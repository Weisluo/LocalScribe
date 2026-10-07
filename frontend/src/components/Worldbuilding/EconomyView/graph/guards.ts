/**
 * EconomyView 降级判定 / 推荐关联 / 时间锚点 / 筛选（Phase 5 P5-T14）
 *
 * 依据：economy_ui_design §4.6.3（时间锚点与 unanchored）、§5.5（筛选与搜索）、§11.1（300 / 800 分档）、
 * §11.2（只保留两端都在结果集的边）、§8.4（退化形态）；cross_module_link_design §5.4（超阈值降级为
 * 模块矩阵 + 推荐关联列表）；phase5_economy §8（风险表：300 内 SVG / 300-800 canvas / >800 降级）。
 *
 * 口径（改动前先改设计文档）：
 * - 本文件是**无副作用纯函数**，不 import React、不读全局状态、不发请求，可被测试直接断言；
 * - 时间锚点：`meta.timeOrder` 优先，其次时间文本的**前缀数字**（「312 年」-> 312）；
 *   解析不出锚点返回 `undefined`，一律进 `unanchored` 标注「时间未锚定」，**绝不猜时间**；
 * - 无锚点的节点 / 边不参与窗口过滤（保持可见并标注），因为「无法比较」不等于「不在窗口内」；
 * - 降级判定 `degradeStateOf` **以后端 `graph.degraded` 为准**：降级载荷只返回 counts（`nodes: []`），
 *   纯前端节点数永远判不出降级；时间窗微调的新锚点一律过 `formatAnchor`（保留小数，不塌成整数）；
 * - 推荐关联**只推荐不写入**，最多 20 条，方向由阶段顺序决定（上游 -> 加工 -> 交换 -> 经营）。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import {
  ECONOMY_CONFIG_DEFAULTS,
  ECONOMY_MATRIX_THRESHOLD,
  ECONOMY_STAGES,
  ECONOMY_SVG_NODE_LIMIT,
  stageOfKind,
} from '../config';
import type {
  EconomyEdge,
  EconomyFilterState,
  EconomyLinkRecommendation,
  EconomyNode,
  EconomyStageDef,
  ResolvedEconomyConfig,
} from '../types';

// ---------------------------------------------------------------------------
// 1. 时间锚点与窗口（§4.6.3）
// ---------------------------------------------------------------------------

/** 时间输入：可以是文本（「312 年」）、已解析的数值锚点，或缺失 */
export type TimeAnchorInput = string | number | null | undefined;

export interface TimeWindowInput {
  start?: TimeAnchorInput;
  end?: TimeAnchorInput;
}

/** 时间文本前缀数字：「312 年」「310-315 年」「-300 年」-> 312 / 310 / -300 */
const LEADING_NUMBER = /^\s*([-+]?\d+(?:\.\d+)?)/;

/**
 * 解析时间锚点：`timeOrder` 优先，其次时间文本前缀数字；解析不出返回 undefined（不猜时间）。
 *
 * 注意 `timeOrder = 0` 是有效锚点；只有缺省（undefined / null / 非有限数）才回退到文本。
 */
export const anchorOf = (text?: string | null, timeOrder?: number | null): number | undefined => {
  if (typeof timeOrder === 'number' && Number.isFinite(timeOrder)) return timeOrder;
  if (typeof text !== 'string') return undefined;
  const match = LEADING_NUMBER.exec(text);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
};

const toAnchor = (value: TimeAnchorInput, timeOrder?: number | null): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  return anchorOf(value, timeOrder);
};

/**
 * 锚点 -> 稳定文本：最多两位小数（抹掉 `0.1 + 0.2` 这类浮点尾巴），整数不带小数点。
 *
 * 与 `anchorOf` 同一个解析口径的逆运算：`anchorOf(formatAnchor(v)) === v`（两位小数内），
 * 时间窗微调（[ / ]）用它生成新锚点，避免 `String(310.2 + 1)` 之外的塌陷风险。
 */
export const formatAnchor = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
};

/**
 * 时间区间与刷选窗口是否有交集。
 *
 * 开区间语义（对齐「存在期」）：只填 start 视为「此后一直存在」，只填 end 视为「此前一直存在」；
 * 端点全是文本、且解析不出锚点时返回 `true`（无锚点不参与过滤，由 unanchored 标注）。
 * 窗口两端都缺省表示「全时段」，一律返回 true。点事件请把同一个锚点同时传给 start 与 end。
 */
export const inWindow = (
  start: TimeAnchorInput,
  end: TimeAnchorInput,
  window?: TimeWindowInput | null
): boolean => {
  const spanStart = toAnchor(start);
  const spanEnd = toAnchor(end);
  const windowStart = toAnchor(window?.start);
  const windowEnd = toAnchor(window?.end);

  if (windowStart === undefined && windowEnd === undefined) return true;
  if (spanStart === undefined && spanEnd === undefined) return true;

  const reversed = windowStart !== undefined && windowEnd !== undefined && windowStart > windowEnd;
  const low = reversed ? windowEnd : (windowStart ?? Number.NEGATIVE_INFINITY);
  const high = reversed ? windowStart : (windowEnd ?? Number.POSITIVE_INFINITY);

  const from = spanStart ?? Number.NEGATIVE_INFINITY;
  const to = spanEnd ?? Number.POSITIVE_INFINITY;
  return to >= low && from <= high;
};

// ---------------------------------------------------------------------------
// 2. 降级与渲染档（§11.1）
// ---------------------------------------------------------------------------

/** 阈值：graph.nodeLimit 优先，缺失 / 非正数回退 ECONOMY_MATRIX_THRESHOLD（800） */
export const matrixNodeLimit = (nodeLimit?: number | null): number =>
  typeof nodeLimit === 'number' && Number.isFinite(nodeLimit) && nodeLimit > 0
    ? nodeLimit
    : ECONOMY_MATRIX_THRESHOLD;

/** 超过阈值才降级（等于阈值仍走简化档） */
export const shouldDegradeMatrix = (nodeCount: number, nodeLimit?: number | null): boolean =>
  nodeCount > matrixNodeLimit(nodeLimit);

/**
 * 渲染档：300 以内 `svg`；300-阈值之间 `simplified`（分层 canvas + 简化标签）；
 * 超过阈值 `matrix`（账册矩阵，唯一路径，不做真实渲染优化）。
 */
export const renderModeOf = (
  nodeCount: number,
  nodeLimit?: number | null
): 'svg' | 'simplified' | 'matrix' => {
  if (shouldDegradeMatrix(nodeCount, nodeLimit)) return 'matrix';
  const svgLimit = Math.min(ECONOMY_SVG_NODE_LIMIT, matrixNodeLimit(nodeLimit));
  return nodeCount > svgLimit ? 'simplified' : 'svg';
};

/**
 * 降级说明（DegradeLedgerMatrix 顶部与外壳共用；reason 直接给用户看）。
 *
 * **降级以后端为准**：后端降级时只返回 `counts`（`nodes: []` / `edges: []`），载荷里的节点数天然是 0，
 * 只按 `nodeCount > nodeLimit` 判定会永远为 false（降级视图因此不可达）；`serverDegraded` 即
 * `EconomyGraph.degraded`。`nodeCount > nodeLimit` 仍保留，覆盖「后端还没表态」的本地越界情形
 * （例如本地展示筛选后越界）。原因文案优先用后端 `degradeReason`，前端文案只做回退；
 * 降级时真实节点数只在 `counts.nodes` 里（`serverNodeCount`）。
 */
export const degradeStateOf = (input: {
  nodeCount: number;
  nodeLimit?: number | null;
  /** 后端已声明降级（EconomyGraph.degraded） */
  serverDegraded?: boolean;
  /** 后端降级原因（EconomyGraph.degradeReason） */
  serverReason?: string | null;
  /** 后端计数（EconomyGraph.counts.nodes）：降级时真实节点数只有这里有 */
  serverNodeCount?: number | null;
}): { degraded: boolean; reason: string | null; nodeLimit: number } => {
  const nodeLimit = matrixNodeLimit(input.nodeLimit);
  const degraded = input.serverDegraded === true || input.nodeCount > nodeLimit;
  const serverReason = input.serverReason?.trim();
  const nodeCount =
    typeof input.serverNodeCount === 'number' && Number.isFinite(input.serverNodeCount)
      ? input.serverNodeCount
      : input.nodeCount;
  return {
    degraded,
    nodeLimit,
    reason: degraded
      ? serverReason || `当前 ${nodeCount} 个节点，超过 ${nodeLimit} 阈值；已切换为账册矩阵`
      : null,
  };
};

// ---------------------------------------------------------------------------
// 3. 推荐关联（§5.4 世界脉络降级：模块矩阵 + 推荐关联列表）
// ---------------------------------------------------------------------------

export const RECOMMENDATION_LIMIT = 20;

interface KindPairRule {
  source: string[];
  target: string[];
  linkType: string;
  reason: string;
}

/**
 * 合法 kind 对 -> 标准关联（只覆盖阶段相邻的一对，方向 = 上游 -> 下游）。
 * 全部取自契约 §4.4，不新增 link_type；语义拿不准的组合宁可不推荐。
 */
const KIND_PAIR_RULES: KindPairRule[] = [
  { source: ['resource'], target: ['industry'], linkType: 'economy.consumes', reason: '上游物产可能被该产业消耗' },
  { source: ['industry'], target: ['resource'], linkType: 'economy.requires', reason: '该产业可能依赖此物产' },
  { source: ['industry'], target: ['market'], linkType: 'economy.traded_at', reason: '该产业的产品可能在这个集市交易' },
  { source: ['good'], target: ['market'], linkType: 'economy.traded_at', reason: '该商品可能在这个集市交易' },
  { source: ['market'], target: ['good'], linkType: 'economy.supplies', reason: '该集市可能供给此商品' },
  { source: ['market'], target: ['resource'], linkType: 'economy.supplies', reason: '该集市可能供给此物产' },
  { source: ['actor'], target: ['market'], linkType: 'economy.traded_at', reason: '该经济主体可能在这个集市交易' },
];

const pairKey = (a: string, b: string): string => (a <= b ? `${a}|${b}` : `${b}|${a}`);

const stageIdOf = (node: EconomyNode, config: ResolvedEconomyConfig): string =>
  node.stage || stageOfKind(node.kind, config);

const stageIndexOf = (stageId: string, stages: EconomyStageDef[]): number =>
  stages.findIndex((stage) => stage.id === stageId);

/**
 * 推荐关联：两端都在结果集、尚无边（任一方向都算有边）、kind 组合合法、阶段相邻（order 差 1）的节点对。
 *
 * **只推荐不写入**；同类/上下游判断用本地 kind 表（registry 的 source/target 形状与
 * `common/EntityPicker/linkTypes.ts` 的 `filterLinkTypes` 同口径：module/kind 匹配、kind `*` 通配），
 * 本函数不引入 §4 之外的 link_type，也不因为推荐而创建任何实体或关联。
 */
export const recommendationsOf = (
  nodes: EconomyNode[],
  edges: EconomyEdge[],
  config?: ResolvedEconomyConfig | null
): EconomyLinkRecommendation[] => {
  const resolved = config ?? ECONOMY_CONFIG_DEFAULTS;
  const stages = resolved.stages && resolved.stages.length > 0 ? resolved.stages : ECONOMY_STAGES;

  const existing = new Set<string>();
  for (const edge of edges) existing.add(pairKey(edge.source.id, edge.target.id));

  const byStage = new Map<number, EconomyNode[]>();
  for (const node of nodes) {
    const index = stageIndexOf(stageIdOf(node, resolved), stages);
    if (index < 0) continue;
    const list = byStage.get(index) ?? [];
    list.push(node);
    byStage.set(index, list);
  }

  const seen = new Set<string>();
  const out: EconomyLinkRecommendation[] = [];
  for (const index of [...byStage.keys()].sort((a, b) => a - b)) {
    const sources = byStage.get(index) ?? [];
    const targets = byStage.get(index + 1) ?? [];
    for (const source of sources) {
      for (const target of targets) {
        if (source.id === target.id) continue;
        const rule = KIND_PAIR_RULES.find(
          (candidate) => candidate.source.includes(source.kind) && candidate.target.includes(target.kind)
        );
        if (!rule) continue;
        const key = pairKey(source.id, target.id);
        if (existing.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push({ source, target, linkType: rule.linkType, reason: rule.reason });
      }
    }
  }

  out.sort(
    (a, b) =>
      (a.source.orderIndex ?? 0) - (b.source.orderIndex ?? 0) ||
      (a.target.orderIndex ?? 0) - (b.target.orderIndex ?? 0) ||
      a.source.name.localeCompare(b.source.name, 'zh-Hans-CN') ||
      a.target.name.localeCompare(b.target.name, 'zh-Hans-CN')
  );
  return out.slice(0, RECOMMENDATION_LIMIT);
};

// ---------------------------------------------------------------------------
// 4. 筛选与搜索（§5.5；画布与账册共用）
// ---------------------------------------------------------------------------

export interface EconomySearchTokens {
  kinds: string[];
  stages: string[];
  levels: string[];
  statuses: string[];
  /** 自由词：同时匹配名称与 id（重复名称允许，用 id 兜底） */
  terms: string[];
}

/** 搜索解析：`kind:market 集市` -> { kinds: ['market'], terms: ['集市'] }；前缀大小写不敏感 */
export const parseSearchTokens = (search?: string | null): EconomySearchTokens => {
  const tokens: EconomySearchTokens = { kinds: [], stages: [], levels: [], statuses: [], terms: [] };
  for (const raw of (search ?? '').trim().split(/\s+/)) {
    if (!raw) continue;
    const match = /^(kind|stage|level|status):(.+)$/i.exec(raw);
    if (!match) {
      tokens.terms.push(raw.toLowerCase());
      continue;
    }
    const value = match[2].toLowerCase();
    if (match[1].toLowerCase() === 'kind') tokens.kinds.push(value);
    else if (match[1].toLowerCase() === 'stage') tokens.stages.push(value);
    else if (match[1].toLowerCase() === 'level') tokens.levels.push(value);
    else tokens.statuses.push(value);
  }
  return tokens;
};

const hasMetrics = (node: EconomyNode): boolean =>
  node.hasMetrics === true || (node.metricIds?.length ?? 0) > 0;

const containsTerm = (value: string | null | undefined, term: string): boolean =>
  typeof value === 'string' && value.toLowerCase().includes(term);

/**
 * 单节点筛选：阶段 / kind / 等级 / 状态 / 关联数区间 / 有无指标 / 搜索。
 * 关联数取 `counts.total`（后端批量聚合结果），缺省按 0 处理。
 * `hasMetrics === true` 只留已填指标的，`false` 只留未填指标的；缺省不过滤。
 */
export const matchesFilters = (node: EconomyNode, filters: EconomyFilterState): boolean => {
  const stages = filters.stages ?? [];
  const kinds = filters.kinds ?? [];
  const levels = filters.levels ?? [];
  const statuses = filters.statuses ?? [];
  const linkCount = filters.linkCount ?? {};

  if (stages.length > 0 && !stages.includes(node.stage)) return false;
  if (kinds.length > 0 && !kinds.includes(node.kind)) return false;
  if (levels.length > 0 && (!node.level || !levels.includes(node.level))) return false;
  if (statuses.length > 0 && (!node.status || !statuses.includes(node.status))) return false;

  const total = node.counts?.total ?? 0;
  if (linkCount.min !== undefined && total < linkCount.min) return false;
  if (linkCount.max !== undefined && total > linkCount.max) return false;

  if (filters.hasMetrics === true && !hasMetrics(node)) return false;
  if (filters.hasMetrics === false && hasMetrics(node)) return false;

  const tokens = parseSearchTokens(filters.search);
  if (tokens.kinds.length > 0 && !tokens.kinds.includes(node.kind.toLowerCase())) return false;
  if (tokens.stages.length > 0 && !tokens.stages.includes(node.stage.toLowerCase())) return false;
  if (tokens.levels.length > 0 && !tokens.levels.includes((node.level ?? '').toLowerCase())) return false;
  if (tokens.statuses.length > 0 && !tokens.statuses.includes((node.status ?? '').toLowerCase())) return false;
  for (const term of tokens.terms) {
    if (!containsTerm(node.name, term) && !containsTerm(node.id, term)) return false;
  }
  return true;
};

export const filterNodes = (nodes: EconomyNode[], filters: EconomyFilterState): EconomyNode[] =>
  nodes.filter((node) => matchesFilters(node, filters));

/** 边只在两端都还在结果集里时保留（§11.2：画布只拉两端都在结果集中的边） */
export const filterEdges = (
  edges: EconomyEdge[],
  nodes: EconomyNode[],
  filters: EconomyFilterState
): EconomyEdge[] => {
  const visible = new Set(filterNodes(nodes, filters).map((node) => node.id));
  return edges.filter((edge) => visible.has(edge.source.id) && visible.has(edge.target.id));
};

/** 复杂度档位顺序（图层 / 分档判定共用） */
export const COMPLEXITY_RANK: Record<ComplexityLevel, number> = {
  sketch: 0,
  structure: 1,
  sandbox: 2,
};
