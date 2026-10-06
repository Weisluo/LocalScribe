"""WorldLink 服务（契约 §2.5 / §4 / §5）

统一关联存储 world_links 的读写：
- 创建/更新前用 link registry（契约 §4 白名单）校验 link_type 与源/目标 kind
- directed 由 LinkTypeDef 决定，落库冗余
- 对称关联只存一条；查询时按双向匹配
- 删除实体时级联删除其关联
- 归位（P2-T12）：只改 world_id 与 meta 记账键，复用 registry 校验与对称边去重
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import (
    Character,
    World,
    WorldLink,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
)
from app.services.link_registry import get_link_type, validate_link_type
from app.services.world_service import create_world

logger = logging.getLogger(__name__)

# 与 P1-MIG-05 相同的确定性命名空间与容器世界 id 规则（旧接口按项目写关联时复用）
DETERMINISTIC_NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")
CONTAINER_SETTINGS = {"migrationContainer": True}


def resolve_project_world(db: Session, project_id: str) -> World:
    """把「项目」映射到「世界」：

    - 项目下只有一个世界：直接使用
    - 多世界或没有世界：使用确定性迁移容器世界（与 P1-MIG-05 同 id 规则）
    """

    worlds = (
        db.query(World).filter(World.project_id == project_id).order_by(World.id).all()
    )
    if len(worlds) == 1:
        return worlds[0]

    container_id = str(
        uuid.uuid5(DETERMINISTIC_NAMESPACE, f"wbl-p1-05:container:{project_id}")
    )
    container = db.query(World).filter(World.id == container_id).first()
    if container is None:
        # 走 world_service 建世界：容器世界同样遵守契约 §2.2 的七模块不变式
        container = create_world(
            db,
            world_id=container_id,
            name="关联迁移容器",
            description="旧关联无法归属到具体世界时使用的迁移容器（Phase 1）",
            project_id=project_id,
            settings=dict(CONTAINER_SETTINGS, projectId=project_id),
        )
        db.commit()
        db.refresh(container)
    return container


class LinkValidationError(ValueError):
    """link_type 未知或源/目标 kind 不匹配"""


class DuplicateLinkError(Exception):
    """已存在等价关联（对称边或完全重复的边）"""

    def __init__(self, existing_id: str):
        super().__init__(f"关联已存在: {existing_id}")
        self.existing_id = existing_id


class LinkMoveError(ValueError):
    """归位请求不可执行（无法推导世界、已在该世界、跨项目等），映射 400"""


class AlreadyInTargetError(LinkMoveError):
    """关联已位于目标世界，无需归位（映射 400）"""

    code = "already_in_target"


class EndpointWorldConflictError(LinkMoveError):
    """端点分属不同世界且未显式指定目标世界，映射 409"""

    code = "endpoint_world_conflict"


class UnresolvableEndpointError(LinkMoveError):
    """关联两端实体都解析不到，无法推导目标世界（映射 400）"""

    code = "unresolvable_endpoint"


class CharacterWorldAmbiguousError(LinkMoveError):
    """端点含真实角色，而角色是项目级实体、无法唯一归属世界（映射 400）"""

    code = "character_world_ambiguous"


class ForeignLinkTypeError(Exception):
    """批量归位请求中含契约外 link_type（请求级 400，携带出错 link id 供前端定位）"""

    def __init__(self, link_ids: Sequence[str], message: str):
        super().__init__(message)
        self.link_ids = list(link_ids)


class LinkService:
    @staticmethod
    def _require_world(db: Session, world_id: str) -> World:
        world = db.query(World).filter(World.id == world_id).first()
        if world is None:
            raise LookupError(f"世界不存在: {world_id}")
        return world

    @staticmethod
    def _endpoint(source: Dict[str, Any]) -> Dict[str, str]:
        return {
            "source_module": source["module"],
            "source_kind": source["kind"],
            "source_id": source["id"],
        }

    @staticmethod
    def find_duplicate(
        db: Session,
        world_id: str,
        source: Dict[str, Any],
        target: Dict[str, Any],
        link_type: str,
    ) -> Optional[WorldLink]:
        """对称关联正反向任一命中即视为重复；有向关联只比较同向。"""

        definition = get_link_type(link_type)
        same = and_(
            WorldLink.source_module == source["module"],
            WorldLink.source_kind == source["kind"],
            WorldLink.source_id == source["id"],
            WorldLink.target_module == target["module"],
            WorldLink.target_kind == target["kind"],
            WorldLink.target_id == target["id"],
        )
        if definition is not None and not definition.directed:
            reverse = and_(
                WorldLink.source_module == target["module"],
                WorldLink.source_kind == target["kind"],
                WorldLink.source_id == target["id"],
                WorldLink.target_module == source["module"],
                WorldLink.target_kind == source["kind"],
                WorldLink.target_id == source["id"],
            )
            condition = or_(same, reverse)
        else:
            condition = same
        return (
            db.query(WorldLink)
            .filter(
                WorldLink.world_id == world_id,
                WorldLink.link_type == link_type,
                condition,
            )
            .first()
        )

    @staticmethod
    def create_link(db: Session, world_id: str, data: Dict[str, Any]) -> WorldLink:
        LinkService._require_world(db, world_id)

        source = data["source"]
        target = data["target"]
        link_type = data["link_type"]

        ok, error = validate_link_type(
            link_type,
            source["module"],
            source["kind"],
            target["module"],
            target["kind"],
        )
        if not ok:
            raise LinkValidationError(error or "关联类型校验失败")

        existing = LinkService.find_duplicate(db, world_id, source, target, link_type)
        if existing is not None:
            raise DuplicateLinkError(existing.id)

        definition = get_link_type(link_type)
        link = WorldLink(
            world_id=world_id,
            source_module=source["module"],
            source_kind=source["kind"],
            source_id=source["id"],
            target_module=target["module"],
            target_kind=target["kind"],
            target_id=target["id"],
            link_type=link_type,
            directed=bool(definition.directed) if definition else True,
            label=data.get("label"),
            note=data.get("note"),
            meta=data.get("meta"),
            time_range=data.get("time"),
        )
        db.add(link)
        db.commit()
        db.refresh(link)
        return link

    @staticmethod
    def batch_create(
        db: Session, world_id: str, items: Sequence[Dict[str, Any]]
    ) -> List[WorldLink]:
        created: List[WorldLink] = []
        for item in items:
            created.append(LinkService.create_link(db, world_id, item))
        return created

    @staticmethod
    def get_link(db: Session, link_id: str) -> Optional[WorldLink]:
        return db.query(WorldLink).filter(WorldLink.id == link_id).first()

    @staticmethod
    def list_links(
        db: Session,
        world_id: str,
        module: Optional[str] = None,
        entity_id: Optional[str] = None,
        link_type: Optional[str] = None,
        target_module: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> List[WorldLink]:
        query = db.query(WorldLink).filter(WorldLink.world_id == world_id)
        if module and entity_id:
            query = query.filter(
                or_(
                    and_(
                        WorldLink.source_module == module,
                        WorldLink.source_id == entity_id,
                    ),
                    and_(
                        WorldLink.target_module == module,
                        WorldLink.target_id == entity_id,
                    ),
                )
            )
        if link_type:
            query = query.filter(WorldLink.link_type == link_type)
        if target_module:
            query = query.filter(WorldLink.target_module == target_module)
        query = query.order_by(WorldLink.created_at, WorldLink.id)
        if skip:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    @staticmethod
    def update_link(db: Session, link: WorldLink, data: Dict[str, Any]) -> WorldLink:
        if "label" in data:
            link.label = data["label"]
        if "note" in data:
            link.note = data["note"]
        if "meta" in data:
            link.meta = data["meta"]
        if "time" in data:
            link.time_range = data["time"]
        db.commit()
        db.refresh(link)
        return link

    @staticmethod
    def delete_link(db: Session, link: WorldLink) -> None:
        db.delete(link)
        db.commit()

    @staticmethod
    def delete_links_for_entity(
        db: Session,
        world_id: str,
        module: str,
        entity_id: str,
        entity_kind: Optional[str] = None,
    ) -> int:
        """删除实体时级联删除其关联（契约 §2.5：默认级联删除）。"""

        query = db.query(WorldLink).filter(
            WorldLink.world_id == world_id,
            or_(
                and_(
                    WorldLink.source_module == module,
                    WorldLink.source_id == entity_id,
                ),
                and_(
                    WorldLink.target_module == module,
                    WorldLink.target_id == entity_id,
                ),
            ),
        )
        if entity_kind:
            query = query.filter(
                or_(
                    and_(
                        WorldLink.source_module == module,
                        WorldLink.source_kind == entity_kind,
                    ),
                    and_(
                        WorldLink.target_module == module,
                        WorldLink.target_kind == entity_kind,
                    ),
                )
            )
        links = query.all()
        for link in links:
            db.delete(link)
        db.commit()
        return len(links)

    @staticmethod
    def entity_counts(
        db: Session, world_id: str, module: str, entity_id: str
    ) -> Dict[str, int]:
        """单实体出链/入链计数（契约 §5.1）"""

        links = LinkService.list_links(db, world_id, module=module, entity_id=entity_id)
        outgoing = sum(
            1
            for link in links
            if link.source_module == module and link.source_id == entity_id
        )
        incoming = sum(
            1
            for link in links
            if link.target_module == module and link.target_id == entity_id
        )
        return {"outgoing": outgoing, "incoming": incoming, "total": len(links)}

    @staticmethod
    def counts_by_module(db: Session, world_id: str) -> List[Dict[str, Any]]:
        """按模块统计出链/入链（列表页徽章）"""

        modules: Dict[str, Dict[str, int]] = {}
        links: Iterable[WorldLink] = db.query(WorldLink).filter(
            WorldLink.world_id == world_id
        )
        for link in links:
            outgoing = modules.setdefault(
                link.source_module, {"outgoing": 0, "incoming": 0}
            )
            outgoing["outgoing"] += 1
            incoming = modules.setdefault(
                link.target_module, {"outgoing": 0, "incoming": 0}
            )
            incoming["incoming"] += 1
        return [
            {
                "module": module,
                "outgoing": counts["outgoing"],
                "incoming": counts["incoming"],
                "total": counts["outgoing"] + counts["incoming"],
            }
            for module, counts in sorted(modules.items())
        ]

    # ------------------------------------------------------------------
    # 关联归位（P2-T12，契约 §6 迁移容器）
    # ------------------------------------------------------------------

    @staticmethod
    def _module_world(db: Session, module_id: Optional[str]) -> Optional[str]:
        """模块 -> 世界；模块不存在（失效端点）时返回 None。"""

        if not module_id:
            return None
        module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
        return module.world_id if module is not None else None

    @staticmethod
    def get_character(db: Session, entity_id: str) -> Optional[Character]:
        """按 id 取角色行（判断端点是否为真实角色的唯一依据）。"""

        return db.query(Character).filter(Character.id == entity_id).first()

    @staticmethod
    def resolve_character_world(db: Session, entity_id: str) -> Optional[str]:
        """角色端点 -> 世界（契约 §6 归位推导）。

        角色属于项目而非世界：该项目下恰好一个世界时返回该世界 id；
        端点不是角色、或该项目下 0 个/多个世界时返回 None，由调用方决定报错。
        """

        character = LinkService.get_character(db, entity_id)
        if character is None:
            return None
        worlds = db.query(World).filter(World.project_id == character.project_id).all()
        if len(worlds) == 1:
            return worlds[0].id
        return None

    @staticmethod
    def resolve_entity_world(db: Session, entity_id: str) -> Optional[str]:
        """端点 id -> module_id -> world_id（契约 §6 归位推导）。

        依次尝试子模块、模块项、模块自身、角色（角色为项目级实体，见
        resolve_character_world）；实体已被删除（失效端点）时返回 None，
        由调用方决定是显式指定世界还是报错。
        """

        submodule = (
            db.query(WorldSubmodule).filter(WorldSubmodule.id == entity_id).first()
        )
        if submodule is not None:
            return LinkService._module_world(db, submodule.module_id)
        item = db.query(WorldModuleItem).filter(WorldModuleItem.id == entity_id).first()
        if item is not None:
            return LinkService._module_world(db, item.module_id)
        module = db.query(WorldModule).filter(WorldModule.id == entity_id).first()
        if module is not None:
            return module.world_id
        return LinkService.resolve_character_world(db, entity_id)

    @staticmethod
    def derive_link_world(db: Session, link: WorldLink) -> str:
        """按端点推导关联应归位的世界。

        两端都能解析且分属不同世界时抛 EndpointWorldConflictError（映射 409）；
        只有一端可解析时用可解析的一端；两端都解析不到时抛 LinkMoveError
        （映射 400，要求调用方显式给出 world_id）：至少一端是真实角色时按
        「角色为项目级实体、无法唯一归属世界」归类，否则按「两端实体均不存在」归类。
        """

        source_world = LinkService.resolve_entity_world(db, link.source_id)
        target_world = LinkService.resolve_entity_world(db, link.target_id)
        if source_world and target_world and source_world != target_world:
            raise EndpointWorldConflictError(
                "关联两端分属不同世界，请显式指定 world_id"
            )
        world_id = source_world or target_world
        if world_id is None:
            if (
                LinkService.get_character(db, link.source_id) is not None
                or LinkService.get_character(db, link.target_id) is not None
            ):
                raise CharacterWorldAmbiguousError(
                    "无法推导目标世界：关联端点含角色，角色为项目级实体、"
                    "无法唯一归属世界，请显式指定 world_id"
                )
            raise UnresolvableEndpointError(
                "无法推导目标世界：关联两端实体均不存在，请显式指定 world_id"
            )
        return world_id

    @staticmethod
    def _require_same_project(current_world: World, target_world: World) -> None:
        """归位不得跨越项目边界（契约 §6：跨项目 400）。"""

        if (current_world.project_id or None) != (target_world.project_id or None):
            raise LinkMoveError("目标世界与关联当前世界不属于同一项目")

    @staticmethod
    def _require_contract_link(link: WorldLink) -> None:
        """复用 registry 校验既有行：契约外 link_type 或 kind 不匹配一律拒绝。"""

        ok, error = validate_link_type(
            link.link_type,
            link.source_module,
            link.source_kind,
            link.target_module,
            link.target_kind,
        )
        if not ok:
            raise LinkValidationError(error or "关联类型校验失败")

    @staticmethod
    def _resolve_move_target(
        db: Session,
        link: WorldLink,
        current_world: World,
        target_world_id: Optional[str],
    ) -> World:
        """解析并校验归位目标世界（显式 world_id 优先，否则按端点推导）。"""

        if target_world_id is not None:
            target = db.query(World).filter(World.id == target_world_id).first()
            if target is None:
                raise LookupError(f"世界不存在: {target_world_id}")
        else:
            target = LinkService._require_world(
                db, LinkService.derive_link_world(db, link)
            )

        if target.id == current_world.id:
            raise AlreadyInTargetError("关联已位于目标世界，无需归位")
        LinkService._require_same_project(current_world, target)

        existing = LinkService.find_duplicate(
            db,
            target.id,
            {
                "module": link.source_module,
                "kind": link.source_kind,
                "id": link.source_id,
            },
            {
                "module": link.target_module,
                "kind": link.target_kind,
                "id": link.target_id,
            },
            link.link_type,
        )
        if existing is not None:
            raise DuplicateLinkError(existing.id)
        return target

    @staticmethod
    def _apply_move(
        db: Session, link: WorldLink, target_world_id: Optional[str]
    ) -> WorldLink:
        """校验并执行一次归位（不提交）；只改 world_id 与 meta 记账键。"""

        LinkService._require_contract_link(link)
        current_world = LinkService._require_world(db, link.world_id)
        target = LinkService._resolve_move_target(
            db, link, current_world, target_world_id
        )

        # 记账键必须保留：整块复制后追加，不做原地 JSON 变更
        meta = dict(link.meta) if isinstance(link.meta, dict) else {}
        if link.meta is not None and not isinstance(link.meta, dict):
            # 历史行可能存的是 JSON 字符串/数组：原值转入 legacyMeta，不静默丢弃
            logger.warning(
                "关联 %s 的 meta 不是对象（%s），原值已转入 legacyMeta",
                link.id,
                type(link.meta).__name__,
            )
            meta["legacyMeta"] = link.meta
        meta["reclassifiedFrom"] = link.world_id
        meta["reclassifiedAt"] = datetime.now(timezone.utc).isoformat()
        link.world_id = target.id
        link.meta = meta
        return link

    @staticmethod
    def move_error_code(error: LinkMoveError) -> str:
        """单项归位失败的稳定判别码（契约 §6）。

        未单独定义子类的 LinkMoveError（推导出的目标世界与关联当前世界跨项目）
        就近归为 endpoint_world_conflict。
        """

        return getattr(error, "code", "endpoint_world_conflict")

    @staticmethod
    def move_link(
        db: Session, link: WorldLink, target_world_id: Optional[str] = None
    ) -> WorldLink:
        """把一条关联归位到目标世界（单条，自身提交）。"""

        LinkService._apply_move(db, link, target_world_id)
        db.commit()
        db.refresh(link)
        return link

    @staticmethod
    def move_links(
        db: Session,
        world_id: str,
        link_ids: Sequence[str],
        target_world_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """单事务批量归位（契约 §6）。

        请求级问题整体拒绝：未知世界/关联 404、跨项目 400、契约外 link_type 400；
        单项问题只报告不阻塞其余项：等价边进 conflicts，其余进 invalid。
        link_ids 入口保序去重；每项成功后 flush，使同批次内新产生的等价边能被后续项看到。
        """

        current_world = LinkService._require_world(db, world_id)
        explicit_target: Optional[World] = None
        if target_world_id is not None:
            explicit_target = LinkService._require_world(db, target_world_id)
            LinkService._require_same_project(current_world, explicit_target)

        # 保序去重：重复的 link_id 不再进循环（否则已归位项会被误报为「不属于该世界」）
        ordered_ids: List[str] = []
        seen_ids = set()
        for link_id in link_ids:
            if link_id in seen_ids:
                continue
            seen_ids.add(link_id)
            ordered_ids.append(link_id)

        links: List[WorldLink] = []
        for link_id in ordered_ids:
            link = LinkService.get_link(db, link_id)
            if link is None:
                raise LookupError(f"关联不存在: {link_id}")
            links.append(link)

        # 契约外 link_type 属于请求级错误：先整体校验，保证不产生部分写入，
        # 并把出错的 link id 一并回报，让前端能指出具体行
        foreign_ids: List[str] = []
        foreign_message = ""
        for link in links:
            try:
                LinkService._require_contract_link(link)
            except LinkValidationError as exc:
                foreign_ids.append(link.id)
                if not foreign_message:
                    foreign_message = str(exc)
        if foreign_ids:
            raise ForeignLinkTypeError(
                foreign_ids, foreign_message or "关联类型不符合契约"
            )

        conflicts: List[Dict[str, str]] = []
        invalid: List[Dict[str, str]] = []
        moved = 0
        for link in links:
            if link.world_id != world_id:
                invalid.append(
                    {
                        "link_id": link.id,
                        "code": "not_in_world",
                        "reason": "关联不属于该世界",
                    }
                )
                continue
            try:
                LinkService._apply_move(
                    db,
                    link,
                    explicit_target.id if explicit_target is not None else None,
                )
            except DuplicateLinkError as exc:
                conflicts.append(
                    {
                        "link_id": link.id,
                        "code": "duplicate_link",
                        "existing_id": exc.existing_id,
                    }
                )
            except LinkMoveError as exc:
                invalid.append(
                    {
                        "link_id": link.id,
                        "code": LinkService.move_error_code(exc),
                        "reason": str(exc),
                    }
                )
            else:
                # autoflush 关闭：立刻落库，后续项的重复检测才能看到本条的新 world_id
                db.flush()
                moved += 1

        db.commit()
        return {"moved": moved, "conflicts": conflicts, "invalid": invalid}
