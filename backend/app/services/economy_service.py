"""经济聚合服务（Phase 5 P5-T2 / P5-T5；economy_ui_design §3.3 / §11.1 / §11.2）

职责：把「同一套数据」（WorldSubmodule + meta、WorldModuleItem、WorldLink）聚合成分档视图：
- ``build_summary``  sketch 档的唯一请求：配置、速写卡（economy.overview）、周期、指标定义、
  折叠计数（已折叠 N 条往来 / M 个数值 / K 个字段）、阶段与 kind 计数、规模与流量统计、时间范围。
- ``build_graph``    structure / sandbox 的图：节点（经济实体 + 跨模块外站）、边（economy.* 与通用关联）、
  by_kind / by_stage / by_link_type 计数、800 节点降级（只回计数）、时间窗与 kind / stage 筛选。
- ``build_timeline`` sandbox 的时间轴：周期带（economy.cycle）、时代与事件标记（economy.era_context
  及 history.involves 等入链）、可比较的时间范围、未锚定清单。
- ``build_metrics``  sandbox 的指标序列：submodule 级 ``economy.metrics`` 条目按窗口切片。

约定（不可违反）：
- 只读：本服务不写库、不建表、不新增契约外 link_type；写路径全部由 P1 通用接口承担。
- 缺失值不猜：``meta.scale`` 缺省表示未知（与 0 不同）；``flow`` 缺省与 ``flow = 0`` 必须可区分；
  指标缺采样一律丢弃，**禁止补 0**。
- 多单位不换算：``meta.unit`` 不同的流量分别标注，统计面板只提示 ``multi_unit``。
- sketch 档不返回实体明细与指标序列（分档加载），只回计数与速写卡。
- 未知字段（meta / customFields / config）原样透传，不因降档或未识别而丢数据。
- 只读新结构（P6-T10）：Phase 5 的回填已把旧编码写进 kind / meta / config，
  读取侧不再做 legacy 投影（旧 ``moduleConfig`` / ``relations`` 条目与 emoji 图标不再参与聚合）。

实现要求：所有聚合走批量查询（按 module / world 一次取回后内存聚合），禁止逐节点 N+1 查询；
时间比较只在存在锚点（``meta.timeOrder`` 或时间文本前缀数字）时进行，无锚点排末尾并标未锚定。

实现口径（P5-T2 补充，供后续维护与测试对齐）：

1. **一次取数**：``_economy_module_state`` 按 module / world 各取一次子模块、条目、关联；
   ``_world_entity_index`` 再按世界批量取一次跨模块实体的名字 / kind / meta（含 character），
   画布节点与外站名解析全部查表，不做逐节点查询。
2. **时间锚点**：``_anchor_of`` 只认数字与「文本前缀数字」（如 ``312 年`` -> 312.0）。
   实体锚点来自 ``meta.time.start/end`` 与 ``meta.timeOrder``；没有任何锚点的实体 / 周期 / 边
   进入 ``unanchored``（不猜时间，前端排在同段末尾）。时间窗筛选对**无锚点数据放行**
   （无法比较时不隐藏，符合「隐藏不等于删除」）。
3. **筛选**：``kinds`` / ``stages`` 只作用于经济实体节点；外站节点由「边是否有合法经济端点」
   决定。因筛选或端点缺失未返回的边计入 ``skipped_edges``。
4. **降级**：经济实体节点数超过 ``module.config.nodeLimit``（未配置时 800）即
   ``degraded=True``，只回 counts，不回 nodes / edges（economy_ui_design §11.1）。
5. **折叠计数**：``fold.links`` 是该模块在当前筛选下的边总数（``len(edges) + skipped_edges``，
   含被 kinds / stages / 时间窗筛掉的边），sketch / 降级时给出该总数、其余档位为 0；
   ``fold.metrics`` 是 ``economy.metrics`` 里存的采样条数（sandbox 前的档位折叠）；
   ``fold.fields`` 是 sketch 档未披露的可展示字段数（见 ``_DISPLAYABLE_META_KEYS``）。
6. **无 legacy 投影**（P6-T10）：只读 ``WorldSubmodule.kind / meta``、``WorldModule.config``
   与 ``WorldLink``；旧编码的等价转换由 P1/P5 迁移一次性完成，读取侧不再推导。
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pydantic import ValidationError
from pydantic.alias_generators import to_snake
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import (
    Character,
    WorldLink,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
)
from app.schemas.economy import (
    CYCLE_KIND,
    DEFAULT_STAGES,
    DEGRADE_NODE_THRESHOLD,
    RECOMMENDED_ECONOMY_KINDS,
    EconomyChip,
    EconomyConfig,
    EconomyCycle,
    EconomyCycleBand,
    EconomyCyclePhase,
    EconomyEdge,
    EconomyFoldCounts,
    EconomyGraph,
    EconomyGraphCounts,
    EconomyLinkCounts,
    EconomyMetricCoverage,
    EconomyMetrics,
    EconomyMetricSample,
    EconomyMetricSeries,
    EconomyNode,
    EconomyOverview,
    EconomyStatBucket,
    EconomySummary,
    EconomySurplusCounts,
    EconomyTimeline,
    EconomyTimelineMarker,
    EconomyTimeRange,
    EconomyTotals,
    is_economy_stage,
    normalize_intensity,
    normalize_metric_value,
    stage_of_kind,
)
from app.schemas.relation import EntityRef, LinkTimeRange
from app.services.link_registry import get_link_type

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 条目名常量
# ---------------------------------------------------------------------------

OVERVIEW_ITEM_NAME = "economy.overview"
CYCLE_ITEM_NAME = "economy.cycle"
METRICS_ITEM_NAME = "economy.metrics"

# §3.4 推荐 kind 的 Lucide 图标（config.entityTypes 提供图标时以用户配置为准）
RECOMMENDED_KIND_ICONS: Dict[str, str] = {
    "resource": "gem",
    "good": "package",
    "industry": "factory",
    "market": "store",
    "currency": "coins",
    "actor": "briefcase",
    "institution": "scroll-text",
    CYCLE_KIND: "repeat",
}

# 内置阶段标签（config.stages 可改名调序）
DEFAULT_STAGE_LABELS: Dict[str, str] = {
    "upstream": "上游",
    "transform": "加工",
    "exchange": "交换",
    "operator": "经营",
    "crosscut": "横切",
}

# 跨模块外站节点统一落在横切轨（外站没有经济流转阶段）
EXTERNAL_STAGE = "crosscut"

# sketch 档未披露的可展示 meta 字段（fold.fields 口径）
_DISPLAYABLE_META_KEYS = (
    "level",
    "status",
    "unit",
    "scale",
    "timeOrder",
    "cyclePhaseId",
)

_LUCIDE_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_LEADING_NUMBER_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)")
_EMOJI_VARIATION_SELECTORS = "\ufe0e\ufe0f\u200d"


# ---------------------------------------------------------------------------
# 基础取值 / 时间锚点
# ---------------------------------------------------------------------------


def _as_float(value: Any) -> Optional[float]:
    """数字 -> float；``bool`` 与其它类型 -> None（缺失与 0 必须可区分）。"""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _as_str(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _as_number(value: Any) -> Optional[float]:
    """数字或数字字符串 -> float（旧 ``relations`` 编码里的流量是字符串）。"""

    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = _as_str(value)
    if text is None:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _anchor_of(value: Any) -> Optional[float]:
    """时间锚点：数字原样，文本取前缀数字（``312 年`` -> 312.0），无法比较时 None。"""

    number = _as_float(value)
    if number is not None:
        return number
    if isinstance(value, str):
        match = _LEADING_NUMBER_RE.match(value)
        if match:
            return float(match.group(1))
    return None


def _time_range_anchors(time_range: Any) -> Tuple[Optional[float], Optional[float]]:
    if not isinstance(time_range, dict):
        return (None, None)
    return (_anchor_of(time_range.get("start")), _anchor_of(time_range.get("end")))


def _entity_anchors(meta: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """实体锚点：``meta.time`` 的起止；没有起止时用 ``meta.timeOrder`` 当唯一点。"""

    start, end = _time_range_anchors(meta.get("time"))
    order = _anchor_of(meta.get("timeOrder"))
    if order is not None:
        if start is None:
            start = order
        if end is None:
            end = order
    return (start, end)


def _range_in_window(
    start: Optional[float],
    end: Optional[float],
    window_start: Optional[float],
    window_end: Optional[float],
) -> bool:
    """时间窗相交判断：没有锚点的一侧视为无边界；两端都无锚点视为未知，放行。"""

    if window_start is None and window_end is None:
        return True
    if start is None and end is None:
        return True
    if window_start is not None and end is not None and end < window_start:
        return False
    if window_end is not None and start is not None and start > window_end:
        return False
    return True


def _safe_time_range(start: Any, end: Any) -> Optional[LinkTimeRange]:
    """自由文本时间 -> ``LinkTimeRange``：每侧先按契约截断到 100 字符，两侧都空则 None。

    ``LinkTimeRange`` 的字段有 ``max_length=100``，而进入本服务的文本来自
    ``meta.time`` / ``WorldLink.time_range`` / 查询参数，都是用户自由文本，可能超过上限。
    截断只做「保留前 100 字符」这一件事：``_anchor_of`` 只看前缀数字，截断后锚点仍然可解析
    （因此时间筛选、范围回显与时间轴口径都不变），同时响应不再抛 ``ValidationError``。
    所有构造 ``LinkTimeRange`` 的地方都必须走这里，不要在调用点各写一遍。
    """

    clipped_start = start[:100] if isinstance(start, str) else None
    clipped_end = end[:100] if isinstance(end, str) else None
    if not clipped_start and not clipped_end:
        return None
    return LinkTimeRange(start=clipped_start, end=clipped_end)


def _point_in_window(anchor: Optional[float], window_start, window_end) -> bool:
    """单点时间窗判断；无锚点放行。"""

    if anchor is None:
        return True
    if window_start is not None and anchor < window_start:
        return False
    if window_end is not None and anchor > window_end:
        return False
    return True


def _time_strings(meta: Dict[str, Any]) -> List[str]:
    """实体 / 边的时间文本（用于范围回显与未锚定判定）。"""

    strings: List[str] = []
    time_range = meta.get("time")
    if isinstance(time_range, dict):
        for key in ("start", "end"):
            text = _as_str(time_range.get(key))
            if text:
                strings.append(text)
    if not strings:
        order = meta.get("timeOrder")
        if order is not None:
            strings.append(str(order))
    return strings


def _anchored_strings(strings: Iterable[str]) -> List[Tuple[float, str]]:
    points: List[Tuple[float, str]] = []
    for text in strings:
        anchor = _anchor_of(text)
        if anchor is not None:
            points.append((anchor, text))
    return points


def _range_from_points(points: List[Tuple[float, str]]) -> EconomyTimeRange:
    if not points:
        return EconomyTimeRange()
    start = min(points, key=lambda item: (item[0], item[1]))
    end = max(points, key=lambda item: (item[0], item[1]))
    return EconomyTimeRange(start=start[1], end=end[1], anchored=True)


# ---------------------------------------------------------------------------
# kind / 图标（P6-T10：只认新结构，不再投影旧编码）
# ---------------------------------------------------------------------------


def _economy_kind(kind: Any) -> str:
    """经济实体 kind：直接取 ``WorldSubmodule.kind``（P5 回填后必有值），缺失按 custom。"""

    return _as_str(kind) or "custom"


def _lucide_icon(icon: Any) -> Optional[str]:
    """图标 -> Lucide 名：kebab-case 原样返回，其余（emoji / 旧编码）一律 None。"""

    cleaned = _as_str(icon)
    if not cleaned:
        return None
    cleaned = "".join(ch for ch in cleaned if ch not in _EMOJI_VARIATION_SELECTORS)
    if _LUCIDE_NAME_RE.match(cleaned):
        return cleaned
    return None


# ---------------------------------------------------------------------------
# 批量取数
# ---------------------------------------------------------------------------


def _economy_module_state(
    db: Session, module: WorldModule
) -> Tuple[List[WorldSubmodule], List[WorldModuleItem], List[WorldLink]]:
    """按 module / world 各取一次：经济子模块、经济条目、以经济实体为一端的全部关联。"""

    submodules = (
        db.query(WorldSubmodule)
        .filter(WorldSubmodule.module_id == module.id)
        .order_by(
            WorldSubmodule.order_index, WorldSubmodule.created_at, WorldSubmodule.id
        )
        .all()
    )
    items = (
        db.query(WorldModuleItem)
        .filter(WorldModuleItem.module_id == module.id)
        .order_by(
            WorldModuleItem.order_index, WorldModuleItem.created_at, WorldModuleItem.id
        )
        .all()
    )
    links = (
        db.query(WorldLink)
        .filter(
            WorldLink.world_id == module.world_id,
            or_(
                WorldLink.source_module == "economy",
                WorldLink.target_module == "economy",
            ),
        )
        .order_by(WorldLink.created_at, WorldLink.id)
        .all()
    )
    return submodules, items, links


def _world_entity_index(
    db: Session,
    module: WorldModule,
    submodules: Sequence[WorldSubmodule],
    items: Sequence[WorldModuleItem],
    links: Sequence[WorldLink],
) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """{(module, entity_id): {name, kind, meta}}：本模块 + 跨模块外站一次批量解析。

    经济模块条目（周期等）也进索引，便于边端点命名；外站名字按
    ``模块 -> 子模块 / 条目`` 批量取，角色（character）是项目级实体单独取一次。
    """

    index: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for sub in submodules:
        kind = _economy_kind(sub.kind)
        index[("economy", sub.id)] = {
            "name": sub.name,
            "kind": kind,
            "meta": dict(sub.meta or {}),
        }
    for item in items:
        content = item.content if isinstance(item.content, dict) else {}
        index[("economy", item.id)] = {
            "name": _as_str(content.get("name")) or item.name,
            "kind": item.name if item.name == CYCLE_ITEM_NAME else "entry",
            "meta": {},
        }

    external = {
        (link.source_module, link.source_id)
        for link in links
        if link.source_module != "economy"
    } | {
        (link.target_module, link.target_id)
        for link in links
        if link.target_module != "economy"
    }
    if not external:
        return index

    modules = (
        db.query(WorldModule).filter(WorldModule.world_id == module.world_id).all()
    )
    module_types = {
        row.id: row.module_type for row in modules if row.module_type != "economy"
    }
    wanted_module_ids = [
        module_id for module_id in module_types if module_id is not None
    ]
    if wanted_module_ids:
        rows = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.module_id.in_(wanted_module_ids))
            .all()
        )
        for row in rows:
            index[(module_types[row.module_id], row.id)] = {
                "name": row.name,
                "kind": row.kind,
                "meta": dict(row.meta or {}),
            }
        item_rows = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.module_id.in_(wanted_module_ids))
            .all()
        )
        for row in item_rows:
            index[(module_types[row.module_id], row.id)] = {
                "name": row.name,
                "kind": "entry",
                "meta": {},
            }

    character_ids = [entity_id for name, entity_id in external if name == "character"]
    if character_ids:
        rows = db.query(Character).filter(Character.id.in_(character_ids)).all()
        for row in rows:
            index[("character", row.id)] = {
                "name": row.name,
                "kind": "character",
                "meta": {},
            }
    return index


def _entity_name(index: Dict[Tuple[str, str], Dict[str, Any]], module: str, id_: str):
    entry = index.get((module, id_))
    return entry["name"] if entry else id_


# ---------------------------------------------------------------------------
# 配置 / 桶 / 计数
# ---------------------------------------------------------------------------


def _config_of(db: Session, module: WorldModule) -> EconomyConfig:
    """模块配置：直接读 ``WorldModule.config``（P5 回填后旧条目不再参与），未知键透传。"""

    merged: Dict[str, Any] = dict(module.config or {})
    try:
        return EconomyConfig.model_validate(merged)
    except ValidationError as exc:
        # 单个字段形状非法不能让整个模块 500：剔除出错字段后重试，未声明键仍原样保留
        logger.warning("经济模块 config 校验失败，剔除非法字段后透传：%s", exc)
        safe = dict(merged)
        for error in exc.errors():
            location = error.get("loc") or ()
            if not location:
                continue
            key = str(location[0])
            safe.pop(key, None)
            safe.pop(to_snake(key), None)
        try:
            return EconomyConfig.model_validate(safe)
        except ValidationError:
            return EconomyConfig()


def _complexity_of(complexity: Optional[str], config: EconomyConfig) -> str:
    if complexity in ("sketch", "structure", "sandbox"):
        return complexity
    default = config.default_complexity
    return default if default in ("sketch", "structure", "sandbox") else "sketch"


def _node_limit_of(module: WorldModule) -> int:
    """降级阈值：``module.config.nodeLimit`` 覆盖，未配置时 800（契约 §11.1）。"""

    raw = module.config if isinstance(module.config, dict) else {}
    value = raw.get("nodeLimit")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return DEGRADE_NODE_THRESHOLD
    if value <= 0:
        return DEGRADE_NODE_THRESHOLD
    return int(value)


def _stage_of(kind: str, meta: Dict[str, Any], config: EconomyConfig) -> str:
    """阶段：``meta.stage`` 合法优先，否则按 kind 推导（config.stages 可覆盖）。"""

    stage = meta.get("stage")
    if is_economy_stage(stage):
        return str(stage)
    config_data = config.model_dump(by_alias=True)
    return stage_of_kind(kind, config_data)


def _entity_type_defs(config: EconomyConfig) -> Dict[str, Dict[str, Any]]:
    defs: Dict[str, Dict[str, Any]] = {}
    for item in config.entity_types or []:
        if not isinstance(item, dict):
            continue
        kind = _as_str(item.get("id"))
        if kind:
            defs[kind] = item
    return defs


def _kind_bucket(kind: str, count: int, config: EconomyConfig) -> EconomyStatBucket:
    defs = _entity_type_defs(config)
    definition = defs.get(kind) or {}
    label = _as_str(definition.get("label")) or kind
    icon = _as_str(definition.get("icon")) or RECOMMENDED_KIND_ICONS.get(kind)
    color = _as_str(definition.get("color"))
    return EconomyStatBucket(id=kind, label=label, count=count, icon=icon, color=color)


def _stage_defs(config: EconomyConfig) -> List[Tuple[str, str, int]]:
    """(stage_id, label, order)：config.stages 合法项优先，缺失的内置阶段补在末尾。"""

    result: List[Tuple[str, str, int]] = []
    seen: set = set()
    for index, item in enumerate(config.stages or []):
        stage_id = item.id if hasattr(item, "id") else None
        if not is_economy_stage(stage_id) or stage_id in seen:
            continue
        seen.add(stage_id)
        result.append((str(stage_id), item.label, item.order))
    for stage_id in DEFAULT_STAGES:
        if stage_id in seen:
            continue
        seen.add(stage_id)
        result.append(
            (stage_id, DEFAULT_STAGE_LABELS.get(stage_id, stage_id), len(result))
        )
    return result


def _kind_order(config: EconomyConfig) -> List[str]:
    order: List[str] = []
    for kind in RECOMMENDED_ECONOMY_KINDS:
        if kind not in order:
            order.append(kind)
    for item in config.entity_types or []:
        if isinstance(item, dict):
            kind = _as_str(item.get("id"))
            if kind and kind not in order:
                order.append(kind)
    return order


# ---------------------------------------------------------------------------
# 指标条目 / 折叠计数
# ---------------------------------------------------------------------------


def _metrics_item_values(content: Any) -> Dict[str, List[Any]]:
    """``economy.metrics`` content -> {metricId: [sample, ...]}（非法形状返回空）。"""

    if not isinstance(content, dict):
        return {}
    values = content.get("values")
    if not isinstance(values, dict):
        return {}
    result: Dict[str, List[Any]] = {}
    for metric_id, samples in values.items():
        if isinstance(metric_id, str) and isinstance(samples, list):
            result[metric_id] = samples
    return result


def _metrics_by_submodule(
    items: Sequence[WorldModuleItem],
) -> Tuple[Dict[str, Dict[str, List[Any]]], int]:
    """submodule_id -> {metricId: samples}，同时返回采样总条数（fold.metrics 口径）。"""

    result: Dict[str, Dict[str, List[Any]]] = {}
    total = 0
    for item in items:
        if item.name != METRICS_ITEM_NAME or not item.submodule_id:
            continue
        values = _metrics_item_values(item.content)
        if not values:
            continue
        bucket = result.setdefault(item.submodule_id, {})
        for metric_id, samples in values.items():
            bucket.setdefault(metric_id, []).extend(samples)
            total += len(samples)
    return result, total


def _displayable_field_count(meta: Dict[str, Any]) -> int:
    """可展示字段数：已知 meta 字段 + tags + customFields 的非空项。"""

    count = 0
    for key in _DISPLAYABLE_META_KEYS:
        value = meta.get(key)
        if value is not None and value != "" and value != []:
            count += 1
    if meta.get("tags"):
        count += 1
    custom_fields = meta.get("customFields")
    if isinstance(custom_fields, dict):
        for value in custom_fields.values():
            if value is not None and value != "" and value != [] and value != {}:
                count += 1
    return count


# ---------------------------------------------------------------------------
# 图节点 / 边构造
# ---------------------------------------------------------------------------


def _link_entity_counts(links: Sequence[WorldLink]) -> Dict[str, Dict[str, int]]:
    counts: Dict[str, Dict[str, int]] = {}
    for link in links:
        if link.source_module == "economy":
            counts.setdefault(link.source_id, {"outgoing": 0, "incoming": 0})[
                "outgoing"
            ] += 1
        if link.target_module == "economy":
            counts.setdefault(link.target_id, {"outgoing": 0, "incoming": 0})[
                "incoming"
            ] += 1
    return counts


def _link_counts_for(
    entity_id: str, counts: Dict[str, Dict[str, int]]
) -> EconomyLinkCounts:
    bucket = counts.get(entity_id) or {"outgoing": 0, "incoming": 0}
    outgoing = int(bucket["outgoing"])
    incoming = int(bucket["incoming"])
    return EconomyLinkCounts(
        outgoing=outgoing, incoming=incoming, total=outgoing + incoming
    )


def _node_from_submodule(
    sub: WorldSubmodule,
    config: EconomyConfig,
    counts: Dict[str, Dict[str, int]],
    metrics_map: Dict[str, Dict[str, List[Any]]],
) -> EconomyNode:
    kind = _economy_kind(sub.kind)
    meta = dict(sub.meta or {})
    level = _as_str(meta.get("level"))
    icon = _lucide_icon(sub.icon)
    color = sub.color if not str(sub.color or "").startswith("type:") else None
    time_range = meta.get("time")
    parsed_time = None
    if isinstance(time_range, dict):
        parsed_time = _safe_time_range(
            _as_str(time_range.get("start")), _as_str(time_range.get("end"))
        )
    metric_ids = sorted((metrics_map.get(sub.id) or {}).keys())
    # meta 形状不做猜测：tags 只认 list 里的 str（字符串会被拆成字符数组），
    # customFields 只认 dict（list / str 会让 dict() 抛 ValueError）——非契约形状一律空，
    # 与 ``_displayable_field_count`` 的 isinstance 守卫同口径。
    raw_tags = meta.get("tags")
    tags = (
        [tag for tag in raw_tags if isinstance(tag, str)]
        if isinstance(raw_tags, list)
        else []
    )
    raw_custom_fields = meta.get("customFields")
    custom_fields = (
        dict(raw_custom_fields) if isinstance(raw_custom_fields, dict) else {}
    )
    # 旧数据标记（P5 迁移写入 meta.legacyIcon / meta.legacy）只作为展示提示保留
    legacy = bool(meta.get("legacyIcon") or meta.get("legacy"))
    return EconomyNode(
        id=sub.id,
        name=sub.name,
        kind=kind,
        stage=_stage_of(kind, meta, config),
        description=sub.description,
        icon=icon,
        color=color,
        order_index=sub.order_index or 0,
        level=level,
        status=_as_str(meta.get("status")),
        unit=_as_str(meta.get("unit")),
        scale=_as_float(meta.get("scale")),
        time=parsed_time,
        time_order=_as_float(meta.get("timeOrder")),
        cycle_phase_id=_as_str(meta.get("cyclePhaseId")),
        stub=bool(meta.get("stub")),
        tags=tags,
        custom_fields=custom_fields,
        counts=_link_counts_for(sub.id, counts),
        has_metrics=bool(metric_ids),
        metric_ids=metric_ids,
        external=False,
        legacy=legacy,
        ref=EntityRef(module="economy", kind=kind, id=sub.id),
    )


def _external_node(
    module_name: str,
    kind: str,
    entity_id: str,
    index: Dict[Tuple[str, str], Dict[str, Any]],
) -> EconomyNode:
    entry = index.get((module_name, entity_id)) or {}
    name = entry.get("name") or entity_id
    resolved_kind = _as_str(entry.get("kind")) or kind
    return EconomyNode(
        id=entity_id,
        name=name,
        kind=str(resolved_kind),
        stage=EXTERNAL_STAGE,
        ref=EntityRef(module=module_name, kind=str(resolved_kind), id=entity_id),
        external=True,
    )


def _edge_meta(link: WorldLink) -> Dict[str, Any]:
    meta = link.meta if isinstance(link.meta, dict) else {}
    flow = _as_float(meta.get("flow"))
    unit = _as_str(meta.get("unit"))
    flow_series = meta.get("flowSeries")
    intensity = normalize_intensity(meta.get("intensity"))
    surplus = meta.get("surplus")
    if surplus not in ("surplus", "deficit", "balanced"):
        surplus = None
    price_band_raw = meta.get("priceBand")
    price_band = None
    if isinstance(price_band_raw, (list, tuple)) and len(price_band_raw) == 2:
        low, high = _as_float(price_band_raw[0]), _as_float(price_band_raw[1])
        if low is not None and high is not None:
            price_band = [low, high]
    confidence = meta.get("confidence")
    if confidence not in ("known", "rumored"):
        confidence = None
    return {
        "flow": flow,
        "unit": unit,
        "flow_series": (
            [item for item in flow_series if isinstance(item, dict)]
            if isinstance(flow_series, list)
            else []
        ),
        "intensity": intensity,
        "surplus": surplus,
        "surplus_derived": bool(meta.get("surplusDerived")),
        "price_band": price_band,
        "confidence": confidence,
        "route_note": _as_str(meta.get("routeNote")),
    }


def _edge_from_link(
    link: WorldLink,
    source_ref: EntityRef,
    target_ref: EntityRef,
    source_external: bool,
    target_external: bool,
) -> EconomyEdge:
    definition = get_link_type(link.link_type)
    parsed = _edge_meta(link)
    time_range = None
    if isinstance(link.time_range, dict):
        time_range = _safe_time_range(
            _as_str(link.time_range.get("start")), _as_str(link.time_range.get("end"))
        )
    return EconomyEdge(
        id=link.id,
        link_type=link.link_type,
        label=link.label,
        reverse_label=definition.reverse_label if definition else None,
        directed=bool(link.directed),
        note=link.note,
        source=source_ref,
        target=target_ref,
        time=time_range,
        meta=dict(link.meta or {}),
        external=bool(source_external or target_external),
        **parsed,
    )


def _totals_of(
    submodules: Sequence[WorldSubmodule],
    links: Sequence[WorldLink],
    metrics_map: Dict[str, Dict[str, List[Any]]],
) -> EconomyTotals:
    total_flow = 0.0
    units: set = set()
    surplus = EconomySurplusCounts()
    for link in links:
        meta = link.meta if isinstance(link.meta, dict) else {}
        flow = _as_float(meta.get("flow"))
        if flow is not None:
            total_flow += flow
            unit = _as_str(meta.get("unit"))
            if unit:
                units.add(unit)
        state = meta.get("surplus")
        if state == "surplus":
            surplus.surplus += 1
        elif state == "balanced":
            surplus.balanced += 1
        elif state == "deficit":
            surplus.deficit += 1
    surplus.unknown = max(
        len(links) - surplus.surplus - surplus.balanced - surplus.deficit, 0
    )
    with_metrics = sum(1 for sub in submodules if metrics_map.get(sub.id))
    total_entities = len(submodules)
    coverage = round(with_metrics / total_entities, 4) if total_entities else 0.0
    return EconomyTotals(
        entities=total_entities,
        links=len(links),
        total_flow=total_flow,
        flow_units=sorted(units),
        multi_unit=len(units) > 1,
        surplus=surplus,
        metric_coverage=EconomyMetricCoverage(
            entities_with_metrics=with_metrics,
            total_entities=total_entities,
            coverage=coverage,
        ),
    )


# ---------------------------------------------------------------------------
# 速写卡 / 周期
# ---------------------------------------------------------------------------


def _chip_of(value: Any) -> Optional[EconomyChip]:
    if not isinstance(value, dict):
        return None
    chip_id = _as_str(value.get("id"))
    if not chip_id:
        return None
    label = _as_str(value.get("label")) or chip_id
    kind = _as_str(value.get("kind")) or "custom"
    entity_ref = None
    raw_ref = value.get("entityRef", value.get("entity_ref"))
    if isinstance(raw_ref, dict):
        try:
            entity_ref = EntityRef.model_validate(raw_ref)
        except ValidationError:
            entity_ref = None
    return EconomyChip(id=chip_id, label=label, kind=kind, entity_ref=entity_ref)


def _chips_of(value: Any) -> List[EconomyChip]:
    if not isinstance(value, list):
        return []
    return [chip for chip in (_chip_of(item) for item in value) if chip is not None]


def _overview_of(content: Any) -> Optional[EconomyOverview]:
    if not isinstance(content, dict):
        return None
    return EconomyOverview(
        form=_as_str(content.get("form")),
        currency=_chip_of(content.get("currency")),
        resources=_chips_of(content.get("resources")),
        industries=_chips_of(content.get("industries")),
        distribution=_as_str(content.get("distribution")),
    )


def _phase_of(value: Any) -> Optional[EconomyCyclePhase]:
    if not isinstance(value, dict):
        return None
    phase_id = _as_str(value.get("id"))
    if not phase_id:
        return None
    return EconomyCyclePhase(
        id=phase_id,
        label=_as_str(value.get("label")) or phase_id,
        start=_as_str(value.get("start")),
        end=_as_str(value.get("end")),
    )


def _cycle_of(item: WorldModuleItem) -> EconomyCycle:
    content = item.content if isinstance(item.content, dict) else {}
    phases = [
        phase
        for phase in (_phase_of(value) for value in (content.get("phases") or []))
        if phase is not None
    ]
    return EconomyCycle(
        id=item.id,
        name=_as_str(content.get("name")) or item.name,
        phases=phases,
        note=_as_str(content.get("note")),
    )


def _cycle_items(items: Sequence[WorldModuleItem]) -> List[WorldModuleItem]:
    return [item for item in items if item.name == CYCLE_ITEM_NAME]


def _cycle_band(item: WorldModuleItem) -> EconomyCycleBand:
    """周期带起止：按 ``_anchor_of`` 取最早起点与最晚终点，与 phases 书写顺序无关。"""

    cycle = _cycle_of(item)
    # 与 ``_range_from_points`` 同口径：各自按锚点取最小 / 最大，倒序写的 phases 不再算错
    starts = _range_from_points(
        _anchored_strings(phase.start for phase in cycle.phases if phase.start)
    )
    ends = _range_from_points(
        _anchored_strings(phase.end for phase in cycle.phases if phase.end)
    )
    return EconomyCycleBand(
        cycle_id=item.id,
        label=cycle.name,
        start=starts.start,
        end=ends.end,
        phases=cycle.phases,
    )


# ---------------------------------------------------------------------------
# 服务
# ---------------------------------------------------------------------------


class EconomyService:
    """经济模块的只读聚合服务（全部方法为静态方法，便于 API 直接调用与测试）。"""

    # ------------------------------------------------------------------
    # 视图入口（P5-T3 消费；签名与 schemas/economy.py 一起构成冻结接口）
    # ------------------------------------------------------------------

    @staticmethod
    def build_summary(
        db: Session,
        module: WorldModule,
        complexity: Optional[str] = None,
    ) -> EconomySummary:
        """sketch 档载荷：配置 + 速写卡 + 折叠计数 + 统计 + 时间范围。"""

        config = _config_of(db, module)
        level = _complexity_of(complexity, config)
        submodules, items, links = _economy_module_state(db, module)
        metrics_map, sample_total = _metrics_by_submodule(items)

        overview = None
        cycles: List[EconomyCycle] = []
        user_items = 0
        for item in items:
            # 速写卡与周期在 summary 里已披露，其余条目（economy.metrics / 用户条目）只计数，
            # 供降档提示条使用，不在此档返回内容
            if item.name == OVERVIEW_ITEM_NAME and overview is None:
                overview = _overview_of(item.content)
            elif item.name == CYCLE_ITEM_NAME:
                cycles.append(_cycle_of(item))
            else:
                user_items += 1

        kind_counts: Dict[str, int] = {}
        stage_counts: Dict[str, int] = {}
        field_total = 0
        points: List[Tuple[float, str]] = []
        unanchored: List[EntityRef] = []
        for sub in submodules:
            kind = _economy_kind(sub.kind)
            meta = dict(sub.meta or {})
            kind_counts[kind] = kind_counts.get(kind, 0) + 1
            stage = _stage_of(kind, meta, config)
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            field_total += _displayable_field_count(meta)
            strings = _time_strings(meta)
            anchored = _anchored_strings(strings)
            points.extend(anchored)
            if not anchored:
                unanchored.append(EntityRef(module="economy", kind=kind, id=sub.id))

        for link in links:
            range_meta = {
                "time": link.time_range,
                "timeOrder": None,
            }
            points.extend(_anchored_strings(_time_strings(range_meta)))
        for item in _cycle_items(items):
            cycle = _cycle_of(item)
            anchored = _anchored_strings(_cycle_phase_strings(cycle))
            points.extend(anchored)
            if not anchored:
                unanchored.append(
                    EntityRef(module="economy", kind=CYCLE_KIND, id=item.id)
                )

        stages = [
            EconomyStatBucket(
                id=stage_id,
                label=label,
                count=stage_counts.get(stage_id, 0),
                stage=stage_id,
            )
            for stage_id, label, _order in _stage_defs(config)
        ]
        # kind / 阶段桶保留完整骨架（计数可为 0），数据里出现的额外 kind 追加在末尾，
        # 前端筛选轨道因此不随数据增删而抖动。
        kinds = [
            _kind_bucket(kind, kind_counts.get(kind, 0), config)
            for kind in _kind_order(config)
        ]
        for kind in sorted(kind_counts, key=lambda value: (-kind_counts[value], value)):
            if all(bucket.id != kind for bucket in kinds):
                kinds.append(_kind_bucket(kind, kind_counts[kind], config))

        totals = _totals_of(submodules, links, metrics_map)
        fold = EconomyFoldCounts(
            links=len(links),
            metrics=sample_total,
            fields=field_total,
        )
        return EconomySummary(
            module_id=module.id,
            world_id=module.world_id,
            module_name=module.name,
            complexity=level,
            config=config,
            totals=totals,
            stages=stages,
            kinds=kinds,
            levels=[item for item in (config.levels or []) if isinstance(item, dict)],
            statuses=[
                item for item in (config.statuses or []) if isinstance(item, dict)
            ],
            fold=fold,
            overview=overview,
            cycles=cycles,
            metrics=list(config.metrics or []),
            time_range=_range_from_points(points),
            unanchored=unanchored,
            user_items=user_items,
        )

    @staticmethod
    def build_graph(
        db: Session,
        module: WorldModule,
        complexity: Optional[str] = None,
        kinds: Optional[List[str]] = None,
        stages: Optional[List[str]] = None,
        window_start: Optional[str] = None,
        window_end: Optional[str] = None,
    ) -> EconomyGraph:
        """structure / sandbox 图：节点、边、计数、降级标记与筛选回显。"""

        config = _config_of(db, module)
        level = _complexity_of(complexity, config)
        kind_filter = [kind for kind in (kinds or []) if _as_str(kind)]
        stage_filter = [stage for stage in (stages or []) if _as_str(stage)]
        w_start = _anchor_of(window_start)
        w_end = _anchor_of(window_end)
        windowed = w_start is not None or w_end is not None

        submodules, items, links = _economy_module_state(db, module)
        index = _world_entity_index(db, module, submodules, items, links)
        link_counts = _link_entity_counts(links)
        metrics_map, sample_total = _metrics_by_submodule(items)

        # 1) 经济实体节点（kinds / stages / 时间窗筛选）
        selected: Dict[str, EconomyNode] = {}
        for sub in submodules:
            node = _node_from_submodule(sub, config, link_counts, metrics_map)
            if kind_filter and node.kind not in kind_filter:
                continue
            if stage_filter and node.stage not in stage_filter:
                continue
            if windowed:
                start, end = _entity_anchors(dict(sub.meta or {}))
                if not _range_in_window(start, end, w_start, w_end):
                    continue
            selected[sub.id] = node

        # 2) 边：端点必须都能落在节点集合里（经济端点用已筛选节点，外站按需建）
        edges: List[EconomyEdge] = []
        external_nodes: Dict[Tuple[str, str], EconomyNode] = {}
        # 只有被实际保留的边引用到的外站节点才进输出与计数：external_nodes 只是超集，
        # 一端被 kinds / stages / window 筛掉的边不会把另一端的外站节点留成孤儿。
        used_external: Dict[Tuple[str, str], EconomyNode] = {}
        skipped_edges = 0
        for link in links:
            if windowed:
                start, end = _time_range_anchors(link.time_range)
                if not _range_in_window(start, end, w_start, w_end):
                    skipped_edges += 1
                    continue
            source_node = _endpoint_node(
                link.source_module,
                link.source_kind,
                link.source_id,
                selected,
                external_nodes,
                index,
            )
            target_node = _endpoint_node(
                link.target_module,
                link.target_kind,
                link.target_id,
                selected,
                external_nodes,
                index,
            )
            if source_node is None or target_node is None:
                skipped_edges += 1
                continue
            for endpoint in (source_node, target_node):
                if not endpoint.external:
                    continue
                key = (endpoint.ref.module, endpoint.ref.id)
                # dict 保持插入顺序：外站节点按首次被保留边使用的顺序排列
                used_external.setdefault(key, endpoint)
            edges.append(
                _edge_from_link(
                    link,
                    source_node.ref,
                    target_node.ref,
                    source_node.external,
                    target_node.external,
                )
            )

        # 输出顺序稳定：经济实体（selected 顺序）在前，外站按首次使用顺序在后
        nodes = list(selected.values()) + list(used_external.values())
        by_kind: Dict[str, int] = {}
        by_stage: Dict[str, int] = {}
        # 类型 × 阶段交叉计数：只统计经济实体节点（不含外站），降级 / sketch 隐藏明细时
        # 仍照常返回，是账册矩阵的唯一数据源。
        by_kind_stage: Dict[str, int] = {}
        stub_nodes = 0
        for node in selected.values():
            by_kind[node.kind] = by_kind.get(node.kind, 0) + 1
            by_stage[node.stage] = by_stage.get(node.stage, 0) + 1
            key = f"{node.kind}|{node.stage}"
            by_kind_stage[key] = by_kind_stage.get(key, 0) + 1
            if node.stub:
                stub_nodes += 1
        by_link_type: Dict[str, int] = {}
        for edge in edges:
            by_link_type[edge.link_type] = by_link_type.get(edge.link_type, 0) + 1

        node_limit = _node_limit_of(module)
        degraded = len(nodes) > node_limit
        hidden = level == "sketch" or degraded

        field_total = sum(
            _displayable_field_count(dict(sub.meta or {}))
            for sub in submodules
            if sub.id in selected
        )
        counts = EconomyGraphCounts(
            nodes=len(nodes),
            edges=len(edges),
            by_kind=by_kind,
            by_stage=by_stage,
            by_kind_stage=by_kind_stage,
            by_link_type=by_link_type,
            external_nodes=len(used_external),
            stub_nodes=stub_nodes,
            folded=EconomyFoldCounts(
                # 该模块在当前筛选下的边总数（返回的 + 被筛掉的），与文件顶部口径一致
                links=len(edges) + skipped_edges if hidden else 0,
                metrics=sample_total if level != "sandbox" else 0,
                fields=field_total if level == "sketch" else 0,
            ),
        )

        degrade_reason = None
        if degraded:
            degrade_reason = (
                f"节点数 {len(nodes)} 超过上限 {node_limit}，"
                "已降级为账册矩阵 + 推荐关联列表（只返回计数，不返回节点与边明细）"
            )
        return EconomyGraph(
            module_id=module.id,
            world_id=module.world_id,
            complexity=level,
            nodes=[] if hidden else nodes,
            edges=[] if hidden else edges,
            counts=counts,
            degraded=degraded,
            degrade_reason=degrade_reason,
            node_limit=node_limit,
            skipped_edges=skipped_edges,
            applied_kinds=kind_filter,
            applied_stages=stage_filter,
            # 查询参数是自由文本，同样先截断到 LinkTimeRange 的 100 字符上限
            applied_window=(
                _safe_time_range(window_start, window_end) if windowed else None
            ),
        )

    @staticmethod
    def build_timeline(
        db: Session,
        module: WorldModule,
        window_start: Optional[str] = None,
        window_end: Optional[str] = None,
    ) -> EconomyTimeline:
        """sandbox 时间轴：周期带、时代 / 事件标记、未锚定清单。"""

        w_start = _anchor_of(window_start)
        w_end = _anchor_of(window_end)
        windowed = w_start is not None or w_end is not None
        submodules, items, links = _economy_module_state(db, module)
        index = _world_entity_index(db, module, submodules, items, links)

        cycles: List[EconomyCycleBand] = []
        points: List[Tuple[float, str]] = []
        unanchored: List[EntityRef] = []
        for item in _cycle_items(items):
            band = _cycle_band(item)
            cycle = _cycle_of(item)
            strings = _cycle_phase_strings(cycle)
            anchored = _anchored_strings(strings)
            if windowed and not _range_in_window(
                _anchor_of(band.start), _anchor_of(band.end), w_start, w_end
            ):
                continue
            cycles.append(band)
            points.extend(anchored)
            if not anchored:
                unanchored.append(
                    EntityRef(module="economy", kind=CYCLE_KIND, id=item.id)
                )

        markers: List[EconomyTimelineMarker] = []
        for link in links:
            if link.link_type != "economy.era_context":
                continue
            if link.target_module != "history":
                continue
            if link.target_kind not in ("era", "event"):
                continue
            entry = index.get((link.target_module, link.target_id)) or {}
            target_meta = entry.get("meta") or {}
            raw_time = target_meta.get("time")
            time_range = raw_time if isinstance(raw_time, dict) else {}
            # 窗口判定与节点路径同口径：先并入 meta.timeOrder（``_entity_anchors``），
            # 只用 timeOrder 锚定的时代 / 事件不会被漏筛或误留。
            start, end = _entity_anchors(target_meta)
            if windowed and not _range_in_window(start, end, w_start, w_end):
                continue
            order = _anchor_of(target_meta.get("timeOrder"))
            markers.append(
                EconomyTimelineMarker(
                    ref=EntityRef(
                        module=link.target_module,
                        kind=link.target_kind,
                        id=link.target_id,
                    ),
                    label=str(entry.get("name") or link.target_id),
                    at=_as_str(time_range.get("start")),
                    order=order,
                    start=_as_str(time_range.get("start")),
                    end=_as_str(time_range.get("end")),
                    source="era" if link.target_kind == "era" else "event",
                )
            )
            points.extend(_anchored_strings(_time_strings(target_meta)))

        for sub in submodules:
            meta = dict(sub.meta or {})
            kind = _economy_kind(sub.kind)
            start, end = _entity_anchors(meta)
            if windowed and not _range_in_window(start, end, w_start, w_end):
                continue
            anchored = _anchored_strings(_time_strings(meta))
            points.extend(anchored)
            if not anchored:
                unanchored.append(EntityRef(module="economy", kind=kind, id=sub.id))

        units: set = set()
        for link in links:
            meta = link.meta if isinstance(link.meta, dict) else {}
            if _as_float(meta.get("flow")) is not None:
                unit = _as_str(meta.get("unit"))
                if unit:
                    units.add(unit)
            start, end = _time_range_anchors(link.time_range)
            if windowed and not _range_in_window(start, end, w_start, w_end):
                continue
            anchored = _anchored_strings(
                _time_strings({"time": link.time_range, "timeOrder": None})
            )
            points.extend(anchored)
            if not anchored:
                unanchored.append(EntityRef(module="economy", kind="link", id=link.id))

        return EconomyTimeline(
            module_id=module.id,
            world_id=module.world_id,
            cycles=cycles,
            markers=markers,
            range=_range_from_points(points),
            unanchored=unanchored,
            units=sorted(units),
            multi_unit=len(units) > 1,
        )

    @staticmethod
    def build_metrics(
        db: Session,
        module: WorldModule,
        window_start: Optional[str] = None,
        window_end: Optional[str] = None,
        metric_ids: Optional[List[str]] = None,
    ) -> EconomyMetrics:
        """sandbox 指标序列：按窗口切片，缺采样丢弃并在 empty_entities 里回报。"""

        config = _config_of(db, module)
        requested = [metric for metric in (metric_ids or []) if _as_str(metric)]
        w_start = _anchor_of(window_start)
        w_end = _anchor_of(window_end)
        windowed = w_start is not None or w_end is not None

        submodules, items, _links = _economy_module_state(db, module)
        metrics_map, _sample_total = _metrics_by_submodule(items)

        defs = list(config.metrics or [])
        if requested:
            wanted = set(requested)
            defs = [definition for definition in defs if definition.id in wanted]

        series: List[EconomyMetricSeries] = []
        empty_entities: List[EntityRef] = []
        any_anchor = False
        for sub in submodules:
            kind = _economy_kind(sub.kind)
            entry = metrics_map.get(sub.id) or {}
            if requested:
                metric_names = [metric for metric in requested if metric in entry]
                metric_names += [metric for metric in requested if metric not in entry]
                metric_names = sorted(set(metric_names))
            else:
                metric_names = sorted(set(entry) | {item.id for item in defs})
            had_sample = False
            for metric_id in metric_names:
                samples: List[EconomyMetricSample] = []
                for raw in entry.get(metric_id) or []:
                    sample = _sample_of(raw, w_start, w_end, windowed)
                    if sample is None:
                        continue
                    samples.append(sample)
                    if (
                        _anchor_of(sample.time_order) is not None
                        or _anchor_of(sample.t) is not None
                    ):
                        any_anchor = True
                if samples or (requested and metric_id in requested):
                    series.append(
                        EconomyMetricSeries(
                            metric_id=metric_id,
                            entity=EntityRef(module="economy", kind=kind, id=sub.id),
                            samples=samples,
                        )
                    )
                if samples:
                    had_sample = True
            if not had_sample:
                empty_entities.append(EntityRef(module="economy", kind=kind, id=sub.id))

        return EconomyMetrics(
            module_id=module.id,
            world_id=module.world_id,
            metrics=defs,
            series=series,
            window=EconomyTimeRange(
                start=window_start,
                end=window_end,
                anchored=bool(windowed or any_anchor),
            ),
            empty_entities=empty_entities,
        )


# ---------------------------------------------------------------------------
# 私有 helper（图 / 指标）
# ---------------------------------------------------------------------------


def _endpoint_node(
    module_name: str,
    kind: str,
    entity_id: str,
    selected: Dict[str, EconomyNode],
    external_nodes: Dict[Tuple[str, str], EconomyNode],
    index: Dict[Tuple[str, str], Dict[str, Any]],
) -> Optional[EconomyNode]:
    """边端点 -> 节点：经济端点必须已在已筛选节点集里，其余按需建外站节点。

    ``external_nodes`` 只是构建期缓存（可以是超集）：某条边的另一端被筛掉时，这里缓存的
    外站节点不会被输出，输出与计数由调用方按「实际保留的边」裁剪。
    """

    if module_name == "economy":
        return selected.get(entity_id)
    key = (module_name, entity_id)
    node = external_nodes.get(key)
    if node is None:
        node = _external_node(module_name, kind, entity_id, index)
        external_nodes[key] = node
    return node


def _cycle_phase_strings(cycle: EconomyCycle) -> List[str]:
    strings: List[str] = []
    for phase in cycle.phases:
        if phase.start:
            strings.append(phase.start)
        if phase.end:
            strings.append(phase.end)
    return strings


def _sample_of(
    raw: Any,
    window_start: Optional[float],
    window_end: Optional[float],
    windowed: bool,
) -> Optional[EconomyMetricSample]:
    """单条采样 -> EconomyMetricSample；非法 / 缺值返回 None（调用方丢弃，禁止补 0）。"""

    if not isinstance(raw, dict):
        return None
    text = _as_str(raw.get("t"))
    value = normalize_metric_value(raw.get("value"))
    if text is None or value is None:
        return None
    time_order = _as_float(raw.get("timeOrder", raw.get("time_order")))
    anchor = time_order if time_order is not None else _anchor_of(text)
    if windowed and anchor is not None:
        if not _point_in_window(anchor, window_start, window_end):
            return None
    source_ref = None
    raw_ref = raw.get("sourceRef", raw.get("source_ref"))
    if isinstance(raw_ref, dict):
        try:
            source_ref = EntityRef.model_validate(raw_ref)
        except ValidationError:
            source_ref = None
    return EconomyMetricSample(
        t=text,
        value=value,
        note=_as_str(raw.get("note")),
        source_ref=source_ref,
        time_order=time_order,
    )
