"""
跨模块引用系统 - 业务服务层（world_links 适配层）

Phase 1 决策 D1：world_links 承接旧 bidirectional_relations，回填后旧表只读、不双写。
本模块保留旧 /relations 接口的全部服务签名与返回形状，内部实现改为：
- 写入：LinkService.create_link / update_link / delete_link，只写契约 §4 白名单类型
- 读取：WorldLink -> 旧 RelationResponse（旧名称与旧枚举从 meta 回读，缺失时尽力反查）
- 旧表 bidirectional_relations 只读，本模块不再插入/更新/删除
"""

from typing import Any, Dict, List, Optional, TypedDict

from sqlalchemy import or_
from sqlalchemy.orm import Session, object_session

from app.core.logging import get_logger
from app.models import (
    Project,
    World,
    WorldLink,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
)
from app.schemas.relation import (
    DiscoveredRelation,
    EntityReference,
    ModuleType,
    RelationCreate,
    RelationDiscoveryResponse,
    RelationNetworkResponse,
    RelationResponse,
    RelationStatistics,
    RelationType,
    RelationUpdate,
    StrengthType,
)
from app.services.link_registry import get_link_type, validate_link_type
from app.services.link_service import LinkService, resolve_project_world

logger = get_logger(__name__)


class DiscoveryRule(TypedDict):
    """关联发现规则类型定义"""

    id: str
    name: str
    source_module: ModuleType
    target_module: ModuleType
    relation_type: RelationType
    description: str
    confidence: float


# 旧 relation_type -> 契约 §4 具体类型（仅当源/目标 kind 也通过校验时才使用）
LEGACY_RELATION_TYPE_MAP: Dict[str, str] = {
    "causal": "history.causes",
    "dependency": "economy.requires",
    "hierarchical": "politics.subordinate_to",
}

# 反查映射：没有专门映射的 link_type 一律读作 functional
LINK_TYPE_TO_LEGACY_RELATION_TYPE: Dict[str, str] = {
    "history.causes": RelationType.CAUSAL.value,
    "economy.requires": RelationType.DEPENDENCY.value,
    "politics.subordinate_to": RelationType.HIERARCHICAL.value,
}

# 降级用的通用类型（契约 §4.1）
GENERAL_SYMMETRIC_LINK_TYPE = "core.related_to"
GENERAL_DIRECTED_LINK_TYPE = "core.references"

LEGACY_RELATION_TYPES = {item.value for item in RelationType}
LEGACY_STRENGTHS = {item.value for item in StrengthType}

# 适配层记账键：写入 meta 时最后覆盖，客户端 metadata 不得覆盖或删除
RESERVED_META_KEYS = (
    "legacyRelationType",
    "strength",
    "legacySourceName",
    "legacyTargetName",
    "projectId",
)


# 预置关联发现规则
# 基于模块间的语义关系定义，用于推荐潜在关联
DISCOVERY_RULES: List[DiscoveryRule] = [
    {
        "id": "history-politics-causal",
        "name": "历史-政治因果关联",
        "source_module": ModuleType.HISTORY,
        "target_module": ModuleType.POLITICS,
        "relation_type": RelationType.CAUSAL,
        "description": "历史事件与政治实体之间的因果关系",
        "confidence": 0.9,
    },
    {
        "id": "history-economy-functional",
        "name": "历史-经济功能关联",
        "source_module": ModuleType.HISTORY,
        "target_module": ModuleType.ECONOMY,
        "relation_type": RelationType.FUNCTIONAL,
        "description": "历史事件对经济活动的影响",
        "confidence": 0.7,
    },
    {
        "id": "politics-economy-hierarchical",
        "name": "政治-经济层级关联",
        "source_module": ModuleType.POLITICS,
        "target_module": ModuleType.ECONOMY,
        "relation_type": RelationType.HIERARCHICAL,
        "description": "政治体制与经济体系的层级关系",
        "confidence": 0.8,
    },
    {
        "id": "map-history-spatial",
        "name": "地图-历史空间关联",
        "source_module": ModuleType.MAP,
        "target_module": ModuleType.HISTORY,
        "relation_type": RelationType.SPATIAL,
        "description": "地理位置与历史事件的空间关系",
        "confidence": 0.75,
    },
    {
        "id": "races-history-temporal",
        "name": "种族-历史时间关联",
        "source_module": ModuleType.RACES,
        "target_module": ModuleType.HISTORY,
        "relation_type": RelationType.TEMPORAL,
        "description": "种族起源与历史时代的时间关系",
        "confidence": 0.7,
    },
    {
        "id": "systems-history-dependency",
        "name": "体系-历史依赖关联",
        "source_module": ModuleType.SYSTEMS,
        "target_module": ModuleType.HISTORY,
        "relation_type": RelationType.DEPENDENCY,
        "description": "修炼体系或魔法体系与历史的依赖关系",
        "confidence": 0.65,
    },
]


class RelationService:
    """关联关系业务服务类（旧接口签名 + world_links 实现）"""

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------

    @staticmethod
    def _project_world_ids(db: Session, project_id: str) -> List[str]:
        """项目下所有世界的 id（一个项目可能有多个世界）。"""

        worlds = db.query(World).filter(World.project_id == project_id).all()
        return [world.id for world in worlds]

    @staticmethod
    def _link_in_project(db: Session, link: WorldLink, project_id: str) -> bool:
        """关联所属世界是否属于该项目（用于旧接口的 project_id 校验）。"""

        world = db.query(World).filter(World.id == link.world_id).first()
        return world is not None and world.project_id == project_id

    @staticmethod
    def _resolve_link_type(
        relation_type: str,
        source_module: str,
        source_kind: str,
        target_module: str,
        target_kind: str,
        bidirectional: bool,
    ) -> str:
        """选择契约 §4 类型：对称优先，其次语义映射，最后降级通用类型。

        - bidirectional=True：一律 core.related_to（与 P1-MIG-05 回填口径一致，
          对称标志必须能读回，对称边也只落一条）
        - bidirectional=False：先试 causal/dependency/hierarchical 的映射类型，
          校验不过或没有映射时用 core.references
        """

        if bidirectional:
            return GENERAL_SYMMETRIC_LINK_TYPE
        candidate = LEGACY_RELATION_TYPE_MAP.get(relation_type)
        if candidate is not None:
            ok, _ = validate_link_type(
                candidate, source_module, source_kind, target_module, target_kind
            )
            if ok:
                return candidate
        return GENERAL_DIRECTED_LINK_TYPE

    @staticmethod
    def _build_meta(relation_data: RelationCreate) -> Dict[str, Any]:
        """客户端 metadata + 适配层记账键（记账键最后写入，不可被覆盖）。"""

        meta: Dict[str, Any] = {}
        if isinstance(relation_data.metadata, dict):
            meta.update(relation_data.metadata)
        meta.update(
            {
                "legacyRelationType": relation_data.relation_type.value,
                "strength": relation_data.strength.value,
                "legacySourceName": relation_data.source_entity_name,
                "legacyTargetName": relation_data.target_entity_name,
                "projectId": relation_data.project_id,
            }
        )
        return meta

    @staticmethod
    def _lookup_entity_name(
        db: Optional[Session], module: str, entity_id: str
    ) -> Optional[str]:
        """尽力从子模块/模块项反查名称（经 /links 写入的关联没有 legacy 名称）。"""

        if db is None or not entity_id:
            return None
        name = (
            db.query(WorldSubmodule.name)
            .join(WorldModule, WorldSubmodule.module_id == WorldModule.id)
            .filter(
                WorldSubmodule.id == entity_id,
                WorldModule.module_type == module,
            )
            .scalar()
        )
        if name:
            return str(name)
        item_name = (
            db.query(WorldModuleItem.name)
            .join(WorldModule, WorldModuleItem.module_id == WorldModule.id)
            .filter(
                WorldModuleItem.id == entity_id,
                WorldModule.module_type == module,
            )
            .scalar()
        )
        if item_name:
            return str(item_name)
        return None

    @staticmethod
    def _link_endpoint_name(
        db: Optional[Session], link: WorldLink, is_source: bool
    ) -> str:
        """端点显示名：meta 记账名 -> 数据库反查 -> 实体 id。"""

        meta = link.meta if isinstance(link.meta, dict) else {}
        key = "legacySourceName" if is_source else "legacyTargetName"
        name = meta.get(key)
        if name:
            return str(name)
        module = link.source_module if is_source else link.target_module
        entity_id = link.source_id if is_source else link.target_id
        looked_up = RelationService._lookup_entity_name(db, module, entity_id)
        if looked_up:
            return looked_up
        return str(entity_id)

    @staticmethod
    def _legacy_relation_type(link: WorldLink) -> str:
        """world_links 行 -> 旧 relation_type 枚举值。"""

        meta = link.meta if isinstance(link.meta, dict) else {}
        legacy = meta.get("legacyRelationType")
        if legacy in LEGACY_RELATION_TYPES:
            return str(legacy)
        return LINK_TYPE_TO_LEGACY_RELATION_TYPE.get(
            link.link_type, RelationType.FUNCTIONAL.value
        )

    @staticmethod
    def _legacy_strength(link: WorldLink) -> str:
        """旧 strength 枚举值，缺失或非法时回退 medium。"""

        meta = link.meta if isinstance(link.meta, dict) else {}
        strength = meta.get("strength")
        if strength in LEGACY_STRENGTHS:
            return str(strength)
        return StrengthType.MEDIUM.value

    @staticmethod
    def _safe_module(module: str) -> ModuleType:
        """旧 EntityReference 只认识 7 个世界观模块；其他模块归入 special。"""

        try:
            return ModuleType(module)
        except ValueError:
            return ModuleType.SPECIAL

    @staticmethod
    def _create_link(db: Session, relation_data: RelationCreate) -> WorldLink:
        """核心写入：旧 RelationCreate -> world_links 行（重复时返回已存在的行）。"""

        project = (
            db.query(Project).filter(Project.id == relation_data.project_id).first()
        )
        if project is None:
            # API 层 verify_project_exists 已先返回 404，这里保护直接调用方
            raise ValueError(f"Project {relation_data.project_id} not found")

        world = resolve_project_world(db, relation_data.project_id)
        link_type = RelationService._resolve_link_type(
            relation_data.relation_type.value,
            relation_data.source_module.value,
            relation_data.source_entity_type,
            relation_data.target_module.value,
            relation_data.target_entity_type,
            relation_data.bidirectional,
        )
        source = {
            "module": relation_data.source_module.value,
            "kind": relation_data.source_entity_type,
            "id": relation_data.source_entity_id,
        }
        target = {
            "module": relation_data.target_module.value,
            "kind": relation_data.target_entity_type,
            "id": relation_data.target_entity_id,
        }

        # 已存在等价关联时返回既有行而不是抛错：旧接口「重复即返回已有」的语义，
        # 对称关联（directed=False）正反向都算同一条，避免产生第二条对称边。
        existing = LinkService.find_duplicate(db, world.id, source, target, link_type)
        if existing is not None:
            logger.warning(f"Relation already exists as world link: {existing.id}")
            return existing

        # directed 由注册表按 link_type 决定（LinkService.create_link 内部完成），
        # 不采信客户端的 bidirectional 作为 directed。
        return LinkService.create_link(
            db,
            world.id,
            {
                "source": source,
                "target": target,
                "link_type": link_type,
                "label": None,
                "note": None,
                "meta": RelationService._build_meta(relation_data),
                "time": None,
            },
        )

    # ------------------------------------------------------------------
    # 写操作
    # ------------------------------------------------------------------

    @staticmethod
    def create_relation(
        db: Session, relation_data: RelationCreate, auto_commit: bool = True
    ) -> RelationResponse:
        """
        创建单个关联关系（写入 world_links）

        Args:
            db: 数据库会话
            relation_data: 关联创建数据
            auto_commit: 是否自动提交事务。底层 LinkService.create_link 每条自行提交，
                因此 False 只表示「调用方随后会提交」，不再保证仅 flush 的旧语义。

        Returns:
            创建的关联响应（如果已存在等价关联则返回已存在的那条）
        """
        logger.info(
            f"Creating world link: "
            f"{relation_data.source_entity_name} -> {relation_data.target_entity_name}"
        )

        link = RelationService._create_link(db, relation_data)
        if auto_commit:
            logger.info(f"Created relation: {link.id}")
        return RelationService._to_relation_response(link)

    @staticmethod
    def batch_create_relations(
        db: Session, relations_data: List[RelationCreate]
    ) -> List[RelationResponse]:
        """
        批量创建关联关系

        Args:
            db: 数据库会话
            relations_data: 关联创建数据列表

        Returns:
            创建的关联响应列表（含重复时返回的既有行）

        说明：LinkService.create_link 每条自行提交，无法做到严格「全有全无」；
        失败时仍会回滚当前会话并抛出，由 API 层转成错误响应。
        """
        logger.info(f"Batch creating {len(relations_data)} relations")

        created: List[RelationResponse] = []
        try:
            for relation_data in relations_data:
                relation = RelationService.create_relation(
                    db, relation_data, auto_commit=False
                )
                created.append(relation)
            db.commit()
            logger.info(f"Batch created {len(created)} relations")
        except Exception as e:
            db.rollback()
            logger.error(f"Batch create failed, rolled back: {e}")
            raise

        return created

    @staticmethod
    def update_relation(
        db: Session,
        relation_id: str,
        update_data: RelationUpdate,
        project_id: Optional[str] = None,
    ) -> Optional[RelationResponse]:
        """
        更新关联关系（只改 world_links 上的语义字段）

        Args:
            db: 数据库会话
            relation_id: 关联ID
            update_data: 更新数据
            project_id: 可选的项目ID验证

        Returns:
            更新后的关联响应，不存在则返回None
        """
        link = LinkService.get_link(db, relation_id)
        if link is None:
            return None
        if project_id and not RelationService._link_in_project(db, link, project_id):
            return None

        meta = dict(link.meta) if isinstance(link.meta, dict) else {}
        link_type = link.link_type
        directed = bool(link.directed)

        if update_data.relation_type is not None:
            meta["legacyRelationType"] = update_data.relation_type.value
        new_relation_type = meta.get("legacyRelationType")
        if new_relation_type not in LEGACY_RELATION_TYPES:
            new_relation_type = RelationService._legacy_relation_type(link)

        bidirectional = (
            update_data.bidirectional
            if update_data.bidirectional is not None
            else not directed
        )

        if (
            update_data.relation_type is not None
            or update_data.bidirectional is not None
        ):
            # 与写入同一套规则：显式 bidirectional=True 落对称通用类型，
            # False 时按新旧 relation_type 重新映射（客户端显式翻转必须生效）
            link_type = RelationService._resolve_link_type(
                str(new_relation_type),
                link.source_module,
                link.source_kind,
                link.target_module,
                link.target_kind,
                bool(bidirectional),
            )
            definition = get_link_type(link_type)
            directed = bool(definition.directed) if definition is not None else True

        if update_data.strength is not None:
            meta["strength"] = update_data.strength.value

        if update_data.metadata is not None:
            # 合并元数据而非完全替换（旧行为）；记账键不允许被客户端覆盖或删除
            merged = {k: v for k, v in meta.items() if k not in RESERVED_META_KEYS}
            merged.update(update_data.metadata)
            for key in RESERVED_META_KEYS:
                if key in meta:
                    merged[key] = meta[key]
            meta = merged

        link.link_type = link_type
        link.directed = directed
        LinkService.update_link(db, link, {"meta": meta})
        logger.info(f"Updated relation: {relation_id}")
        return RelationService._to_relation_response(link)

    @staticmethod
    def delete_relation(
        db: Session, relation_id: str, project_id: Optional[str] = None
    ) -> bool:
        """
        删除关联关系

        Args:
            db: 数据库会话
            relation_id: 关联ID
            project_id: 可选的项目ID验证

        Returns:
            是否成功删除
        """
        link = LinkService.get_link(db, relation_id)
        if link is None:
            return False
        if project_id and not RelationService._link_in_project(db, link, project_id):
            return False

        LinkService.delete_link(db, link)
        logger.info(f"Deleted relation: {relation_id}")
        return True

    # ------------------------------------------------------------------
    # 读操作
    # ------------------------------------------------------------------

    @staticmethod
    def get_relation_by_id(db: Session, relation_id: str) -> Optional[RelationResponse]:
        """根据ID获取关联关系（world_links 行 -> 旧响应形状）"""

        link = LinkService.get_link(db, relation_id)
        if link is None:
            return None
        return RelationService._to_relation_response(link)

    @staticmethod
    def _to_relation_response(rel: WorldLink) -> RelationResponse:
        """将 world_links 行转换为旧响应Schema（保持原有单参数签名）"""

        session = object_session(rel)
        world = None
        if session is not None and rel.world_id:
            world = session.query(World).filter(World.id == rel.world_id).first()
        meta = rel.meta if isinstance(rel.meta, dict) else {}

        project_id = None
        if world is not None and world.project_id:
            project_id = world.project_id
        if not project_id:
            project_id = meta.get("projectId") or ""

        extra_meta = {
            key: value for key, value in meta.items() if key not in RESERVED_META_KEYS
        }

        return RelationResponse(
            id=rel.id,
            source_module=rel.source_module,
            source_entity_type=rel.source_kind,
            source_entity_id=rel.source_id,
            source_entity_name=RelationService._link_endpoint_name(session, rel, True),
            target_module=rel.target_module,
            target_entity_type=rel.target_kind,
            target_entity_id=rel.target_id,
            target_entity_name=RelationService._link_endpoint_name(session, rel, False),
            relation_type=RelationService._legacy_relation_type(rel),
            bidirectional=not bool(rel.directed),
            strength=RelationService._legacy_strength(rel),
            metadata_json=extra_meta or None,
            project_id=str(project_id),
            created_at=rel.created_at,
            updated_at=rel.updated_at,
        )

    @staticmethod
    def get_entity_relation_network(
        db: Session,
        project_id: str,
        entity_id: str,
        module_filter: Optional[str] = None,
    ) -> RelationNetworkResponse:
        """
        获取实体的关联网络

        返回指定实体的所有关联关系，按方向分类（入向、出向、双向）。

        Args:
            db: 数据库会话
            project_id: 项目ID
            entity_id: 实体ID
            module_filter: 可选的模块过滤

        Returns:
            实体关联网络响应

        分类规则：对称关联（directed=False）只进 bidirectional；
        有向关联按「实体是源/目标是源」分别进 outgoing / incoming。
        """

        world_ids = RelationService._project_world_ids(db, project_id)
        relations: List[WorldLink] = []
        if world_ids:
            query = db.query(WorldLink).filter(
                WorldLink.world_id.in_(world_ids),
                or_(
                    WorldLink.source_id == entity_id,
                    WorldLink.target_id == entity_id,
                ),
            )
            if module_filter:
                query = query.filter(
                    or_(
                        WorldLink.source_module == module_filter,
                        WorldLink.target_module == module_filter,
                    )
                )
            relations = query.order_by(WorldLink.created_at, WorldLink.id).all()

        incoming: List[RelationResponse] = []
        outgoing: List[RelationResponse] = []
        bidirectional: List[RelationResponse] = []
        entity_ref: Optional[EntityReference] = None

        for rel in relations:
            rel_response = RelationService._to_relation_response(rel)
            is_source = rel.source_id == entity_id
            is_target = rel.target_id == entity_id

            if not rel.directed:
                bidirectional.append(rel_response)
            elif is_source:
                outgoing.append(rel_response)
            elif is_target:
                incoming.append(rel_response)

            if entity_ref is None:
                if is_source:
                    entity_ref = EntityReference(
                        module=RelationService._safe_module(rel.source_module),
                        entity_type=rel.source_kind,
                        entity_id=rel.source_id,
                        entity_name=rel_response.source_entity_name,
                    )
                elif is_target:
                    entity_ref = EntityReference(
                        module=RelationService._safe_module(rel.target_module),
                        entity_type=rel.target_kind,
                        entity_id=rel.target_id,
                        entity_name=rel_response.target_entity_name,
                    )

        # 如果实体没有关联，创建默认引用
        if entity_ref is None:
            entity_ref = EntityReference(
                module=ModuleType.HISTORY,
                entity_type="unknown",
                entity_id=entity_id,
                entity_name="Unknown Entity",
            )

        return RelationNetworkResponse(
            entity=entity_ref,
            incoming=incoming,
            outgoing=outgoing,
            bidirectional=bidirectional,
            total_count=len(relations),
        )

    @staticmethod
    def discover_relations(
        db: Session,
        project_id: str,
        entity_id: str,
        module: ModuleType,
        entity_type: str,
        entity_name: str,
    ) -> RelationDiscoveryResponse:
        """
        发现潜在关联关系

        基于预置规则，从项目现有实体中推荐可能存在的关联。
        排除已存在的关联。

        Args:
            db: 数据库会话
            project_id: 项目ID
            entity_id: 实体ID
            module: 实体所属模块
            entity_type: 实体类型
            entity_name: 实体名称

        Returns:
            关联发现响应，包含推荐列表
        """
        logger.info(f"Discovering relations for entity: {entity_id} ({module.value})")

        world_ids = RelationService._project_world_ids(db, project_id)

        # 获取已存在的关联
        existing_relations: List[WorldLink] = []
        if world_ids:
            existing_relations = (
                db.query(WorldLink)
                .filter(
                    WorldLink.world_id.in_(world_ids),
                    or_(
                        WorldLink.source_id == entity_id,
                        WorldLink.target_id == entity_id,
                    ),
                )
                .all()
            )

        # 构建已存在关联的集合，用于去重
        existing_set = set()
        for rel in existing_relations:
            legacy_type = RelationService._legacy_relation_type(rel)
            existing_set.add((rel.source_id, rel.target_id, legacy_type))
            if not rel.directed:
                existing_set.add((rel.target_id, rel.source_id, legacy_type))

        discoveries: List[DiscoveredRelation] = []
        discovery_keys: set = set()  # 用于去重

        # 遍历发现规则，查找潜在关联
        for rule in DISCOVERY_RULES:
            source_mod = rule["source_module"]
            target_mod = rule["target_module"]

            # 确定当前实体在规则中的角色
            if source_mod == module:
                effective_target: ModuleType = target_mod
            elif target_mod == module:
                effective_target = source_mod
            else:
                continue  # 当前规则不适用

            # 从目标模块中查找相关实体（world_links 中从该模块出发的关联）
            related_relations: List[WorldLink] = []
            if world_ids:
                related_relations = (
                    db.query(WorldLink)
                    .filter(
                        WorldLink.world_id.in_(world_ids),
                        WorldLink.source_module == effective_target.value,
                    )
                    .limit(10)
                    .all()
                )

            for rel in related_relations:
                legacy_type = rule["relation_type"].value
                pair_key = (entity_id, rel.source_id, legacy_type)
                reverse_key = (rel.source_id, entity_id, legacy_type)

                # 去重检查：同一目标实体只推荐一次
                discovery_key = (rel.source_id, legacy_type)

                if (
                    pair_key in existing_set
                    or reverse_key in existing_set
                    or discovery_key in discovery_keys
                ):
                    continue

                # 只推荐能用契约 §4 类型表达的关联（不新造 link_type）
                candidate_link_type = RelationService._resolve_link_type(
                    legacy_type,
                    module.value,
                    entity_type,
                    effective_target.value,
                    rel.source_kind,
                    False,
                )
                ok, _ = validate_link_type(
                    candidate_link_type,
                    module.value,
                    entity_type,
                    effective_target.value,
                    rel.source_kind,
                )
                if not ok:
                    continue

                discovery_keys.add(discovery_key)
                discovery = DiscoveredRelation(
                    source_module=module,
                    source_entity_type=entity_type,
                    source_entity_id=entity_id,
                    source_entity_name=entity_name,
                    target_module=effective_target,
                    target_entity_type=rel.source_kind,
                    target_entity_id=rel.source_id,
                    target_entity_name=RelationService._link_endpoint_name(
                        db, rel, True
                    ),
                    relation_type=rule["relation_type"],
                    strength=StrengthType.MEDIUM,
                    confidence=rule["confidence"],
                    reason=rule["description"],
                )
                discoveries.append(discovery)

        return RelationDiscoveryResponse(
            entity=EntityReference(
                module=module,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_name=entity_name,
            ),
            discoveries=discoveries,
            total_count=len(discoveries),
        )

    @staticmethod
    def get_project_relations(
        db: Session,
        project_id: str,
        source_module: Optional[str] = None,
        target_module: Optional[str] = None,
        relation_type: Optional[str] = None,
    ) -> List[RelationResponse]:
        """
        获取项目的所有关联关系

        支持按源模块、目标模块、关系类型过滤。

        Args:
            db: 数据库会话
            project_id: 项目ID
            source_module: 源模块过滤
            target_module: 目标模块过滤
            relation_type: 关系类型过滤（旧枚举值）

        Returns:
            关联响应列表
        """
        world_ids = RelationService._project_world_ids(db, project_id)
        if not world_ids:
            return []

        query = db.query(WorldLink).filter(WorldLink.world_id.in_(world_ids))

        if source_module:
            query = query.filter(WorldLink.source_module == source_module)
        if target_module:
            query = query.filter(WorldLink.target_module == target_module)

        links = query.order_by(WorldLink.created_at.desc(), WorldLink.id).all()
        relations = [RelationService._to_relation_response(link) for link in links]

        if relation_type:
            # 旧枚举 -> link_type 的反查规则集中在一处，这里在内存里对齐旧过滤语义
            relations = [
                relation
                for relation in relations
                if relation.relation_type == relation_type
            ]

        return relations

    @staticmethod
    def get_relation_statistics(db: Session, project_id: str) -> RelationStatistics:
        """
        获取项目关联统计信息

        Args:
            db: 数据库会话
            project_id: 项目ID

        Returns:
            关联统计信息
        """

        world_ids = RelationService._project_world_ids(db, project_id)
        links: List[WorldLink] = []
        if world_ids:
            links = db.query(WorldLink).filter(WorldLink.world_id.in_(world_ids)).all()

        by_module: Dict[str, int] = {}
        by_relation_type: Dict[str, int] = {}
        by_strength: Dict[str, int] = {}
        bidirectional_count = 0
        cross_module = 0
        connections: Dict[tuple, int] = {}
        names: Dict[tuple, str] = {}

        for link in links:
            if not link.directed:
                bidirectional_count += 1
            if link.source_module != link.target_module:
                cross_module += 1

            by_module[link.source_module] = by_module.get(link.source_module, 0) + 1

            legacy_type = RelationService._legacy_relation_type(link)
            by_relation_type[legacy_type] = by_relation_type.get(legacy_type, 0) + 1

            strength = RelationService._legacy_strength(link)
            by_strength[strength] = by_strength.get(strength, 0) + 1

            key = (link.source_module, link.source_id)
            connections[key] = connections.get(key, 0) + 1
            if key not in names:
                names[key] = RelationService._link_endpoint_name(db, link, True)

        # 连接最多的实体（Top 10）
        top_connected = [
            {
                "entity_id": entity_id,
                "entity_name": names[key],
                "module": module,
                "connection_count": count,
            }
            for (module, entity_id), count in sorted(
                connections.items(), key=lambda item: (-item[1], item[0])
            )
        ][:10]

        return RelationStatistics(
            total_relations=len(links),
            bidirectional_count=bidirectional_count,
            by_module=by_module,
            by_relation_type=by_relation_type,
            by_strength=by_strength,
            cross_module_relations=cross_module,
            top_connected_entities=top_connected,
        )

    # ------------------------------------------------------------------
    # 实体校验
    # ------------------------------------------------------------------

    @staticmethod
    def verify_entity_exists(
        db: Session,
        module: ModuleType,
        entity_type: str,
        entity_id: str,
        project_id: str,
    ) -> bool:
        """
        验证实体是否真实存在

        根据模块类型查询对应的实体表。

        Args:
            db: 数据库会话
            module: 模块类型
            entity_type: 实体类型
            entity_id: 实体ID
            project_id: 项目ID

        Returns:
            实体是否存在
        """
        try:
            if module in (
                ModuleType.MAP,
                ModuleType.HISTORY,
                ModuleType.POLITICS,
                ModuleType.ECONOMY,
                ModuleType.RACES,
                ModuleType.SYSTEMS,
                ModuleType.SPECIAL,
            ):
                # 世界观实体既可能是子模块（event/polity/...）也可能是模块项
                submodule = (
                    db.query(WorldSubmodule)
                    .filter(WorldSubmodule.id == entity_id)
                    .first()
                )
                if submodule is not None:
                    return True
                exists = (
                    db.query(WorldModuleItem)
                    .filter(
                        WorldModuleItem.id == entity_id,
                    )
                    .first()
                )
                return exists is not None
            else:
                # 其他模块类型暂未支持验证
                logger.warning(f"Entity validation not supported for module: {module}")
                return True
        except Exception as e:
            logger.error(f"Entity verification failed: {e}")
            return False

    @staticmethod
    def validate_relation_entities(
        db: Session, relation_data: RelationCreate
    ) -> tuple[bool, str]:
        """
        验证关联的源实体和目标实体是否都存在

        Args:
            db: 数据库会话
            relation_data: 关联创建数据

        Returns:
            (是否验证通过, 错误信息)
        """
        # 验证源实体
        source_exists = RelationService.verify_entity_exists(
            db,
            relation_data.source_module,
            relation_data.source_entity_type,
            relation_data.source_entity_id,
            relation_data.project_id,
        )
        if not source_exists:
            return False, f"Source entity not found: {relation_data.source_entity_name}"

        # 验证目标实体
        target_exists = RelationService.verify_entity_exists(
            db,
            relation_data.target_module,
            relation_data.target_entity_type,
            relation_data.target_entity_id,
            relation_data.project_id,
        )
        if not target_exists:
            return False, f"Target entity not found: {relation_data.target_entity_name}"

        return True, ""
