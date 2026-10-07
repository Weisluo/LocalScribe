"""经济模块视图的 Pydantic 模型（Phase 5 P5-T1；economy_ui_design §3.2 / §3.3 / §11.1）

口径：
- 只读视图：写路径一律复用 P1 通用接口（``/modules/{id}/submodules``、``/modules/{id}/items``、
  ``/worlds/{id}/links``），本文件不定义任何写模型。
- 三档共用同一批模型：``sketch`` 只填计数与速写卡，``structure`` 再填节点与边，
  ``sandbox`` 再填指标序列、周期与时代带；档位只决定披露，不影响任何数据。
- **JSON 一律 camelCase**（``alias_generator=to_camel``）：存进 ``world_module_items.content`` /
  ``world_submodules.meta`` / ``WorldLink.meta`` / ``WorldModule.config`` 的键都是前端按设计文档
  写的 camelCase，视图层直接透传，避免来回映射（契约 §2.7 的 ModuleConfig 同样是 camelCase）。
- 未知键一律保留：``meta`` / ``customFields`` / ``config`` 用自由字典透传，降档或未识别字段不丢数据。

本文件是 P5-T2（economy_service）与 P5-T3（economy API）的冻结接口：改动这里必须先改
``docs/worldbuilding/implementation/phase5_economy.md`` 与受其引用的设计文档。
"""

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .relation import EntityRef, LinkTimeRange

# 契约 §2.6 复杂度三档
ComplexityLevel = Literal["sketch", "structure", "sandbox"]
# economy_ui_design §3.2 流转阶段；crosscut 为通货 / 制度横切轨
EconomyStage = Literal["upstream", "transform", "exchange", "operator", "crosscut"]

MetricValueType = Literal["number", "band"]
MetricPolarity = Literal["higher-better", "neutral", "lower-better"]
SurplusState = Literal["surplus", "deficit", "balanced"]
ConfidenceLevel = Literal["known", "rumored"]

# economy_ui_design §11.1：超过 800 节点自动降级为账册矩阵 + 推荐关联列表
DEGRADE_NODE_THRESHOLD = 800

# economy_ui_design §3.4 推荐 kind 骨架（默认为空，用户点击后才写入 config.entityTypes）
RECOMMENDED_ECONOMY_KINDS: tuple[str, ...] = (
    "resource",
    "good",
    "industry",
    "market",
    "currency",
    "actor",
    "institution",
)
# 系统预登记的条目型 kind（经济周期）：不进节点层，但寻址能力不可删除
CYCLE_KIND = "custom_cycle"
# kind 到阶段的默认映射（config.stages[].defaultKinds 可覆盖；economy_ui_design §3.4）
DEFAULT_KIND_STAGE: Dict[str, str] = {
    "resource": "upstream",
    "good": "transform",
    "industry": "transform",
    "market": "exchange",
    "currency": "crosscut",
    "actor": "operator",
    "institution": "crosscut",
    CYCLE_KIND: "crosscut",
}
DEFAULT_STAGES: tuple[str, ...] = ("upstream", "transform", "exchange", "operator", "crosscut")

ECONOMY_COMPLEXITIES: tuple[str, ...] = ("sketch", "structure", "sandbox")


class EconomyModel(BaseModel):
    """经济视图模型基类：JSON 键为 camelCase，同时接受 snake_case 输入。"""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def is_economy_stage(value: Any) -> bool:
    """阶段 id 校验（config.stages 可改名调序，但 id 必须落在契约枚举内）。"""

    return isinstance(value, str) and value in DEFAULT_STAGES


def stage_of_kind(kind: Optional[str], config: Optional[Dict[str, Any]] = None) -> str:
    """kind -> 阶段：先查 config.stages[].defaultKinds 覆盖，再回落内置映射。

    economy_ui_design §7.7：kind 到阶段的默认映射可在类型配置中覆盖。
    """

    if kind:
        for stage in (config or {}).get("stages") or []:
            if not isinstance(stage, dict):
                continue
            stage_id = stage.get("id")
            if not is_economy_stage(stage_id):
                continue
            if kind in (stage.get("defaultKinds") or []):
                return str(stage_id)
    return DEFAULT_KIND_STAGE.get(kind or "", "transform")


def normalize_metric_value(value: Any) -> Optional[Union[float, List[float]]]:
    """指标采样值归一化：number 或 band（两元数组）。

    非法值返回 None —— 调用方必须**丢弃**该采样，禁止用 0 补点（economy_ui_design §4.6.2）。
    """

    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, (list, tuple)) and len(value) == 2:
        low, high = value
        if isinstance(low, bool) or isinstance(high, bool):
            return None
        if isinstance(low, (int, float)) and isinstance(high, (int, float)):
            return [float(low), float(high)]
    return None


def normalize_intensity(value: Any) -> Optional[int]:
    """meta.intensity 只认 1-5 的整数（economy_ui_design §3.2）。"""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = int(value)
    return number if 1 <= number <= 5 and number == value else None


# ---------------------------------------------------------------------------
# 模块配置（economy_ui_design §3.2 EconomyModuleConfig；后端类名 EconomyConfig，
# 避免与 schemas/worldbuilding.py 的旧 EconomyModuleConfig 在 OpenAPI 里重名）
# ---------------------------------------------------------------------------


class EconomySketchFieldDef(EconomyModel):
    """速写字段定义：3-5 项，chips 类型绑定 chipKind。"""

    id: str
    label: str
    type: Literal["text", "select", "chips"]
    chip_kind: Optional[str] = None
    options: List[str] = Field(default_factory=list)
    max_items: Optional[int] = None


class EconomyMetricDef(EconomyModel):
    """指标定义：默认空数组，用户添加后才有值。"""

    id: str
    label: str
    unit: Optional[str] = None
    value_type: MetricValueType = "number"
    polarity: Optional[MetricPolarity] = None
    stage_filter: List[str] = Field(default_factory=list)
    kind_filter: List[str] = Field(default_factory=list)


class EconomyStageDef(EconomyModel):
    id: str
    label: str
    order: int
    default_kinds: List[str] = Field(default_factory=list)


class EconomyLayerConfig(EconomyModel):
    id: str
    label: str
    icon: str
    min_complexity: ComplexityLevel
    default_on: bool


class EconomyConfig(EconomyModel):
    """经济模块配置（契约 ModuleConfig 的经济扩展）。

    ``levels`` / ``statuses`` / ``fieldSchema`` / ``terminology`` 等契约字段以自由字典透传，
    未识别的键不丢；``stages`` / ``sketchFields`` / ``metrics`` / ``layers`` 只声明经济专属外形。
    """

    # extra="allow"：契约 ModuleConfig 的键集合会随模块演进，未声明的键必须原样透传，
    # 否则一次 GET 就会「看起来删掉」了用户配置（economy_ui_design §7.8）。
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="allow"
    )

    default_complexity: ComplexityLevel = "sketch"
    display_mode: str = "lanes"
    entity_types: List[Dict[str, Any]] = Field(default_factory=list)
    levels: List[Dict[str, Any]] = Field(default_factory=list)
    statuses: List[Dict[str, Any]] = Field(default_factory=list)
    stages: List[EconomyStageDef] = Field(default_factory=list)
    sketch_fields: List[EconomySketchFieldDef] = Field(default_factory=list)
    metrics: List[EconomyMetricDef] = Field(default_factory=list)
    layers: List[EconomyLayerConfig] = Field(default_factory=list)
    default_flow_unit: Optional[str] = None
    field_schema: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    terminology: Dict[str, str] = Field(default_factory=dict)
    palette: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 速写卡（economy.overview）与周期（economy.cycle）
# ---------------------------------------------------------------------------


class EconomyChip(EconomyModel):
    """速写关键词 chip；展开后 chip.id 与新实体 id 相同。"""

    id: str
    label: str
    kind: str
    entity_ref: Optional[EntityRef] = None


class EconomyOverview(EconomyModel):
    """速写卡：模块级唯一一条 item（名称以 ``economy`` 前缀加 ``overview`` 构成）。"""

    form: Optional[str] = None
    currency: Optional[EconomyChip] = None
    resources: List[EconomyChip] = Field(default_factory=list)
    industries: List[EconomyChip] = Field(default_factory=list)
    distribution: Optional[str] = None


class EconomyCyclePhase(EconomyModel):
    id: str
    label: str
    start: Optional[str] = None
    end: Optional[str] = None


class EconomyCycle(EconomyModel):
    """经济周期：模块级 item（一条一个周期，kind 为 ``custom_cycle``，可被 WorldLink 寻址）。"""

    id: str
    name: str
    phases: List[EconomyCyclePhase] = Field(default_factory=list)
    note: Optional[str] = None
    era_ref: Optional[EntityRef] = None


# ---------------------------------------------------------------------------
# 指标采样（economy.metrics，submodule 级）
# ---------------------------------------------------------------------------


class EconomyMetricSample(EconomyModel):
    t: str
    # number 或 band（两元数组）；缺采样不补 0，由前端断线
    value: Union[float, List[float]]
    note: Optional[str] = None
    source_ref: Optional[EntityRef] = None
    time_order: Optional[float] = None


class EconomyMetricSeries(EconomyModel):
    metric_id: str
    entity: EntityRef
    samples: List[EconomyMetricSample] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# 图（nodes / edges / counts）
# ---------------------------------------------------------------------------


class EconomyLinkCounts(EconomyModel):
    outgoing: int = 0
    incoming: int = 0
    total: int = 0


class EconomyNode(EconomyModel):
    """画布节点 / 账册行的统一外形（经济实体或跨模块外站）。"""

    id: str
    name: str
    kind: str
    stage: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    order_index: int = 0
    level: Optional[str] = None
    status: Optional[str] = None
    unit: Optional[str] = None
    # 缺省表示未知，与 0 不同（economy_ui_design §4.6.2）
    scale: Optional[float] = None
    time: Optional[LinkTimeRange] = None
    time_order: Optional[float] = None
    cycle_phase_id: Optional[str] = None
    stub: bool = False
    tags: List[str] = Field(default_factory=list)
    custom_fields: Dict[str, Any] = Field(default_factory=dict)
    counts: EconomyLinkCounts = Field(default_factory=EconomyLinkCounts)
    has_metrics: bool = False
    metric_ids: List[str] = Field(default_factory=list)
    # 跨模块外站：只读、取对方模块领域色、点击跳转
    external: bool = False
    legacy: bool = False
    ref: EntityRef


class EconomyEdge(EconomyModel):
    """经济关联边；流量 / 盈余 / 价格区间全部来自 WorldLink.meta。"""

    id: str
    link_type: str
    label: Optional[str] = None
    reverse_label: Optional[str] = None
    directed: bool = True
    note: Optional[str] = None
    source: EntityRef
    target: EntityRef
    time: Optional[LinkTimeRange] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    # meta 约定外形（economy_ui_design §3.2 EconomyLinkMeta）
    flow: Optional[float] = None
    unit: Optional[str] = None
    flow_series: List[Dict[str, Any]] = Field(default_factory=list)
    intensity: Optional[int] = None
    surplus: Optional[str] = None
    surplus_derived: bool = False
    price_band: Optional[List[float]] = None
    confidence: Optional[str] = None
    route_note: Optional[str] = None
    external: bool = False


class EconomyFoldCounts(EconomyModel):
    """降档提示条：已折叠的往来 / 数值 / 字段（数据未删除）。"""

    links: int = 0
    metrics: int = 0
    fields: int = 0


class EconomyGraphCounts(EconomyModel):
    nodes: int = 0
    edges: int = 0
    by_kind: Dict[str, int] = Field(default_factory=dict)
    by_stage: Dict[str, int] = Field(default_factory=dict)
    # 类型 × 阶段交叉计数，键为 `<kind>|<stage>`：降级时节点明细不返回，
    # 账册矩阵的唯一数据来源（economy_ui_design §11.1）
    by_kind_stage: Dict[str, int] = Field(default_factory=dict)
    by_link_type: Dict[str, int] = Field(default_factory=dict)
    external_nodes: int = 0
    stub_nodes: int = 0
    folded: EconomyFoldCounts = Field(default_factory=EconomyFoldCounts)


class EconomyGraph(EconomyModel):
    module_id: str
    world_id: str
    complexity: ComplexityLevel
    nodes: List[EconomyNode] = Field(default_factory=list)
    edges: List[EconomyEdge] = Field(default_factory=list)
    counts: EconomyGraphCounts = Field(default_factory=EconomyGraphCounts)
    # 超过阈值时只回 counts 与降级标记，不返回节点明细（economy_ui_design §11.1）
    degraded: bool = False
    degrade_reason: Optional[str] = None
    node_limit: int = DEGRADE_NODE_THRESHOLD
    skipped_edges: int = 0
    # 筛选回显：kinds / stages / window 生效后的实际口径
    applied_kinds: List[str] = Field(default_factory=list)
    applied_stages: List[str] = Field(default_factory=list)
    applied_window: Optional[LinkTimeRange] = None


# ---------------------------------------------------------------------------
# 统计与摘要（stats / overview / cycles / metrics 定义）
# ---------------------------------------------------------------------------


class EconomySurplusCounts(EconomyModel):
    surplus: int = 0
    balanced: int = 0
    deficit: int = 0
    unknown: int = 0


class EconomyMetricCoverage(EconomyModel):
    entities_with_metrics: int = 0
    total_entities: int = 0
    coverage: float = 0.0


class EconomyTotals(EconomyModel):
    entities: int = 0
    links: int = 0
    total_flow: float = 0.0
    flow_units: List[str] = Field(default_factory=list)
    multi_unit: bool = False
    surplus: EconomySurplusCounts = Field(default_factory=EconomySurplusCounts)
    metric_coverage: EconomyMetricCoverage = Field(default_factory=EconomyMetricCoverage)


class EconomyStatBucket(EconomyModel):
    id: str
    label: str
    count: int = 0
    icon: Optional[str] = None
    color: Optional[str] = None
    stage: Optional[str] = None


class EconomyTimeRange(EconomyModel):
    start: Optional[str] = None
    end: Optional[str] = None
    # 是否存在可比较的时间锚点；false 时前端不画刻度，不猜时间
    anchored: bool = False


class EconomySummary(EconomyModel):
    """sketch 档的单请求载荷：配置 + 速写卡 + 折叠计数 + 聚合计数 + 时间范围。"""

    module_id: str
    world_id: str
    module_name: str
    complexity: ComplexityLevel
    config: EconomyConfig
    totals: EconomyTotals = Field(default_factory=EconomyTotals)
    stages: List[EconomyStatBucket] = Field(default_factory=list)
    kinds: List[EconomyStatBucket] = Field(default_factory=list)
    levels: List[Dict[str, Any]] = Field(default_factory=list)
    statuses: List[Dict[str, Any]] = Field(default_factory=list)
    fold: EconomyFoldCounts = Field(default_factory=EconomyFoldCounts)
    overview: Optional[EconomyOverview] = None
    cycles: List[EconomyCycle] = Field(default_factory=list)
    metrics: List[EconomyMetricDef] = Field(default_factory=list)
    time_range: EconomyTimeRange = Field(default_factory=EconomyTimeRange)
    unanchored: List[EntityRef] = Field(default_factory=list)
    # 已有数据但档位不披露的条目数（配置 / 指标 / 周期）：供降档提示条使用
    user_items: int = 0


# ---------------------------------------------------------------------------
# 时间线（周期带 / 时代底带 / 事件标记）
# ---------------------------------------------------------------------------


class EconomyCycleBand(EconomyModel):
    cycle_id: str
    label: str
    start: Optional[str] = None
    end: Optional[str] = None
    phases: List[EconomyCyclePhase] = Field(default_factory=list)


class EconomyTimelineMarker(EconomyModel):
    ref: EntityRef
    label: str
    at: Optional[str] = None
    order: Optional[float] = None
    start: Optional[str] = None
    end: Optional[str] = None
    # cycle / era / event：视觉层级依次升高（economy_ui_design §6.4）
    source: str


class EconomyTimeline(EconomyModel):
    module_id: str
    world_id: str
    cycles: List[EconomyCycleBand] = Field(default_factory=list)
    markers: List[EconomyTimelineMarker] = Field(default_factory=list)
    range: EconomyTimeRange = Field(default_factory=EconomyTimeRange)
    # 无时间锚点的实体 / 周期 / 边：排在同段末尾并标注「时间未锚定」
    unanchored: List[EntityRef] = Field(default_factory=list)
    units: List[str] = Field(default_factory=list)
    multi_unit: bool = False


# ---------------------------------------------------------------------------
# 指标载荷（沙盘按时间窗口拉取）
# ---------------------------------------------------------------------------


class EconomyMetrics(EconomyModel):
    module_id: str
    world_id: str
    metrics: List[EconomyMetricDef] = Field(default_factory=list)
    series: List[EconomyMetricSeries] = Field(default_factory=list)
    window: EconomyTimeRange = Field(default_factory=EconomyTimeRange)
    # 窗口内没有任何采样的实体：前端显示「此段无记录」，禁止用 0 补点
    empty_entities: List[EntityRef] = Field(default_factory=list)
