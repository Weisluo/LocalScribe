"""WorldLink API（契约 §3.2，Phase 1 P1-T6）

路由（挂载在 /api/v1/worldbuilding 下）：
- GET    /worlds/{world_id}/links
- POST   /worlds/{world_id}/links
- GET    /worlds/{world_id}/links/counts
- GET    /links/{link_id}
- PATCH  /links/{link_id}
- DELETE /links/{link_id}
- GET    /link-registry           只读，返回契约 §4 全量 link_type
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models import World
from app.schemas.relation import (
    LinkTypeDefResponse,
    WorldLinkCounts,
    WorldLinkCreate,
    WorldLinkResponse,
    WorldLinkUpdate,
)
from app.services.link_registry import LINK_TYPES
from app.services.link_service import (
    DuplicateLinkError,
    LinkService,
    LinkValidationError,
)

router = APIRouter()


def _get_world_or_404(db: Session, world_id: str) -> World:
    world = db.query(World).filter(World.id == world_id).first()
    if world is None:
        raise HTTPException(status_code=404, detail=f"世界不存在: {world_id}")
    return world


@router.get("/link-registry", response_model=List[LinkTypeDefResponse])
def get_link_registry():
    """契约 §4 的 link_type 全量清单（只读，供前端筛选与校验）"""

    return [LinkTypeDefResponse.from_definition(item) for item in LINK_TYPES]


@router.get("/worlds/{world_id}/links", response_model=List[WorldLinkResponse])
def list_world_links(
    world_id: str,
    module: Optional[str] = Query(None, description="按实体所属模块过滤"),
    entity_id: Optional[str] = Query(None, description="按实体 ID 过滤（出链+入链）"),
    link_type: Optional[str] = Query(None),
    target_module: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if (module is None) != (entity_id is None):
        raise HTTPException(status_code=422, detail="module 与 entity_id 必须同时提供")

    _get_world_or_404(db, world_id)
    links = LinkService.list_links(
        db,
        world_id,
        module=module,
        entity_id=entity_id,
        link_type=link_type,
        target_module=target_module,
        skip=skip,
        limit=limit,
    )
    return [WorldLinkResponse.from_model(link) for link in links]


@router.post(
    "/worlds/{world_id}/links", response_model=WorldLinkResponse, status_code=201
)
def create_world_link(
    world_id: str, payload: WorldLinkCreate, db: Session = Depends(get_db)
):
    data = payload.model_dump()
    try:
        link = LinkService.create_link(db, world_id, data)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DuplicateLinkError as exc:
        raise HTTPException(
            status_code=409,
            detail=f"关联已存在（{exc.existing_id}）：对称关联只存一条",
        ) from exc
    except LinkValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WorldLinkResponse.from_model(link)


@router.get("/worlds/{world_id}/links/counts", response_model=List[WorldLinkCounts])
def get_world_link_counts(world_id: str, db: Session = Depends(get_db)):
    _get_world_or_404(db, world_id)
    return LinkService.counts_by_module(db, world_id)


@router.get("/links/{link_id}", response_model=WorldLinkResponse)
def get_world_link(link_id: str, db: Session = Depends(get_db)):
    link = LinkService.get_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail=f"关联不存在: {link_id}")
    return WorldLinkResponse.from_model(link)


@router.patch("/links/{link_id}", response_model=WorldLinkResponse)
def update_world_link(
    link_id: str, payload: WorldLinkUpdate, db: Session = Depends(get_db)
):
    link = LinkService.get_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail=f"关联不存在: {link_id}")
    updated = LinkService.update_link(db, link, payload.model_dump(exclude_unset=True))
    return WorldLinkResponse.from_model(updated)


@router.delete("/links/{link_id}", status_code=204, response_model=None)
def delete_world_link(link_id: str, db: Session = Depends(get_db)):
    link = LinkService.get_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail=f"关联不存在: {link_id}")
    LinkService.delete_link(db, link)
