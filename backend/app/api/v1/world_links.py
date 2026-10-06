"""WorldLink API（契约 §3.2，Phase 1 P1-T6）

路由（挂载在 /api/v1/worldbuilding 下）：
- GET    /worlds/{world_id}/links
- POST   /worlds/{world_id}/links
- POST   /worlds/{world_id}/links/move        单事务批量归位（P2-T12）
- GET    /worlds/{world_id}/links/counts
- GET    /links/{link_id}
- POST   /links/{link_id}/move                单条归位（P2-T12）
- PATCH  /links/{link_id}
- DELETE /links/{link_id}
- GET    /link-registry           只读，返回契约 §4 全量 link_type
"""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
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
    EndpointWorldConflictError,
    ForeignLinkTypeError,
    LinkMoveError,
    LinkService,
    LinkValidationError,
)

router = APIRouter()


class LinkMoveRequest(BaseModel):
    """单条归位请求体（契约 §6）：省略 world_id 时按端点所属世界推导。"""

    world_id: Optional[str] = Field(None, min_length=1, max_length=36)


class LinksMoveRequest(BaseModel):
    """批量归位请求体（契约 §6）"""

    link_ids: List[str] = Field(..., min_length=1, max_length=500)
    target_world_id: Optional[str] = Field(None, min_length=1, max_length=36)


class LinksMoveResponse(BaseModel):
    """批量归位结果：冲突与非法项只报告，不阻塞其余项

    conflicts 元素：{"link_id", "code": "duplicate_link", "existing_id"}
    invalid 元素：{"link_id", "code", "reason"}
    """

    moved: int
    conflicts: List[Dict[str, str]]
    invalid: List[Dict[str, str]]


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


@router.post("/worlds/{world_id}/links/move", response_model=LinksMoveResponse)
def move_world_links(
    world_id: str, payload: LinksMoveRequest, db: Session = Depends(get_db)
):
    """单事务批量归位（契约 §6）：冲突与非法项不阻塞其余项。

    请求级校验失败整体返回：未知世界/关联 404、跨项目 400、契约外 link_type 400
    （后者 detail 为 {"code": "foreign_link_type", "message", "link_ids"}，便于定位具体行）。
    """

    try:
        result = LinkService.move_links(
            db, world_id, payload.link_ids, payload.target_world_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ForeignLinkTypeError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "foreign_link_type",
                "message": str(exc),
                "link_ids": exc.link_ids,
            },
        ) from exc
    except (LinkValidationError, LinkMoveError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LinksMoveResponse(**result)


@router.get("/worlds/{world_id}/links/counts", response_model=List[WorldLinkCounts])
def get_world_link_counts(world_id: str, db: Session = Depends(get_db)):
    _get_world_or_404(db, world_id)
    return LinkService.counts_by_module(db, world_id)


@router.post("/links/{link_id}/move", response_model=WorldLinkResponse)
def move_world_link(
    link_id: str,
    payload: Optional[LinkMoveRequest] = None,
    db: Session = Depends(get_db),
):
    """把一条关联归位到目标世界（契约 §6）。

    省略 world_id 时按端点推导；端点分属不同世界且未显式指定返回 409；
    目标世界已有等价边返回 409。两种 409 的 detail 都是结构化判别码：
    {"code": "endpoint_world_conflict", "message"} /
    {"code": "duplicate_link", "message", "existing_id"}。
    """

    link = LinkService.get_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail=f"关联不存在: {link_id}")

    world_id = payload.world_id if payload is not None else None
    try:
        moved = LinkService.move_link(db, link, world_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EndpointWorldConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "endpoint_world_conflict",
                "message": "关联两端分属不同世界，请显式指定 world_id",
            },
        ) from exc
    except DuplicateLinkError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_link",
                "message": "目标世界已有等价关联",
                "existing_id": exc.existing_id,
            },
        ) from exc
    except (LinkValidationError, LinkMoveError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WorldLinkResponse.from_model(moved)


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
