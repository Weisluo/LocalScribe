/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 5 回归用例（浏览器侧，P5-T15 / 验收）
 *
 * 由 tests/worldbuilding/phase5.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE5_TESTS__。分三类：
 * 1) 纯函数：config 契约骨架、normalize 数值口径（规模/流量/盈余/时间窗/多单位）、
 *    guards（降级阈值与 degradeStateOf、推荐关联、时间锚点与 formatAnchor、筛选）、
 *    URL 作用域判定（切世界不读回上一个模块的筛选 / 选中 / 时间窗）；
 * 2) 组件：EconomyView 三档在预置缓存下的 DOM 行为（速写卡、画布 + 账册、沙盘叠加 + 时间刷、
 *    降级矩阵、退化形态 1 实体 0 边 / 1 实体 1 边）；
 * 3) 键盘：1/2/3 切档、L 切布局、Esc 清选择 / 关表单、已 preventDefault 的方向键不重复处理。
 *
 * P6 交接：feature flag 与旧经济视图已删除，本用例不再断言「开关可开可关」；
 * 目录由 EconomyViewV2 改名为 EconomyView，导出名去掉 V2 后缀。
 * 不发任何网络请求：TanStack Query 缓存由 seedEconomy 预置，mutation 不参与断言。
 */

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  CYCLE_KIND,
  ECONOMY_CHIP_SUGGESTION_MAX,
  ECONOMY_CONFIG_DEFAULTS,
  ECONOMY_KIND_SHAPE,
  ECONOMY_KIND_STAGE,
  ECONOMY_LAYERS,
  ECONOMY_LAYOUT_LABELS,
  ECONOMY_LINK_LABELS,
  ECONOMY_LINK_TYPE_IDS,
  ECONOMY_LINK_TYPES,
  ECONOMY_MATRIX_THRESHOLD,
  ECONOMY_MAX_SKETCH_FIELDS,
  ECONOMY_METRIC_SUGGESTIONS,
  ECONOMY_MIN_SKETCH_FIELDS,
  ECONOMY_PALETTE,
  ECONOMY_RAW_LINK_TYPE,
  ECONOMY_RECOMMENDED_KINDS,
  ECONOMY_SKETCH_FIELDS,
  ECONOMY_STAGES,
  ECONOMY_TERM_DEFAULTS,
  ECONOMY_VERBS,
  EMPTY_ECONOMY_FILTER,
  ROUTE_KIND,
  SURPLUS_LABELS,
  defaultLayerState,
  isSketchComplete,
  layersForComplexity,
  resolveEconomyConfig,
  resolveEconomyLayout,
  sketchFieldKind,
  stageOfKind,
  stageLabel,
  stageOrder,
  validateSketchFields,
} from '@/components/Worldbuilding/EconomyView/config';
import {
  EDGE_WIDTH_MAX,
  EDGE_WIDTH_MID,
  EDGE_WIDTH_MIN,
  FLOW_LABEL_MISSING,
  buildVisualModel,
  formatFlowLabel,
  nodeSizeScore,
  scaleWeight,
  sizeBucket,
} from '@/components/Worldbuilding/EconomyView/graph/normalize';
import {
  anchorOf,
  degradeStateOf,
  formatAnchor,
  inWindow,
  parseSearchTokens,
  recommendationsOf,
  renderModeOf,
  shouldDegradeMatrix,
} from '@/components/Worldbuilding/EconomyView/graph/guards';
import {
  ECONOMY_SCOPED_URL_KEYS,
  ECONOMY_URL_KEYS,
  economyUrlScopeMatches,
} from '@/components/Worldbuilding/EconomyView/hooks/useEconomyViewState';
import { buildLaneLayout } from '@/components/Worldbuilding/EconomyView/graph/layout';
import {
  EconomyView,
  economyKeys,
} from '@/components/Worldbuilding/EconomyView';
import { worldbuildingKeys } from '@/components/Worldbuilding/hooks/worldQueryKeys';
import type {
  EconomyEdge,
  EconomyGraph,
  EconomyMetrics,
  EconomyNode,
  EconomySummary,
  EconomyTimeline,
} from '@/components/Worldbuilding/EconomyView/types';
import type { LevelDef } from '@/components/Worldbuilding/shared/moduleConfig';
import type { ComplexityLevel } from '@/services/worldbuildingApi';
import { ComplexityProvider } from '@/components/common/ComplexitySwitcher';

interface Check {
  name: string;
  ok: boolean;
  detail?: unknown;
}

const checks: Check[] = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok: !!ok, detail });
};
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });

// ---------- 渲染工具 ----------

interface Mounted {
  container: HTMLElement;
  text: () => string;
  query: (selector: string) => Element | null;
  queryAll: (selector: string) => Element[];
  unmount: () => void;
}

const mount = (node: ReactNode): Mounted => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(node));
  return {
    container,
    text: () => container.textContent ?? '',
    query: (selector) => container.querySelector(selector),
    queryAll: (selector) => [...container.querySelectorAll(selector)],
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
};

const settle = async (rounds = 8) => {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const seededClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      mutations: { retry: false },
    },
  });

const clickTestId = (view: Mounted, testId: string): boolean => {
  const element = view.query(`[data-testid="${testId}"]`);
  if (!element) return false;
  const clickable =
    element.tagName === 'BUTTON' || element.getAttribute('role') === 'button'
      ? element
      : element.querySelector('button, [role="button"]') ?? element;
  // 画布节点是 SVG <g>：SVGElement 没有 HTMLElement.click()，统一用冒泡的 MouseEvent 派发
  flushSync(() => {
    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  return true;
};

const clickIncludes = (view: Mounted, text: string): boolean => {
  const button = [...view.queryAll('button')].find((candidate) =>
    (candidate.textContent ?? '').includes(text)
  );
  if (button) flushSync(() => (button as HTMLButtonElement).click());
  return !!button;
};

// ---------- 1. 配置契约骨架（不预置世界观内容） ----------

const testConfigContract = () => {
  eq(
    '推荐 kind 顺序与 §3.4 一致',
    ECONOMY_RECOMMENDED_KINDS.map((def) => def.id),
    ['resource', 'good', 'industry', 'market', 'currency', 'actor', 'institution']
  );
  eq(
    '推荐 kind 图标全为 Lucide 名',
    ECONOMY_RECOMMENDED_KINDS.map((def) => def.icon),
    ['gem', 'package', 'factory', 'store', 'coins', 'briefcase', 'scroll-text']
  );
  check(
    '推荐 kind 都带默认字段建议与领域色',
    ECONOMY_RECOMMENDED_KINDS.every(
      (def) => (def.defaultFields?.length ?? 0) > 0 && !!def.color
    )
  );

  eq(
    'kind -> 阶段默认映射',
    ['resource', 'industry', 'market', 'currency', 'actor', 'institution'].map(
      (kind) => ECONOMY_KIND_STAGE[kind]
    ),
    ['upstream', 'transform', 'exchange', 'crosscut', 'operator', 'crosscut']
  );
  eq(
    '流转阶段顺序（上游 / 加工 / 交换 / 经营 / 横切）',
    ECONOMY_STAGES.map((stage) => stage.id),
    ['upstream', 'transform', 'exchange', 'operator', 'crosscut']
  );
  eq('阶段 order 递增', ECONOMY_STAGES.map((stage) => stage.order), [0, 1, 2, 3, 4]);
  eq('阶段文案', ECONOMY_STAGES.map((stage) => stage.label), ['上游', '加工', '交换', '经营', '横切']);

  eq(
    '速写字段默认五槽',
    ECONOMY_SKETCH_FIELDS.map((field) => field.id),
    ['form', 'currency', 'resources', 'industries', 'distribution']
  );
  eq(
    'chips 槽位绑定 chipKind',
    ECONOMY_SKETCH_FIELDS.filter((field) => field.type === 'chips').map((field) => field.chipKind),
    ['currency', 'resource', 'industry']
  );
  eq('速写完成 = 形态 + 货币 + 物产或营生', [
    isSketchComplete(null),
    isSketchComplete({ form: '集市贸易', resources: [], industries: [] }),
    isSketchComplete({ form: '集市贸易', currency: { id: 'c1', label: '通货甲', kind: 'currency' }, resources: [] }),
    isSketchComplete({
      form: '集市贸易',
      currency: { id: 'c1', label: '通货甲', kind: 'currency' },
      resources: [{ id: 'r1', label: '物产甲', kind: 'resource' }],
      industries: [],
    }),
  ], [false, false, false, true]);
  eq('速写字段数量下限', validateSketchFields(ECONOMY_SKETCH_FIELDS.slice(0, 2)), `速写字段至少保留 ${ECONOMY_MIN_SKETCH_FIELDS} 项`);
  eq('速写字段五槽通过', validateSketchFields(ECONOMY_SKETCH_FIELDS), null);
  eq(
    '速写字段六槽被拒',
    validateSketchFields([
      ...ECONOMY_SKETCH_FIELDS,
      { id: 'extra', label: '额外', type: 'text' },
    ]),
    `速写字段最多 ${ECONOMY_MAX_SKETCH_FIELDS} 项`
  );
  eq('字段 -> chip kind', ['resources', 'industries', 'currency'].map(sketchFieldKind), [
    'resource',
    'industry',
    'currency',
  ]);

  eq(
    '八图层顺序与 §4.6.5 一致',
    ECONOMY_LAYERS.map((layer) => layer.id),
    ['trunk', 'flows', 'balance', 'currency', 'institutions', 'cycles', 'history', 'external']
  );
  eq(
    '图层最早出现档位',
    ECONOMY_LAYERS.map((layer) => layer.minComplexity),
    [
      'structure',
      'sandbox',
      'sandbox',
      'structure',
      'structure',
      'sandbox',
      'sandbox',
      'structure',
    ]
  );
  eq('历史事件与外部站点默认关闭', [
    ECONOMY_LAYERS.find((layer) => layer.id === 'history')?.defaultOn,
    ECONOMY_LAYERS.find((layer) => layer.id === 'external')?.defaultOn,
  ], [false, false]);
  eq('速写档不出现任何图层', layersForComplexity('sketch').length, 0);
  eq('结构档只出现四层', layersForComplexity('structure').map((layer) => layer.id), [
    'trunk',
    'currency',
    'institutions',
    'external',
  ]);
  eq('沙盘档八层齐全', layersForComplexity('sandbox').length, 8);
  eq('结构档默认关掉流量/盈余/周期/历史', [
    defaultLayerState('structure').flows,
    defaultLayerState('structure').balance,
    defaultLayerState('structure').cycles,
    defaultLayerState('structure').history,
    defaultLayerState('structure').trunk,
  ], [false, false, false, false, true]);

  eq(
    '经济自有边恰为契约 §4.4 的 12 条',
    Object.values(ECONOMY_LINK_TYPES).sort(),
    [
      'economy.produces',
      'economy.consumes',
      'economy.requires',
      'economy.traded_at',
      'economy.flows_to',
      'economy.currency_of',
      'economy.owned_by',
      'economy.regulated_by',
      'economy.taxed_by',
      'economy.located_in',
      'economy.supplies',
      'economy.era_context',
    ].sort()
  );
  eq('兜底标签覆盖 12 条自有边', Object.keys(ECONOMY_LINK_LABELS).filter((id) => id.startsWith('economy.')).length, 12);
  eq(
    '速写动词映射到标准关联',
    ECONOMY_VERBS.map((verb) => verb.linkType).filter((id) => Object.values(ECONOMY_LINK_TYPES).includes(id as never)).length,
    ECONOMY_VERBS.length
  );
  eq('速写边先落通用关联', ECONOMY_RAW_LINK_TYPE, 'core.related_to');
  eq('周期与路线为预登记 kind', [CYCLE_KIND, ROUTE_KIND], ['custom_cycle', 'custom_route']);
  eq('kind 形状表覆盖推荐骨架', ['resource', 'good', 'industry', 'market', 'currency', 'actor', 'institution'].every((kind) => !!ECONOMY_KIND_SHAPE[kind]), true);
  eq('降级阈值为 800', ECONOMY_MATRIX_THRESHOLD, 800);
  eq('chips 单槽建议上限为 6', ECONOMY_CHIP_SUGGESTION_MAX, 6);

  check(
    '领域色 light/dark 两套值',
    Object.values(ECONOMY_PALETTE).every(
      (tone) => /^#[0-9a-f]{6}$/i.test(tone.light) && /^#[0-9a-f]{6}$/i.test(tone.dark)
    )
  );
  eq('盈余语义四种齐全', Object.keys(SURPLUS_LABELS).sort(), ['balanced', 'deficit', 'surplus', 'unknown']);

  eq('默认复杂度为速写、默认布局为线路图', [
    ECONOMY_CONFIG_DEFAULTS.defaultComplexity,
    ECONOMY_CONFIG_DEFAULTS.displayMode,
  ], ['sketch', 'lanes']);
  eq('默认不预置任何用户内容', [
    ECONOMY_CONFIG_DEFAULTS.entityTypes.length,
    ECONOMY_CONFIG_DEFAULTS.levels.length,
    ECONOMY_CONFIG_DEFAULTS.statuses.length,
    ECONOMY_CONFIG_DEFAULTS.metrics.length,
  ], [0, 0, 0, 0]);
  eq('默认带结构骨架（阶段/速写字段/图层）', [
    ECONOMY_CONFIG_DEFAULTS.stages.length,
    ECONOMY_CONFIG_DEFAULTS.sketchFields.length,
    ECONOMY_CONFIG_DEFAULTS.layers.length,
  ], [5, 5, 8]);
  eq('指标骨架建议四项且为空值', ECONOMY_METRIC_SUGGESTIONS.map((def) => def.id), [
    'custom_metric_supply',
    'custom_metric_demand',
    'custom_metric_price',
    'custom_metric_volume',
  ]);
  check(
    '术语默认值不含示例数据名',
    Object.values(ECONOMY_TERM_DEFAULTS).every((value) => !/甲|乙|示例|example/.test(value))
  );
  check(
    '配置不含预置内容字段',
    !['presets', 'seeded', 'sampleData', 'defaultEntities', 'starterLevels'].some((token) =>
      JSON.stringify(ECONOMY_CONFIG_DEFAULTS).includes(token)
    )
  );
  eq('空筛选清一色为空', EMPTY_ECONOMY_FILTER, {
    stages: [],
    kinds: [],
    levels: [],
    statuses: [],
    linkCount: {},
    search: '',
  });
};

// ---------- 2. 配置解析 ----------

const testConfigResolution = () => {
  const resolved = resolveEconomyConfig({});
  eq('空配置补齐骨架', [
    resolved.defaultComplexity,
    resolved.displayMode,
    resolved.stages.length,
    resolved.sketchFields.length,
    resolved.layers.length,
  ], ['sketch', 'lanes', 5, 5, 8]);
  eq('空配置不预置用户内容', [
    resolved.entityTypes.length,
    resolved.levels.length,
    resolved.statuses.length,
    resolved.metrics.length,
  ], [0, 0, 0, 0]);

  const withUnknown = resolveEconomyConfig({
    defaultComplexity: 'structure',
    displayMode: 'ledger',
    entityTypes: [{ id: 'custom_port', label: '港口', parentKind: 'market' }],
    levels: [{ id: 'l1', label: '地方', rank: 1 }],
    customKey: { keepMe: true },
  } as never);
  eq('未知键保留', (withUnknown as Record<string, unknown>).customKey, { keepMe: true });
  eq('用户 kind 保留', withUnknown.entityTypes.map((def) => def.id), ['custom_port']);
  eq('用户等级保留', withUnknown.levels.map((def) => def.id), ['l1']);
  eq('合法档位保留', withUnknown.defaultComplexity, 'structure');
  eq('非法档位回落速写', resolveEconomyConfig({ defaultComplexity: 'nope' } as never).defaultComplexity, 'sketch');

  eq('stageOfKind 内置映射', ['resource', 'market', 'nope'].map((kind) => stageOfKind(kind, resolved)), [
    'upstream',
    'exchange',
    'transform',
  ]);
  eq(
    'stageOfKind 尊重配置覆盖',
    stageOfKind('custom_port', resolveEconomyConfig({
      stages: [
        { id: 'upstream', label: '上游', order: 0, defaultKinds: [] },
        { id: 'transform', label: '加工', order: 1, defaultKinds: [] },
        { id: 'exchange', label: '交换', order: 2, defaultKinds: ['custom_port'] },
      ],
    } as never)),
    'exchange'
  );
  eq('阶段文案与顺序', [stageLabel('transform', resolved), stageOrder('upstream'), stageOrder('crosscut')], [
    '加工',
    0,
    4,
  ]);
  eq('布局文案四档', Object.values(ECONOMY_LAYOUT_LABELS).sort(), ['分栏', '账册', '线路图', '网络图'].sort());
  eq('非法布局回落线路图', [resolveEconomyLayout('ledger'), resolveEconomyLayout('nope'), resolveEconomyLayout(undefined)], [
    'ledger',
    'lanes',
    'lanes',
  ]);
};

// ---------- 3. （P6 已删除 feature flag：旧经济视图与开关分支都不复存在） ----------

// ---------- 4. normalize / guards / layout 纯函数（P5-T12/T13/T14 口径） ----------

const LEVELS: LevelDef[] = [
  { id: 'low', label: '地方', rank: 1 },
  { id: 'high', label: '跨域', rank: 2 },
];

const node = (over: Partial<EconomyNode> & { id: string; kind: string }): EconomyNode => ({
  stage: ECONOMY_STAGES.find((stage) => (stage.defaultKinds ?? []).includes(over.kind))?.id ?? 'transform',
  description: null,
  icon: null,
  color: null,
  orderIndex: 0,
  level: null,
  status: null,
  unit: null,
  scale: null,
  time: null,
  timeOrder: null,
  cyclePhaseId: null,
  stub: false,
  tags: [],
  customFields: {},
  counts: { outgoing: 0, incoming: 0, total: 0 },
  hasMetrics: false,
  metricIds: [],
  external: false,
  legacy: false,
  name: over.id,
  ...over,
  ref: over.ref ?? { module: 'economy', kind: over.kind, id: over.id },
});

const edge = (
  id: string,
  source: string,
  target: string,
  over: Partial<EconomyEdge> = {}
): EconomyEdge => ({
  id,
  linkType: 'economy.consumes',
  label: null,
  reverseLabel: null,
  directed: true,
  note: null,
  source: { module: 'economy', kind: 'industry', id: source },
  target: { module: 'economy', kind: 'resource', id: target },
  time: null,
  meta: {},
  flow: null,
  unit: null,
  flowSeries: [],
  intensity: null,
  surplus: null,
  surplusDerived: false,
  priceBand: null,
  confidence: null,
  routeNote: null,
  external: false,
  ...over,
});

const visualInput = (
  nodes: EconomyNode[],
  edges: EconomyEdge[],
  extra: Record<string, unknown> = {}
) => ({
  nodes,
  edges,
  levels: LEVELS,
  complexity: 'sandbox' as const,
  config: resolveEconomyConfig(null),
  ...extra,
});

const testNormalize = () => {
  eq(
    'formatFlowLabel：缺省「—」与 0 可区分',
    [
      formatFlowLabel(undefined, '袋'),
      formatFlowLabel(null, '袋'),
      formatFlowLabel(0, '袋'),
      formatFlowLabel(120, '袋/季'),
      formatFlowLabel(120, null),
    ],
    [FLOW_LABEL_MISSING, FLOW_LABEL_MISSING, '0', '120 袋/季', '120']
  );
  eq(
    'scaleWeight：scale=0 是有效值，缺省才是未知',
    [scaleWeight(0, 100), scaleWeight(50, 100), scaleWeight(undefined, 100), scaleWeight(null, 100)],
    [0, 0.5, undefined, undefined]
  );
  eq(
    'sizeBucket 三档阈值',
    [sizeBucket(undefined), sizeBucket(0), sizeBucket(1 / 3), sizeBucket(0.5), sizeBucket(2 / 3), sizeBucket(1)],
    ['sm', 'sm', 'md', 'md', 'lg', 'lg']
  );
  eq(
    'nodeSizeScore：两项各半',
    nodeSizeScore(node({ id: 'n1', kind: 'industry', level: 'high', scale: 100 }), LEVELS, 100),
    1
  );
  eq(
    'nodeSizeScore：只填一项按单项',
    [
      nodeSizeScore(node({ id: 'n2', kind: 'industry', scale: 50 }), LEVELS, 100),
      nodeSizeScore(node({ id: 'n3', kind: 'industry', level: 'high' }), LEVELS, 100),
    ],
    [0.5, 1]
  );
  eq(
    'nodeSizeScore：两项都缺省 = 未知（不按 0 处理）',
    nodeSizeScore(node({ id: 'n4', kind: 'industry' }), LEVELS, 100),
    undefined
  );

  const noEdges = buildVisualModel(
    visualInput([node({ id: 'a', kind: 'resource' })], [])
  );
  eq('无边时流量口径为 none', [noEdges.scale, noEdges.flowless], ['none', true]);
  eq('无边时统计不假装有流量', noEdges.stats.flowRecorded, false);

  const intensity = buildVisualModel(
    visualInput(
      [node({ id: 'a', kind: 'industry' }), node({ id: 'b', kind: 'resource' })],
      [edge('e1', 'a', 'b', { intensity: 3 })]
    )
  );
  eq(
    '无任何流量值 -> intensity 模式：按强度取线宽、标注「—」',
    [intensity.scale, intensity.flowless, intensity.edgeWidth.e1, intensity.edgeLabel.e1],
    ['intensity', true, 3, FLOW_LABEL_MISSING]
  );

  const absolute = buildVisualModel(
    visualInput(
      [node({ id: 'a', kind: 'industry' }), node({ id: 'b', kind: 'resource' })],
      [edge('e1', 'a', 'b', { flow: 120, unit: '袋/季' })]
    )
  );
  eq(
    '恰好一条边有流量 -> 绝对模式：固定中等线宽 + 直接标数值（不做 100% 归一）',
    [absolute.scale, absolute.edgeWidth.e1, absolute.edgeLabel.e1],
    ['absolute', EDGE_WIDTH_MID, '120 袋/季']
  );

  const zero = buildVisualModel(
    visualInput(
      [node({ id: 'a', kind: 'industry' }), node({ id: 'b', kind: 'resource' })],
      [edge('e1', 'a', 'b', { flow: 0 })]
    )
  );
  eq(
    'flow = 0 是有效值：细实线 + 标 0（不是缺省的「—」）',
    [zero.scale, zero.edgeLabel.e1, zero.flowless, zero.stats.flowRecorded],
    ['absolute', '0', false, true]
  );

  const relative = buildVisualModel(
    visualInput(
      [
        node({ id: 'a', kind: 'industry' }),
        node({ id: 'b', kind: 'resource' }),
        node({ id: 'c', kind: 'resource' }),
      ],
      [edge('e1', 'a', 'b', { flow: 100, unit: '袋' }), edge('e2', 'a', 'c', { flow: 400, unit: '袋' })]
    )
  );
  eq('两条以上有值 -> 相对模式', relative.scale, 'relative');
  check(
    '相对线宽按 sqrt 压缩极端值（最小/最大夹取）',
    Math.abs(relative.edgeWidth.e2 - EDGE_WIDTH_MAX) < 1e-6 &&
      Math.abs(relative.edgeWidth.e1 - 3.5) < 1e-6 &&
      relative.edgeWidth.e1 >= EDGE_WIDTH_MIN,
    relative.edgeWidth
  );

  const multi = buildVisualModel(
    visualInput(
      [node({ id: 'a', kind: 'industry' }), node({ id: 'b', kind: 'resource' }), node({ id: 'c', kind: 'resource' })],
      [edge('e1', 'a', 'b', { flow: 1, unit: '袋' }), edge('e2', 'a', 'c', { flow: 2, unit: '枚' })]
    )
  );
  eq('多单位只提示不换算', [multi.units.slice().sort(), multi.multiUnit], [['枚', '袋'], true]);

  const surplus = buildVisualModel(
    visualInput(
      [node({ id: 'a', kind: 'industry', customFields: { surplus: 'deficit' } })],
      [edge('e1', 'a', 'a', { surplus: 'surplus' })]
    )
  );
  eq(
    '盈余优先读 meta.surplus（节点与边）',
    [surplus.nodeSurplus.a, surplus.edgeSurplus.e1],
    ['deficit', 'surplus']
  );

  const windowed = buildVisualModel(
    visualInput(
      [
        node({ id: 'inwin', kind: 'industry', time: { start: '312', end: '312' } }),
        node({ id: 'outwin', kind: 'industry', time: { start: '100', end: '110' } }),
        node({ id: 'noanchor', kind: 'industry' }),
      ],
      [],
      { window: { start: '310', end: '315' } }
    )
  );
  eq(
    '窗口外节点淡出而不删除，无锚点保持可见',
    [windowed.inWindow.has('inwin'), windowed.inWindow.has('outwin')],
    [true, false]
  );
  check('无锚点进 unanchored 清单（无法比较不等于不在窗口内）', windowed.unanchored.has('noanchor'), [...windowed.unanchored]);
};

const testGuards = () => {
  eq(
    'anchorOf：timeOrder 优先、自由文本取前缀数字、缺锚点不猜',
    [anchorOf('312 年'), anchorOf('312', 99), anchorOf('约三百年前'), anchorOf(undefined), anchorOf('')],
    [312, 99, undefined, undefined, undefined]
  );
  eq(
    'inWindow：无锚点恒可见、只填一端视为开区间',
    [
      inWindow(undefined, undefined, { start: '310', end: '315' }),
      inWindow(300, undefined, { start: '310', end: '315' }),
      inWindow(300, 305, { start: '310', end: '315' }),
      inWindow(311, 312, { start: '310', end: '315' }),
    ],
    [true, true, false, true]
  );
  eq(
    '降级阈值严格大于且可被 graph.nodeLimit 覆盖',
    [shouldDegradeMatrix(800), shouldDegradeMatrix(801), shouldDegradeMatrix(500, 500), shouldDegradeMatrix(501, 500)],
    [false, true, false, true]
  );
  // 真正的生产判定（外壳与矩阵共用）：降级载荷里 nodes 为空，只有后端 degraded 说了算
  eq(
    'degradeStateOf：800 不降级 / 801 降级 / 后端已声明降级时前端节点数为 0 也降级',
    [
      degradeStateOf({ nodeCount: 800 }).degraded,
      degradeStateOf({ nodeCount: 801 }).degraded,
      degradeStateOf({ nodeCount: 0, serverDegraded: true }).degraded,
      degradeStateOf({ nodeCount: 0, serverDegraded: false }).degraded,
      degradeStateOf({ nodeCount: 10, nodeLimit: 500 }).degraded,
      degradeStateOf({ nodeCount: 501, nodeLimit: 500 }).degraded,
    ],
    [false, true, true, false, false, true]
  );
  eq(
    'degradeStateOf：原因优先用后端 degradeReason，节点数取 counts.nodes，未降级无原因',
    [
      degradeStateOf({
        nodeCount: 0,
        serverDegraded: true,
        serverReason: '  后端原因  ',
        serverNodeCount: 917,
      }).reason,
      degradeStateOf({ nodeCount: 0, serverDegraded: true, serverNodeCount: 917 }).reason?.includes(
        '917'
      ),
      degradeStateOf({ nodeCount: 3 }).reason,
      degradeStateOf({ nodeCount: 3 }).nodeLimit,
    ],
    ['后端原因', true, null, 800]
  );
  // 时间窗微调（F6）：解析用 anchorOf、生成用 formatAnchor，小数不能塌成整数 / 零宽
  eq(
    'formatAnchor：时间窗微调保留小数（310.2 -> 311.2）且不丢自由文本锚点',
    [
      formatAnchor(310.2 + 1),
      formatAnchor(310.8 + 1),
      formatAnchor(0.1 + 0.2),
      formatAnchor(310),
      anchorOf(formatAnchor(310.2)),
    ],
    ['311.2', '311.8', '0.3', '310', 310.2]
  );
  eq(
    '渲染档：300 内 SVG / 阈值内简化 / 超阈值矩阵',
    [renderModeOf(300), renderModeOf(301), renderModeOf(900), renderModeOf(600, 500)],
    ['svg', 'simplified', 'matrix', 'matrix']
  );
  const tokens = parseSearchTokens('kind:market 集市');
  eq('搜索 token：kind: 形式 + 关键词', [tokens.kinds, tokens.terms], [['market'], ['集市']]);
  eq('空搜索不产生 token', [parseSearchTokens('').kinds.length, parseSearchTokens(undefined).terms.length], [0, 0]);

  const recs = recommendationsOf(
    [
      node({ id: 'r1', kind: 'resource' }),
      node({ id: 'i1', kind: 'industry' }),
      node({ id: 'm1', kind: 'market' }),
    ],
    [],
    resolveEconomyConfig(null)
  );
  check('推荐关联只给契约内类型且有条数上限', recs.length > 0 && recs.length <= 20 && recs.every((rec) => ECONOMY_LINK_TYPE_IDS.includes(rec.linkType)), recs.length);
};

/** URL 作用域（F7）：切世界 / 切模块后不能读回上一个模块的筛选、选中、时间窗 */
const testViewStateScope = () => {
  const scopeKey = ECONOMY_URL_KEYS.scope;
  const scoped = ECONOMY_SCOPED_URL_KEYS as readonly string[];
  check(
    '作用域组覆盖分组 / 选中 / 筛选 / 时间窗',
    scopeKey === 'economyScope' &&
      scoped.includes(ECONOMY_URL_KEYS.group) &&
      scoped.includes(ECONOMY_URL_KEYS.selected) &&
      scoped.includes(ECONOMY_URL_KEYS.stages) &&
      scoped.includes(ECONOMY_URL_KEYS.kinds) &&
      scoped.includes(ECONOMY_URL_KEYS.levels) &&
      scoped.includes(ECONOMY_URL_KEYS.statuses) &&
      scoped.includes(ECONOMY_URL_KEYS.search) &&
      scoped.includes(ECONOMY_URL_KEYS.windowStart) &&
      scoped.includes(ECONOMY_URL_KEYS.windowEnd),
    [...ECONOMY_SCOPED_URL_KEYS]
  );
  check(
    '档位 / 布局是跨世界沿用的偏好，不进作用域组',
    !scoped.includes(ECONOMY_URL_KEYS.complexity) && !scoped.includes(ECONOMY_URL_KEYS.layout)
  );
  eq(
    '作用域匹配才认这组参数：无作用域键 / 别的模块都不认',
    [
      economyUrlScopeMatches(`?${scopeKey}=m-econ`, 'm-econ'),
      economyUrlScopeMatches(`?${scopeKey}=m-other`, 'm-econ'),
      economyUrlScopeMatches(`?${ECONOMY_URL_KEYS.stages}=market`, 'm-econ'),
      economyUrlScopeMatches(`?${scopeKey}=m-econ`, undefined),
      economyUrlScopeMatches('', 'm-econ'),
    ],
    [true, false, false, false, false]
  );
};

const testLayout = () => {
  const nodes = [
    node({ id: 'm1', kind: 'market', stage: 'exchange' }),
    node({ id: 'i1', kind: 'industry', stage: 'transform' }),
    node({ id: 'r1', kind: 'resource', stage: 'upstream' }),
    node({ id: 'c1', kind: 'currency', stage: 'crosscut' }),
  ];
  const layout = buildLaneLayout(nodes, { config: resolveEconomyConfig(null) });
  eq('阶段泳道顺序：横切轨恒置底', layout.lanes.map((lane) => lane.id), [
    'upstream',
    'transform',
    'exchange',
    'crosscut',
  ]);
  check(
    '同一份数据两次布局结果恒等（确定性）',
    JSON.stringify(buildLaneLayout(nodes, { config: resolveEconomyConfig(null) })) === JSON.stringify(layout)
  );
  check(
    '每个节点都有画布坐标',
    nodes.every((item) => {
      const position = layout.positions[item.id];
      return !!position && typeof position.x === 'number' && typeof position.y === 'number';
    })
  );
  eq('空数据不画空洞泳道', buildLaneLayout([], {}).lanes.length, 0);
  const single = buildLaneLayout([node({ id: 'only', kind: 'industry' })], {});
  eq('1 个实体也能成立', single.nodes.length, 1);

  const kindLayout = buildLaneLayout(nodes, {
    groupBy: 'kind',
    kinds: ECONOMY_RECOMMENDED_KINDS,
    config: resolveEconomyConfig(null),
  });
  eq('类型泳道按推荐 kind 顺序排列', kindLayout.lanes.map((lane) => lane.id), [
    'resource',
    'industry',
    'market',
    'currency',
  ]);
};

// ---------- 5. 组件：三档 / 退化形态 / 降级 / 交互 ----------

const WORLD_ID = 'w1';
const MODULE_ID = 'm-econ';

const summaryFixture = (over: Partial<EconomySummary> = {}): EconomySummary => ({
  moduleId: MODULE_ID,
  worldId: WORLD_ID,
  moduleName: '经济',
  complexity: 'structure',
  config: resolveEconomyConfig(null) as never,
  totals: {
    entities: 3,
    links: 1,
    totalFlow: 120,
    flowUnits: ['袋/季'],
    multiUnit: false,
    surplus: { surplus: 1, balanced: 0, deficit: 1, unknown: 1 },
    metricCoverage: { entitiesWithMetrics: 1, totalEntities: 3, coverage: 1 / 3 },
  },
  stages: [
    { id: 'upstream', label: '上游', count: 1, icon: null, color: null, stage: 'upstream' },
    { id: 'transform', label: '加工', count: 1, icon: null, color: null, stage: 'transform' },
    { id: 'exchange', label: '交换', count: 1, icon: null, color: null, stage: 'exchange' },
  ],
  kinds: [
    { id: 'resource', label: '资源', count: 1, icon: 'gem', color: 'green', stage: 'upstream' },
    { id: 'industry', label: '产业', count: 1, icon: 'factory', color: 'green', stage: 'transform' },
    { id: 'market', label: '市场', count: 1, icon: 'store', color: 'cyan', stage: 'exchange' },
  ],
  levels: [],
  statuses: [],
  fold: { links: 1, metrics: 2, fields: 0 },
  overview: null,
  cycles: [],
  metrics: [],
  timeRange: { start: '310', end: '315', anchored: true },
  unanchored: [],
  userItems: 0,
  ...over,
});

const FIXTURE_NODES: EconomyNode[] = [
  node({
    id: 'r1',
    name: '物产甲',
    kind: 'resource',
    stage: 'upstream',
    scale: 2,
    time: { start: '310', end: '315' },
  }),
  node({
    id: 'i1',
    name: '营生甲',
    kind: 'industry',
    stage: 'transform',
    level: 'high',
    scale: 3,
    customFields: { surplus: 'surplus' },
    time: { start: '310', end: '315' },
    hasMetrics: true,
    metricIds: ['custom_metric_volume'],
  }),
  node({
    id: 'm1',
    name: '集市甲',
    kind: 'market',
    stage: 'exchange',
    time: { start: '310', end: '315' },
    counts: { outgoing: 0, incoming: 1, total: 1 },
  }),
];

const FIXTURE_EDGES: EconomyEdge[] = [
  edge('e1', 'i1', 'r1', {
    linkType: 'economy.consumes',
    flow: 120,
    unit: '袋/季',
    time: { start: '310', end: '312' },
  }),
];

const graphFixture = (over: Partial<EconomyGraph> = {}): EconomyGraph => ({
  moduleId: MODULE_ID,
  worldId: WORLD_ID,
  complexity: 'structure',
  nodes: FIXTURE_NODES,
  edges: FIXTURE_EDGES,
  counts: {
    nodes: FIXTURE_NODES.length,
    edges: FIXTURE_EDGES.length,
    byKind: { resource: 1, industry: 1, market: 1 },
    byStage: { upstream: 1, transform: 1, exchange: 1 },
    byLinkType: { 'economy.consumes': 1 },
    externalNodes: 0,
    stubNodes: 0,
    folded: { links: 1, metrics: 2, fields: 0 },
  },
  degraded: false,
  degradeReason: null,
  nodeLimit: 800,
  skippedEdges: 0,
  appliedKinds: [],
  appliedStages: [],
  appliedWindow: null,
  ...over,
});

const timelineFixture = (): EconomyTimeline => ({
  moduleId: MODULE_ID,
  worldId: WORLD_ID,
  cycles: [
    {
      cycleId: 'cy1',
      label: '周期甲',
      start: '310',
      end: '315',
      phases: [{ id: 'p1', label: '繁荣', start: '310', end: '312' }],
    },
  ],
  markers: [
    { ref: { module: 'history', kind: 'era', id: 'era1' }, label: '时代甲', at: null, order: null, start: '310', end: '313', source: 'era' },
  ],
  range: { start: '310', end: '315', anchored: true },
  unanchored: [],
  units: ['袋/季'],
  multiUnit: false,
});

const metricsFixture = (): EconomyMetrics => ({
  moduleId: MODULE_ID,
  worldId: WORLD_ID,
  metrics: [
    { id: 'custom_metric_volume', label: '贸易量', unit: '袋/季', valueType: 'number', polarity: 'higher-better', stageFilter: [], kindFilter: [] },
  ],
  series: [
    {
      metricId: 'custom_metric_volume',
      entity: { module: 'economy', kind: 'industry', id: 'i1' },
      samples: [
        { t: '310', value: 100, note: null, sourceRef: null, timeOrder: null },
        { t: '312', value: 120, note: null, sourceRef: null, timeOrder: null },
      ],
    },
  ],
  window: { start: '310', end: '315', anchored: true },
  emptyEntities: [],
});

const worldFixture = () =>
  ({
    id: WORLD_ID,
    name: '测试世界',
    description: null,
    cover_image: null,
    project_id: 'p1',
    tone: null,
    settings: { complexity: 'structure' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    module_count: 7,
    link_count: 1,
    modules: [
      {
        id: MODULE_ID,
        world_id: WORLD_ID,
        module_type: 'economy',
        name: '经济',
        description: null,
        icon: 'coins',
        order_index: 3,
        config: resolveEconomyConfig(null),
        is_collapsible: true,
        is_required: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        submodule_count: FIXTURE_NODES.length,
        item_count: 0,
        submodules: [],
        items: [],
      },
    ],
  }) as never;

const seedEconomy = (
  client: QueryClient,
  options: {
    complexity: 'sketch' | 'structure' | 'sandbox';
    summary?: EconomySummary;
    graph?: EconomyGraph | null;
    timeline?: EconomyTimeline | null;
    metrics?: EconomyMetrics | null;
  }
) => {
  client.setQueryData(worldbuildingKeys.world(WORLD_ID), worldFixture());
  client.setQueryData(worldbuildingKeys.linkRegistry(), []);
  client.setQueryData(economyKeys.summary(MODULE_ID), options.summary ?? summaryFixture());
  client.setQueryData(economyKeys.graph(MODULE_ID), options.graph === undefined ? graphFixture() : options.graph);
  client.setQueryData(
    economyKeys.timeline(MODULE_ID),
    options.timeline === undefined ? timelineFixture() : options.timeline
  );
  client.setQueryData(
    economyKeys.metrics(MODULE_ID),
    options.metrics === undefined ? metricsFixture() : options.metrics
  );
};

const mountView = (client: QueryClient, level: 'sketch' | 'structure' | 'sandbox'): Mounted =>
  mount(
    <QueryClientProvider client={client}>
      <ComplexityProvider value={level}>
        <EconomyView worldId={WORLD_ID} moduleId={MODULE_ID} onNavigateToEntity={() => undefined} />
      </ComplexityProvider>
    </QueryClientProvider>
  );

const testDomTiers = async () => {
  // ① 速写档：只读速写卡，不出现复杂术语
  const sketchClient = seededClient();
  seedEconomy(sketchClient, { complexity: 'sketch', graph: null, timeline: null, metrics: null });
  const sketch = mountView(sketchClient, 'sketch');
  await settle();
  const sketchRoot = sketch.query('[data-testid="economy-view"]');
  check('速写档根节点带 data-complexity=sketch', !!sketchRoot && sketchRoot.getAttribute('data-complexity') === 'sketch');
  check('速写档渲染速写卡', !!sketch.query('[data-testid="economy-sketch"]'));
  const sketchText = sketch.text();
  const forbidden = ['实体', '关联', '流量', '指标', '周期', '节点'].filter((word) =>
    sketchText.includes(word)
  );
  eq('速写档不出现实体/关联/流量/指标/周期/节点', forbidden, []);
  check(
    '速写卡在折叠条里说明「另有 N 条往来、M 个数值已折叠」',
    sketchText.includes('折叠') && sketchText.includes('升到结构'),
    sketchText.slice(0, 200)
  );
  check('速写档有「展开为脉络」入口', !!sketch.query('[data-testid="economy-open-structure"]'));
  sketch.unmount();

  // ② 结构档：线路图 + 账册
  const structureClient = seededClient();
  seedEconomy(structureClient, { complexity: 'structure' });
  const structure = mountView(structureClient, 'structure');
  await settle();
  check(
    '结构档根节点带 data-complexity=structure',
    structure.query('[data-testid="economy-view"]')?.getAttribute('data-complexity') === 'structure'
  );
  check('结构档渲染线路图', !!structure.query('[data-testid="economy-canvas"]'));
  check('画布渲染节点与边', !!structure.query('[data-testid="economy-node-i1"]') && !!structure.query('[data-testid="economy-edge-e1"]'));
  check('画布有泳道与图例', structure.queryAll('[data-testid^="economy-lane-"]').length > 0 && !!structure.query('[data-testid="economy-legend"]'));
  check('顶栏有三档布局切换', !!structure.query('[data-testid="economy-layout-tab-ledger"]'));
  clickTestId(structure, 'economy-layout-tab-ledger');
  await settle();
  check('切到账册后渲染账册行', !!structure.query('[data-testid="economy-ledger"]') && !!structure.query('[data-testid="economy-ledger-row-i1"]'));
  const ledgerText = structure.text();
  check('账册把未填显示为「—」而不是 0', ledgerText.includes('—'));
  clickTestId(structure, 'economy-layout-tab-lanes');
  await settle();
  // 选中节点后打开检查器（检查器只在有选中实体时渲染）
  clickTestId(structure, 'economy-node-i1');
  await settle();
  clickTestId(structure, 'economy-inspector-toggle');
  await settle();
  check('选中节点后可展开检查器', !!structure.query('[data-testid="economy-inspector"]'));
  check('检查器带关联区（LinkPanel 嵌入）', !!structure.query('[data-testid="economy-inspector-links"]'));
  structure.unmount();

  // ③ 沙盘档：叠加 + 统计 + 时间刷 + 图层
  const sandboxClient = seededClient();
  seedEconomy(sandboxClient, { complexity: 'sandbox' });
  const sandbox = mountView(sandboxClient, 'sandbox');
  await settle();
  check(
    '沙盘档根节点带 data-complexity=sandbox',
    sandbox.query('[data-testid="economy-view"]')?.getAttribute('data-complexity') === 'sandbox'
  );
  check('沙盘渲染图层栏 / 统计 / 时间刷', !!sandbox.query('[data-testid="economy-layer-flows"]') && !!sandbox.query('[data-testid="economy-stats"]') && !!sandbox.query('[data-testid="economy-timebrush"]'));
  check('统计面板出现总流量与指标覆盖', !!sandbox.query('[data-testid="economy-stat-flow"]') && !!sandbox.query('[data-testid="economy-stat-coverage"]'));
  check('时间刷画出窗口手柄', !!sandbox.query('[data-testid="economy-window-start"]'));
  sandbox.unmount();
};

const testDomDegrade = async () => {
  /**
   * 后端降级的**真实载荷形状**：`degraded: true` + `counts`（含 byKindStage）+ `degradeReason`，
   * 而 `nodes: []` / `edges: []`（economy_service.build_graph：`nodes=[] if hidden else nodes`）。
   * 喂「900 个节点 + degraded: true」是后端永远不会产生的形状，查不出「降级视图不可达」这个缺陷。
   */
  const client = seededClient();
  seedEconomy(client, {
    complexity: 'structure',
    graph: graphFixture({
      nodes: [],
      edges: [],
      degraded: true,
      degradeReason: '节点过多，已降级为账册矩阵 + 推荐关联列表（只返回计数，不返回节点与边明细）',
      nodeLimit: 800,
      counts: {
        nodes: 917,
        edges: 0,
        byKind: { industry: 640, resource: 277 },
        byStage: { transform: 640, upstream: 277 },
        byKindStage: { 'industry|transform': 640, 'resource|upstream': 277 },
        byLinkType: {},
        externalNodes: 0,
        stubNodes: 0,
        folded: { links: 0, metrics: 0, fields: 0 },
      },
    }),
  });
  const view = mountView(client, 'structure');
  await settle();
  check(
    '后端降级（nodes 为空）时渲染账册矩阵，而不是「空世界」引导',
    !!view.query('[data-testid="economy-degrade-matrix"]') && !view.query('[data-testid="economy-empty"]')
  );
  check(
    '降级视图给出后端 degradeReason（不是「当前 0 个节点」这类前端文案）',
    (view.query('[data-testid="economy-degrade-reason"]')?.textContent ?? '').includes(
      '已降级为账册矩阵 + 推荐关联列表'
    )
  );
  const matrixText = view.query('[data-testid="economy-degrade-matrix"]')?.textContent ?? '';
  check(
    '降级矩阵按 counts 渲染类型行与计数（counts.nodes 917 或 byKindStage 明细 640 / 277）',
    !!view.query('[data-testid="economy-degrade-kind-industry"]') &&
      (matrixText.includes('917') || (matrixText.includes('640') && matrixText.includes('277'))),
    matrixText.slice(0, 200)
  );
  check('降级视图不再铺开画布：没有 SVG 画布容器', !view.query('[data-testid="economy-canvas"]'));
  check('降级视图渲染推荐关联位', !!view.query('[data-testid="economy-recommendations"]'));
  view.unmount();
};

/** 键盘派发（§5.6）：flushSync 保证事件里的 setState 在断言前落地 */
const pressKey = (target: EventTarget, key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  flushSync(() => target.dispatchEvent(event));
  return event;
};

/** 键盘 / URL 用例的前后清理：URL（replaceState）与本地偏好会跨用例留存 */
const resetUrlAndStorage = () => {
  try {
    window.localStorage.clear();
  } catch {
    // 存储禁用：忽略
  }
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // about:blank / 沙箱：URL 不可写，忽略
  }
};

const testDomKeyboard = async () => {
  resetUrlAndStorage();
  const client = seededClient();
  seedEconomy(client, { complexity: 'structure' });
  // ComplexityProvider 受控时 setLevel 不改变 value：键盘切档要真的生效，需由外壳持有档位
  const Host = () => {
    const [level, setLevel] = useState<ComplexityLevel>('structure');
    return (
      <QueryClientProvider client={client}>
        <ComplexityProvider value={level} onChange={setLevel}>
          <EconomyView worldId={WORLD_ID} moduleId={MODULE_ID} onNavigateToEntity={() => undefined} />
        </ComplexityProvider>
      </QueryClientProvider>
    );
  };
  const view = mount(<Host />);
  await settle();
  const root = () => view.query('[data-testid="economy-view"]');

  // 起点档位由「URL -> 本地偏好 -> ModuleConfig.defaultComplexity」播种，不在这里假设；
  // 1/2/3 直接映射三档，断言与起点无关。
  pressKey(window, '3');
  await settle();
  check('按 3 切到沙盘档', root()?.getAttribute('data-complexity') === 'sandbox');
  pressKey(window, '1');
  await settle();
  check('按 1 切到速写档', root()?.getAttribute('data-complexity') === 'sketch');
  pressKey(window, '2');
  await settle();
  check('按 2 切回结构档', root()?.getAttribute('data-complexity') === 'structure');

  const layoutAtStart = root()?.getAttribute('data-layout');
  pressKey(window, 'l');
  await settle();
  const layoutAfterFirstPress = root()?.getAttribute('data-layout');
  pressKey(window, 'l');
  await settle();
  eq(
    'L 键在画布与账册之间互切（并回到上一次画布布局）',
    [layoutAtStart, layoutAfterFirstPress, root()?.getAttribute('data-layout')],
    ['lanes', 'ledger', 'lanes']
  );

  clickTestId(view, 'economy-new-entity');
  await settle();
  check('「添加实体」表单已打开', !!view.query('[data-testid="economy-new-entity-form"]'));
  pressKey(window, 'Escape');
  await settle();
  check('Esc 关闭新建表单', !view.query('[data-testid="economy-new-entity-form"]'));

  clickTestId(view, 'economy-node-i1');
  await settle();
  check(
    '点击画布节点即选中',
    view.query('[data-testid="economy-node-i1"]')?.getAttribute('data-selected') === 'true'
  );
  pressKey(window, 'Escape');
  await settle();
  check(
    'Esc 清空画布选择',
    view.query('[data-testid="economy-node-i1"]')?.getAttribute('data-selected') === 'false'
  );

  const selectedIds = () =>
    view
      .queryAll('[data-testid^="economy-node-"][data-selected="true"]')
      .map((element) => element.getAttribute('data-testid'));
  eq('清选择后没有任何节点处于选中态', selectedIds(), []);
  // 未经 preventDefault 的方向键：外壳仍要移动选中并打开检查器
  pressKey(window, 'ArrowDown');
  await settle();
  check(
    '外壳方向键仍能移动选中并打开检查器',
    view.query('[data-testid="economy-inspector-toggle"]')?.getAttribute('aria-pressed') === 'true' &&
      selectedIds().length === 1,
    { selected: selectedIds() }
  );

  // F4：切换器在自己的 onKeyDown 里 preventDefault 并切档，外壳不得再改选中 / 弹检查器
  const switcher = view.query('[role="radiogroup"][aria-label="复杂度"]');
  check('结构档使用共用复杂度切换器（radiogroup）', !!switcher);
  const beforeSwitcher = {
    level: root()?.getAttribute('data-complexity'),
    selected: selectedIds(),
    inspector: view.query('[data-testid="economy-inspector-toggle"]')?.getAttribute('aria-pressed'),
  };
  pressKey(switcher ?? window, 'ArrowDown');
  await settle();
  eq(
    '切换器方向键只切档：外壳不再改选中 / 弹检查器（已 preventDefault）',
    [
      root()?.getAttribute('data-complexity') !== beforeSwitcher.level,
      selectedIds(),
      view.query('[data-testid="economy-inspector-toggle"]')?.getAttribute('aria-pressed'),
    ],
    [true, beforeSwitcher.selected, beforeSwitcher.inspector]
  );

  // 直接构造「已 preventDefault」的事件：模拟画布（FlowCanvas）先处理方向键的情形
  const prevented = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    cancelable: true,
  });
  prevented.preventDefault();
  const beforePrevented = selectedIds();
  flushSync(() => window.dispatchEvent(prevented));
  await settle();
  eq('已 preventDefault 的按键不再由外壳重复处理', selectedIds(), beforePrevented);

  view.unmount();
  resetUrlAndStorage();
};

const testDomDegenerate = async () => {
  // 1 实体 0 边：单站点居中，仍可用
  const oneClient = seededClient();
  seedEconomy(oneClient, {
    complexity: 'structure',
    graph: graphFixture({
      nodes: [node({ id: 'only', name: '物产甲', kind: 'resource', stage: 'upstream' })],
      edges: [],
      counts: {
        nodes: 1,
        edges: 0,
        byKind: { resource: 1 },
        byStage: { upstream: 1 },
        byLinkType: {},
        externalNodes: 0,
        stubNodes: 0,
        folded: { links: 0, metrics: 0, fields: 0 },
      },
    }),
  });
  const one = mountView(oneClient, 'structure');
  await settle();
  check('1 实体 0 边仍画出单站点', !!one.query('[data-testid="economy-node-only"]'));
  eq(
    '1 实体 0 边不制造假边',
    one
      .queryAll('[data-testid^="economy-edge-"]')
      .filter((element) => element.getAttribute('data-testid') !== 'economy-edge-layer').length,
    0
  );
  one.unmount();

  // 1 实体 1 边：绝对模式直接标数值
  const twoClient = seededClient();
  seedEconomy(twoClient, {
    complexity: 'sandbox',
    graph: graphFixture({
      nodes: [
        node({ id: 'a', name: '物产甲', kind: 'resource', stage: 'upstream', scale: 1 }),
        node({ id: 'b', name: '营生甲', kind: 'industry', stage: 'transform', scale: 2 }),
      ],
      edges: [edge('e1', 'b', 'a', { flow: 120, unit: '袋/季' })],
      counts: {
        nodes: 2,
        edges: 1,
        byKind: { resource: 1, industry: 1 },
        byStage: { upstream: 1, transform: 1 },
        byLinkType: { 'economy.consumes': 1 },
        externalNodes: 0,
        stubNodes: 0,
        folded: { links: 1, metrics: 0, fields: 0 },
      },
    }),
  });
  const two = mountView(twoClient, 'sandbox');
  await settle();
  check('1 实体 1 边画出两点一线', !!two.query('[data-testid="economy-edge-e1"]'));
  check('绝对模式的边直接标注数值与单位', two.text().includes('120'), two.text().slice(0, 200));
  two.unmount();

  // 全空：速写引导
  const emptyClient = seededClient();
  seedEconomy(emptyClient, {
    complexity: 'sketch',
    summary: summaryFixture({
      totals: {
        entities: 0,
        links: 0,
        totalFlow: 0,
        flowUnits: [],
        multiUnit: false,
        surplus: { surplus: 0, balanced: 0, deficit: 0, unknown: 0 },
        metricCoverage: { entitiesWithMetrics: 0, totalEntities: 0, coverage: 0 },
      },
      stages: [],
      kinds: [],
      fold: { links: 0, metrics: 0, fields: 0 },
      overview: null,
      timeRange: { start: null, end: null, anchored: false },
    }),
    graph: null,
    timeline: null,
    metrics: null,
  });
  const empty = mountView(emptyClient, 'sketch');
  await settle();
  check('全空世界给速写引导而不是错误页', !!empty.query('[data-testid="economy-empty"]') || !!empty.query('[data-testid="economy-sketch"]'));
  empty.unmount();
};

// ---------- 运行 ----------

const run = async () => {
  try {
    testConfigContract();
    testConfigResolution();
    testNormalize();
    testGuards();
    testViewStateScope();
    testLayout();
    await testDomTiers();
    await testDomDegrade();
    await testDomKeyboard();
    await testDomDegenerate();
  } catch (error) {
    check(
      'harness 未捕获异常',
      false,
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    );
  }

  (window as unknown as Record<string, unknown>).__PHASE5_TESTS__ = {
    done: true,
    checks,
  } satisfies { done: boolean; checks: Check[] };
};

void run();
