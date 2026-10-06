"""WorldLink 服务（契约 §2.5 / §4 / §5）

统一关联存储 world_links 的读写：
- 创建/更新前用 link registry（契约 §4 白名单）校验 link_type 与源/目标 kind
- directed 由 LinkTypeDef 决定，落库冗余
- 对称关联只存一条；查询时按双向匹配
- 删除实体时级联删除其关联
"""

import uuid
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models import World, WorldLink
from app.services.link_registry import get_link_type, validate_link_type
from app.services.world_service import create_world

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
