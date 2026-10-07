/**
 * EconomyView 类型与组件接口（Phase 5 P5-T8 冻结；economy_ui_design §3.2/§4/§8/§11.4）
 *
 * 分三层，禁止互相越界：
 * 1) **契约层**：`EconomyGraph` / `EconomySummary` / `EconomyTimeline` / `EconomyMetrics` 直接取自
 *    OpenAPI 生成类型（`npm run gen:types`），与后端 `app/schemas/economy.py` 一一对应，前端不手写副本；
 * 2) **视图状态层**：筛选、图层、时间窗、布局、降级形态等只存在于前端，绝不写回世界数据；
 * 3) **组件接口层**：本文件冻结各组件 props，组件之间只通过这些形状通信（P5-T8..T14 并行实现的依据）。
 *
 * 契约细节（改动前先改设计文档）：
 * - 三档共用一套数据：sketch 只读 `EconomySummary`，structure 读 `EconomyGraph`，
 *   sandbox 再读 `EconomyTimeline` + `EconomyMetrics`；
 * - 缺失值与 0 必须可区分：`scale` / `flow` 的 `undefined` 表示未知，`0` 是有效值；
 * - 指标缺采样不补 0；多单位不换算；无时间锚点不猜时间；
 * - 领域色 green / cyan，图标一律 Lucide 名（kebab-case），全文无 emoji。
 */

import type { ReactNode } from 'react';

import type { components } from '@/types/api';
import type { ComplexityLevel, EntityRef } from '@/services/worldbuildingApi';
import type { CustomFieldDef, EntityTypeDef, LevelDef, StatusDef } from '../shared/moduleConfig';

// ---------------------------------------------------------------------------
// 1. 契约层（后端 payload；camelCase）
// ---------------------------------------------------------------------------

export type EconomyConfig = components['schemas']['EconomyConfig'];
export type EconomyChip = components['schemas']['EconomyChip'];
export type EconomyOverview = components['schemas']['EconomyOverview'];
export type EconomyCycle = components['schemas']['EconomyCycle'];
export type EconomyCyclePhase = components['schemas']['EconomyCyclePhase'];
export type EconomyCycleBand = components['schemas']['EconomyCycleBand'];
export type EconomyMetricDef = components['schemas']['EconomyMetricDef'];
export type EconomyMetricSample = components['schemas']['EconomyMetricSample'];
export type EconomyMetricSeries = components['schemas']['EconomyMetricSeries'];
export type EconomyMetrics = components['schemas']['EconomyMetrics'];
export type EconomyNode = components['schemas']['EconomyNode'];
export type EconomyEdge = components['schemas']['EconomyEdge'];
export type EconomyGraph = components['schemas']['EconomyGraph'];
export type EconomyGraphCounts = components['schemas']['EconomyGraphCounts'];
export type EconomySummary = components['schemas']['EconomySummary'];
export type EconomyTimeline = components['schemas']['EconomyTimeline'];
export type EconomyTimelineMarker = components['schemas']['EconomyTimelineMarker'];
export type EconomyFoldCounts = components['schemas']['EconomyFoldCounts'];
export type EconomyTotals = components['schemas']['EconomyTotals'];
export type EconomyStatBucket = components['schemas']['EconomyStatBucket'];
export type EconomyTimeRange = components['schemas']['EconomyTimeRange'];
export type EconomyLayerConfig = components['schemas']['EconomyLayerConfig'];
export type EconomyStageDef = components['schemas']['EconomyStageDef'];
export type EconomySketchFieldDef = components['schemas']['EconomySketchFieldDef'];

/** 画布 / 账册布局（economy_ui_design §4.2/§5.5：线路图 · 账册 · 分栏） */
export type EconomyLayoutMode = 'lanes' | 'network' | 'ledger' | 'split';
/** 泳道分组维度：按流转阶段（默认）或按类型（§2.1） */
export type EconomyGroupBy = 'stage' | 'kind';
/** 边线宽口径：无流量用强度；只有一条边有值时进入绝对模式（§4.6.2） */
export type EconomyFlowScale = 'none' | 'intensity' | 'absolute' | 'relative';
/** 盈余 / 赤字（颜色必须配文字或纹理，不单独承载语义） */
export type EconomySurplus = 'surplus' | 'balanced' | 'deficit' | 'unknown';
/** 通货与制度横切轨的展开状态 */
export type EconomyCrosscut = 'currency' | 'institution';

/** 图层开关（只影响绘制，不改变筛选结果；§4.6.5） */
export type EconomyLayerId =
  | 'trunk'
  | 'flows'
  | 'balance'
  | 'currency'
  | 'institutions'
  | 'cycles'
  | 'history'
  | 'external';

export type EconomyLayerState = Partial<Record<EconomyLayerId, boolean>>;

// ---------------------------------------------------------------------------
// 2. 视图状态层（只在前端；§11.4 EconomyViewState）
// ---------------------------------------------------------------------------

export interface EconomyFilterState {
  stages: string[];
  kinds: string[];
  levels: string[];
  statuses: string[];
  linkCount: { min?: number; max?: number };
  hasMetrics?: boolean;
  /** 搜索：支持 `kind:market 集市` 形式（§5.5） */
  search: string;
}

export interface EconomyTimeWindow {
  start?: string;
  end?: string;
}

/** 折叠提示条（降档不删数据，只提示「已折叠 N 项」；§4.3/§8.3） */
export interface EconomyFoldedNotice {
  links: number;
  metrics: number;
  fields: number;
  direction: 'up' | 'down';
  text: string;
}

/** graph/normalize.ts 出的视觉模型：数值叠加的唯一口径（P5-T12） */
export interface EconomyVisualModel {
  scale: EconomyFlowScale;
  flowMax: number;
  units: string[];
  multiUnit: boolean;
  /** 无任何流量值时为 true：边一律按 intensity 或细线绘制 */
  flowless: boolean;
  nodeSize: Record<string, 'sm' | 'md' | 'lg'>;
  nodeSurplus: Record<string, EconomySurplus>;
  edgeWidth: Record<string, number>;
  edgeSurplus: Record<string, EconomySurplus>;
  /** 边上的直接标注：'120 袋 / 季' / '0' / '—'（缺省与 0 不同） */
  edgeLabel: Record<string, string>;
  /** 时间未锚定的节点 / 边：同段末尾并标注（§4.6.3） */
  unanchored: Set<string>;
  /** 窗口内有采样的节点：其余节点淡出 */
  inWindow: Set<string>;
  stats: EconomyVisualStats;
}

export interface EconomyVisualStats {
  entities: number;
  links: number;
  totalFlow: number;
  flowUnits: string[];
  multiUnit: boolean;
  /** 是否真的记录过流量值（0 也是值）：false 时统计里的总量显示「—」而不是 0 */
  flowRecorded: boolean;
  surplus: { surplus: number; balanced: number; deficit: number; unknown: number };
  metricCoverage: number;
  hiddenLayersPresent: boolean;
  timeWindow: EconomyTimeWindow;
}

/** 速写动词 -> 标准关联（§4.4 速写动词到标准关联的映射） */
export interface EconomyVerbLink {
  verb: string;
  label: string;
  linkType: string;
  /** false = 先落 core.related_to + label，进入结构档后可一键细化 */
  direct: boolean;
}

export type EconomyEmptyScene =
  | 'all-empty'
  | 'entities-without-links'
  | 'chips-unexpanded'
  | 'industry-without-resource'
  | 'market-without-currency'
  | 'sandbox-without-metrics'
  | 'sandbox-without-cycle'
  | 'empty-window'
  | 'no-filter-result';

// ---------------------------------------------------------------------------
// 3. 组件接口层（P5-T8..T14 并行实现的冻结签名）
// ---------------------------------------------------------------------------

export interface EconomyViewProps {
  worldId: string;
  moduleId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  highlightRef?: EntityRef | null;
}

/** 数据层结果（hooks/useEconomyData.ts；组件层不直接发请求） */
export interface UseEconomyDataResult {
  worldId: string;
  moduleId: string;
  complexity: ComplexityLevel;
  rawConfig: EconomyConfig | null;
  config: ResolvedEconomyConfig;
  summary: EconomySummary | null;
  graph: EconomyGraph | null;
  timeline: EconomyTimeline | null;
  metrics: EconomyMetrics | null;
  nodes: EconomyNode[];
  edges: EconomyEdge[];
  entries: import('@/services/worldbuildingApi').ModuleItemV2[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;

  hasEntity: (id: string) => boolean;
  createEntity: (input: EconomyEntityInput) => Promise<import('@/services/worldbuildingApi').SubmoduleV2>;
  updateEntity: (
    entityId: string,
    patch: EconomyEntityPatch
  ) => Promise<import('@/services/worldbuildingApi').SubmoduleV2>;
  deleteEntity: (entityId: string) => Promise<void>;
  saveOverview: (overview: EconomyOverview) => Promise<void>;
  saveCycle: (cycle: EconomyCycle) => Promise<void>;
  deleteCycle: (cycleId: string) => Promise<void>;
  saveMetricSamples: (
    entityId: string,
    metricId: string,
    samples: EconomyMetricSample[]
  ) => Promise<void>;
  saveEntry: (
    entityId: string,
    name: string,
    content: Record<string, unknown>
  ) => Promise<void>;
  createLink: (input: EconomyLinkInput) => Promise<unknown>;
  updateLink: (
    linkId: string,
    patch: { label?: string | null; note?: string | null; meta?: Record<string, unknown>; time?: EconomyTimeWindow | null }
  ) => Promise<unknown>;
  deleteLink: (linkId: string) => Promise<void>;
  saveConfig: (patch: Partial<EconomyConfig>) => Promise<void>;
  isSaving: boolean;
}

export interface EconomyEntityInput {
  name: string;
  kind: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  orderIndex?: number;
  meta?: Record<string, unknown>;
}

export interface EconomyEntityPatch {
  name?: string;
  kind?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  orderIndex?: number;
  meta?: Record<string, unknown>;
}

export interface EconomyLinkInput {
  linkType: string;
  source: EntityRef;
  target: EntityRef;
  label?: string | null;
  note?: string | null;
  meta?: Record<string, unknown>;
  time?: EconomyTimeWindow | null;
}

/** 前端解析后的模块配置（叠加默认值；未知键原样保留） */
export interface ResolvedEconomyConfig extends Record<string, unknown> {
  defaultComplexity: ComplexityLevel;
  displayMode: string;
  entityTypes: EntityTypeDef[];
  levels: LevelDef[];
  statuses: StatusDef[];
  stages: EconomyStageDef[];
  sketchFields: EconomySketchFieldDef[];
  metrics: EconomyMetricDef[];
  layers: EconomyLayerConfig[];
  defaultFlowUnit?: string;
  fieldSchema?: Record<string, CustomFieldDef[]>;
  terminology?: Record<string, string>;
}

/** SketchLedger（P5-T9）：速写档唯一的可见组件 */
export interface SketchLedgerProps {
  config: ResolvedEconomyConfig;
  overview: EconomyOverview | null;
  fold: EconomyFoldCounts;
  counts: { entities: number; links: number };
  /** 速写档只读展示的往来（已细化边 + 未细化 core.related_to） */
  verbLinksOf: (chip: EconomyChip) => EconomyVerbLinkRow[];
  canWrite: boolean;
  isSaving: boolean;
  onSaveOverview: (overview: EconomyOverview) => void | Promise<void>;
  onPromoteChip: (chip: EconomyChip, fieldId: string) => void;
  onExpandAllChips: (field: EconomySketchFieldDef, chips: EconomyChip[]) => void | Promise<void>;
  onOpenStructure: () => void;
  onCreateVerbLink: (source: EconomyChip, verb: EconomyVerbLink, target: EconomyChip) => void | Promise<void>;
  term: (key: string, fallback: string) => string;
}

export interface EconomyVerbLinkRow {
  id: string;
  verbLabel: string;
  linkType: string;
  fromLabel: string;
  toLabel: string;
  /** 未细化：仍是一条 core.related_to + label，可一键细化 */
  raw: boolean;
  refine: () => void;
}

export interface ChipListProps {
  field: EconomySketchFieldDef;
  chips: EconomyChip[];
  canWrite: boolean;
  suggestions?: string[];
  onChange: (chips: EconomyChip[]) => void;
  onPromote: (chip: EconomyChip) => void;
  onExpandAll: () => void;
  term: (key: string, fallback: string) => string;
}

export interface PromoteChipModalProps {
  open: boolean;
  chip: EconomyChip | null;
  /** chip 所属速写字段：决定默认 kind（资源->resource、产业->industry、货币->currency） */
  field: EconomySketchFieldDef | null;
  kinds: EntityTypeDef[];
  onClose: () => void;
  onConfirm: (kind: string) => void | Promise<void>;
}

/** FlowCanvas（P5-T10）：线路图 / 网络图；沙盘叠加只改绘制，不改数据 */
export interface FlowCanvasProps {
  nodes: EconomyNode[];
  edges: EconomyEdge[];
  layout: EconomyLayoutMode;
  groupBy: EconomyGroupBy;
  filters: EconomyFilterState;
  layers: EconomyLayerState;
  selectedId: string | null;
  visual: EconomyVisualModel;
  /** 沙盘档：显示规模 / 流量 / 盈余叠加；structure 档为 false */
  sandbox: boolean;
  degraded: boolean;
  kindDefs: EntityTypeDef[];
  refs: { resolveName: (ref?: EntityRef | null) => string; isInvalid: (ref?: EntityRef | null) => boolean };
  onSelect: (nodeId: string) => void;
  onOpenEntity: (nodeId: string) => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  onClearSelection: () => void;
  onOpenLedger: () => void;
  onAddEntity: () => void;
  /**
   * 可选：画布工具条的 4 个回调。不传时画布**不渲染**这几个只读控件
   * （外壳已有同名控件时避免出现点不动的重复工具条）。
   */
  onLayoutChange?: (next: EconomyLayoutMode) => void;
  onGroupByChange?: (next: EconomyGroupBy) => void;
  onSearchChange?: (next: string) => void;
  onResetFilter?: () => void;
}

export interface GraphNodeProps {
  node: EconomyNode;
  x: number;
  y: number;
  size: 'sm' | 'md' | 'lg';
  selected: boolean;
  sandbox: boolean;
  surplus: EconomySurplus;
  scaleLabel: string;
  external: boolean;
  stub: boolean;
  dimmed: boolean;
  kindDef?: EntityTypeDef;
  onSelect: (nodeId: string) => void;
  onOpenEntity: (nodeId: string) => void;
}

export interface GraphEdgeProps {
  edge: EconomyEdge;
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
  surplus: EconomySurplus;
  label: string;
  lineStyle: string;
  color: string;
  dimmed: boolean;
  selected: boolean;
  onSelect: (edgeId: string) => void;
}

/** LedgerList（P5-T11）：账册是画布的第二面孔，共享选中与筛选 */
export interface LedgerListProps {
  nodes: EconomyNode[];
  edges: EconomyEdge[];
  stages: EconomyStatBucket[];
  kinds: EconomyStatBucket[];
  levels: LevelDef[];
  statuses: StatusDef[];
  filters: EconomyFilterState;
  groupBy: EconomyGroupBy;
  selectedId: string | null;
  visual: EconomyVisualModel | null;
  sandbox: boolean;
  onFiltersChange: (next: EconomyFilterState) => void;
  onGroupByChange: (next: EconomyGroupBy) => void;
  onSelect: (nodeId: string) => void;
  onOpenEntity: (nodeId: string) => void;
  onResetFilter: () => void;
  /** 可选：跨模块对端名称解析（缺省时只能显示「模块 + 短 id」） */
  refs?: {
    resolveName: (ref?: EntityRef | null) => string;
    isInvalid: (ref?: EntityRef | null) => boolean;
  };
}

/** InspectorPanel（P5-T11）：概览 -> 字段 -> 关联 -> 条目（沙盘在字段后插入指标） */
export interface InspectorPanelProps {
  worldId: string;
  complexity: ComplexityLevel;
  node: EconomyNode | null;
  edges: EconomyEdge[];
  levels: LevelDef[];
  statuses: StatusDef[];
  fieldSchema: Record<string, CustomFieldDef[]>;
  metrics: EconomyMetricDef[];
  metricSamples: Record<string, EconomyMetricSample[]>;
  entries: import('@/services/worldbuildingApi').ModuleItemV2[];
  kindDefs: EntityTypeDef[];
  canWrite: boolean;
  refs: { resolveName: (ref?: EntityRef | null) => string; isInvalid: (ref?: EntityRef | null) => boolean };
  onNavigateToEntity: (ref: EntityRef) => void;
  onClose: () => void;
  onUpdateMeta: (nodeId: string, patch: Record<string, unknown>) => Promise<void>;
  onUpdateName: (nodeId: string, name: string) => Promise<void>;
  onSaveMetrics: (nodeId: string, metricId: string, samples: EconomyMetricSample[]) => Promise<void>;
  onSaveEntry: (nodeId: string, name: string, content: Record<string, unknown>) => Promise<void>;
  onDeleteEntity: (nodeId: string) => Promise<void>;
  onLinkChanged: () => void;
  onNavigateToHistory: (ref: EntityRef) => void;
}

/** LayerRail（P5-T12）：图层开关只影响绘制 */
export interface LayerRailProps {
  layers: EconomyLayerConfig[];
  value: EconomyLayerState;
  complexity: ComplexityLevel;
  onChange: (next: EconomyLayerState) => void;
}

/** StatsPanel（P5-T12）：只统计已填数据，不做推断 */
export interface StatsPanelProps {
  stats: EconomyVisualStats;
  counts: EconomyGraphCounts | null;
  timeline: EconomyTimeline | null;
  multiUnit: boolean;
  onApplySurplus: (state: EconomySurplus | null) => void;
  onExportWindow: () => void;
}

/** SandboxOverlay（P5-T12）：沙盘的图层栏 + 统计 + 时间刷包围层 */
export interface SandboxOverlayProps {
  complexity: ComplexityLevel;
  layers: EconomyLayerConfig[];
  layerState: EconomyLayerState;
  onLayerChange: (next: EconomyLayerState) => void;
  visual: EconomyVisualModel;
  counts: EconomyGraphCounts | null;
  timeline: EconomyTimeline | null;
  window: EconomyTimeWindow;
  onWindowChange: (next: EconomyTimeWindow) => void;
  onResetWindow: () => void;
  onExportWindow: () => void;
  onApplySurplus: (state: EconomySurplus | null) => void;
  children: ReactNode;
}

/** TimeBrush（P5-T13）：周期带 + 时代底带 + 事件标记 + 窗口手柄 */
export interface TimeBrushProps {
  timeline: EconomyTimeline | null;
  window: EconomyTimeWindow;
  playing: boolean;
  onChange: (next: EconomyTimeWindow) => void;
  onTogglePlay: () => void;
  onReset: () => void;
}

/** DegradeLedgerMatrix（P5-T14）：超过阈值后的唯一路径（不做真实渲染优化） */
export interface DegradeLedgerMatrixProps {
  nodes: EconomyNode[];
  edges: EconomyEdge[];
  counts: EconomyGraphCounts | null;
  reason: string | null;
  nodeLimit: number;
  kinds: EconomyStatBucket[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  onOpenEntity: (nodeId: string) => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  /** 推荐关联：两端都在当前结果集、但尚无边的同类节点对 */
  recommendations: EconomyLinkRecommendation[];
}

export interface EconomyLinkRecommendation {
  source: EconomyNode;
  target: EconomyNode;
  linkType: string;
  reason: string;
}

/** EmptyState（P5-T14）：每个空状态只有一个主按钮，最多一个备选 */
export interface EconomyEmptyStateProps {
  scene: EconomyEmptyScene;
  onCreateEntity?: () => void;
  onWriteSketch: () => void;
  onDrawCanvas: () => void;
  onExpandChips?: () => void;
  onAddMetric?: () => void;
  onAddCycle?: () => void;
  onClearFilter?: () => void;
  onWidenWindow?: () => void;
  term: (key: string, fallback: string) => string;
}
