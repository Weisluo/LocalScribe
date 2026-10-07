/**
 * EconomyView 视觉数值模型（Phase 5 P5-T12，**全模块唯一的数值口径**）
 *
 * 依据：economy_ui_design §4.6.1（沙盘总览）、§4.6.2（叠加规则，防止视觉撒谎）、§4.6.3（时间窗口）、
 * §4.6.4（统计面板）、§8.4（退化形态）、§11.3（归一化口径）；phase5_economy §8 风险表。
 *
 * =========================================================================
 * 入参形状（`EconomyVisualInput`）
 * =========================================================================
 * ```ts
 * buildVisualModel({
 *   nodes,                       // 必填：当前筛选后的节点（EconomyNode[]）
 *   edges,                       // 必填：两端都在结果集里的边（EconomyEdge[]）
 *   window,                      // 可选：刷选窗口 { start?, end? }（文本或数字锚点文本）
 *   layers,                      // 可选：图层开关（只用于 hiddenLayersPresent，不影响任何数值）
 *   defaultFlowUnit,             // 可选：边没有 unit 时的兜底单位（等价 config.defaultFlowUnit）
 *   config, levels, summary, timeline, metrics, complexity,   // 全部可选，用于等级归一 / 单位 / 推定
 * })
 * ```
 * 归一化使用**当前视图内已知数据**（§11.3）：等级按视图内 levels 顺序，规模按视图内最大 scale，
 * 流量按视图内最大 flow。筛选后含义会变，这是设计允许的（绝对模式与相对模式显式记录在 `scale`）。
 *
 * =========================================================================
 * 口径（改动前先改设计文档）
 * =========================================================================
 * 1. 节点大小：`size = 小站点 + (大站点 - 小站点) × (0.5×等级归一 + 0.5×规模归一)`；
 *    只填一项按单项归一；两项都缺省 = 标准小站点（`sm`）+ 空心环 +「规模未填」。
 *    **`scale = 0` 是有效值**（归一为 0），只有缺省（null/undefined）才是未知。
 *    等级顺序：有 rank 时按 rank 升序，否则按 levels 数组顺序；未登记的等级视为缺省（不猜）。
 * 2. 边宽：`w = w最小 + (w最大 - w最小) × sqrt(flow / flowMax)`（平方根压缩极端值）；
 *    全图无任何流量值 -> `scale = 'intensity'`（按 `edge.intensity` 1-5 取线宽，无 intensity 细线）；
 *    只有一条边有流量值 -> `scale = 'absolute'`：固定中等线宽 + 直接标「120 袋/季」，**不做 100% 归一**；
 *    ≥2 条有值 -> `'relative'`；没有任何边 -> `'none'`。
 * 3. 缺省 vs 0：`flow` 缺省 -> 标注「—」（画布据此上虚线）；`flow = 0` -> 标注「0」+ 细实线。
 *    两个信息都只通过 `edgeLabel` / `edgeWidth` 表达（`EconomyVisualModel` 没有 lineStyle 字段）：
 *    `edgeLabel[id] === '—'` 等价于「流量缺省」（虚线），`'0'` 等价于「有效 0」（细实线）。
 * 4. 颜色：优先 `meta.surplus`（节点另兼容 `customFields.surplus`，§11.6 旧 meta 投影）；
 *    没有时若有可比指标（数值型采样）按**窗口内最后一个采样的正负**推定，并把 id 放进
 *    `buildSurplusDetail().derived`（界面必须标「推定」）；没有依据一律 `'unknown'` 中性，不猜。
 *    （`EconomyVisualModel` 冻结无 `surplusDerived` 字段，判定方式：`meta.surplus` 缺省但
 *    `nodeSurplus[id] !== 'unknown'` 即为推定。）
 * 5. 时间：与窗口无交集的节点 / 边只进入 `inWindow = false`（淡出，**不删除**）；
 *    无锚点的节点 / 边进 `unanchored` 且保持可见（无法比较 != 不在窗口内）；
 *    窗口内没有任何记录时用 `windowRecordState()` 取「此段无记录」所需信息，**不返回假 0**。
 * 6. 多单位：`units` 去重收集、`multiUnit` 只做提示，**绝不换算**；`totalFlow` 是已填流量之和，
 *    多单位下只作量级参考（面板同时给单位列表与「存在多单位」）。
 * 7. `stats.flowRecorded`：窗口内是否有任何边带流量值（`flow = 0` 也算记录过）。false 时统计面板的
 *    总流量显示「—」而不是 0 假象；true 时即使是 0 也照实显示（如「0 袋」）。
 *
 * 本文件是**无副作用纯函数**（不 import React、不读全局状态、不发请求），可被测试直接断言。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import type { LevelDef } from '../../shared/moduleConfig';
import { layersForComplexity } from '../config';
import type {
  EconomyEdge,
  EconomyFlowScale,
  EconomyLayerId,
  EconomyLayerState,
  EconomyMetricSample,
  EconomyMetrics,
  EconomyNode,
  EconomySummary,
  EconomySurplus,
  EconomyTimeWindow,
  EconomyTimeline,
  EconomyVisualModel,
  EconomyVisualStats,
  ResolvedEconomyConfig,
} from '../types';
import { anchorOf, inWindow, type TimeWindowInput } from './guards';

// ---------------------------------------------------------------------------
// 1. 常量与标量格式化
// ---------------------------------------------------------------------------

/** 边宽范围（相对模式）与绝对模式固定中等线宽 */
export const EDGE_WIDTH_MIN = 1;
export const EDGE_WIDTH_MAX = 6;
export const EDGE_WIDTH_MID = 3;

/** 缺省流量与有效 0 的两种标注（缺省 != 0，§4.6.2） */
export const FLOW_LABEL_MISSING = '—';
export const FLOW_LABEL_ZERO = '0';

/** 节点大小分档阈值（归一分数 0..1 -> sm / md / lg） */
export const NODE_SIZE_MD_THRESHOLD = 1 / 3;
export const NODE_SIZE_LG_THRESHOLD = 2 / 3;

/** 数字文案：整数原样，小数最多两位（账册用 tabular-nums 对齐） */
export const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return FLOW_LABEL_MISSING;
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
};

/**
 * 边上直接标注：`120 袋/季` / `0` / `—`。
 * - 流量缺省 -> `—`（画布画虚线）；
 * - 流量为 0 -> `0`（有效值，细实线，零流量不需要单位）；
 * - 有单位则拼在数字后，多单位不换算。
 */
export const formatFlowLabel = (flow?: number | null, unit?: string | null): string => {
  if (typeof flow !== 'number' || !Number.isFinite(flow)) return FLOW_LABEL_MISSING;
  const trimmed = typeof unit === 'string' ? unit.trim() : '';
  if (!trimmed || flow === 0) return formatNumber(flow);
  return `${formatNumber(flow)} ${trimmed}`;
};

const SURPLUS_ALIASES: Record<string, EconomySurplus> = {
  surplus: 'surplus',
  盈余: 'surplus',
  balanced: 'balanced',
  平衡: 'balanced',
  deficit: 'deficit',
  赤字: 'deficit',
  unknown: 'unknown',
  未知: 'unknown',
};

/** 把 meta 里的自由值收敛到四态；无法识别返回 undefined（不猜） */
export const asSurplus = (value: unknown): EconomySurplus | undefined => {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  return SURPLUS_ALIASES[raw.toLowerCase()] ?? SURPLUS_ALIASES[raw];
};

// ---------------------------------------------------------------------------
// 2. 节点大小（§4.6.2 规则 1）
// ---------------------------------------------------------------------------

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** 节点读 meta：契约 EconomyNode 无顶层 meta，兼容读 `meta`（若后端透传）与 `customFields`（旧投影 §11.6） */
const nodeMetaOf = (node: EconomyNode): Record<string, unknown> => ({
  ...asRecord(node.customFields),
  ...asRecord((node as { meta?: unknown }).meta),
});

/** 等级顺序：任一等级给了 rank 就按 rank 升序，否则按数组顺序（未登记 -> undefined，不猜） */
const orderedLevels = (levels: LevelDef[]): LevelDef[] =>
  levels.some((def) => typeof def.rank === 'number')
    ? [...levels].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    : levels;

/** 等级归一：最低 0，最高 1；只有一个等级视为最高 */
export const levelWeight = (levelId: string | null | undefined, levels: LevelDef[]): number | undefined => {
  if (!levelId) return undefined;
  const ordered = orderedLevels(levels);
  const index = ordered.findIndex((def) => def.id === levelId);
  if (index < 0) return undefined;
  if (ordered.length <= 1) return 1;
  return index / (ordered.length - 1);
};

/** 规模归一：`scale = 0` 有效（归一 0），只有缺省才是未知；全为 0 时不做除零 */
export const scaleWeight = (scale: number | null | undefined, maxScale: number): number | undefined => {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return undefined;
  if (maxScale <= 0) return 0;
  return Math.min(1, Math.max(0, scale / maxScale));
};

/**
 * 归一分数：两项都填 = `0.5×等级 + 0.5×规模`；只填一项 = 该项；两项都缺省 = `undefined`。
 * `undefined` 即「规模未填」：标准小站点 + 空心环。
 */
export const nodeSizeScore = (
  node: EconomyNode,
  levels: LevelDef[],
  maxScale: number
): number | undefined => {
  const level = levelWeight(node.level, levels);
  const scale = scaleWeight(node.scale, maxScale);
  if (level === undefined && scale === undefined) return undefined;
  if (level !== undefined && scale !== undefined) return 0.5 * level + 0.5 * scale;
  return level ?? scale ?? 0;
};

export const sizeBucket = (score?: number): 'sm' | 'md' | 'lg' => {
  if (score === undefined) return 'sm';
  if (score >= NODE_SIZE_LG_THRESHOLD) return 'lg';
  if (score >= NODE_SIZE_MD_THRESHOLD) return 'md';
  return 'sm';
};

// ---------------------------------------------------------------------------
// 3. 时间锚点（节点存在期 / 边有效期）
// ---------------------------------------------------------------------------

interface AnchorSpan {
  start?: number;
  end?: number;
}

/** 节点：`timeOrder`（点）优先，否则 time.start–time.end（只填一端 = 开区间） */
const nodeSpanOf = (node: EconomyNode): AnchorSpan => {
  if (typeof node.timeOrder === 'number' && Number.isFinite(node.timeOrder)) {
    return { start: node.timeOrder, end: node.timeOrder };
  }
  return { start: anchorOf(node.time?.start), end: anchorOf(node.time?.end) };
};

/** 边：`meta.timeOrder` 优先，否则 time.start–time.end */
const edgeSpanOf = (edge: EconomyEdge): AnchorSpan => {
  const order = asRecord(edge.meta).timeOrder;
  if (typeof order === 'number' && Number.isFinite(order)) return { start: order, end: order };
  return { start: anchorOf(edge.time?.start), end: anchorOf(edge.time?.end) };
};

const sampleAnchor = (sample: EconomyMetricSample): number | undefined =>
  anchorOf(sample.t, sample.timeOrder);

// ---------------------------------------------------------------------------
// 4. 盈余 / 赤字（§4.6.2 规则 3）
// ---------------------------------------------------------------------------

export interface EconomySurplusDetail {
  nodeSurplus: Record<string, EconomySurplus>;
  edgeSurplus: Record<string, EconomySurplus>;
  /** 由指标正负**推定**（或后端 `surplusDerived`）的 id：界面必须标「推定」 */
  derived: Set<string>;
}

const surplusOfValue = (value: number): EconomySurplus =>
  value > 0 ? 'surplus' : value < 0 ? 'deficit' : 'balanced';

/**
 * 窗口内最后一个数值采样；没有窗口时取最后一个可锚定采样，再退到最后一个数值采样。
 * 有窗口但窗口内没有采样时返回 undefined（**缺采样不补 0**，也不拿窗口外的值硬套）。
 */
const lastNumericValue = (
  samples: EconomyMetricSample[],
  window: TimeWindowInput,
  windowed: boolean
): number | undefined => {
  let best: number | undefined;
  let bestAnchor: number | undefined;
  let fallback: number | undefined;
  for (const sample of samples) {
    if (typeof sample.value !== 'number' || !Number.isFinite(sample.value)) continue;
    fallback = sample.value;
    const at = sampleAnchor(sample);
    if (at === undefined) continue;
    if (windowed && !inWindow(at, at, window)) continue;
    if (bestAnchor === undefined || at >= bestAnchor) {
      bestAnchor = at;
      best = sample.value;
    }
  }
  if (best !== undefined) return best;
  return windowed ? undefined : fallback;
};

/**
 * 盈余 / 赤字明细。显式值优先（`meta.surplus` / `customFields.surplus` / `edge.surplus`）；
 * 节点缺显式值时按「窗口内最后一个数值型指标采样的正负」推定并进 `derived`；无依据 `'unknown'`。
 *
 * 边不做指标推定（流量本身不是盈余依据）；但后端 `surplusDerived = true` 的边也会进 `derived`，
 * 让界面能标「推定」。
 */
export const buildSurplusDetail = (input: EconomyVisualInput): EconomySurplusDetail => {
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const window: TimeWindowInput = { start: input.window?.start, end: input.window?.end };
  const windowed = input.window?.start !== undefined || input.window?.end !== undefined;
  const series = input.metrics?.series ?? [];

  const nodeSurplus: Record<string, EconomySurplus> = {};
  const edgeSurplus: Record<string, EconomySurplus> = {};
  const derived = new Set<string>();

  for (const node of nodes) {
    const explicit = asSurplus(nodeMetaOf(node).surplus);
    if (explicit !== undefined) {
      nodeSurplus[node.id] = explicit;
      continue;
    }
    let value: number | undefined;
    for (const entry of series) {
      if (entry?.entity?.id !== node.id) continue;
      const candidate = lastNumericValue(entry.samples ?? [], window, windowed);
      if (candidate !== undefined) value = candidate;
    }
    if (value === undefined) {
      nodeSurplus[node.id] = 'unknown';
      continue;
    }
    nodeSurplus[node.id] = surplusOfValue(value);
    derived.add(node.id);
  }

  for (const edge of edges) {
    const explicit = asSurplus(asRecord(edge.meta).surplus) ?? asSurplus(edge.surplus);
    edgeSurplus[edge.id] = explicit ?? 'unknown';
    if (explicit !== undefined && edge.surplusDerived === true) derived.add(edge.id);
  }

  return { nodeSurplus, edgeSurplus, derived };
};

// ---------------------------------------------------------------------------
// 5. 入口：buildVisualModel
// ---------------------------------------------------------------------------

/** buildVisualModel 的入参（除 nodes/edges 外全部可选；外壳只传 5 个键也能工作） */
export interface EconomyVisualInput {
  nodes: EconomyNode[];
  edges: EconomyEdge[];
  layers?: EconomyLayerState | null;
  window?: EconomyTimeWindow | null;
  /** 边没有 unit 时的兜底单位（等价 `config.defaultFlowUnit`） */
  defaultFlowUnit?: string | null;
  config?: ResolvedEconomyConfig | null;
  /** 等级归一顺序；缺省读 `config.levels` */
  levels?: LevelDef[] | null;
  summary?: EconomySummary | null;
  timeline?: EconomyTimeline | null;
  /** 指标采样：用于按正负推定盈余（不补 0） */
  metrics?: EconomyMetrics | null;
  /** 默认 sandbox；决定 `hiddenLayersPresent` 只看本档可见图层 */
  complexity?: ComplexityLevel;
}

export type BuildVisualModelInput = EconomyVisualInput;

const resolveDefaultUnit = (input: EconomyVisualInput): string | undefined => {
  const direct = typeof input.defaultFlowUnit === 'string' ? input.defaultFlowUnit.trim() : '';
  if (direct) return direct;
  const fromConfig = input.config?.defaultFlowUnit;
  return typeof fromConfig === 'string' && fromConfig.trim() ? fromConfig.trim() : undefined;
};

const clampWidth = (value: number): number =>
  Math.min(EDGE_WIDTH_MAX, Math.max(EDGE_WIDTH_MIN, value));

export const buildVisualModel = (input: EconomyVisualInput): EconomyVisualModel => {
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const config = input.config ?? null;
  const window: EconomyTimeWindow = { start: input.window?.start, end: input.window?.end };
  const windowInput: TimeWindowInput = { start: window.start, end: window.end };
  const fallbackUnit = resolveDefaultUnit(input);

  // --- 时间：窗口外的淡出，无锚点的标注（隐藏 != 删除） ---
  const unanchored = new Set<string>();
  const inWindowSet = new Set<string>();
  for (const node of nodes) {
    const span = nodeSpanOf(node);
    if (span.start === undefined && span.end === undefined) unanchored.add(node.id);
    if (inWindow(span.start, span.end, windowInput)) inWindowSet.add(node.id);
  }
  for (const edge of edges) {
    const span = edgeSpanOf(edge);
    if (span.start === undefined && span.end === undefined) unanchored.add(edge.id);
    if (inWindow(span.start, span.end, windowInput)) inWindowSet.add(edge.id);
  }

  // --- 节点大小 ---
  const levels = input.levels ?? config?.levels ?? [];
  const maxScale = nodes.reduce(
    (max, node) =>
      typeof node.scale === 'number' && Number.isFinite(node.scale) ? Math.max(max, node.scale) : max,
    0
  );
  const nodeSize: Record<string, 'sm' | 'md' | 'lg'> = {};
  for (const node of nodes) nodeSize[node.id] = sizeBucket(nodeSizeScore(node, levels, maxScale));

  // --- 流量口径与边宽 ---
  const flowEdges = edges.filter(
    (edge) => typeof edge.flow === 'number' && Number.isFinite(edge.flow)
  );
  const flowMax = flowEdges.reduce(
    (max, edge) => Math.max(max, edge.flow as number),
    0
  );
  const flowless = flowEdges.length === 0;
  const scale: EconomyFlowScale =
    edges.length === 0 ? 'none' : flowless ? 'intensity' : flowEdges.length === 1 ? 'absolute' : 'relative';

  const edgeWidth: Record<string, number> = {};
  const edgeLabel: Record<string, string> = {};
  for (const edge of edges) {
    const flow =
      typeof edge.flow === 'number' && Number.isFinite(edge.flow) ? edge.flow : undefined;
    edgeLabel[edge.id] = formatFlowLabel(flow, edge.unit ?? fallbackUnit);

    if (flow === undefined) {
      // 无流量：intensity 模式按强度给线宽，其余模式一律细线（缺省 -> 虚线，见文件头口径 3）
      const intensity =
        typeof edge.intensity === 'number' && Number.isFinite(edge.intensity)
          ? edge.intensity
          : undefined;
      edgeWidth[edge.id] =
        scale === 'intensity' && intensity !== undefined ? clampWidth(intensity) : EDGE_WIDTH_MIN;
      continue;
    }

    if (scale === 'absolute') {
      edgeWidth[edge.id] = EDGE_WIDTH_MID;
      continue;
    }
    if (scale === 'relative') {
      edgeWidth[edge.id] =
        flowMax > 0
          ? EDGE_WIDTH_MIN +
            (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN) * Math.sqrt(Math.max(0, flow) / flowMax)
          : EDGE_WIDTH_MIN;
      continue;
    }
    edgeWidth[edge.id] = EDGE_WIDTH_MIN;
  }

  // --- 颜色（盈余 / 赤字） ---
  const surplusDetail = buildSurplusDetail({ ...input, nodes, edges, window });

  // --- 单位：去重收集，不换算 ---
  const units: string[] = [];
  const addUnit = (value?: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed && !units.includes(trimmed)) units.push(trimmed);
  };
  for (const edge of flowEdges) addUnit(edge.unit ?? fallbackUnit);
  for (const value of input.summary?.totals?.flowUnits ?? []) addUnit(value);
  for (const value of input.timeline?.units ?? []) addUnit(value);
  const multiUnit =
    units.length > 1 ||
    input.timeline?.multiUnit === true ||
    input.summary?.totals?.multiUnit === true;

  // --- 统计：只统计已填数据，图层关闭仍按全量 ---
  let totalFlow = 0;
  /** 窗口内是否真的记录过流量值：`flow = 0` 也算记录过（false 时面板显示「—」而不是 0） */
  let flowRecorded = false;
  for (const edge of edges) {
    if (!inWindowSet.has(edge.id)) continue;
    if (typeof edge.flow !== 'number' || !Number.isFinite(edge.flow)) continue;
    flowRecorded = true;
    totalFlow += edge.flow;
  }

  const surplus: Record<EconomySurplus, number> = {
    surplus: 0,
    balanced: 0,
    deficit: 0,
    unknown: 0,
  };
  for (const node of nodes) surplus[surplusDetail.nodeSurplus[node.id] ?? 'unknown'] += 1;

  const withMetrics = nodes.filter(
    (node) => node.hasMetrics === true || (node.metricIds?.length ?? 0) > 0
  ).length;
  const metricCoverage =
    nodes.length > 0
      ? withMetrics / nodes.length
      : (input.summary?.totals?.metricCoverage?.coverage ?? 0);

  const complexity = input.complexity ?? 'sandbox';
  const layerState = input.layers ?? {};
  const hiddenLayersPresent = layersForComplexity(complexity).some(
    (layer) => layerState[layer.id as EconomyLayerId] === false
  );

  const stats: EconomyVisualStats = {
    entities: nodes.length,
    links: edges.length,
    totalFlow,
    flowUnits: units,
    multiUnit,
    flowRecorded,
    surplus,
    metricCoverage,
    hiddenLayersPresent,
    timeWindow: { start: window.start, end: window.end },
  };

  return {
    scale,
    flowMax,
    units,
    multiUnit,
    flowless,
    nodeSize,
    nodeSurplus: surplusDetail.nodeSurplus,
    edgeWidth,
    edgeSurplus: surplusDetail.edgeSurplus,
    edgeLabel,
    unanchored,
    inWindow: inWindowSet,
    stats,
  };
};

// ---------------------------------------------------------------------------
// 6. 「此段无记录」所需信息（窗口内没有任何记录时不要返回假 0）
// ---------------------------------------------------------------------------

export interface EconomyWindowRecordState {
  /** 有锚点 / 无锚点的节点 + 边数量（无锚点无法比较，不算进窗口记录） */
  anchoredItems: number;
  unanchoredItems: number;
  inWindowNodes: number;
  inWindowEdges: number;
  /** 有流量值的边（全量）与其中的窗口内数量 */
  flowEdges: number;
  flowEdgesInWindow: number;
  sampleCount: number;
  samplesInWindow: number;
  markersInWindow: number;
  /** 窗口内是否有任何记录（无窗口时=是否根本没有任何数据） */
  hasRecords: boolean;
}

/**
 * 窗口记录状态：给「此段无记录」判断用。
 * 只统计**能锚定**的记录（无锚点采样不参与，因为它们没法定位于某一段）；缺省不返回 0 假象。
 */
export const windowRecordState = (input: EconomyVisualInput): EconomyWindowRecordState => {
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const windowInput: TimeWindowInput = { start: input.window?.start, end: input.window?.end };
  const windowed = input.window?.start !== undefined || input.window?.end !== undefined;

  let anchoredItems = 0;
  let unanchoredItems = 0;
  let inWindowNodes = 0;
  let inWindowEdges = 0;
  let flowEdges = 0;
  let flowEdgesInWindow = 0;

  for (const node of nodes) {
    const span = nodeSpanOf(node);
    if (span.start === undefined && span.end === undefined) {
      unanchoredItems += 1;
      continue;
    }
    anchoredItems += 1;
    if (inWindow(span.start, span.end, windowInput)) inWindowNodes += 1;
  }

  for (const edge of edges) {
    const hasFlow = typeof edge.flow === 'number' && Number.isFinite(edge.flow);
    if (hasFlow) flowEdges += 1;
    const span = edgeSpanOf(edge);
    if (span.start === undefined && span.end === undefined) {
      unanchoredItems += 1;
      continue;
    }
    anchoredItems += 1;
    if (!inWindow(span.start, span.end, windowInput)) continue;
    inWindowEdges += 1;
    if (hasFlow) flowEdgesInWindow += 1;
  }

  let sampleCount = 0;
  let samplesInWindow = 0;
  for (const entry of input.metrics?.series ?? []) {
    for (const sample of entry.samples ?? []) {
      sampleCount += 1;
      const at = sampleAnchor(sample);
      if (at === undefined) continue;
      if (inWindow(at, at, windowInput)) samplesInWindow += 1;
    }
  }

  let markersInWindow = 0;
  for (const marker of input.timeline?.markers ?? []) {
    const start = anchorOf(marker.start ?? marker.at, marker.order);
    const end = anchorOf(marker.end ?? marker.at, marker.order);
    if (start === undefined && end === undefined) continue;
    if (inWindow(start, end, windowInput)) markersInWindow += 1;
  }

  const hasRecords = windowed
    ? inWindowNodes > 0 || inWindowEdges > 0 || samplesInWindow > 0 || markersInWindow > 0
    : nodes.length + edges.length + sampleCount > 0;

  return {
    anchoredItems,
    unanchoredItems,
    inWindowNodes,
    inWindowEdges,
    flowEdges,
    flowEdgesInWindow,
    sampleCount,
    samplesInWindow,
    markersInWindow,
    hasRecords,
  };
};
