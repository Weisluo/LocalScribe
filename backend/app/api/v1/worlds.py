"""World API（契约 §2.1/§2.2/§3.2，Phase 1 P1-T7）

路由（挂载在 /api/v1/worldbuilding 下）：
- GET    /worlds
- POST   /worlds            （空白世界 + 七个空模块，契约 §2.2）
- POST   /worlds/import     （世界备份恢复，契约 §2.1）
- GET    /worlds/{world_id}
- PUT    /worlds/{world_id}
- DELETE /worlds/{world_id}
- GET    /worlds/{world_id}/export
"""

import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.logging import get_logger
from app.models import (
    DEFAULT_MODULE_SPECS,
    World,
    WorldLink,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
)
from app.schemas.worldbuilding import (
    WorldCreate,
    WorldExport,
    WorldImport,
    WorldLinkExportEntry,
    WorldModuleItemResponse,
    WorldModuleWithItemsV2,
    WorldResponse,
    WorldSubmoduleResponse,
    WorldUpdate,
    WorldWithModules,
)
from app.services import world_service
from app.services.link_registry import validate_link_type
from app.services.link_service import DuplicateLinkError, LinkService

logger = get_logger(__name__)

router = APIRouter()


def _module_count(db: Session, world_id: str) -> int:
    return db.query(WorldModule).filter(WorldModule.world_id == world_id).count()


def _link_count(db: Session, world_id: str) -> int:
    return db.query(WorldLink).filter(WorldLink.world_id == world_id).count()


def _to_response(
    db: Session, world: World, include_link_count: bool = True
) -> WorldResponse:
    return WorldResponse(
        id=world.id,
        name=world.name,
        description=world.description,
        cover_image=world.cover_image,
        project_id=world.project_id,
        tone=world.tone,
        settings=world.settings,
        created_at=world.created_at,
        updated_at=world.updated_at,
        module_count=_module_count(db, world.id),
        link_count=_link_count(db, world.id) if include_link_count else 0,
    )


def _module_payload(
    db: Session, module: WorldModule, include_items: bool = True
) -> WorldModuleWithItemsV2:
    submodules = (
        db.query(WorldSubmodule)
        .filter(WorldSubmodule.module_id == module.id)
        .order_by(WorldSubmodule.order_index, WorldSubmodule.id)
        .all()
    )
    payload = WorldModuleWithItemsV2.model_validate(module)
    payload.submodules = [
        WorldSubmoduleResponse.model_validate(submodule) for submodule in submodules
    ]
    if include_items:
        items = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.module_id == module.id)
            .order_by(WorldModuleItem.order_index, WorldModuleItem.id)
            .all()
        )
        payload.items = [WorldModuleItemResponse.model_validate(item) for item in items]
    return payload


def _get_world_or_404(db: Session, world_id: str) -> World:
    world = db.query(World).filter(World.id == world_id).first()
    if world is None:
        raise HTTPException(status_code=404, detail=f"世界不存在: {world_id}")
    return world


@router.get("/worlds", response_model=List[WorldResponse])
def list_worlds(
    project_id: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(World)
    if project_id:
        query = query.filter(World.project_id == project_id)
    if name:
        query = query.filter(World.name.ilike(f"%{name}%"))
    worlds = query.order_by(World.created_at, World.id).offset(skip).limit(limit).all()
    return [_to_response(db, world) for world in worlds]


@router.post("/worlds", response_model=WorldResponse, status_code=201)
def create_world(payload: WorldCreate, db: Session = Depends(get_db)):
    world = world_service.create_world(
        db,
        name=payload.name,
        description=payload.description,
        cover_image=payload.cover_image,
        project_id=payload.project_id,
        tone=payload.tone.model_dump(exclude_none=True) if payload.tone else None,
        settings=(
            payload.settings.model_dump(exclude_none=True) if payload.settings else None
        ),
    )
    db.commit()
    db.refresh(world)
    return _to_response(db, world)


@router.post("/worlds/import", response_model=WorldResponse, status_code=201)
def import_world(payload: WorldImport, db: Session = Depends(get_db)):
    """世界备份恢复：新建世界，实体 id 重新分配并重映射关联端点。

    - 关联先整体过一遍契约 §4 校验，非法则整包拒绝（400），不做部分写入
    - 实体分两遍建立：先全部 submodule 再回填 parent_id，避免备份里子级排在
      父级之前时静默丢掉父子关系
    - 关联落库统一走 LinkService，沿用 registry 的 directed 与对称边去重
    """

    for index, link_payload in enumerate(payload.links):
        ok, error = validate_link_type(
            link_payload.link_type,
            link_payload.source_module,
            link_payload.source_kind,
            link_payload.target_module,
            link_payload.target_kind,
        )
        if not ok:
            raise HTTPException(
                status_code=400, detail=f"第 {index + 1} 条关联非法：{error}"
            )

    world = world_service.create_world(
        db,
        name=payload.name or payload.world.name,
        description=payload.world.description,
        cover_image=payload.world.cover_image,
        project_id=payload.project_id or payload.world.project_id,
        tone=payload.world.tone,
        settings=payload.world.settings,
        with_default_modules=False,  # 模块以备份为准，缺的类型在下面补齐
    )

    id_map: Dict[str, str] = {}
    module_map: Dict[str, WorldModule] = {}
    for module_payload in payload.modules:
        module = WorldModule(
            id=str(uuid.uuid4()),
            world_id=world.id,
            module_type=(
                module_payload.module_type.value
                if hasattr(module_payload.module_type, "value")
                else module_payload.module_type
            ),
            name=module_payload.name,
            description=module_payload.description,
            icon=module_payload.icon,
            order_index=module_payload.order_index,
            config=module_payload.config,
            is_collapsible=module_payload.is_collapsible,
            is_required=module_payload.is_required,
        )
        db.add(module)
        db.flush()
        module_map[module_payload.id] = module

    # 第一遍：建立全部 submodule（暂不带 parent_id），保证 id_map 完整
    for module_payload in payload.modules:
        module = module_map[module_payload.id]
        for submodule_payload in module_payload.submodules:
            submodule = WorldSubmodule(
                id=str(uuid.uuid4()),
                module_id=module.id,
                name=submodule_payload.name,
                description=submodule_payload.description,
                order_index=submodule_payload.order_index,
                kind=submodule_payload.kind,
                meta=submodule_payload.meta,
                color=submodule_payload.color,
                icon=submodule_payload.icon,
                parent_id=None,
            )
            id_map[submodule_payload.id] = submodule.id
            db.add(submodule)
    db.flush()

    # 第二遍：回填 parent_id（父级不在备份里时保持 None 并记日志）
    for module_payload in payload.modules:
        for submodule_payload in module_payload.submodules:
            if not submodule_payload.parent_id:
                continue
            parent_id = id_map.get(submodule_payload.parent_id)
            child = db.get(WorldSubmodule, id_map[submodule_payload.id])
            if parent_id is None or child is None:
                logger.warning(
                    f"World import: parent {submodule_payload.parent_id} missing, "
                    f"submodule {submodule_payload.id} imported as root"
                )
                continue
            child.parent_id = parent_id
    db.flush()

    for module_payload in payload.modules:
        module = module_map[module_payload.id]
        for item_payload in module_payload.items:
            item = WorldModuleItem(
                id=str(uuid.uuid4()),
                module_id=module.id,
                submodule_id=(
                    id_map.get(item_payload.submodule_id)
                    if item_payload.submodule_id
                    else None
                ),
                name=item_payload.name,
                content=item_payload.content,
                order_index=item_payload.order_index,
                is_published=item_payload.is_published,
            )
            id_map[item_payload.id] = item.id
            db.add(item)

    existing_modules = {m.module_type for m in module_map.values()}
    for order_index, (module_type, name, icon) in enumerate(DEFAULT_MODULE_SPECS):
        if module_type in existing_modules:
            continue
        db.add(
            WorldModule(
                id=str(uuid.uuid4()),
                world_id=world.id,
                module_type=module_type,
                name=name,
                icon=icon,
                order_index=order_index,
            )
        )
    db.flush()

    merged_duplicates = 0
    for link_payload in payload.links:
        try:
            LinkService.create_link(
                db,
                world.id,
                {
                    "source": {
                        "module": link_payload.source_module,
                        "kind": link_payload.source_kind,
                        "id": id_map.get(
                            link_payload.source_id, link_payload.source_id
                        ),
                    },
                    "target": {
                        "module": link_payload.target_module,
                        "kind": link_payload.target_kind,
                        "id": id_map.get(
                            link_payload.target_id, link_payload.target_id
                        ),
                    },
                    "link_type": link_payload.link_type,
                    "label": link_payload.label,
                    "note": link_payload.note,
                    "meta": link_payload.meta,
                    "time": link_payload.time,
                },
            )
        except DuplicateLinkError:
            # 备份里可能带有对称边的两个方向（旧回填允许），合并为一条
            merged_duplicates += 1

    if merged_duplicates:
        logger.info(f"World import merged {merged_duplicates} duplicate links")

    db.commit()
    db.refresh(world)
    return _to_response(db, world)


@router.get("/worlds/{world_id}", response_model=WorldWithModules)
def get_world(
    world_id: str,
    include_modules: bool = Query(True),
    include_items: bool = Query(True),
    db: Session = Depends(get_db),
):
    world = _get_world_or_404(db, world_id)
    module_payloads: List[WorldModuleWithItemsV2] = []
    if include_modules:
        modules = (
            db.query(WorldModule)
            .filter(WorldModule.world_id == world_id)
            .order_by(WorldModule.order_index, WorldModule.id)
            .all()
        )
        module_payloads = [
            _module_payload(db, module, include_items=include_items)
            for module in modules
        ]

    response = WorldWithModules(
        **_to_response(db, world).model_dump(),
        modules=module_payloads,
    )
    return response


@router.put("/worlds/{world_id}", response_model=WorldResponse)
def update_world(world_id: str, payload: WorldUpdate, db: Session = Depends(get_db)):
    world = _get_world_or_404(db, world_id)
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "description", "cover_image", "project_id"):
        if field in data:
            setattr(world, field, data[field])
    if "tone" in data:
        world.tone = data["tone"]
    if "settings" in data:
        world.settings = data["settings"]
    db.commit()
    db.refresh(world)
    return _to_response(db, world)


@router.delete("/worlds/{world_id}", status_code=204, response_model=None)
def delete_world(world_id: str, db: Session = Depends(get_db)):
    world = _get_world_or_404(db, world_id)
    db.query(WorldLink).filter(WorldLink.world_id == world_id).delete()
    db.delete(world)
    db.commit()


@router.get("/worlds/{world_id}/export", response_model=WorldExport)
def export_world(world_id: str, db: Session = Depends(get_db)):
    world = _get_world_or_404(db, world_id)
    modules = (
        db.query(WorldModule)
        .filter(WorldModule.world_id == world_id)
        .order_by(WorldModule.order_index, WorldModule.id)
        .all()
    )
    module_payloads: List[WorldModuleWithItemsV2] = [
        _module_payload(db, module) for module in modules
    ]

    links = LinkService.list_links(db, world_id)
    link_payloads = [
        WorldLinkExportEntry(
            source_module=link.source_module,
            source_kind=link.source_kind,
            source_id=link.source_id,
            target_module=link.target_module,
            target_kind=link.target_kind,
            target_id=link.target_id,
            link_type=link.link_type,
            directed=bool(link.directed),
            label=link.label,
            note=link.note,
            meta=link.meta,
            time=link.time_range,
        )
        for link in links
    ]

    return WorldExport(
        world=_to_response(db, world), modules=module_payloads, links=link_payloads
    )
