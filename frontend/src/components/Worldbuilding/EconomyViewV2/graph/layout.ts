/**
 * 经济结构档布局与视觉口径（Phase 5 P5-T10；economy_ui_design §2.1/§4.5/§4.6.2/§4.7）
 *
 * 纯函数模块，不依赖 React（phase5.spec 会静态断言这一点），可被测试直接断言：
 * - buildLaneLayout：默认按**流转阶段**分泳道（上游 -> 加工 -> 交换 -> 经营；通货 / 制度合并成
 *   底部横切轨），`groupBy='kind'` 时按**类型**分泳道（推荐 kind 在前、custom_ 之后、未登记的 kind 置底）；
 * - buildNetworkLayout：轻量自研环形 + 关联数分环（不引入图形库、不做力导迭代）；
 * - estimateCanvasSize 等尺寸辅助；
 * - matchesEconomyFilter / matchEconomySearch：画布与账册共用的筛选判定（同一套口径，两副面孔不分叉）；
 * - 线型 / 色名 / 强度 / 规模文本的折算：注册表与 EconomyVisualModel 到 SVG 的唯一落点。
 *
 * 确定性：同一份数据每次打开位置一致 —— 泳道顺序由 config.stages.order（kind 模式由 kind 骨架顺序）
 * 决定，泳道内按 order_index 再按 id 稳定排序，无随机、无时间依赖、无迭代收敛。
 *
 * 为什么筛选判定放在「布局」文件里：task-3 只允许写 6 个文件，而 FlowCanvas 与 LedgerList 必须共用
 * 同一套筛选口径（§5.5「画布 / 账册 / 分栏三种布局共享同一选中与筛选」），因此它是本任务唯一的纯函数模块。
 */

import { MODULE_COLORS } from '@/components/Worldbuilding/types';
import type { EntityRef } from '@/services/worldbuildingApi';
import {
  ECONOMY_CONFIG_DEFAULTS,
  ECONOMY_RECOMMENDED_KINDS,
  isCrosscut,
  stageLabel,
  stageOfKind,
  stageOrder,
} from '../config';
import type { EntityTypeDef } from '../../shared/moduleConfig';
import type {
  EconomyFilterState,
  EconomyGroupBy,
  EconomyLayerId,
  EconomyLayerState,
  EconomySurplus,
  ResolvedEconomyConfig,
} from '../types';

/* ------------------------------------------------------------------ *
 * 几何常量（世界坐标 = SVG viewBox 坐标）
 * ------------------------------------------------------------------ */

/**
 * 泳道内一个节点占的格位（宽 / 高，像素）。
 * 高度必须容得下「形状 + 两行名称 + 一行小字」（§4.7.3 标签最多两行）：实测最大纵向占用约
 * `半高 h + 31`（lg 时 20 + 31 = 51），112 的格位给到半格 56，行间不会互相压字。
 */
export const ECONOMY_CELL_WIDTH = 132;
export const ECONOMY_CELL_HEIGHT = 112;
/** 横切轨的节点格位更矮：轨道带是「一条横线」而不是一级泳道（§2.2 横切·轨道） */
export const ECONOMY_CROSSCUT_CELL_HEIGHT = 92;
export const ECONOMY_LANE_HEADER = 26;
export const ECONOMY_LANE_PADDING = 18;
export const ECONOMY_LANE_GAP = 10;
/** 画布默认宽度（未显式传 width 时）；高度由泳道累加得出，设下限避免空画布塌成一条线 */
export const ECONOMY_CANVAS_WIDTH = 1180;
export const ECONOMY_CANVAS_MIN_HEIGHT = 360;

/** 网络图：环基准半径 / 环间距 / 环上单节点占的弧长 / 边距 */
export const ECONOMY_NETWORK_RING_BASE = 150;
export const ECONOMY_NETWORK_RING_GAP = 120;
export const ECONOMY_NETWORK_NODE_SPACING = 128;
export const ECONOMY_NETWORK_MARGIN = 72;

/* ------------------------------------------------------------------ *
 * 输入形状（结构性类型：EconomyNode / EconomyEdge 天然满足，测试可传最小对象）
 * ------------------------------------------------------------------ */

export interface LayoutNodeInput {
  id: string;
  kind: string;
  /** 后端已解析的流转阶段；缺省时按 kind 推导 */
  stage?: string | null;
  /** 同泳道内的稳定次序（缺省按 0 处理）；后端未给创建时间，id 作第二稳定键 */
  orderIndex?: number;
}

export interface LayoutEdgeInput {
  id: string;
  source: EntityRef;
  target: EntityRef;
}

/* ------------------------------------------------------------------ *
 * 泳道布局
 * ------------------------------------------------------------------ */

export interface LaneBand {
  /** 阶段 id 或 kind id（FlowCanvas 的 data-testid 用它） */
  id: string;
  label: string;
  /** 展示用次序（阶段用 config.stages.order，横切轨置底） */
  order: number;
  /** kind 模式下的 kind id */
  kind?: string;
  /** 横切轨（通货 / 制度）：画成轨道带而不是一级泳道 */
  crosscut: boolean;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
}

export interface LaneNodePlacement {
  id: string;
  x: number;
  y: number;
  lane: string;
  laneIndex: number;
  row: number;
  column: number;
}

export interface LaneLayout {
  groupBy: EconomyGroupBy;
  lanes: LaneBand[];
  nodes: LaneNodePlacement[];
  /** id -> 节点中心（SVG 坐标），边层与键盘方向键都用它 */
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

export interface LaneLayoutOptions {
  groupBy?: EconomyGroupBy;
  /** 解析后的模块配置（阶段定义可被用户改名 / 调序）；缺省用出厂骨架 */
  config?: ResolvedEconomyConfig;
  /** kind 定义（推荐骨架 + 自定义），决定类型泳道顺序与文案 */
  kinds?: EntityTypeDef[];
  width?: number;
}

/** 稳定排序：order_index 优先，其次 id（同一份数据两次布局结果恒等） */
export const compareLayoutNodes = (a: LayoutNodeInput, b: LayoutNodeInput): number =>
  (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.id.localeCompare(b.id);

/** 节点归属的泳道键：阶段模式优先取后端已解析的 stage，缺省按 kind 推导 */
export const laneKeyOf = (
  node: LayoutNodeInput,
  groupBy: EconomyGroupBy,
  config: ResolvedEconomyConfig = ECONOMY_CONFIG_DEFAULTS
): string => {
  if (groupBy === 'kind') return node.kind || 'unknown';
  const stage = typeof node.stage === 'string' && node.stage ? node.stage : undefined;
  return stage ?? stageOfKind(node.kind, config);
};

const kindLabelOf = (kindId: string, kinds?: EntityTypeDef[]): string =>
  kinds?.find((def) => def.id === kindId)?.label ??
  ECONOMY_RECOMMENDED_KINDS.find((def) => def.id === kindId)?.label ??
  kindId;

interface LanePlan {
  id: string;
  label: string;
  order: number;
  kind?: string;
  crosscut: boolean;
}

/** 类型泳道顺序：推荐 kind 在前 -> custom_ -> 出现但未登记的 kind（按 id 稳定排序） */
const kindLanePlans = (nodes: readonly LayoutNodeInput[], kinds?: EntityTypeDef[]): LanePlan[] => {
  const declared = (kinds ?? []).map((def) => def?.id).filter((id): id is string => !!id);
  const present = [...new Set(nodes.map((node) => node.kind || 'unknown'))];
  const extra = present.filter((id) => !declared.includes(id)).sort();
  const ordered = [
    ...declared.filter((id) => !id.startsWith('custom_')),
    ...declared.filter((id) => id.startsWith('custom_')),
    ...extra,
  ];
  return ordered.map((id, index) => ({
    id,
    label: kindLabelOf(id, kinds),
    order: index,
    kind: id,
    crosscut: false,
  }));
};

/** 阶段泳道顺序：非横切阶段按 order -> 未登记阶段 -> 横切轨（始终置底） */
const stageLanePlans = (
  nodes: readonly LayoutNodeInput[],
  config: ResolvedEconomyConfig
): LanePlan[] => {
  const stages = [...(config.stages ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
  );
  const primary = stages.filter((stage) => !isCrosscut(stage.id));
  const crosscuts = stages.filter((stage) => isCrosscut(stage.id));
  const present = [...new Set(nodes.map((node) => laneKeyOf(node, 'stage', config)))];
  const unknown = present
    .filter((id) => !stages.some((stage) => stage.id === id))
    .sort((a, b) => stageOrder(a) - stageOrder(b) || a.localeCompare(b));
  return [
    ...primary.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      order: typeof stage.order === 'number' ? stage.order : index,
      crosscut: false,
    })),
    ...unknown.map((id) => ({
      id,
      label: stageLabel(id, config),
      order: 500 + stageOrder(id),
      crosscut: isCrosscut(id),
    })),
    ...crosscuts.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      order: 900 + (typeof stage.order === 'number' ? stage.order : index),
      crosscut: true,
    })),
  ];
};

/**
 * 泳道布局（纯函数）。
 *
 * 规则：
 * 1. 泳道只画「有节点」的，不显示空洞目录（§4.5.1：数据为空时轨道不出现）；
 * 2. 泳道内按 order_index -> id 排序，从左到右按格位排布，超出列数换行（绝不排成一条 8000px 长行）；
 * 3. 横切轨用更矮的格位并置底：通货 / 制度是一条轨道带，不占一级泳道（§2.1）；
 * 4. 0 / 1 / N 个孤立节点都成立：无节点时 lanes 为空、高度取画布下限。
 */
export const buildLaneLayout = (
  nodes: readonly LayoutNodeInput[] = [],
  options: LaneLayoutOptions = {}
): LaneLayout => {
  const config = options.config ?? ECONOMY_CONFIG_DEFAULTS;
  const groupBy = options.groupBy ?? 'stage';
  const width = options.width && options.width > 0 ? options.width : ECONOMY_CANVAS_WIDTH;
  const columns = Math.max(
    1,
    Math.floor((width - ECONOMY_LANE_PADDING * 2) / ECONOMY_CELL_WIDTH)
  );

  const plans =
    groupBy === 'kind' ? kindLanePlans(nodes, options.kinds) : stageLanePlans(nodes, config);

  const byLane = new Map<string, LayoutNodeInput[]>();
  for (const node of nodes) {
    const key = laneKeyOf(node, groupBy, config);
    const bucket = byLane.get(key);
    if (bucket) bucket.push(node);
    else byLane.set(key, [node]);
  }
  for (const bucket of byLane.values()) bucket.sort(compareLayoutNodes);

  const lanes: LaneBand[] = [];
  const placements: LaneNodePlacement[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
  let cursorY = 0;

  for (const plan of plans) {
    const members = byLane.get(plan.id);
    if (!members || members.length === 0) continue; // 空格位不出现
    const cellHeight = plan.crosscut ? ECONOMY_CROSSCUT_CELL_HEIGHT : ECONOMY_CELL_HEIGHT;
    const rows = Math.max(1, Math.ceil(members.length / columns));
    const laneIndex = lanes.length;
    const laneY = cursorY;
    const height = ECONOMY_LANE_HEADER + rows * cellHeight + ECONOMY_LANE_PADDING;
    lanes.push({
      id: plan.id,
      label: plan.label,
      order: plan.order,
      kind: plan.kind,
      crosscut: plan.crosscut,
      index: laneIndex,
      x: 0,
      y: laneY,
      width,
      height,
      nodeIds: members.map((member) => member.id),
    });
    members.forEach((node, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = ECONOMY_LANE_PADDING + column * ECONOMY_CELL_WIDTH + ECONOMY_CELL_WIDTH / 2;
      const y = laneY + ECONOMY_LANE_HEADER + row * cellHeight + cellHeight / 2;
      placements.push({ id: node.id, x, y, lane: plan.id, laneIndex, row, column });
      positions[node.id] = { x, y };
    });
    cursorY += height + ECONOMY_LANE_GAP;
  }

  const size = estimateCanvasSize(lanes, width);
  return { groupBy, lanes, nodes: placements, positions, width: size.width, height: size.height };
};

/** 泳道累加 -> 画布尺寸（下限兜底，避免空画布塌成一条线） */
export const estimateCanvasSize = (
  lanes: readonly Pick<LaneBand, 'height'>[],
  width: number = ECONOMY_CANVAS_WIDTH
): { width: number; height: number } => {
  const height =
    lanes.length === 0
      ? ECONOMY_CANVAS_MIN_HEIGHT
      : lanes.reduce((sum, lane) => sum + lane.height, 0) +
        ECONOMY_LANE_GAP * (lanes.length - 1) +
        ECONOMY_LANE_PADDING * 2;
  return {
    width: Math.max(width, ECONOMY_CELL_WIDTH + ECONOMY_LANE_PADDING * 2),
    height: Math.max(ECONOMY_CANVAS_MIN_HEIGHT, height),
  };
};

/* ------------------------------------------------------------------ *
 * 网络图布局（轻量自研：环形 + 关联数分环）
 * ------------------------------------------------------------------ */

export interface NetworkRing {
  index: number;
  radius: number;
  nodeIds: string[];
}

export interface NetworkNodePlacement {
  id: string;
  x: number;
  y: number;
  ring: number;
  degree: number;
}

export interface NetworkLayout {
  nodes: NetworkNodePlacement[];
  positions: Record<string, { x: number; y: number }>;
  rings: NetworkRing[];
  width: number;
  height: number;
}

export interface NetworkLayoutOptions {
  width?: number;
  height?: number;
}

/** 关联数（出 + 入）：两端都在结果集内才计数，箭头不因视觉方向改变归属 */
export const degreeMapOf = (
  nodes: readonly LayoutNodeInput[],
  edges: readonly LayoutEdgeInput[]
): Map<string, number> => {
  const degree = new Map<string, number>();
  for (const node of nodes) degree.set(node.id, 0);
  for (const edge of edges) {
    const source = edge.source?.id;
    const target = edge.target?.id;
    if (source && degree.has(source)) degree.set(source, (degree.get(source) ?? 0) + 1);
    if (target && degree.has(target)) degree.set(target, (degree.get(target) ?? 0) + 1);
  }
  return degree;
};

/**
 * 网络布局（纯函数）：关联数最高的节点在中心，其余按关联数分环，环上按角度均分。
 * 不做力导迭代（不需要收敛、结果确定），也不引入任何图形库。
 * 0 个节点返回空布局；N 个孤立节点（全为 0 度）也稳定排在一环上。
 */
export const buildNetworkLayout = (
  nodes: readonly LayoutNodeInput[] = [],
  edges: readonly LayoutEdgeInput[] = [],
  options: NetworkLayoutOptions = {}
): NetworkLayout => {
  const requestedWidth = options.width && options.width > 0 ? options.width : ECONOMY_CANVAS_WIDTH;
  const requestedHeight = options.height && options.height > 0 ? options.height : 720;
  const degree = degreeMapOf(nodes, edges);
  const ordered = [...nodes].sort(
    (a, b) =>
      (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || compareLayoutNodes(a, b)
  );

  const bucketOfRing = (ring: number): number => (ring === 0 ? 1 : ring * 6);
  const radiusOfRing = (ring: number): number => {
    if (ring === 0) return 0;
    const capacity = bucketOfRing(ring);
    const byCapacity = (capacity * ECONOMY_NETWORK_NODE_SPACING) / (Math.PI * 2);
    return Math.max(ECONOMY_NETWORK_RING_BASE + (ring - 1) * ECONOMY_NETWORK_RING_GAP, byCapacity);
  };

  // 先切环，再按最大半径定画布（内容再大也要放得下，居中后不会被裁掉）
  const ringMembers: LayoutNodeInput[][] = [];
  let index = 0;
  let ring = 0;
  while (index < ordered.length) {
    const capacity = bucketOfRing(ring);
    ringMembers.push(ordered.slice(index, index + capacity));
    index += capacity;
    ring += 1;
  }
  const maxRadius = ringMembers.length > 0 ? radiusOfRing(ringMembers.length - 1) : 0;
  const need = Math.max(0, (maxRadius + ECONOMY_NETWORK_MARGIN) * 2);
  const width = Math.max(requestedWidth, need);
  const height = Math.max(requestedHeight, need);
  const cx = width / 2;
  const cy = height / 2;

  const placements: NetworkNodePlacement[] = [];
  const positions: Record<string, { x: number; y: number }> = {};
  const rings: NetworkRing[] = [];

  ringMembers.forEach((members, ringIndex) => {
    const radius = radiusOfRing(ringIndex);
    const step = (Math.PI * 2) / Math.max(1, members.length);
    const start = -Math.PI / 2 + ringIndex * 0.35; // 每环错开起始角，减少同列压字
    members.forEach((node, slot) => {
      const angle = start + step * slot;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      placements.push({ id: node.id, x, y, ring: ringIndex, degree: degree.get(node.id) ?? 0 });
      positions[node.id] = { x, y };
    });
    rings.push({ index: ringIndex, radius, nodeIds: members.map((member) => member.id) });
  });

  return { nodes: placements, positions, rings, width, height };
};

/* ------------------------------------------------------------------ *
 * 筛选（画布 / 账册同一口径；§5.5）
 * ------------------------------------------------------------------ */

export interface FilterableNode extends LayoutNodeInput {
  name?: string;
  description?: string | null;
  level?: string | null;
  status?: string | null;
  counts?: { outgoing?: number; incoming?: number; total?: number } | null;
  hasMetrics?: boolean;
}

/** 关联数合计：优先用后端给出的 total，缺省由出 / 入相加（缺计数按 0，不按未知） */
export const linkCountOf = (node: {
  counts?: { outgoing?: number; incoming?: number; total?: number } | null;
}): number => {
  const counts = node.counts;
  if (!counts) return 0;
  if (typeof counts.total === 'number') return counts.total;
  return (counts.outgoing ?? 0) + (counts.incoming ?? 0);
};

const SEARCH_TOKEN = /^(kind|stage|level|status):(.+)$/i;

/**
 * 搜索：支持 `kind:market 集市` 形式（§5.5）。
 * 字段 token 精确匹配，其余词命中名称 / id / 描述任意一处即可（AND 语义）。
 */
export const matchEconomySearch = (
  node: FilterableNode,
  search: string | undefined,
  stage: string
): boolean => {
  const text = (search ?? '').trim();
  if (!text) return true;
  const haystack = `${node.name ?? ''} ${node.id} ${node.description ?? ''}`.toLowerCase();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const token = SEARCH_TOKEN.exec(word);
    if (token) {
      const field = token[1].toLowerCase();
      const value = token[2].toLowerCase();
      if (field === 'kind' && node.kind.toLowerCase() !== value) return false;
      if (field === 'stage' && stage.toLowerCase() !== value) return false;
      if (field === 'level' && (node.level ?? '').toLowerCase() !== value) return false;
      if (field === 'status' && (node.status ?? '').toLowerCase() !== value) return false;
      continue;
    }
    if (!haystack.includes(word.toLowerCase())) return false;
  }
  return true;
};

/** 筛选判定：阶段 / kind / 等级 / 状态 / 关联数区间 / 有无指标 / 搜索 */
export const matchesEconomyFilter = (
  node: FilterableNode,
  filters: EconomyFilterState | null | undefined,
  config: ResolvedEconomyConfig = ECONOMY_CONFIG_DEFAULTS
): boolean => {
  if (!filters) return true;
  const stage = laneKeyOf(node, 'stage', config);
  if (filters.stages?.length && !filters.stages.includes(stage)) return false;
  if (filters.kinds?.length && !filters.kinds.includes(node.kind)) return false;
  if (filters.levels?.length && !(node.level && filters.levels.includes(node.level))) return false;
  if (filters.statuses?.length && !(node.status && filters.statuses.includes(node.status)))
    return false;

  const total = linkCountOf(node);
  const min = filters.linkCount?.min;
  const max = filters.linkCount?.max;
  if (typeof min === 'number' && total < min) return false;
  if (typeof max === 'number' && total > max) return false;
  if (filters.hasMetrics === true && !node.hasMetrics) return false;

  return matchEconomySearch(node, filters.search, stage);
};

/** 是否有任何筛选条件生效（决定是否给「清除筛选」入口） */
export const hasActiveFilter = (filters: EconomyFilterState | null | undefined): boolean => {
  if (!filters) return false;
  return (
    (filters.stages?.length ?? 0) > 0 ||
    (filters.kinds?.length ?? 0) > 0 ||
    (filters.levels?.length ?? 0) > 0 ||
    (filters.statuses?.length ?? 0) > 0 ||
    typeof filters.linkCount?.min === 'number' ||
    typeof filters.linkCount?.max === 'number' ||
    filters.hasMetrics === true ||
    !!filters.search?.trim()
  );
};

/* ------------------------------------------------------------------ *
 * 图层（只影响绘制，不改变筛选结果；§4.6.5）
 * ------------------------------------------------------------------ */

export const layerVisible = (layers: EconomyLayerState | null | undefined, id: EconomyLayerId): boolean =>
  layers?.[id] !== false;

/* ------------------------------------------------------------------ *
 * 线型 / 色名 / 强度 / 规模（注册表 -> SVG 的唯一折算点）
 * ------------------------------------------------------------------ */

const TONE_STROKE: Record<string, string> = {
  // §4.7.1：契约绿是 eco-green-600 (#16A34A)，即 Tailwind green-600，不能用 emerald
  emerald: 'stroke-emerald-600 dark:stroke-emerald-400',
  green: 'stroke-green-600 dark:stroke-green-400',
  teal: 'stroke-teal-600 dark:stroke-teal-400',
  cyan: 'stroke-cyan-600 dark:stroke-cyan-400',
  lime: 'stroke-lime-600 dark:stroke-lime-400',
  yellow: 'stroke-yellow-600 dark:stroke-yellow-400',
  amber: 'stroke-amber-600 dark:stroke-amber-400',
  orange: 'stroke-orange-600 dark:stroke-orange-400',
  blue: 'stroke-blue-600 dark:stroke-blue-400',
  violet: 'stroke-violet-600 dark:stroke-violet-400',
  red: 'stroke-red-600 dark:stroke-red-400',
  slate: 'stroke-slate-500 dark:stroke-slate-400',
  neutral: 'stroke-slate-500 dark:stroke-slate-400',
  /** 赤字语义（§4.6.1）：必须配文字或斜纹，不单独承载语义 */
  deficit: 'stroke-amber-600 dark:stroke-amber-400',
};

const TONE_FILL: Record<string, string> = {
  emerald: 'fill-emerald-600 dark:fill-emerald-400',
  green: 'fill-green-600 dark:fill-green-400',
  teal: 'fill-teal-600 dark:fill-teal-400',
  cyan: 'fill-cyan-600 dark:fill-cyan-400',
  lime: 'fill-lime-600 dark:fill-lime-400',
  yellow: 'fill-yellow-600 dark:fill-yellow-400',
  amber: 'fill-amber-600 dark:fill-amber-400',
  orange: 'fill-orange-600 dark:fill-orange-400',
  blue: 'fill-blue-600 dark:fill-blue-400',
  violet: 'fill-violet-600 dark:fill-violet-400',
  red: 'fill-red-600 dark:fill-red-400',
  slate: 'fill-slate-500 dark:fill-slate-400',
  neutral: 'fill-slate-500 dark:fill-slate-400',
  deficit: 'fill-amber-600 dark:fill-amber-400',
};

/** 色名不是封闭集合（ModuleConfig 允许自填），未登记的色名一律退回中性线色 */
export const toneStrokeClassOf = (tone?: string | null): string =>
  TONE_STROKE[tone ?? 'neutral'] ?? TONE_STROKE.neutral;

export const toneFillClassOf = (tone?: string | null): string =>
  TONE_FILL[tone ?? 'neutral'] ?? TONE_FILL.neutral;

/** 盈余 / 赤字 -> 色名（§4.6.1：盈余 green、平衡 cyan、赤字 amber、未知中性） */
export const SURPLUS_TONE_KEY: Record<EconomySurplus, string> = {
  surplus: 'green',
  balanced: 'cyan',
  deficit: 'deficit',
  unknown: 'neutral',
};

/** 外站（跨模块实体）的领域底色取对方模块（契约 §6.5 建议领域色） */
export const moduleToneOf = (module?: string | null): string =>
  (module ? MODULE_COLORS[module] : undefined) ?? 'neutral';

/** 契约注册表线型 -> SVG stroke-dasharray；'double' 由双边偏移表达，不用虚线 */
export const dashArrayOf = (lineStyle?: string | null): string | undefined => {
  switch (lineStyle) {
    case 'dashed':
      return '7 5';
    case 'dotted':
      return '2 4';
    default:
      return undefined;
  }
};

/** 无流量时统一细线；有 intensity(1-5) 时按级差加粗，不显示 0（§4.5.2） */
export const edgeWidthFromIntensity = (intensity?: number | null): number => {
  if (typeof intensity !== 'number' || !Number.isFinite(intensity)) return 1.4;
  const level = Math.min(5, Math.max(1, Math.round(intensity)));
  return 1.4 + (level - 1) * 0.7;
};

export const clampEdgeWidth = (value: number): number =>
  Math.min(8, Math.max(1, Number.isFinite(value) ? value : 1.4));

/** 斜纹 / 箭头按元素派生 id：每个节点 / 边自带 defs，不互相引用（缺 id 会画出空图形） */
export const hatchPatternId = (key: string): string => `economy-hatch-${key}`;
export const arrowMarkerId = (key: string): string => `economy-arrow-${key}`;

/* ------------------------------------------------------------------ *
 * 节点大小与文本
 * ------------------------------------------------------------------ */

/** 四级视觉权重（§2.2）的 kind 基准：一级枢纽 3、横切与主体 2、二级物料 1 */
const KIND_WEIGHT: Record<string, number> = {
  market: 3,
  industry: 3,
  actor: 2,
  currency: 2,
  institution: 2,
  resource: 1,
  good: 1,
};

export const sizeTierFromWeight = (weight: number): 'sm' | 'md' | 'lg' => {
  if (weight >= 3) return 'lg';
  if (weight <= 1.5) return 'sm';
  return 'md';
};

/**
 * 结构档默认节点大小：kind 权重 +（填了等级）+（关联数 >= 4）。
 * 沙盘档的 visual.nodeSize 是唯一口径，本函数只在 visual 未给出该节点时兜底。
 * 未填等级 / 规模不报错、不催填（§2.2），仍按二级视觉成立。
 */
export const defaultNodeSize = (node: {
  kind: string;
  level?: string | null;
  counts?: { outgoing?: number; incoming?: number; total?: number } | null;
}): 'sm' | 'md' | 'lg' => {
  let weight = KIND_WEIGHT[node.kind] ?? 2;
  if (node.level) weight += 0.5;
  const links = linkCountOf(node);
  if (links >= 4) weight += 0.5;
  return sizeTierFromWeight(weight);
};

/**
 * 规模文本：「—」= 未填，`0` 是有效值（§4.6.2 明确区分）。
 * 例：2 + 袋 -> 「2 袋」；0 -> 「0 袋」；未填 -> 「—」。
 */
export const formatScaleLabel = (scale?: number | null, unit?: string | null): string => {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return '—';
  const unitText = typeof unit === 'string' && unit ? ` ${unit}` : '';
  return `${scale}${unitText}`;
};

/** 节点标签最多两行、超出省略（§4.7.3） */
export const wrapNodeLabel = (name: string, maxChars = 8, maxLines = 2): string[] => {
  const text = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return [];
  if (text.length <= maxChars) return [text];
  const lines: string[] = [];
  let cursor = 0;
  while (cursor < text.length && lines.length < maxLines) {
    if (lines.length === maxLines - 1) {
      const rest = text.slice(cursor);
      lines.push(rest.length > maxChars ? `${rest.slice(0, Math.max(1, maxChars - 1))}…` : rest);
      break;
    }
    lines.push(text.slice(cursor, cursor + maxChars));
    cursor += maxChars;
  }
  return lines;
};
