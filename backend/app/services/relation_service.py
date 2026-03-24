"""
跨模块引用系统 - 业务服务层

提供关联关系的CRUD操作和智能发现功能。
"""

import uuid
from typing import List, Optional, TypedDict

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models import BidirectionalRelation, WorldModuleItem
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
    """关联关系业务服务类"""

    @staticmethod
    def create_relation(
        db: Session, relation_data: RelationCreate, auto_commit: bool = True
    ) -> BidirectionalRelation:
        """
        创建单个关联关系

        Args:
            db: 数据库会话
            relation_data: 关联创建数据
            auto_commit: 是否自动提交事务

        Returns:
            创建的关联对象（如果已存在则返回已存在的）
        """
        logger.info(
            f"Creating bidirectional relation: "
            f"{relation_data.source_entity_name} -> {relation_data.target_entity_name}"
        )

        # 检查是否已存在相同关联（包括反向）
        existing = (
            db.query(BidirectionalRelation)
            .filter(
                or_(
                    and_(
                        BidirectionalRelation.source_entity_id
                        == relation_data.source_entity_id,
                        BidirectionalRelation.target_entity_id
                        == relation_data.target_entity_id,
                        BidirectionalRelation.relation_type
                        == relation_data.relation_type.value,
                    ),
                    and_(
                        BidirectionalRelation.source_entity_id
                        == relation_data.target_entity_id,
                        BidirectionalRelation.target_entity_id
                        == relation_data.source_entity_id,
                        BidirectionalRelation.relation_type
                        == relation_data.relation_type.value,
                    ),
                )
            )
            .first()
        )

        if existing:
            logger.warning(f"Relation already exists: {existing.id}")
            return existing

        # 创建新关联
        relation = BidirectionalRelation(
            id=str(uuid.uuid4()),
            source_module=relation_data.source_module.value,
            source_entity_type=relation_data.source_entity_type,
            source_entity_id=relation_data.source_entity_id,
            source_entity_name=relation_data.source_entity_name,
            target_module=relation_data.target_module.value,
            target_entity_type=relation_data.target_entity_type,
            target_entity_id=relation_data.target_entity_id,
            target_entity_name=relation_data.target_entity_name,
            relation_type=relation_data.relation_type.value,
            bidirectional=relation_data.bidirectional,
            strength=relation_data.strength.value,
            metadata_json=relation_data.metadata,
            project_id=relation_data.project_id,
        )

        db.add(relation)
        if auto_commit:
            db.commit()
            db.refresh(relation)
            logger.info(f"Created relation: {relation.id}")
        else:
            db.flush()

        return relation

    @staticmethod
    def batch_create_relations(
        db: Session, relations_data: List[RelationCreate]
    ) -> List[BidirectionalRelation]:
        """
        批量创建关联关系

        使用事务确保原子性，失败时回滚所有操作。

        Args:
            db: 数据库会话
            relations_data: 关联创建数据列表

        Returns:
            创建的关联对象列表
        """
        logger.info(f"Batch creating {len(relations_data)} relations")

        created = []
        try:
            for relation_data in relations_data:
                relation = RelationService.create_relation(
                    db, relation_data, auto_commit=False
                )
                created.append(relation)
            db.commit()
            for relation in created:
                db.refresh(relation)
            logger.info(f"Batch created {len(created)} relations")
        except Exception as e:
            db.rollback()
            logger.error(f"Batch create failed, rolled back: {e}")
            raise

        return created

    @staticmethod
    def get_relation_by_id(
        db: Session, relation_id: str
    ) -> Optional[BidirectionalRelation]:
        """根据ID获取关联关系"""
        return (
            db.query(BidirectionalRelation)
            .filter(BidirectionalRelation.id == relation_id)
            .first()
        )

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
        query = db.query(BidirectionalRelation).filter(
            BidirectionalRelation.id == relation_id
        )
        if project_id:
            query = query.filter(BidirectionalRelation.project_id == project_id)

        relation = query.first()
        if not relation:
            return False

        db.delete(relation)
        db.commit()
        logger.info(f"Deleted relation: {relation_id}")
        return True

    @staticmethod
    def _to_relation_response(rel: BidirectionalRelation) -> RelationResponse:
        """将模型对象转换为响应Schema"""
        return RelationResponse(
            id=rel.id,
            source_module=rel.source_module,
            source_entity_type=rel.source_entity_type,
            source_entity_id=rel.source_entity_id,
            source_entity_name=rel.source_entity_name,
            target_module=rel.target_module,
            target_entity_type=rel.target_entity_type,
            target_entity_id=rel.target_entity_id,
            target_entity_name=rel.target_entity_name,
            relation_type=rel.relation_type,
            bidirectional=rel.bidirectional,
            strength=rel.strength,
            metadata_json=rel.metadata_json,
            project_id=rel.project_id,
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
        """
        query = db.query(BidirectionalRelation).filter(
            BidirectionalRelation.project_id == project_id,
            or_(
                BidirectionalRelation.source_entity_id == entity_id,
                BidirectionalRelation.target_entity_id == entity_id,
            ),
        )

        if module_filter:
            query = query.filter(
                or_(
                    BidirectionalRelation.source_module == module_filter,
                    BidirectionalRelation.target_module == module_filter,
                )
            )

        relations = query.all()

        incoming: List[RelationResponse] = []
        outgoing: List[RelationResponse] = []
        bidirectional: List[RelationResponse] = []
        entity_ref: Optional[EntityReference] = None

        for rel in relations:
            rel_response = RelationService._to_relation_response(rel)

            if rel.source_entity_id == entity_id:
                outgoing.append(rel_response)
                if entity_ref is None:
                    entity_ref = EntityReference(
                        module=ModuleType(rel.source_module),
                        entity_type=rel.source_entity_type,
                        entity_id=rel.source_entity_id,
                        entity_name=rel.source_entity_name,
                    )
            elif rel.target_entity_id == entity_id:
                incoming.append(rel_response)
                if entity_ref is None:
                    entity_ref = EntityReference(
                        module=ModuleType(rel.target_module),
                        entity_type=rel.target_entity_type,
                        entity_id=rel.target_entity_id,
                        entity_name=rel.target_entity_name,
                    )

            if rel.bidirectional:
                bidirectional.append(rel_response)

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

        # 获取已存在的关联
        existing_relations = (
            db.query(BidirectionalRelation)
            .filter(
                BidirectionalRelation.project_id == project_id,
                or_(
                    BidirectionalRelation.source_entity_id == entity_id,
                    BidirectionalRelation.target_entity_id == entity_id,
                ),
            )
            .all()
        )

        # 构建已存在关联的集合，用于去重
        existing_set = set()
        for rel in existing_relations:
            existing_set.add(
                (rel.source_entity_id, rel.target_entity_id, rel.relation_type)
            )
            if rel.bidirectional:
                existing_set.add(
                    (rel.target_entity_id, rel.source_entity_id, rel.relation_type)
                )

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

            # 从目标模块中查找相关实体
            related_relations = (
                db.query(BidirectionalRelation)
                .filter(
                    BidirectionalRelation.project_id == project_id,
                    BidirectionalRelation.source_module == effective_target.value,
                )
                .limit(10)
                .all()
            )

            for rel in related_relations:
                # 检查是否已存在该关联
                pair_key = (
                    entity_id,
                    rel.source_entity_id,
                    rule["relation_type"].value,
                )
                reverse_key = (
                    rel.source_entity_id,
                    entity_id,
                    rule["relation_type"].value,
                )

                # 去重检查：同一目标实体只推荐一次
                discovery_key = (rel.source_entity_id, rule["relation_type"].value)

                if (
                    pair_key not in existing_set
                    and reverse_key not in existing_set
                    and discovery_key not in discovery_keys
                ):
                    discovery_keys.add(discovery_key)
                    discovery = DiscoveredRelation(
                        source_module=module,
                        source_entity_type=entity_type,
                        source_entity_id=entity_id,
                        source_entity_name=entity_name,
                        target_module=effective_target,
                        target_entity_type=rel.source_entity_type,
                        target_entity_id=rel.source_entity_id,
                        target_entity_name=rel.source_entity_name,
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
            relation_type: 关系类型过滤

        Returns:
            关联响应列表
        """
        query = db.query(BidirectionalRelation).filter(
            BidirectionalRelation.project_id == project_id
        )

        if source_module:
            query = query.filter(BidirectionalRelation.source_module == source_module)
        if target_module:
            query = query.filter(BidirectionalRelation.target_module == target_module)
        if relation_type:
            query = query.filter(BidirectionalRelation.relation_type == relation_type)

        relations = query.order_by(BidirectionalRelation.created_at.desc()).all()

        return [RelationService._to_relation_response(rel) for rel in relations]

    @staticmethod
    def update_relation(
        db: Session,
        relation_id: str,
        update_data: RelationUpdate,
        project_id: Optional[str] = None,
    ) -> Optional[BidirectionalRelation]:
        """
        更新关联关系

        Args:
            db: 数据库会话
            relation_id: 关联ID
            update_data: 更新数据
            project_id: 可选的项目ID验证

        Returns:
            更新后的关联对象，不存在则返回None
        """
        query = db.query(BidirectionalRelation).filter(
            BidirectionalRelation.id == relation_id
        )
        if project_id:
            query = query.filter(BidirectionalRelation.project_id == project_id)

        relation = query.first()
        if not relation:
            return None

        # 只更新提供的字段
        if update_data.relation_type is not None:
            relation.relation_type = update_data.relation_type.value
        if update_data.bidirectional is not None:
            relation.bidirectional = update_data.bidirectional
        if update_data.strength is not None:
            relation.strength = update_data.strength.value
        if update_data.metadata is not None:
            # 合并元数据而非完全替换
            if relation.metadata_json is None:
                relation.metadata_json = {}
            relation.metadata_json.update(update_data.metadata)

        db.commit()
        db.refresh(relation)
        logger.info(f"Updated relation: {relation_id}")
        return relation

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
        from sqlalchemy import func

        # 基础统计
        total = (
            db.query(BidirectionalRelation)
            .filter(BidirectionalRelation.project_id == project_id)
            .count()
        )

        bidirectional_count = (
            db.query(BidirectionalRelation)
            .filter(
                BidirectionalRelation.project_id == project_id,
                BidirectionalRelation.bidirectional.is_(True),
            )
            .count()
        )

        # 按模块统计
        module_stats = (
            db.query(
                BidirectionalRelation.source_module,
                func.count(BidirectionalRelation.id).label("count"),
            )
            .filter(BidirectionalRelation.project_id == project_id)
            .group_by(BidirectionalRelation.source_module)
            .all()
        )
        by_module = {m: c for m, c in module_stats}

        # 按关系类型统计
        type_stats = (
            db.query(
                BidirectionalRelation.relation_type,
                func.count(BidirectionalRelation.id).label("count"),
            )
            .filter(BidirectionalRelation.project_id == project_id)
            .group_by(BidirectionalRelation.relation_type)
            .all()
        )
        by_relation_type = {t: c for t, c in type_stats}

        # 按强度统计
        strength_stats = (
            db.query(
                BidirectionalRelation.strength,
                func.count(BidirectionalRelation.id).label("count"),
            )
            .filter(BidirectionalRelation.project_id == project_id)
            .group_by(BidirectionalRelation.strength)
            .all()
        )
        by_strength = {s: c for s, c in strength_stats}

        # 跨模块关联数（源模块不等于目标模块）
        cross_module = (
            db.query(BidirectionalRelation)
            .filter(
                BidirectionalRelation.project_id == project_id,
                BidirectionalRelation.source_module
                != BidirectionalRelation.target_module,
            )
            .count()
        )

        # 连接最多的实体（Top 10）
        entity_connections = (
            db.query(
                BidirectionalRelation.source_entity_id,
                BidirectionalRelation.source_entity_name,
                BidirectionalRelation.source_module,
                func.count(BidirectionalRelation.id).label("connection_count"),
            )
            .filter(BidirectionalRelation.project_id == project_id)
            .group_by(
                BidirectionalRelation.source_entity_id,
                BidirectionalRelation.source_entity_name,
                BidirectionalRelation.source_module,
            )
            .order_by(func.count(BidirectionalRelation.id).desc())
            .limit(10)
            .all()
        )

        top_connected = [
            {
                "entity_id": eid,
                "entity_name": name,
                "module": module,
                "connection_count": count,
            }
            for eid, name, module, count in entity_connections
        ]

        return RelationStatistics(
            total_relations=total,
            bidirectional_count=bidirectional_count,
            by_module=by_module,
            by_relation_type=by_relation_type,
            by_strength=by_strength,
            cross_module_relations=cross_module,
            top_connected_entities=top_connected,
        )

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
                # 世界观模块实体存储在 WorldModuleItem
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
