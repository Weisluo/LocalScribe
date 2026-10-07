/**
 * 经济模块配置骨架与常量（Phase 5 P5-T8 冻结；economy_ui_design §3.2/§3.4/§4.4/§4.6.5/§4.7）
 *
 * 口径：
 * - **不预置任何世界观内容**：推荐 kind、速写字段、指标骨架、图层全部只是「可选项」，
 *   用户点击后才写入 `WorldModule.config`；出厂配置里 levels / statuses / metrics / entityTypes 都是空。
 * - 领域色固定 green / cyan（§4.7.1）；图标一律 Lucide 名（kebab-case），全文无 emoji。
 * - 本文件是纯常量与纯函数，可被测试直接断言（不依赖 React）。
 */

import type { ComplexityLevel } from '@/services/worldbuildingApi';
import type {
  CustomFieldDef,
  EntityTypeDef,
  LevelDef,
  ModuleConfig,
  StatusDef,
} from '../shared/moduleConfig';
import type {
  EconomyConfig,
  EconomyFilterState,
  EconomyLayerConfig,
  EconomyLayerId,
  EconomyMetricDef,
  EconomyOverview,
  EconomySketchFieldDef,
  EconomyStageDef,
  EconomyVerbLink,
  ResolvedEconomyConfig,
} from './types';

export const ECONOMY_MODULE = 'economy';

/** 系统预登记的条目型 kind（经济周期）：不进节点层，但寻址能力不可删除（§3.4） */
export const CYCLE_KIND = 'custom_cycle';
/** 旧方案升级为独立节点时使用的 kind（§2.3：路线默认是边，显式升级才建节点） */
export const ROUTE_KIND = 'custom_route';

/** 速写字段槽位数量限制（§4.4：3-5 项，默认 5 项） */
export const ECONOMY_MIN_SKETCH_FIELDS = 3;
export const ECONOMY_MAX_SKETCH_FIELDS = 5;
/** chips 单槽建议上限：超出只提示不拦截（§4.4 规则 2） */
export const ECONOMY_CHIP_SUGGESTION_MAX = 6;
/** 超过该节点数自动降级为账册矩阵（§11.1）；后端 nodeLimit 优先 */
export const ECONOMY_MATRIX_THRESHOLD = 800;
/** 画布 SVG 上限与 canvas 区间（§11.1：300 以内 SVG，300-800 canvas） */
export const ECONOMY_SVG_NODE_LIMIT = 300;
/** 账册虚拟滚动阈值 */
export const ECONOMY_LEDGER_VIRTUAL_LIMIT = 200;

// ---------------------------------------------------------------------------
// 推荐 kind 骨架（§3.4 表格；默认不创建，用户勾选后才写入 config.entityTypes）
// ---------------------------------------------------------------------------

export const ECONOMY_RECOMMENDED_KINDS: EntityTypeDef[] = [
  {
    id: 'resource',
    label: '资源',
    icon: 'gem',
    color: 'green',
    description: '原材料与物产；二级物料',
    defaultFields: [
      { id: 'form', label: '形态', type: 'text' },
      { id: 'unit', label: '计量单位', type: 'text' },
      { id: 'scale', label: '规模', type: 'number' },
    ],
  },
  {
    id: 'good',
    label: '商品',
    icon: 'package',
    color: 'green',
    description: '货物与成品；二级物料',
    defaultFields: [
      { id: 'spec', label: '规格', type: 'text' },
      { id: 'unit', label: '计量单位', type: 'text' },
      { id: 'priceBand', label: '价格区间', type: 'text' },
    ],
  },
  {
    id: 'industry',
    label: '产业',
    icon: 'factory',
    color: 'green',
    description: '生产部门与营生；一级枢纽',
    defaultFields: [
      { id: 'output', label: '产出物', type: 'text' },
      { id: 'capacity', label: '产能', type: 'text' },
      { id: 'unit', label: '计量单位', type: 'text' },
    ],
  },
  {
    id: 'market',
    label: '市场',
    icon: 'store',
    color: 'cyan',
    description: '集市与交易场所；一级枢纽',
    defaultFields: [
      { id: 'marketForm', label: '市场形态', type: 'text' },
      { id: 'scale', label: '规模', type: 'number' },
      { id: 'mainGoods', label: '主要货品', type: 'text' },
    ],
  },
  {
    id: 'currency',
    label: '货币',
    icon: 'coins',
    color: 'cyan',
    description: '通货与交换媒介；横切轨',
    defaultFields: [
      { id: 'material', label: '材质', type: 'text' },
      { id: 'denomination', label: '面额', type: 'text' },
      { id: 'circulation', label: '通行范围', type: 'text' },
    ],
  },
  {
    id: 'actor',
    label: '经济主体',
    icon: 'briefcase',
    color: 'green',
    description: '商帮、商行、承运者；经营层',
    defaultFields: [
      { id: 'actorForm', label: '主体形态', type: 'text' },
      { id: 'business', label: '经营物', type: 'text' },
      { id: 'range', label: '活动范围', type: 'text' },
    ],
  },
  {
    id: 'institution',
    label: '制度',
    icon: 'scroll-text',
    color: 'cyan',
    description: '规则与行会规章；横切轨',
    defaultFields: [
      { id: 'domain', label: '规则领域', type: 'text' },
      { id: 'effectiveAt', label: '生效时间', type: 'text' },
      { id: 'enforcer', label: '执行者', type: 'text' },
    ],
  },
];

export const ECONOMY_RECOMMENDED_KIND_IDS = ECONOMY_RECOMMENDED_KINDS.map((def) => def.id);

/** kind -> 阶段默认映射（§3.4「默认阶段」列；config.stages 可覆盖） */
export const ECONOMY_KIND_STAGE: Record<string, string> = {
  resource: 'upstream',
  good: 'transform',
  industry: 'transform',
  market: 'exchange',
  currency: 'crosscut',
  actor: 'operator',
  institution: 'crosscut',
  [CYCLE_KIND]: 'crosscut',
  [ROUTE_KIND]: 'exchange',
};

/** kind -> 画布形状（§4.7.2；不依赖颜色单独区分类型） */
export const ECONOMY_KIND_SHAPE: Record<string, string> = {
  resource: 'dot',
  good: 'diamond',
  industry: 'rounded-square',
  market: 'double-square',
  currency: 'rail-end',
  actor: 'hexagon',
  institution: 'track-bar',
  [CYCLE_KIND]: 'time-band',
  [ROUTE_KIND]: 'route',
};

/** 流转阶段定义（§2.1：上游 -> 加工 -> 交换 -> 经营 + 通货·制度横切） */
export const ECONOMY_STAGES: EconomyStageDef[] = [
  { id: 'upstream', label: '上游', order: 0, defaultKinds: ['resource'] },
  { id: 'transform', label: '加工', order: 1, defaultKinds: ['industry', 'good'] },
  { id: 'exchange', label: '交换', order: 2, defaultKinds: ['market'] },
  { id: 'operator', label: '经营', order: 3, defaultKinds: ['actor'] },
  { id: 'crosscut', label: '横切', order: 4, defaultKinds: ['currency', 'institution'] },
];

/** 速写卡字段（§4.4：默认 5 槽，可改名 / 调序 / 关闭，最少 3 槽） */
export const ECONOMY_SKETCH_FIELDS: EconomySketchFieldDef[] = [
  { id: 'form', label: '经济形态', type: 'text', options: [] },
  { id: 'currency', label: '通用货币', type: 'chips', chipKind: 'currency', maxItems: 1 },
  { id: 'resources', label: '主要资源', type: 'chips', chipKind: 'resource', maxItems: ECONOMY_CHIP_SUGGESTION_MAX },
  { id: 'industries', label: '主要产业', type: 'chips', chipKind: 'industry', maxItems: ECONOMY_CHIP_SUGGESTION_MAX },
  {
    id: 'distribution',
    label: '分配特征',
    type: 'select',
    // 仅作输入建议，可自填；出厂不预置世界观内容
    options: ['少数集中', '大致平均', '两极分化'],
  },
];

/** 速写卡完成判定（§10.3：形态 + 货币 + 至少一类物产或营生） */
export const sketchFieldKind = (fieldId: string): string | undefined =>
  ECONOMY_SKETCH_FIELDS.find((field) => field.id === fieldId)?.chipKind ?? undefined;

export const isSketchComplete = (overview: EconomyOverview | null): boolean => {
  if (!overview) return false;
  return (
    !!overview.form?.trim() &&
    !!overview.currency?.label?.trim() &&
    ((overview.resources?.length ?? 0) > 0 || (overview.industries?.length ?? 0) > 0)
  );
};

// ---------------------------------------------------------------------------
// 图层（§4.6.5 表格；minComplexity 为最早出现档位）
// ---------------------------------------------------------------------------

export const ECONOMY_LAYERS = [
  { id: 'trunk', label: '主干', icon: 'network', minComplexity: 'structure' as ComplexityLevel, defaultOn: true },
  { id: 'flows', label: '流量', icon: 'route', minComplexity: 'sandbox' as ComplexityLevel, defaultOn: true },
  { id: 'balance', label: '盈余/赤字', icon: 'sigma', minComplexity: 'sandbox' as ComplexityLevel, defaultOn: true },
  { id: 'currency', label: '通货', icon: 'coins', minComplexity: 'structure' as ComplexityLevel, defaultOn: true },
  { id: 'institutions', label: '制度', icon: 'scroll-text', minComplexity: 'structure' as ComplexityLevel, defaultOn: true },
  { id: 'cycles', label: '周期', icon: 'refresh-cw', minComplexity: 'sandbox' as ComplexityLevel, defaultOn: true },
  { id: 'history', label: '历史事件', icon: 'calendar-range', minComplexity: 'sandbox' as ComplexityLevel, defaultOn: false },
  { id: 'external', label: '外部站点', icon: 'globe', minComplexity: 'structure' as ComplexityLevel, defaultOn: false },
];

export const ECONOMY_LAYER_IDS: EconomyLayerId[] = ECONOMY_LAYERS.map(
  (layer) => layer.id as EconomyLayerId
);

/** 某档位下可见的图层（minComplexity 之前不出现） */
export const layersForComplexity = (complexity: ComplexityLevel) => {
  const rank: Record<ComplexityLevel, number> = { sketch: 0, structure: 1, sandbox: 2 };
  return ECONOMY_LAYERS.filter((layer) => rank[layer.minComplexity] <= rank[complexity]);
};

/** 默认图层开关（§4.6.5「沙盘默认」列的通用化：按档位取默认值） */
export const defaultLayerState = (
  complexity: ComplexityLevel
): Partial<Record<EconomyLayerId, boolean>> => {
  const state: Partial<Record<EconomyLayerId, boolean>> = {};
  for (const layer of ECONOMY_LAYERS) state[layer.id as EconomyLayerId] = layer.defaultOn;
  if (complexity === 'structure') {
    // 结构档只画主干与横切轨；流量与盈余属于沙盘
    state.flows = false;
    state.balance = false;
    state.cycles = false;
    state.history = false;
  }
  return state;
};

// ---------------------------------------------------------------------------
// 关联类型与速写动词（契约 §4.4；本模块只读注册表，不新增 id）
// ---------------------------------------------------------------------------

export const ECONOMY_LINK_TYPES = {
  produces: 'economy.produces',
  consumes: 'economy.consumes',
  requires: 'economy.requires',
  tradedAt: 'economy.traded_at',
  flowsTo: 'economy.flows_to',
  currencyOf: 'economy.currency_of',
  ownedBy: 'economy.owned_by',
  regulatedBy: 'economy.regulated_by',
  taxedBy: 'economy.taxed_by',
  locatedIn: 'economy.located_in',
  supplies: 'economy.supplies',
  eraContext: 'economy.era_context',
} as const;

/** 本模块自有边（契约 §4.4 的 12 条），与后端 registry 顺序一致 */
export const ECONOMY_LINK_TYPE_IDS = Object.values(ECONOMY_LINK_TYPES);

/**
 * 跨模块引用清单（契约 §4.2-§4.7 中与经济相关、或经济侧需要识别为入链的类型）。
 * 只用于读取侧的分组与文案，本模块不写入这些类型。
 *
 * 注意：政治侧的「管制 / 征税 / 归属 / 货币」在经济侧是 economy.regulated_by / taxed_by /
 * owned_by / currency_of（已在上面的 ECONOMY_LINK_TYPES 里），契约 §4 没有 politics. 前缀的同名边，
 * 因此这里不列政治边；政治的四种语义靠这些 economy.* 出链的反向文案呈现（economy_ui_design §6.3）。
 */
export const ECONOMY_CROSS_MODULE_LINK_TYPES = [
  'history.involves',
  'history.causes',
  'history.caused_by',
  'history.occurs_at',
  'history.milestone_of',
  'politics.trades_with',
  'races.specialty',
  'races.prefers',
  'systems.costs',
  'systems.enables',
  'character.owns',
  'core.references',
  'core.related_to',
  'custom.link',
];

/** 注册表不可用时的兜底标签（正式标签一律取 `/link-registry`） */
export const ECONOMY_LINK_LABELS: Record<string, { label: string; reverseLabel: string; icon: string; color: string; lineStyle: string }> = {
  'economy.produces': { label: '生产', reverseLabel: '被生产', icon: 'factory', color: 'green', lineStyle: 'solid' },
  'economy.consumes': { label: '消耗', reverseLabel: '被消耗', icon: 'package-minus', color: 'green', lineStyle: 'solid' },
  'economy.requires': { label: '依赖', reverseLabel: '被依赖', icon: 'git-branch', color: 'teal', lineStyle: 'dashed' },
  'economy.traded_at': { label: '交易于', reverseLabel: '交易于此', icon: 'store', color: 'green', lineStyle: 'solid' },
  'economy.flows_to': { label: '流通至', reverseLabel: '自该地流入', icon: 'route', color: 'cyan', lineStyle: 'solid' },
  'economy.currency_of': { label: '流通货币', reverseLabel: '通行货币为', icon: 'coins', color: 'yellow', lineStyle: 'solid' },
  'economy.owned_by': { label: '归属/控制', reverseLabel: '拥有/控制', icon: 'key-round', color: 'lime', lineStyle: 'solid' },
  'economy.regulated_by': { label: '受管制', reverseLabel: '管制', icon: 'gavel', color: 'amber', lineStyle: 'dashed' },
  'economy.taxed_by': { label: '征税', reverseLabel: '征税于', icon: 'landmark', color: 'amber', lineStyle: 'dotted' },
  'economy.located_in': { label: '位于', reverseLabel: '包含', icon: 'map-pin', color: 'blue', lineStyle: 'solid' },
  'economy.supplies': { label: '供给', reverseLabel: '由该方供给', icon: 'truck', color: 'green', lineStyle: 'solid' },
  'economy.era_context': { label: '对应时代', reverseLabel: '对应经济周期', icon: 'calendar-range', color: 'cyan', lineStyle: 'dashed' },
  'core.references': { label: '引用', reverseLabel: '被引用', icon: 'link', color: 'slate', lineStyle: 'dotted' },
  'core.related_to': { label: '相关', reverseLabel: '相关', icon: 'git-branch', color: 'slate', lineStyle: 'dotted' },
  'custom.link': { label: '自定义关联', reverseLabel: '自定义关联', icon: 'link-2', color: 'slate', lineStyle: 'dashed' },
};

/**
 * 速写动词（§4.4 表格）：速写档说人话，先落 core.related_to + label，
 * 进入结构档后可一键细化为对应 economy.*（保留关联 id、方向、时间与备注）。
 */
export const ECONOMY_VERBS: EconomyVerbLink[] = [
  { verb: 'produce', label: '产 / 出', linkType: 'economy.produces', direct: false },
  { verb: 'consume', label: '用 / 耗', linkType: 'economy.consumes', direct: false },
  { verb: 'require', label: '靠', linkType: 'economy.requires', direct: false },
  { verb: 'sell', label: '卖 / 换', linkType: 'economy.traded_at', direct: false },
  { verb: 'ship', label: '走 / 运到', linkType: 'economy.flows_to', direct: false },
  { verb: 'currency', label: '通行 / 用钱', linkType: 'economy.currency_of', direct: false },
  { verb: 'own', label: '属', linkType: 'economy.owned_by', direct: false },
  { verb: 'regulate', label: '管', linkType: 'economy.regulated_by', direct: false },
  { verb: 'tax', label: '税', linkType: 'economy.taxed_by', direct: false },
  { verb: 'locate', label: '在', linkType: 'economy.located_in', direct: false },
  { verb: 'supply', label: '养 / 供', linkType: 'economy.supplies', direct: false },
];

/** 速写档落库用的通用边：先写这条，结构档再细化（契约 §5.5） */
export const ECONOMY_RAW_LINK_TYPE = 'core.related_to';

// ---------------------------------------------------------------------------
// 领域色（§4.7.1；light / dark 两套值，正文对比度不低于 WCAG AA）
// ---------------------------------------------------------------------------

export const ECONOMY_PALETTE = {
  green600: { light: '#16A34A', dark: '#4ADE80' },
  green500: { light: '#22C55E', dark: '#86EFAC' },
  cyan600: { light: '#0891B2', dark: '#22D3EE' },
  cyan400: { light: '#22D3EE', dark: '#67E8F9' },
  paper: { light: '#F7F8F5', dark: '#0F1318' },
  rule: { light: '#D8DDD6', dark: '#26303A' },
  ink: { light: '#111827', dark: '#E5E7EB' },
  muted: { light: '#6B7280', dark: '#9CA3AF' },
  deficit: { light: '#D97706', dark: '#FBBF24' },
} as const;

/** 盈余 / 赤字语义色 token（颜色永远配文字或纹理） */
export const SURPLUS_TONE: Record<string, string> = {
  surplus: 'text-green-600 dark:text-green-400',
  balanced: 'text-cyan-600 dark:text-cyan-400',
  deficit: 'text-amber-600 dark:text-amber-400',
  unknown: 'text-muted-foreground',
};

export const SURPLUS_LABELS: Record<string, string> = {
  surplus: '盈余',
  balanced: '平衡',
  deficit: '赤字',
  unknown: '未知',
};

// ---------------------------------------------------------------------------
// 术语（§4.4 术语门：速写用日常词，结构才出现类型与关联）
// ---------------------------------------------------------------------------

export const ECONOMY_TERM_DEFAULTS: Record<string, string> = {
  sketchField: '物产',
  industryWord: '营生',
  marketWord: '集市',
  currencyWord: '通货',
  flowWord: '往来',
  expandWord: '展开',
  entityWord: '实体',
  kindWord: '类型',
  linkWord: '关联',
  ledgerWord: '账册',
  canvasWord: '线路图',
  flowMeasureWord: '流量',
  metricWord: '指标',
  cycleWord: '周期',
  eraWord: '时代',
  windowWord: '窗口',
  overviewTitle: '经济速写卡',
  ledgerTitle: '经济账册',
  canvasTitle: '经济脉络图',
  sandboxTitle: '沙盘',
  statsTitle: '统计',
  layerTitle: '图层',
  timeTitle: '时间刷',
  newEntity: '添加实体',
  newLink: '添加关联',
  promoChip: '展开为脉络',
  keepSketch: '就这样，先记着',
  verbLink: '连一句往来',
  emptySketch: '先记三件事就够了',
  emptyCanvas: '添加第一个实体',
};

// ---------------------------------------------------------------------------
// 模块配置默认值与解析（首次打开懒创建；不预置任何世界观内容）
// ---------------------------------------------------------------------------

export const ECONOMY_CONFIG_DEFAULTS: ResolvedEconomyConfig = {
  defaultComplexity: 'sketch',
  displayMode: 'lanes',
  entityTypes: [],
  levels: [],
  statuses: [],
  stages: ECONOMY_STAGES,
  sketchFields: ECONOMY_SKETCH_FIELDS,
  metrics: [],
  layers: ECONOMY_LAYERS,
  defaultFlowUnit: undefined,
  fieldSchema: {},
  terminology: {},
};

export const EMPTY_ECONOMY_FILTER: EconomyFilterState = {
  stages: [],
  kinds: [],
  levels: [],
  statuses: [],
  linkCount: {},
  search: '',
};

/** 指标骨架建议（§7.6：一键添加，值同样为空，不预置世界观内容） */
export const ECONOMY_METRIC_SUGGESTIONS: EconomyMetricDef[] = [
  { id: 'custom_metric_supply', label: '供给量', unit: '', valueType: 'number', polarity: 'neutral', stageFilter: [], kindFilter: [] },
  { id: 'custom_metric_demand', label: '需求量', unit: '', valueType: 'number', polarity: 'neutral', stageFilter: [], kindFilter: [] },
  { id: 'custom_metric_price', label: '价格', unit: '', valueType: 'band', polarity: 'neutral', stageFilter: [], kindFilter: [] },
  { id: 'custom_metric_volume', label: '贸易量', unit: '', valueType: 'number', polarity: 'higher-better', stageFilter: [], kindFilter: [] },
];

/** 速写字段至少保留 3 项（§4.4 规则 1；配置校验用） */
export const validateSketchFields = (fields: EconomySketchFieldDef[]): string | null => {
  if (fields.length < ECONOMY_MIN_SKETCH_FIELDS) {
    return `速写字段至少保留 ${ECONOMY_MIN_SKETCH_FIELDS} 项`;
  }
  if (fields.length > ECONOMY_MAX_SKETCH_FIELDS) {
    return `速写字段最多 ${ECONOMY_MAX_SKETCH_FIELDS} 项`;
  }
  return null;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * 后端 config -> 前端解析配置：未知键原样保留，只补经济专属默认值。
 *
 * 注意默认值语义：``stages`` / ``sketchFields`` / ``layers`` 缺省时用出厂骨架（它们是**结构与视图**
 * 定义，不是世界观内容），而 ``entityTypes`` / ``levels`` / ``statuses`` / ``metrics`` 缺省时必须为空，
 * 不预置任何用户内容（§9.3「不自动创建任何实体或关联」）。
 */
export const resolveEconomyConfig = (raw: EconomyConfig | ModuleConfig | null | undefined): ResolvedEconomyConfig => {
  const source = asRecord(raw);
  const stages = asArray<EconomyStageDef>(source.stages);
  const sketchFields = asArray<EconomySketchFieldDef>(source.sketchFields);
  const layers = asArray<EconomyLayerConfig>(source.layers);
  const defaultComplexity = source.defaultComplexity;

  return {
    ...source,
    defaultComplexity:
      defaultComplexity === 'structure' || defaultComplexity === 'sandbox' || defaultComplexity === 'sketch'
        ? defaultComplexity
        : 'sketch',
    displayMode: typeof source.displayMode === 'string' ? source.displayMode : 'lanes',
    entityTypes: asArray<EntityTypeDef>(source.entityTypes),
    levels: asArray<LevelDef>(source.levels),
    statuses: asArray<StatusDef>(source.statuses),
    stages: stages.length >= 3 ? stages : ECONOMY_STAGES,
    sketchFields: sketchFields.length > 0 ? sketchFields : ECONOMY_SKETCH_FIELDS,
    metrics: asArray<EconomyMetricDef>(source.metrics),
    layers: layers.length > 0 ? layers : ECONOMY_LAYERS,
    defaultFlowUnit:
      typeof source.defaultFlowUnit === 'string' && source.defaultFlowUnit
        ? source.defaultFlowUnit
        : undefined,
    fieldSchema: asRecord(source.fieldSchema) as Record<string, CustomFieldDef[]>,
    terminology: asRecord(source.terminology) as Record<string, string>,
  } as ResolvedEconomyConfig;
};

/** kind -> 阶段（先查 config.stages[].defaultKinds，再回落内置映射；§7.7） */
export const stageOfKind = (kind: string | undefined, config: ResolvedEconomyConfig): string => {
  if (kind) {
    for (const stage of config.stages) {
      if ((stage.defaultKinds ?? []).includes(kind)) return stage.id;
    }
  }
  return ECONOMY_KIND_STAGE[kind ?? ''] ?? 'transform';
};

/** 阶段文案（config 可改名） */
export const stageLabel = (stageId: string, config: ResolvedEconomyConfig): string =>
  config.stages.find((stage) => stage.id === stageId)?.label ?? stageId;

export const stageOrder = (stageId: string): number =>
  ECONOMY_STAGES.findIndex((stage) => stage.id === stageId) >= 0
    ? ECONOMY_STAGES.findIndex((stage) => stage.id === stageId)
    : ECONOMY_STAGES.length;

/** 横切轨（通货 / 制度）不占一级泳道（§2.1） */
export const isCrosscut = (stageId: string): boolean => stageId === 'crosscut';

/** 布局模式（§4.2 线路图 / 网络图 / 账册 / 分栏） */
export const ECONOMY_LAYOUTS = ['lanes', 'network', 'ledger', 'split'] as const;
export const ECONOMY_LAYOUT_LABELS: Record<string, string> = {
  lanes: '线路图',
  network: '网络图',
  ledger: '账册',
  split: '分栏',
};

export const resolveEconomyLayout = (value?: string | null): 'lanes' | 'network' | 'ledger' | 'split' =>
  value === 'network' || value === 'ledger' || value === 'split' ? value : 'lanes';
