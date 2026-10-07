"""World API（契约 §2.1/§2.2/§3.2，Phase 1 P1-T7）

路由（挂载在 /api/v1/worldbuilding 下）：
- GET    /worlds
- POST   /worlds            （空白世界 + 七个空模块，契约 §2.2）
- POST   /worlds/import     （世界备份恢复：new / overwrite 两种模式 + 导入报告，P6-T2）
- GET    /worlds/{world_id}
- PUT    /worlds/{world_id}
- DELETE /worlds/{world_id}
- GET    /worlds/{world_id}/export
- DELETE /worlds/{world_id}/content （清空实体与关联，保留模块与配置）
- POST   /worlds/{world_id}/modules （补齐模块，取代旧 /templates/{id}/modules 转发）
"""

import uuid
from functools import lru_cache
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
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
    WORLD_SCHEMA_VERSION,
    DanglingRefEntry,
    WorldCreate,
    WorldExport,
    WorldImport,
    WorldImportMode,
    WorldImportReport,
    WorldLinkExportEntry,
    WorldModuleCreate,
    WorldModuleItemResponse,
    WorldModuleWithItemsV2,
    WorldResponse,
    WorldSubmoduleResponse,
    WorldUpdate,
    WorldWithModules,
)
from app.services import world_service
from app.services.link_registry import LINK_TYPES, validate_link_type
from app.services.link_service import DuplicateLinkError, LinkService

logger = get_logger(__name__)

router = APIRouter()

# 未注册的 link_type 回落到通用对称类型（与 P1-MIG-05 的回落口径一致）
FALLBACK_LINK_TYPE = "core.related_to"


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
    # 计数必须填真实值：schema 默认 0，而前端设置面板 / 地图-特殊分支都按它判断
    # 「模块内有没有内容」（enabled: !!module.submodule_count）。一次分组查询，避免 N+1。
    submodule_item_counts = dict(
        db.query(WorldModuleItem.submodule_id, func.count(WorldModuleItem.id))
        .filter(WorldModuleItem.module_id == module.id)
        .group_by(WorldModuleItem.submodule_id)
        .all()
    )
    for submodule in payload.submodules:
        submodule.item_count = submodule_item_counts.get(submodule.id, 0)
    payload.submodule_count = len(payload.submodules)
    if include_items:
        items = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.module_id == module.id)
            .order_by(WorldModuleItem.order_index, WorldModuleItem.id)
            .all()
        )
        payload.items = [WorldModuleItemResponse.model_validate(item) for item in items]
        payload.item_count = len(payload.items)
    else:
        payload.item_count = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.module_id == module.id)
            .count()
        )
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


@lru_cache(maxsize=1)
def _contract_kinds_by_module() -> Dict[str, Set[str]]:
    """契约 §4 出现过的 (module, kind) 词表；"*" 表示该模块任意 kind 都算已知。

    kind 本身是开放词表（契约 §2.4「模块内可自定义 kind」、§2.7 EntityTypeDef 由用户维护），
    因此这里只用于在导入报告里列出「既未在 module.config.entityTypes 声明、也不在契约词表里」
    的可疑 kind，绝不做降级改写 —— 设计文档 §3.4 同时要求「恢复时保留 kind」，改写会毁数据。
    """

    table: Dict[str, Set[str]] = {}
    for link_type in LINK_TYPES:
        for refs in (link_type.source, link_type.target):
            for module, kind in refs or ():
                table.setdefault(module, set()).add(kind)
    return table


def _unknown_kinds(payload: WorldImport) -> List[str]:
    """导入报告用：列出可疑的未知 kind（module.kind 形式，去重且保序）。"""

    known = _contract_kinds_by_module()
    reported: List[str] = []
    seen: Set[str] = set()
    for module_payload in payload.modules:
        module_type = _module_type_value(module_payload.module_type)
        declared: Set[str] = set()
        config = module_payload.config
        if isinstance(config, dict):
            for def_ in config.get("entityTypes") or []:
                if isinstance(def_, dict) and def_.get("id"):
                    declared.add(str(def_["id"]))
        allowed = known.get(module_type, set())
        if "*" in allowed:
            continue
        for submodule_payload in module_payload.submodules:
            kind = submodule_payload.kind
            if not kind or kind in declared or kind in allowed:
                continue
            label = f"{module_type}.{kind}"
            if label in seen:
                continue
            seen.add(label)
            reported.append(label)
    return reported


def _module_type_value(module_type) -> str:
    """WorldModuleCreate.module_type 可能是枚举，落库一律用字符串值。"""

    return module_type.value if hasattr(module_type, "value") else str(module_type)


def _clear_world_content(db: Session, world: World) -> None:
    """清空一个世界的模块 / 子模块 / 条目 / 关联，保留 world 行本身。"""

    module_ids = [
        module.id
        for module in db.query(WorldModule).filter(WorldModule.world_id == world.id)
    ]
    if module_ids:
        # 先删条目与子模块（子模块有 parent_id 自引用），最后删模块
        db.query(WorldModuleItem).filter(
            WorldModuleItem.module_id.in_(module_ids)
        ).delete(synchronize_session=False)
        db.query(WorldSubmodule).filter(
            WorldSubmodule.module_id.in_(module_ids)
        ).delete(synchronize_session=False)
        db.query(WorldModule).filter(WorldModule.id.in_(module_ids)).delete(
            synchronize_session=False
        )
    db.query(WorldLink).filter(WorldLink.world_id == world.id).delete(
        synchronize_session=False
    )


@router.post("/worlds/import", response_model=WorldImportReport, status_code=201)
def import_world(payload: WorldImport, db: Session = Depends(get_db)):
    """世界备份恢复（P6-T2）：new / overwrite 两种模式 + id 映射与失效引用报告。

    - 版本：schema_version 高于当前应用支持值时整包拒绝，不做部分写入
    - 关联先整体过一遍契约 §4 校验；未注册的 link_type 回落 core.related_to 并计入报告
    - 实体分两遍建立：先全部 submodule 再回填 parent_id，避免备份里子级排在
      父级之前时静默丢掉父子关系
    - 关联落库统一走 LinkService，沿用 registry 的 directed 与对称边去重
    - 端点 id 不在备份里 => 失效引用：keep_dangling 时保留原 id 作警示引用，否则丢弃
    """

    version = (
        payload.schema_version
        if payload.schema_version is not None
        else WORLD_SCHEMA_VERSION
    )
    if version > WORLD_SCHEMA_VERSION:
        raise HTTPException(
            status_code=400,
            detail=(
                f"备份版本 {version} 高于当前应用支持的 {WORLD_SCHEMA_VERSION}，"
                "请先升级应用再恢复"
            ),
        )
    if payload.schema_version is not None and payload.schema_version < 1:
        raise HTTPException(status_code=400, detail="备份版本号非法")

    mode = payload.mode.value if hasattr(payload.mode, "value") else str(payload.mode)
    warnings: List[str] = []
    unknown_link_types: List[str] = []
    dangling_refs: List[DanglingRefEntry] = []
    skipped_links = 0

    # ---- 关联预检：未知 link_type 回落通用对称类型，kind 不匹配的才整包拒绝 ----
    accepted_links: List[WorldLinkExportEntry] = []
    for index, link_payload in enumerate(payload.links):
        ok, error = validate_link_type(
            link_payload.link_type,
            link_payload.source_module,
            link_payload.source_kind,
            link_payload.target_module,
            link_payload.target_kind,
        )
        if ok:
            accepted_links.append(link_payload)
            continue
        if link_payload.link_type not in unknown_link_types:
            unknown_link_types.append(link_payload.link_type)
        downgraded = link_payload.model_copy(
            update={"link_type": FALLBACK_LINK_TYPE, "directed": False}
        )
        fallback_ok, fallback_error = validate_link_type(
            FALLBACK_LINK_TYPE,
            downgraded.source_module,
            downgraded.source_kind,
            downgraded.target_module,
            downgraded.target_kind,
        )
        if not fallback_ok:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"第 {index + 1} 条关联非法：{error}"
                    f"（回落 {FALLBACK_LINK_TYPE} 也失败：{fallback_error}）"
                ),
            )
        warnings.append(
            f"第 {index + 1} 条关联的类型 {link_payload.link_type} 未注册，"
            f"已回落为 {FALLBACK_LINK_TYPE}"
        )
        accepted_links.append(downgraded)

    # ---- 目标世界：new 建新世界，overwrite 复用目标世界 id 并清空其内容 ----
    if mode == WorldImportMode.OVERWRITE.value:
        if not payload.target_world_id:
            raise HTTPException(
                status_code=400, detail="覆盖恢复必须提供 target_world_id"
            )
        world = _get_world_or_404(db, payload.target_world_id)
        entity_count = (
            db.query(WorldSubmodule)
            .join(WorldModule, WorldSubmodule.module_id == WorldModule.id)
            .filter(WorldModule.world_id == world.id)
            .count()
            + db.query(WorldModuleItem)
            .join(WorldModule, WorldModuleItem.module_id == WorldModule.id)
            .filter(WorldModule.world_id == world.id)
            .count()
        )
        if (
            entity_count or _link_count(db, world.id)
        ) and not payload.confirm_overwrite:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"目标世界「{world.name}」已有 {entity_count} 个实体 / "
                    f"{_link_count(db, world.id)} 条关联：覆盖恢复需要显式确认"
                ),
            )
        _clear_world_content(db, world)
        world.name = payload.name or payload.world.name or world.name
        world.description = payload.world.description
        world.cover_image = payload.world.cover_image
        world.tone = payload.world.tone
        world.settings = payload.world.settings
        db.flush()
    else:
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

    # 顶层未知键不丢弃：原样存回 settings.unknownFields 并写进报告
    extra_keys = sorted((payload.model_extra or {}).keys())
    if extra_keys:
        settings = dict(world.settings or {})
        settings["unknownFields"] = {
            key: (payload.model_extra or {})[key] for key in extra_keys
        }
        world.settings = settings
        warnings.append("备份中的未知顶层字段已保留：" + ", ".join(extra_keys))

    id_map: Dict[str, str] = {}
    module_map: Dict[str, WorldModule] = {}
    entity_count = 0
    for module_payload in payload.modules:
        module = WorldModule(
            id=str(uuid.uuid4()),
            world_id=world.id,
            module_type=_module_type_value(module_payload.module_type),
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
            entity_count += 1
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
            entity_count += 1

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

    # ---- 关联重建：id_map 重映射端点；命不中的记失效引用 ----
    merged_duplicates = 0
    link_count = 0
    for index, link_payload in enumerate(accepted_links):
        source_id = id_map.get(link_payload.source_id)
        if source_id is None:
            dangling_refs.append(
                DanglingRefEntry(
                    role="source",
                    module=link_payload.source_module,
                    kind=link_payload.source_kind,
                    id=link_payload.source_id,
                    link_type=link_payload.link_type,
                )
            )
        target_id = id_map.get(link_payload.target_id)
        if target_id is None:
            dangling_refs.append(
                DanglingRefEntry(
                    role="target",
                    module=link_payload.target_module,
                    kind=link_payload.target_kind,
                    id=link_payload.target_id,
                    link_type=link_payload.link_type,
                )
            )
        if (source_id is None or target_id is None) and not payload.keep_dangling:
            skipped_links += 1
            continue
        # keep_dangling：保留原 id 作为警示引用（worldbuilding_ui_design §3.4）
        try:
            LinkService.create_link(
                db,
                world.id,
                {
                    "source": {
                        "module": link_payload.source_module,
                        "kind": link_payload.source_kind,
                        "id": source_id or link_payload.source_id,
                    },
                    "target": {
                        "module": link_payload.target_module,
                        "kind": link_payload.target_kind,
                        "id": target_id or link_payload.target_id,
                    },
                    "link_type": link_payload.link_type,
                    "label": link_payload.label,
                    "note": link_payload.note,
                    "meta": link_payload.meta,
                    "time": link_payload.time,
                },
            )
            link_count += 1
        except DuplicateLinkError:
            # 备份里可能带有对称边的两个方向（旧回填允许），合并为一条
            merged_duplicates += 1

    if merged_duplicates:
        logger.info(f"World import merged {merged_duplicates} duplicate links")
    if dangling_refs:
        logger.warning(f"World import kept {len(dangling_refs)} dangling link refs")

    unknown_kinds = _unknown_kinds(payload)
    if unknown_kinds:
        warnings.append(
            "以下 kind 既未在该模块 config.entityTypes 声明、也不在契约词表中，"
            "已按原值保留未做降级：" + ", ".join(unknown_kinds)
        )

    db.commit()
    db.refresh(world)
    return WorldImportReport(
        world=_to_response(db, world),
        mode=mode,
        schema_version=min(version, WORLD_SCHEMA_VERSION),
        entity_count=entity_count,
        link_count=link_count,
        merged_duplicates=merged_duplicates,
        skipped_links=skipped_links,
        id_map=id_map,
        dangling_refs=dangling_refs,
        unknown_kinds=unknown_kinds,
        unknown_link_types=unknown_link_types,
        warnings=warnings,
    )


@router.post(
    "/worlds/{world_id}/modules", response_model=WorldModuleWithItemsV2, status_code=201
)
def create_world_module(
    world_id: str, payload: WorldModuleCreate, db: Session = Depends(get_db)
):
    """为已有世界补齐一个模块（P6-T10：取代旧 /templates/{id}/modules 兼容转发）。

    服务端建世界时已补齐七个模块，这里只处理历史上缺模块的旧世界；
    同一 module_type 已存在时返回 400，不静默覆盖。
    """

    world = _get_world_or_404(db, world_id)
    module_type = _module_type_value(payload.module_type)
    exists = (
        db.query(WorldModule)
        .filter(
            WorldModule.world_id == world_id, WorldModule.module_type == module_type
        )
        .first()
    )
    if exists is not None:
        raise HTTPException(
            status_code=400, detail=f"该世界已存在 {module_type} 模块：{exists.id}"
        )
    data = payload.model_dump(exclude={"order_index"})
    module = WorldModule(
        id=str(uuid.uuid4()),
        world_id=world.id,
        order_index=payload.order_index
        or len(db.query(WorldModule).filter(WorldModule.world_id == world_id).all()),
        **{**data, "module_type": module_type},
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return _module_payload(db, module, include_items=True)


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


@router.delete("/worlds/{world_id}/content", status_code=204, response_model=None)
def clear_world_content(world_id: str, db: Session = Depends(get_db)):
    """清空世界内的实体与关联，保留世界行、七个模块与模块配置（P6-T2 危险操作）。

    与覆盖导入里的 `_clear_world_content` 不同：这里**不删模块**，避免顺手抹掉
    module.config（用户配置）。前端「世界设置 → 备份 → 清空世界数据」的口径是
    「模块与配置保留」，因此关联也必须一起清，否则残留的 WorldLink 全部变成失效引用。
    """

    _get_world_or_404(db, world_id)
    module_ids = [
        module.id
        for module in db.query(WorldModule).filter(WorldModule.world_id == world_id)
    ]
    if module_ids:
        db.query(WorldModuleItem).filter(
            WorldModuleItem.module_id.in_(module_ids)
        ).delete(synchronize_session=False)
        db.query(WorldSubmodule).filter(
            WorldSubmodule.module_id.in_(module_ids)
        ).delete(synchronize_session=False)
    db.query(WorldLink).filter(WorldLink.world_id == world_id).delete(
        synchronize_session=False
    )
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
        schema_version=WORLD_SCHEMA_VERSION,
        world=_to_response(db, world),
        modules=module_payloads,
        links=link_payloads,
    )
