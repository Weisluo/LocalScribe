"""经济模块只读 API（Phase 5 P5-T3；economy_ui_design §11.1 分档加载）

路由（挂载在 /api/v1/worldbuilding 下）：
- GET /modules/{module_id}/economy/graph     图：节点 / 边 / 计数（structure / sandbox）
- GET /modules/{module_id}/economy/summary   摘要：配置 + 速写卡 + 折叠计数 + 统计（sketch 只请求它）
- GET /modules/{module_id}/economy/timeline  时间线：周期带 / 时代底带 / 事件标记（sandbox）
- GET /modules/{module_id}/economy/metrics   指标序列（sandbox，按时间窗口）

写入一律复用 P1 通用接口（`/modules/{id}/submodules`、`/modules/{id}/items`、`/worlds/{id}/links`），
本 router 不提供任何写路径，也不新增表。
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models import WorldModule
from app.schemas.economy import (
    EconomyGraph,
    EconomyMetrics,
    EconomySummary,
    EconomyTimeline,
)
from app.services.economy_service import EconomyService

router = APIRouter()

ComplexityParam = Literal["sketch", "structure", "sandbox"]


def _csv(value: Optional[str]) -> Optional[List[str]]:
    """逗号分隔的多选参数 -> 去空列表；未提供时返回 None（= 不筛选）。"""

    if value is None:
        return None
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or None


def _get_economy_module(db: Session, module_id: str) -> WorldModule:
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if module is None:
        raise HTTPException(status_code=404, detail=f"模块不存在: {module_id}")
    if module.module_type != "economy":
        raise HTTPException(
            status_code=400,
            detail=f"模块 {module_id} 不是经济模块（module_type={module.module_type}）",
        )
    return module


@router.get(
    "/modules/{module_id}/economy/graph",
    response_model=EconomyGraph,
    response_model_by_alias=True,
)
def get_economy_graph(
    module_id: str,
    complexity: Optional[ComplexityParam] = Query(
        None, description="披露档位：sketch 只回计数，structure 回节点与边，sandbox 再含指标摘要"
    ),
    kinds: Optional[str] = Query(None, description="逗号分隔的 kind 筛选"),
    stages: Optional[str] = Query(None, description="逗号分隔的 stage 筛选"),
    windowStart: Optional[str] = Query(None, description="时间窗起点（自由文本，按锚点比较）"),
    windowEnd: Optional[str] = Query(None, description="时间窗终点"),
    db: Session = Depends(get_db),
):
    module = _get_economy_module(db, module_id)
    return EconomyService.build_graph(
        db,
        module,
        complexity=complexity,
        kinds=_csv(kinds),
        stages=_csv(stages),
        window_start=windowStart,
        window_end=windowEnd,
    )


@router.get(
    "/modules/{module_id}/economy/summary",
    response_model=EconomySummary,
    response_model_by_alias=True,
)
def get_economy_summary(
    module_id: str,
    complexity: Optional[ComplexityParam] = Query(None),
    db: Session = Depends(get_db),
):
    module = _get_economy_module(db, module_id)
    return EconomyService.build_summary(db, module, complexity=complexity)


@router.get(
    "/modules/{module_id}/economy/timeline",
    response_model=EconomyTimeline,
    response_model_by_alias=True,
)
def get_economy_timeline(
    module_id: str,
    windowStart: Optional[str] = Query(None),
    windowEnd: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    module = _get_economy_module(db, module_id)
    return EconomyService.build_timeline(
        db, module, window_start=windowStart, window_end=windowEnd
    )


@router.get(
    "/modules/{module_id}/economy/metrics",
    response_model=EconomyMetrics,
    response_model_by_alias=True,
)
def get_economy_metrics(
    module_id: str,
    windowStart: Optional[str] = Query(None),
    windowEnd: Optional[str] = Query(None),
    metricIds: Optional[str] = Query(None, description="逗号分隔的指标 id 筛选"),
    db: Session = Depends(get_db),
):
    module = _get_economy_module(db, module_id)
    return EconomyService.build_metrics(
        db,
        module,
        window_start=windowStart,
        window_end=windowEnd,
        metric_ids=_csv(metricIds),
    )
