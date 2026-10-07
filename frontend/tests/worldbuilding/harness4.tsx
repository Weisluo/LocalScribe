/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 4 回归用例（浏览器侧，P4-T12/验收）
 *
 * 由 tests/worldbuilding/phase4.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE4_TESTS__。分两类：
 * 1) 纯函数：政治派生选择器、meta 读写、权重/尺寸/降级阈值、条约缎带投影、任职带、
 *    scope 推导、沿革时间范围（最强不变量，不依赖 React）；
 * 2) 组件：PoliticsView 在预置缓存下的三视图壳、层级过滤器、空态、条约簿、聚焦详情。
 *
 * 不发任何网络请求：TanStack Query 缓存由 seedWorld 预置，mutation 不参与断言。
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ComplexityProvider } from '@/components/common/ComplexitySwitcher';
import { PoliticsView } from '@/components/Worldbuilding/PoliticsView';
import { worldbuildingKeys } from '@/components/Worldbuilding/hooks/worldQueryKeys';
import {
  POLITICS_CONFIG_DEFAULTS,
  POLITICS_PALETTE,
  POLITICS_TERM_DEFAULTS,
  POLITICS_VIEW_LABELS,
  POLITICS_VIEWS,
  resolvePoliticsConfig,
  resolvePoliticsView,
  validatePoliticsKind,
} from '@/components/Worldbuilding/PoliticsView/config';
import {
  CHRONICLE_HISTORY_LINK_TYPES,
  LEGACY_TREATY_LINK_TYPE,
  POLITICS_BUILTIN_KINDS,
  POLITICS_CAPABILITIES,
  POLITICS_ITEM_GROUPS,
  POLITICS_LINK_TYPES,
  POLITICS_RELATION_LAYERS,
  SCOPE_LABELS,
  TREATY_STATUS_LABELS,
  ATLAS_FOLD_POLITY_LIMIT,
  ATLAS_FULL_POLITY_LIMIT,
  FOCUS_PIN_LIMIT,
  LINKPANEL_FOLD_LIMIT,
  ROSTER_VIRTUAL_LIMIT,
  atlasDegradeMode,
  atlasRingOf,
  atlasSizeTier,
  chronicleEntriesOf,
  coreFiguresOf,
  deriveScope,
  entityRefOf,
  isLegacyTreatyLink,
  isSignatoryLink,
  itemGroupsOf,
  legacyTreatyEdges,
  normalizeScope,
  orgDescendantIds,
  orgDepthOf,
  orgEdgeDepthOf,
  politicsRefOf,
  projectSignatories,
  readFigureMeta,
  readOrganizationMeta,
  readPolityMeta,
  readTreatyMeta,
  resolveOrganizationScope,
  shouldFoldLinkPanel,
  shouldVirtualizeRoster,
  tenureBandsOf,
  toPoliticsEntity,
  treatyStatusOf,
  weightOf,
  wouldCreateOrgCycle,
  wouldCreateOrgLinkCycle,
} from '@/components/Worldbuilding/PoliticsView/types';
import {
  aggregateEdges,
  buildAtlasNodes,
  buildChronicleLanes,
  buildChronicleTreatyBands,
  buildEdgeViews,
  buildEntities,
  buildFocusDetail,
  buildIndex,
  buildIndependentForces,
  buildOwnership,
  buildRibbons,
  buildRosterIndependents,
  buildRosterPolities,
  buildRosterTreaties,
  chronicleAnchorsOf,
  chronicleRangeOf,
  chronicleSpansOf,
  countForRef,
  filterPolities,
  matchesFilter,
  pendingLegacyTreatyEdges,
  splitForRef,
  validatePoliticsForm,
  EMPTY_POLITICS_FILTER,
} from '@/components/Worldbuilding/PoliticsView/hooks';
import type { EntityRef, LinkTypeDef, WorldLink, WorldWithModules } from '@/services/worldbuildingApi';

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

const World = ({
  client,
  level,
  children,
}: {
  client: QueryClient;
  level: 'sketch' | 'structure' | 'sandbox';
  children: ReactNode;
}) => (
  <QueryClientProvider client={client}>
    <ComplexityProvider value={level}>{children}</ComplexityProvider>
  </QueryClientProvider>
);

const clickTestId = (view: Mounted, testId: string): boolean => {
  const element = view.query(`[data-testid="${testId}"]`);
  if (!element) return false;
  const clickable =
    element.tagName === 'BUTTON' || element.getAttribute('role') === 'button'
      ? element
      : element.querySelector('button') ?? element;
  flushSync(() => (clickable as HTMLElement).click());
  return true;
};

const clickIncludes = (view: Mounted, text: string): boolean => {
  const button = [...view.queryAll('button')].find((candidate) =>
    (candidate.textContent ?? '').includes(text)
  );
  if (button) flushSync(() => (button as HTMLButtonElement).click());
  return !!button;
};

// ---------- 数据夹具 ----------

const WORLD_ID = 'w1';
const PROJECT_ID = 'p1';
const POLITICS_MODULE_ID = 'm-politics';
const HISTORY_MODULE_ID = 'm-history';
const RACES_MODULE_ID = 'm-races';

const ref = (module: string, kind: string, id: string): EntityRef => ({ module, kind, id });

interface SubFixtureInput {
  id: string;
  name: string;
  kind: string;
  order: number;
  parentId?: string | null;
  meta?: Record<string, unknown> | null;
  color?: string | null;
  icon?: string | null;
}

const sub = ({
  id,
  name,
  kind,
  order,
  parentId = null,
  meta = null,
  color = null,
  icon = null,
}: SubFixtureInput) => ({
  id,
  module_id: POLITICS_MODULE_ID,
  name,
  description: null,
  order_index: order,
  kind,
  meta,
  color,
  icon,
  parent_id: parentId,
  item_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const itemFixture = (
  id: string,
  submoduleId: string,
  name: string,
  content: Record<string, unknown>,
  orderIndex = 0
) => ({
  id,
  module_id: POLITICS_MODULE_ID,
  submodule_id: submoduleId,
  name,
  content,
  order_index: orderIndex,
  is_published: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const moduleFixture = (
  id: string,
  moduleType: string,
  name: string,
  order: number,
  submodules: unknown[],
  items: unknown[] = [],
  config: Record<string, unknown> | null = null
) => ({
  id,
  world_id: WORLD_ID,
  module_type: moduleType,
  name,
  description: null,
  icon: null,
  order_index: order,
  config,
  is_collapsible: true,
  is_required: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  submodule_count: submodules.length,
  item_count: items.length,
  submodules,
  items,
});

/** 政治夹具：2 政权（rank 高/低）+ 1 卫星组织 + 1 独立组织 + 2 人物 + 2 条约 */
const POLITICS_CONFIG: ModuleConfig = {
  ...POLITICS_CONFIG_DEFAULTS,
  levels: [
    { id: 'l3', label: '帝国', rank: 30, color: '#a16207' },
    { id: 'l1', label: '城邦', rank: 10, color: '#a16207' },
  ],
  statuses: [
    { id: 'alive', label: '存续', isTerminal: false },
    { id: 'gone', label: '已灭亡', isTerminal: true },
  ],
  displayMode: 'atlas',
};

/** 用户自定义 kind：附着政权（卫星形态） */
const CUSTOM_SATELLITE_CONFIG: ModuleConfig = {
  ...POLITICS_CONFIG,
  entityTypes: [
    ...POLITICS_BUILTIN_KINDS,
    {
      id: 'custom_order',
      label: '教团',
      icon: 'flame',
      color: 'amber',
      parentKind: 'polity',
      attachment: 'satellite',
    },
  ],
};

const SUBMODULES = [
  sub({
    id: 'pol1',
    name: '政权甲',
    kind: 'polity',
    order: 0,
    meta: {
      level: 'l3',
      status: 'alive',
      time: { start: '100-01-01', display: '纪元百年' },
      note: '版图主干',
      unknownKey: '保留我',
    },
    color: 'type:nation:l3:alive',
    icon: 'landmark',
  }),
  sub({
    id: 'pol2',
    name: '政权乙',
    kind: 'polity',
    order: 1,
    meta: { level: 'l1', status: 'gone' },
  }),
  sub({
    id: 'org1',
    name: '组织甲',
    kind: 'organization',
    order: 2,
    meta: { scope: 'intra_polity', orgSubtypeId: 'subtype_a', level: 'l1' },
  }),
  sub({
    id: 'org2',
    name: '独立组织',
    kind: 'organization',
    order: 3,
    meta: { scope: 'independent' },
  }),
  sub({
    id: 'fig1',
    name: '甲',
    kind: 'figure',
    order: 4,
    meta: {
      characterId: 'c1',
      identityLabel: '君主',
      primaryOfficeLabel: '君主',
      courtRank: '一等',
    },
  }),
  sub({
    id: 'fig2',
    name: '乙',
    kind: 'figure',
    order: 5,
    meta: { characterId: 'missing-character', identityLabel: '摄政' },
  }),
  sub({
    id: 'treaty1',
    name: '条约X',
    kind: 'treaty',
    order: 6,
    meta: {
      treatyTypeId: 'type_a',
      effectiveAt: '110-01-01',
      expiresAt: '120-01-01',
      summary: '一句话摘要',
      status: 'alive',
    },
  }),
  sub({
    id: 'treaty2',
    name: '条约Y',
    kind: 'treaty',
    order: 7,
    meta: { breachState: '中止', effectiveAt: '115-01-01' },
  }),
];

const ITEMS = [
  itemFixture('it-gov', 'pol1', 'government', {
    formLabel: '政体A',
    legitimacy: '神授',
    succession: '长子继承',
  }),
  itemFixture('it-chron', 'pol1', 'chronicle', {
    entries: [
      {
        id: 'ce1',
        order: 0,
        title: '建立',
        time: { start: '100-01-01' },
      },
      {
        id: 'ce2',
        order: 1,
        title: '扩张',
        time: { start: '150-01-01' },
      },
    ],
  }),
  itemFixture('it-demo', 'pol1', 'demographics', { population: 100000, year: '160' }),
  itemFixture('it-eco', 'pol1', 'economy_base', { summary: '以农立国' }),
  itemFixture('it-orgdoctrine', 'org1', 'org_doctrine', { creed: '守序' }),
  itemFixture('it-orgstruct', 'org1', 'org_structure', {
    entries: [{ id: 'os1', order: 0, title: '首座', tierLabel: '上层', seats: 1 }],
  }),
  itemFixture('it-figident', 'fig1', 'figure_identity', { publicStanding: '强硬' }),
  itemFixture('it-terms', 'treaty1', 'treaty_terms', {
    terms: [
      { id: 'tm1', order: 0, title: '第一款', content: '互不侵犯', binding: true },
      { id: 'tm2', order: 1, title: '第二款', content: '通商', secret: true },
    ],
  }),
  itemFixture('it-amend', 'treaty1', 'treaty_amendments', {
    amendments: [{ id: 'am1', order: 0, title: '补充', time: { start: '118-01-01' } }],
  }),
];

const WORLD_FIXTURE = {
  id: WORLD_ID,
  name: '测试世界',
  description: null,
  cover_image: null,
  project_id: PROJECT_ID,
  tone: null,
  settings: { complexity: 'structure' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  module_count: 3,
  link_count: 12,
  modules: [
    moduleFixture(POLITICS_MODULE_ID, 'politics', '政治', 2, SUBMODULES, ITEMS, CUSTOM_SATELLITE_CONFIG),
    moduleFixture(HISTORY_MODULE_ID, 'history', '历史', 1, [
      // P1 回填后 history 子模块的 kind 就是语义 kind（event / era），不是模块名
      sub({
        id: 'ev1',
        name: '赤壁之战',
        kind: 'event',
        order: 0,
        meta: { time: { start: '150-06-01' } },
      }),
    ]),
    moduleFixture(RACES_MODULE_ID, 'races', '种族', 4, [
      sub({ id: 'race1', name: '人类', kind: 'race', order: 0 }),
    ]),
  ],
} as unknown as WorldWithModules;

const link = (
  id: string,
  source: EntityRef,
  target: EntityRef,
  linkType: string,
  extra: Partial<WorldLink> = {}
): WorldLink => ({
  id,
  world_id: WORLD_ID,
  source,
  target,
  link_type: linkType,
  label: null,
  reverse_label: null,
  directed: true,
  note: null,
  meta: null,
  time: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
});

const P = (kind: string, id: string) => politicsRefOf(id, kind);

const LINKS: WorldLink[] = [
  // 组织归属：org1 挂 pol1（intra_polity）；org2 无归属（independent）
  link('lk-org1', P('organization', 'org1'), P('polity', 'pol1'), 'politics.subordinate_to'),
  // 人物任职：fig1 领导 pol1（主要），fig2 效忠 pol1
  link('lk-fig1', P('figure', 'fig1'), P('polity', 'pol1'), 'politics.leads', {
    time: { start: '100-01-01', end: null },
    meta: { officeTitle: '君主', isPrimary: true },
  }),
  link('lk-fig2', P('figure', 'fig2'), P('polity', 'pol1'), 'politics.member_of', {
    time: { start: '120-01-01', end: '130-01-01' },
    meta: { officeTitle: '摄政', isPrimary: false },
  }),
  // 缔约：signatory_of 是唯一规范边
  link('lk-sig1', P('polity', 'pol1'), P('treaty', 'treaty1'), 'politics.signatory_of', {
    time: { start: '110-01-01' },
  }),
  link('lk-sig2', P('polity', 'pol2'), P('treaty', 'treaty1'), 'politics.signatory_of', {
    time: { start: '111-01-01' },
  }),
  link('lk-sig3', P('organization', 'org1'), P('treaty', 'treaty1'), 'politics.signatory_of'),
  // 对称关系边
  link('lk-ally', P('polity', 'pol1'), P('polity', 'pol2'), 'politics.ally_of', { directed: false }),
  link('lk-war', P('polity', 'pol2'), P('polity', 'pol1'), 'politics.at_war_with', {
    directed: false,
    meta: { strength: 3 },
    note: '边境冲突',
  }),
  link('lk-vassal', P('polity', 'pol2'), P('polity', 'pol1'), 'politics.vassal_of'),
  // 跨模块：历史事件涉及政权甲（source = 事件，target = 政权）
  // 注意 P(kind, id) 只构造 politics 模块内的 ref；跨模块端点必须用 ref(module, kind, id)。
  link('lk-hist', ref('history', 'event', 'ev1'), P('polity', 'pol1'), 'history.involves', {
    time: { start: '150-06-01' },
  }),
  // 跨模块：政权甲的种族构成（source = 政权，target = 种族）
  link('lk-race', P('polity', 'pol1'), ref('races', 'race', 'race1'), 'politics.includes_race', {
    meta: { share: 0.6, note: '主要民族' },
  }),
  // 已废弃边：不进入关系层；一端是条约时按 §3.8.1 在展示层等价转换为缔约方
  // （treaty2 因此多一个 legacy 缔约方，缎带与条约数随之增加）
  link('lk-legacy', P('polity', 'pol1'), P('treaty', 'treaty2'), LEGACY_TREATY_LINK_TYPE),
];

const REGISTRY: LinkTypeDef[] = [
  {
    id: 'politics.signatory_of',
    label: '签署/加入',
    reverse_label: '签署方',
    directed: true,
    icon: 'pen-line',
    color: 'green',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
    target: [ref('politics', 'treaty', '*')],
  },
  {
    id: 'politics.ally_of',
    label: '同盟',
    reverse_label: '同盟',
    directed: false,
    icon: 'handshake',
    color: 'emerald',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
    target: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
  },
  {
    id: 'politics.at_war_with',
    label: '敌对/战争',
    reverse_label: '敌对/战争',
    directed: false,
    icon: 'swords',
    color: 'red',
    line_style: 'double',
    group: 'politics',
    source: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
    target: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
  },
  {
    id: 'politics.vassal_of',
    label: '附庸于',
    reverse_label: '宗主',
    directed: true,
    icon: 'chevron-down',
    color: 'amber',
    line_style: 'dashed',
    group: 'politics',
    source: [ref('politics', 'polity', '*')],
    target: [ref('politics', 'polity', '*')],
  },
  {
    id: 'politics.subordinate_to',
    label: '下属于',
    reverse_label: '下辖',
    directed: true,
    icon: 'corner-down-right',
    color: 'red',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'organization', '*')],
    target: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
  },
  {
    id: 'politics.leads',
    label: '领导',
    reverse_label: '被领导',
    directed: true,
    icon: 'crown',
    color: 'red',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'figure', '*')],
    target: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*'), ref('politics', 'treaty', '*')],
  },
  {
    id: 'politics.member_of',
    label: '效忠/隶属',
    reverse_label: '拥有成员',
    directed: true,
    icon: 'users-round',
    color: 'red',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'figure', '*'), ref('politics', 'organization', '*')],
    target: [ref('politics', 'polity', '*'), ref('politics', 'organization', '*')],
  },
  {
    id: 'politics.includes_race',
    label: '民族/种族构成',
    reverse_label: '构成',
    directed: true,
    icon: 'users',
    color: 'teal',
    line_style: 'dashed',
    group: 'politics',
    source: [ref('politics', 'polity', '*')],
    target: [ref('races', 'race', '*'), ref('races', 'subrace', '*')],
  },
  {
    id: 'history.involves',
    label: '涉及',
    reverse_label: '被涉及',
    directed: true,
    icon: 'flag',
    color: 'amber',
    line_style: 'dotted',
    group: 'history',
    source: [ref('history', 'event', '*'), ref('history', 'era', '*')],
    target: null,
  },
  {
    id: 'core.related_to',
    label: '相关',
    reverse_label: '相关',
    directed: false,
    icon: 'git-branch',
    color: 'slate',
    line_style: 'dotted',
    group: 'general',
    source: null,
    target: null,
  },
];

const CHARACTERS = [
  { id: 'c1', name: '青云子' },
  { id: 'c2', name: '无名氏' },
];

const seedWorld = (client: QueryClient, links: WorldLink[] = LINKS) => {
  client.setQueryData(worldbuildingKeys.world(WORLD_ID), WORLD_FIXTURE);
  client.setQueryData(worldbuildingKeys.linkRegistry(), REGISTRY);
  client.setQueryData(['characters-simple', PROJECT_ID], CHARACTERS);
  client.setQueryData(worldbuildingKeys.links(WORLD_ID), links);
  client.setQueryData(worldbuildingKeys.linkCounts(WORLD_ID), [
    { module: 'politics', outgoing: 8, incoming: 4, total: 12 },
  ]);
};

/** 空世界夹具：政治模块存在但没有任何子模块（P4 空态与 3 分钟路径） */
const EMPTY_WORLD = {
  ...WORLD_FIXTURE,
  module_count: 1,
  link_count: 0,
  modules: [
    moduleFixture(POLITICS_MODULE_ID, 'politics', '政治', 2, [], [], POLITICS_CONFIG),
    moduleFixture(HISTORY_MODULE_ID, 'history', '历史', 1, []),
  ],
} as unknown as WorldWithModules;

/** 选择器输入构造：与 usePolitics 内部的 SelectorInput 同形 */
const selectorInput = (refs: ReturnType<typeof makeRefs>, links: WorldLink[] = LINKS) => ({
  submodules: SUBMODULES,
  items: ITEMS,
  links,
  config: resolvePoliticsConfig(POLITICS_CONFIG),
  levels: POLITICS_CONFIG.levels,
  statuses: POLITICS_CONFIG.statuses,
  refs,
  complexity: 'structure' as const,
});

const NAME_MAP: Record<string, string> = {
  pol1: '政权甲',
  pol2: '政权乙',
  org1: '组织甲',
  org2: '独立组织',
  fig1: '甲',
  fig2: '乙',
  treaty1: '条约X',
  treaty2: '条约Y',
  ev1: '赤壁之战',
  race1: '人类',
  c1: '青云子',
};

const makeRefs = () => ({
  // 未命中即视为失效引用：返回 undefined（与 useEntityRefs.lookup 一致）。
  // 早先这里对未命中返回 `{name: ''}` 的对象，让「未绑定角色」被误判成已绑定。
  lookup: (target?: EntityRef | null) =>
    target && NAME_MAP[target.id]
      ? {
          ref: target,
          name: NAME_MAP[target.id],
          module: target.module,
          kind: target.kind,
          moduleName: target.module,
        }
      : undefined,
  resolveName: (target?: EntityRef | null) => (target ? NAME_MAP[target.id] ?? target.id : ''),
  isInvalid: (target?: EntityRef | null) => !!target && !NAME_MAP[target.id],
  byModule: new Map(),
  entries: [],
  isLoading: false,
});

// ---------- 1. 配置与契约 ----------

const testConfigContract = () => {
  eq('三主视图顺序为 版图/名录/沿革', [...POLITICS_VIEWS], ['atlas', 'roster', 'chronicle']);
  eq(
    '视图标签',
    POLITICS_VIEW_LABELS.atlas + POLITICS_VIEW_LABELS.roster + POLITICS_VIEW_LABELS.chronicle,
    '版图名录沿革'
  );
  eq('内置四 kind 顺序', POLITICS_BUILTIN_KINDS.map((def) => def.id), [
    'polity',
    'organization',
    'figure',
    'treaty',
  ]);

  // 空白世界：levels / statuses / fieldSchema / linkTypes / terminology 必须为空
  eq('默认 levels 为空', POLITICS_CONFIG_DEFAULTS.levels, []);
  eq('默认 statuses 为空', POLITICS_CONFIG_DEFAULTS.statuses, []);
  eq('默认 fieldSchema 为空', POLITICS_CONFIG_DEFAULTS.fieldSchema, {});
  eq('默认 linkTypes 为空', POLITICS_CONFIG_DEFAULTS.linkTypes, []);
  eq('默认 terminology 为空', POLITICS_CONFIG_DEFAULTS.terminology, {});
  eq('默认复杂度为速写', POLITICS_CONFIG_DEFAULTS.defaultComplexity, 'sketch');
  eq('默认 displayMode 为 atlas', POLITICS_CONFIG_DEFAULTS.displayMode, 'atlas');
  check(
    '默认配置不含任何预置内容字段',
    !['presets', 'seeded', 'sampleData', 'examplePolities', 'starterLevels', 'defaultPolities'].some(
      (token) => JSON.stringify(POLITICS_CONFIG_DEFAULTS).includes(token)
    )
  );
  check(
    '术语默认值不含示例政权名',
    Object.values(POLITICS_TERM_DEFAULTS).every((value) => !/甲|乙|示例|example/.test(value))
  );

  eq(
    'displayMode 只认三主视图（次级条约簿不是主视图）',
    [
      resolvePoliticsView('roster'),
      resolvePoliticsView('chronicle'),
      resolvePoliticsView('treatybook'),
      resolvePoliticsView(undefined),
    ],
    ['roster', 'chronicle', 'atlas', 'atlas']
  );

  const resolved = resolvePoliticsConfig(POLITICS_CONFIG);
  eq('用户等级被保留', resolved.levels?.map((def) => def.id), ['l3', 'l1']);
  eq('用户状态被保留', resolved.statuses?.map((def) => def.id), ['alive', 'gone']);
  const withCustom = resolvePoliticsConfig(CUSTOM_SATELLITE_CONFIG);
  check(
    '自定义 kind 追加而不覆盖内置',
    (withCustom.entityTypes ?? []).some((def) => def.id === 'custom_order') &&
      (withCustom.entityTypes ?? []).some((def) => def.id === 'polity')
  );

  eq(
    '自定义 kind 缺 parentKind 被拒',
    validatePoliticsKind(resolvePoliticsConfig(POLITICS_CONFIG), { id: 'custom_x', label: 'X' } as never),
    '自定义类型必须声明 parentKind'
  );
  eq(
    '自定义 kind 缺 custom_ 前缀被拒',
    validatePoliticsKind(resolvePoliticsConfig(POLITICS_CONFIG), {
      id: 'order',
      label: 'X',
      parentKind: 'polity',
    } as never),
    '自定义类型 id 必须以 custom_ 开头'
  );
  eq(
    '内置 kind 不能被新增覆盖',
    validatePoliticsKind(resolvePoliticsConfig(POLITICS_CONFIG), {
      id: 'polity',
      label: 'X',
      parentKind: 'polity',
    } as never),
    'polity 是内置类型，不能新增或覆盖'
  );
  eq(
    '附着层非法的自定义 kind 被拒',
    validatePoliticsKind(resolvePoliticsConfig(POLITICS_CONFIG), {
      id: 'custom_ok',
      label: '教团',
      parentKind: 'polity',
      attachment: 'tab',
    } as never),
    '自定义类型必须声明附着层：satellite / independent / edge'
  );
  eq(
    '合法自定义 kind 通过',
    validatePoliticsKind(resolvePoliticsConfig(POLITICS_CONFIG), {
      id: 'custom_order',
      label: '教团',
      parentKind: 'polity',
      attachment: 'satellite',
    } as never),
    null
  );

  eq('polity 字段组', POLITICS_ITEM_GROUPS.polity, [
    'government',
    'chronicle',
    'demographics',
    'economy_base',
    'custom',
  ]);
  eq('organization 字段组', POLITICS_ITEM_GROUPS.organization, [
    'org_doctrine',
    'org_structure',
    'chronicle',
    'custom',
  ]);
  eq('figure 字段组', POLITICS_ITEM_GROUPS.figure, ['figure_identity', 'custom']);
  eq('treaty 字段组', POLITICS_ITEM_GROUPS.treaty, [
    'treaty_terms',
    'treaty_amendments',
    'custom',
  ]);
  eq('自定义 kind 继承政权字段组', itemGroupsOf('custom_order'), POLITICS_ITEM_GROUPS.polity);

  eq(
    'sketch 不画卫星与缎带',
    [
      POLITICS_CAPABILITIES.sketch.satellites,
      POLITICS_CAPABILITIES.sketch.treatyRibbons,
      POLITICS_CAPABILITIES.sketch.relationEdges,
      POLITICS_CAPABILITIES.sketch.tenureBands,
    ],
    [false, false, false, false]
  );
  eq('sketch 保留政权节点与头像条', POLITICS_CAPABILITIES.sketch.atlasPolityOnly, true);
  eq(
    'structure 启用卫星/缎带/关系/任职/六段',
    [
      POLITICS_CAPABILITIES.structure.satellites,
      POLITICS_CAPABILITIES.structure.treatyRibbons,
      POLITICS_CAPABILITIES.structure.relationEdges,
      POLITICS_CAPABILITIES.structure.tenureBands,
      POLITICS_CAPABILITIES.structure.fullDetail,
    ],
    [true, true, true, true, true]
  );
  eq(
    'structure 关闭时间滑杆与派生分布',
    [
      POLITICS_CAPABILITIES.structure.timeline,
      POLITICS_CAPABILITIES.structure.derivedDistribution,
    ],
    [false, false]
  );
  eq(
    'sandbox 启用时间/强度/派生/历史叠加',
    [
      POLITICS_CAPABILITIES.sandbox.timeline,
      POLITICS_CAPABILITIES.sandbox.relationStrength,
      POLITICS_CAPABILITIES.sandbox.derivedDistribution,
      POLITICS_CAPABILITIES.sandbox.historyOverlay,
    ],
    [true, true, true, true]
  );

  eq('scope 三种标签齐全', Object.keys(SCOPE_LABELS).sort(), [
    'cross_polity',
    'independent',
    'intra_polity',
  ]);
  eq('条约状态四种标签齐全', Object.keys(TREATY_STATUS_LABELS).sort(), [
    'active',
    'expired',
    'suspended',
    'unknown',
  ]);
  check(
    '领域色板 light/dark 两套值',
    Object.values(POLITICS_PALETTE).every(
      (tone) => /^#[0-9a-f]{6}$/i.test(tone.light) && /^#[0-9a-f]{6}$/i.test(tone.dark)
    )
  );

  eq(
    '关系层线型表覆盖五种一般关系',
    POLITICS_RELATION_LAYERS.map((layer) => layer.id),
    [
      'politics.ally_of',
      'politics.at_war_with',
      'politics.vassal_of',
      'politics.trades_with',
      'politics.marriage_tie',
    ]
  );
  check(
    '线型与箭头语义固定：附庸虚线有向，同盟实线对称',
    POLITICS_RELATION_LAYERS.find((layer) => layer.id === 'politics.vassal_of')?.lineStyle ===
      'dashed' &&
      POLITICS_RELATION_LAYERS.find((layer) => layer.id === 'politics.vassal_of')?.directed ===
        true &&
      POLITICS_RELATION_LAYERS.find((layer) => layer.id === 'politics.ally_of')?.lineStyle ===
        'solid' &&
      POLITICS_RELATION_LAYERS.find((layer) => layer.id === 'politics.ally_of')?.directed === false
  );

  check(
    'treaty_between 与 signatory_of 不同，且注册表无 treaty_between',
    LEGACY_TREATY_LINK_TYPE !== POLITICS_LINK_TYPES.signatoryOf &&
      !REGISTRY.some((def) => def.id === LEGACY_TREATY_LINK_TYPE)
  );
};

// ---------- 2. meta 读写与实体转换 ----------

const testMetaReaders = () => {
  const polity = toPoliticsEntity(SUBMODULES[0] as never);
  const meta = readPolityMeta(polity.meta);
  eq('PolityMeta.level', meta.level, 'l3');
  eq('PolityMeta.status', meta.status, 'alive');
  eq('PolityMeta.time.start', meta.time?.start, '100-01-01');
  eq('PolityMeta.time.display', meta.time?.display, '纪元百年');
  eq('PolityMeta.note', meta.note, '版图主干');
  check(
    '未知 meta 键保留（转换不丢数据）',
    (polity.meta as Record<string, unknown>).unknownKey === '保留我'
  );

  const org = readOrganizationMeta(SUBMODULES[2].meta);
  eq('OrganizationMeta.scope', org.scope, 'intra_polity');
  eq('OrganizationMeta.orgSubtypeId', org.orgSubtypeId, 'subtype_a');
  eq('缺失 scope 归一化为 intra_polity', readOrganizationMeta({}).scope, 'intra_polity');
  eq('normalizeScope 非法值回落', normalizeScope('nope'), 'intra_polity');
  eq('normalizeScope 保留合法值', normalizeScope('cross_polity'), 'cross_polity');

  const fig = readFigureMeta(SUBMODULES[4].meta);
  eq('FigureMeta.characterId 必填键', fig.characterId, 'c1');
  eq('FigureMeta.identityLabel', fig.identityLabel, '君主');
  eq('FigureMeta.courtRank', fig.courtRank, '一等');
  eq('缺失 characterId 回落空串', readFigureMeta({}).characterId, '');

  const treaty = readTreatyMeta(SUBMODULES[6].meta);
  eq('TreatyMeta.effectiveAt', treaty.effectiveAt, '110-01-01');
  eq('TreatyMeta.expiresAt', treaty.expiresAt, '120-01-01');
  eq('TreatyMeta.summary', treaty.summary, '一句话摘要');

  const legacy = toPoliticsEntity({ ...(SUBMODULES[0] as never), kind: 'nation' } as never);
  eq('未归一化的 nation 不被前端当作 polity', legacy.kind, 'nation');
  const noKind = toPoliticsEntity({ ...(SUBMODULES[0] as never), kind: null } as never);
  eq('kind 缺失退化为 custom', noKind.kind, 'custom');
  eq('entityRefOf 使用 kind', entityRefOf(SUBMODULES[1] as never), {
    module: 'politics',
    kind: 'polity',
    id: 'pol2',
  });

  eq(
    'chronicle 条目按 order 排序',
    chronicleEntriesOf(ITEMS as never, 'pol1').map((entry) => entry.id),
    ['ce1', 'ce2']
  );
  eq('未知 submodule 返回空数组', chronicleEntriesOf(ITEMS as never, 'nope'), []);
  eq('item 不串到别的 submodule', chronicleEntriesOf(ITEMS as never, 'pol2'), []);
};

// ---------- 3. 权重 / 尺寸档 / 布局环 / 降级阈值 ----------

const testWeightAndThresholds = () => {
  const levels = POLITICS_CONFIG.levels ?? [];
  eq(
    'rank 读取',
    [weightOf('l3', levels), weightOf('l1', levels), weightOf('nope', levels), weightOf(undefined, levels)],
    [30, 10, 0, 0]
  );
  eq('等级缺失时不猜 rank', weightOf(undefined, []), 0);

  eq(
    '三档尺寸',
    [atlasSizeTier(30, [30, 20, 10]), atlasSizeTier(20, [30, 20, 10]), atlasSizeTier(10, [30, 20, 10])],
    ['high', 'mid', 'low']
  );
  eq('单一 rank 全部 mid（不把空等级体系画成小卡）', atlasSizeTier(0, [0, 0]), 'mid');
  eq('无等级时 mid', atlasSizeTier(0, []), 'mid');

  eq(
    '布局环 rank 越高越靠中心',
    [atlasRingOf(30, [30, 20, 10]), atlasRingOf(20, [30, 20, 10]), atlasRingOf(10, [30, 20, 10])],
    [0, 1, 2]
  );

  eq('60 政权 / 300 边以内完整', atlasDegradeMode(60, 300), 'full');
  eq('61 政权折叠', atlasDegradeMode(61, 300), 'folded');
  eq('1201 边折叠', atlasDegradeMode(10, 1201), 'folded');
  eq('200 政权仍折叠', atlasDegradeMode(200, 100), 'folded');
  eq('201 政权降为矩阵', atlasDegradeMode(201, 100), 'matrix');
  eq('2001 边降为矩阵', atlasDegradeMode(10, 2001), 'matrix');
  eq(
    '阈值常量与文档 §11.3 一致',
    [ATLAS_FULL_POLITY_LIMIT, ATLAS_FOLD_POLITY_LIMIT, ROSTER_VIRTUAL_LIMIT, LINKPANEL_FOLD_LIMIT, FOCUS_PIN_LIMIT],
    [60, 200, 200, 200, 3]
  );
  eq('名录虚拟滚动阈值', [shouldVirtualizeRoster(200), shouldVirtualizeRoster(201)], [false, true]);
  eq('LinkPanel 折叠阈值', [shouldFoldLinkPanel(200), shouldFoldLinkPanel(201)], [false, true]);
};

// ---------- 4. 条约缎带与状态 ----------

const testTreatyRibbon = () => {
  const refs = makeRefs();
  const treaties = buildEntities(SUBMODULES as never).filter((entity) => entity.kind === 'treaty');
  const ribbons = buildRibbons(treaties, LINKS, POLITICS_CONFIG.statuses ?? [], refs as never);
  const ribbon = ribbons.find((candidate) => candidate.treaty.id === 'treaty1');
  check('条约缎带由 signatory_of 投影', !!ribbon);
  eq('缔约方数量', ribbon?.parties.length, 3);
  eq('缔约方标签实时解析', ribbon?.parties.map((party) => party.label), ['政权甲', '政权乙', '组织甲']);
  eq('缎带线型为双线、颜色为绿', [ribbon?.line, ribbon?.color], ['double', 'green']);
  eq('anchorA 取第一缔约方', ribbon?.anchorA, 'pol1');
  eq('anchorB 取第二缔约方', ribbon?.anchorB, 'pol2');

  const single = buildRibbons(
    treaties,
    [link('solo', P('polity', 'pol1'), P('treaty', 'treaty1'), 'politics.signatory_of')],
    POLITICS_CONFIG.statuses ?? [],
    refs as never
  ).find((candidate) => candidate.treaty.id === 'treaty1');
  eq('单缔约方时 anchorB 为 undefined（改画节点旌旗）', single?.anchorB, undefined);
  eq('单缔约方 parties 长度为 1', single?.parties.length, 1);

  const onlyLegacy = buildRibbons(
    treaties,
    [link('lg', P('polity', 'pol1'), P('treaty', 'treaty2'), LEGACY_TREATY_LINK_TYPE)],
    POLITICS_CONFIG.statuses ?? [],
    refs as never
  ).find((candidate) => candidate.treaty.id === 'treaty2');
  // 旧 politics.treaty_between 在展示层等价转换为 signatory_of（§3.8.1 / §4.6.6）
  eq('废弃条约边转换为缔约方', onlyLegacy?.parties.length, 1);
  eq('转换出的缔约方标 legacy', onlyLegacy?.parties[0]?.legacy, true);
  eq(
    '两端都不是条约的旧边只回报不投影',
    legacyTreatyEdges([
      link('lg2', P('polity', 'pol1'), P('polity', 'pol2'), LEGACY_TREATY_LINK_TYPE),
    ]).length,
    1
  );
  eq('isSignatoryLink 只认 signatory_of', [isSignatoryLink(LINKS[3]), isSignatoryLink(LINKS[11])], [true, false]);
  eq('isLegacyTreatyLink 只认废弃类型', [isLegacyTreatyLink(LINKS[11]), isLegacyTreatyLink(LINKS[3])], [true, false]);

  const dedup = projectSignatories(
    [
      link('d1', P('polity', 'pol1'), P('treaty', 'treaty1'), 'politics.signatory_of'),
      link('d2', P('polity', 'pol1'), P('treaty', 'treaty1'), 'politics.signatory_of'),
    ],
    refs.resolveName
  );
  eq('同一缔约方去重', dedup.get('treaty1')?.length, 1);

  const treatyEntities = buildEntities(SUBMODULES as never);
  const t1 = treatyEntities.find((entity) => entity.id === 'treaty1') as never;
  const t2 = treatyEntities.find((entity) => entity.id === 'treaty2') as never;
  eq('breachState 判为中止/违约', treatyStatusOf(t2, POLITICS_CONFIG.statuses ?? []), 'suspended');
  eq(
    'expiresAt 不按宿主时钟判定（古代 / 架空纪年不误判失效）',
    treatyStatusOf(
      { ...(t1 as Record<string, unknown>), meta: { expiresAt: '2000-01-01' } } as never,
      POLITICS_CONFIG.statuses ?? []
    ),
    'active'
  );
  eq(
    '无任何时间与状态信息判为 unknown（不伪造有效性）',
    treatyStatusOf({ ...(t1 as Record<string, unknown>), meta: {} } as never, []),
    'unknown'
  );
  eq(
    'isTerminal 状态判为 expired',
    treatyStatusOf(
      { ...(t1 as Record<string, unknown>), meta: { status: 'gone', effectiveAt: '110-01-01' } } as never,
      POLITICS_CONFIG.statuses ?? []
    ),
    'expired'
  );
};

// ---------- 5. 任职带与头像条 ----------

const testTenure = () => {
  const bands = tenureBandsOf(LINKS, 'fig1');
  eq('任职带来自 leads 边', bands.length, 1);
  eq('职位在边 meta 上', bands[0].officeTitle, '君主');
  eq('isPrimary 在边 meta 上', bands[0].isPrimary, true);
  eq('任职带指向边 id（编辑任期即编辑边）', bands[0].edgeId, 'lk-fig1');
  eq('任期来自 WorldLink.time', [bands[0].start, bands[0].end], ['100-01-01', undefined]);

  const fig2Bands = tenureBandsOf(LINKS, 'fig2');
  eq('member_of 也是任职边', fig2Bands.length, 1);
  eq('非主要任职', fig2Bands[0].isPrimary, false);
  eq('任职时间区间', [fig2Bands[0].start, fig2Bands[0].end], ['120-01-01', '130-01-01']);
  eq('无任职边的人物返回空', tenureBandsOf(LINKS, 'nope'), []);

  const figures = buildEntities(SUBMODULES as never).filter((entity) => entity.kind === 'figure');
  const core = coreFiguresOf(figures, LINKS, 5);
  eq('头像条主要任职排前', core.map((figure) => figure.id), ['fig1', 'fig2']);
  eq('头像条遵守上限', coreFiguresOf(figures, LINKS, 1).map((figure) => figure.id), ['fig1']);
};

// ---------- 6. 组织 scope 推导与组织树 ----------

const testScope = () => {
  eq(
    '只挂一个政权 -> intra_polity',
    deriveScope('org1', [link('a', P('organization', 'org1'), P('polity', 'pol1'), 'politics.subordinate_to')]),
    'intra_polity'
  );
  eq(
    '挂两个政权 -> cross_polity',
    deriveScope('org1', [
      link('a', P('organization', 'org1'), P('polity', 'pol1'), 'politics.subordinate_to'),
      link('b', P('organization', 'org1'), P('polity', 'pol2'), 'politics.subordinate_to'),
    ]),
    'cross_polity'
  );
  eq('无归属且用户标记独立 -> independent', deriveScope('org1', [], 'independent'), 'independent');
  eq('无归属时不猜，保留现有 scope', deriveScope('org1', [], 'cross_polity'), 'cross_polity');
  eq(
    '只挂上级组织、上溯不到政权 -> 不猜归属',
    deriveScope('org1', [link('a', P('organization', 'org1'), P('organization', 'org2'), 'politics.subordinate_to')]),
    'independent'
  );
  eq(
    '沿组织父链上溯到政权 -> intra_polity',
    deriveScope('org1', [
      link('a', P('organization', 'org1'), P('organization', 'org2'), 'politics.subordinate_to'),
      link('b', P('organization', 'org2'), P('polity', 'pol1'), 'politics.subordinate_to'),
    ]),
    'intra_polity'
  );
  eq(
    '显式 independent 优先于归属推导',
    deriveScope('org1', [link('a', P('organization', 'org1'), P('polity', 'pol1'), 'politics.subordinate_to')], 'independent'),
    'independent'
  );
  eq(
    'member_of 直挂政权也算归属',
    deriveScope('org1', [link('a', P('organization', 'org1'), P('polity', 'pol1'), 'politics.member_of')]),
    'intra_polity'
  );

  const tree = [
    { id: 'o1', parent_id: null },
    { id: 'o2', parent_id: 'o1' },
    { id: 'o3', parent_id: 'o2' },
  ] as never;
  eq('自指成环被拒', wouldCreateOrgCycle(tree, 'o1', 'o1'), true);
  eq('后代回挂成环被拒', wouldCreateOrgCycle(tree, 'o1', 'o3'), true);
  eq('前向挂载允许', wouldCreateOrgCycle(tree, 'o3', null), false);
  eq('组织深度', [orgDepthOf(tree, 'o1'), orgDepthOf(tree, 'o2'), orgDepthOf(tree, 'o3')], [1, 2, 3]);
};

// ---------- 7. 版图聚合（权重落在布局上） ----------

const atlasFixture = () => {
  const refs = makeRefs();
  const input = selectorInput(refs);
  const index = buildIndex(buildEntities(SUBMODULES as never));
  const ownership = buildOwnership(LINKS, index.polities, index.organizations);
  const ribbons = buildRibbons(index.treaties, LINKS, POLITICS_CONFIG.statuses ?? [], refs as never);
  const nodes = buildAtlasNodes(input as never, index, ownership, ribbons);
  return { refs, input, index, ownership, ribbons, nodes };
};

const testAtlas = () => {
  const { input, index, nodes } = atlasFixture();
  eq('政权数量', nodes.length, 2);
  eq('政权按 rank 降序', nodes.map((node) => node.polity.id), ['pol1', 'pol2']);
  eq('rank 权重', nodes.map((node) => node.weight), [30, 10]);
  eq('尺寸档由 rank 分档', nodes.map((node) => node.sizeTier), ['high', 'low']);
  eq('布局环由 rank 决定', nodes.map((node) => node.ring), [0, 1]);
  eq(
    '有且只有一个政权是最大档（唯一大卡片）',
    nodes.filter((node) => node.sizeTier === 'high').length,
    1
  );

  const [pol1, pol2] = nodes;
  eq('政权甲的卫星（scope = intra_polity）', pol1.satellites.map((org) => org.id), ['org1']);
  eq('政权乙没有卫星', pol2.satellites.map((org) => org.id), []);
  eq('政权甲核心人物', pol1.coreFigures.map((figure) => figure.id).sort(), ['fig1', 'fig2']);
  eq('政权甲任职带', pol1.tenureBands.map((band) => band.edgeId).sort(), ['lk-fig1', 'lk-fig2']);
  eq('政权乙没有任职带', pol2.tenureBands, []);
  eq(
    '政权甲的缎带（含旧 treaty_between 转换出的缔约方）',
    pol1.ribbons.map((ribbon) => ribbon.treaty.id),
    ['treaty1', 'treaty2']
  );
  check('政权甲的关联计数非零', pol1.relationCount.out + pol1.relationCount.in > 0);
  eq('终端状态政权标 terminal（画布淡出但名录与沿革保留）', pol2.terminal, true);
  eq('存续政权不标 terminal', pol1.terminal, false);

  const edges = buildEdgeViews(input as never, index);
  eq('小规模时降级模式为 full', atlasDegradeMode(index.polities.length, edges.length), 'full');
};

const testOwnership = () => {
  const index = buildIndex(buildEntities(SUBMODULES as never));
  const ownership = buildOwnership(LINKS, index.polities, index.organizations);
  eq('独立组织 scope', ownership.scopeOf.get('org2'), 'independent');
  eq('卫星组织 scope', ownership.scopeOf.get('org1'), 'intra_polity');
  eq('卫星归到政权甲', (ownership.satellitesOfPolity.get('pol1') ?? []).map((org) => org.id), ['org1']);
  eq('政权乙无卫星', ownership.satellitesOfPolity.get('pol2') ?? [], []);
  eq('单归属时无跨国吸附', ownership.anchorsOf.get('org1') ?? [], []);

  // 只挂上级组织（合法三层组织树写法）与完全无归属的组织，过去既不是卫星也不在独立势力带：
  // 实体在版图与名录里静默消失。它们必须以上溯结果归类，且至少落到势力带里可见。
  const orphanIndex = buildIndex(
    buildEntities([
      ...(SUBMODULES as never[]),
      { id: 'org_child', kind: 'organization', name: '下级组织', meta: {}, order_index: 5 },
      { id: 'org_rootless', kind: 'organization', name: '无归属组织', meta: {}, order_index: 6 },
    ] as never)
  );
  const orphanLinks = [
    ...LINKS,
    link('lk-child', P('organization', 'org_child'), P('organization', 'org1'), 'politics.subordinate_to'),
  ];
  const orphanOwnership = buildOwnership(
    orphanLinks,
    orphanIndex.polities,
    orphanIndex.organizations
  );
  eq(
    '只挂上级组织的组织沿链条上溯到政权甲',
    orphanOwnership.scopeOf.get('org_child'),
    'intra_polity'
  );
  eq(
    '上溯到的组织成为政权甲的卫星',
    (orphanOwnership.satellitesOfPolity.get('pol1') ?? []).map((org) => org.id).sort(),
    ['org1', 'org_child']
  );
  eq(
    '完全无归属的组织进入未归属清单（不再静默消失）',
    orphanOwnership.unattachedOf.map((org) => org.id),
    ['org_rootless']
  );
  const forces = buildIndependentForces(orphanIndex, orphanOwnership, orphanLinks);
  eq(
    '未归属组织出现在势力带且标 unattached',
    forces
      .filter((force) => force.unattached)
      .map((force) => force.entity.id)
      .sort(),
    ['org_rootless']
  );
  eq(
    '名录独立势力行与势力带一致',
    buildRosterIndependents(orphanIndex, orphanOwnership, orphanLinks)
      .filter((row) => row.unattached)
      .map((row) => row.entity.id),
    ['org_rootless']
  );

  // 组织树成环阻断：边口径（政治只写 subordinate_to 边）
  const cycleLinks = [
    link('c1', P('organization', 'org_child'), P('organization', 'org1'), 'politics.subordinate_to'),
  ];
  eq('子组织不能再挂回父级', wouldCreateOrgLinkCycle(cycleLinks, 'org1', 'org_child'), true);
  eq('自指挂载被拒', wouldCreateOrgLinkCycle([], 'org1', 'org1'), true);
  eq('无目标不算成环', wouldCreateOrgLinkCycle([], 'org1', null), false);
  eq('后代集合包含直接与间接下级', [...orgDescendantIds(cycleLinks, 'org1')], ['org_child']);
  eq('边口径层级：org_child 在第二层', orgEdgeDepthOf(cycleLinks, 'org_child'), 2);
  eq(
    'resolveOrganizationScope 不猜归属',
    resolveOrganizationScope([], 'org1').unattached,
    true
  );
};

// ---------- 8. 关系边层 ----------

const testEdges = () => {
  const refs = makeRefs();
  const input = selectorInput(refs);
  const index = buildIndex(buildEntities(SUBMODULES as never));
  const edges = buildEdgeViews(input as never, index);

  eq('只收一般关系边', edges.map((edge) => edge.linkType).sort(), [
    'politics.ally_of',
    'politics.at_war_with',
    'politics.vassal_of',
  ]);
  check(
    'signatory_of 不进入一般关系边层（条约在独立图层）',
    edges.every((edge) => edge.linkType !== 'politics.signatory_of')
  );
  check('treaty_between 不进入边层', edges.every((edge) => edge.linkType !== LEGACY_TREATY_LINK_TYPE));
  check(
    '跨模块边不进入关系层',
    edges.every((edge) => edge.from.module === 'politics' && edge.to.module === 'politics')
  );

  const ally = edges.find((edge) => edge.linkType === 'politics.ally_of');
  eq('同盟实线、对称无箭头', [ally?.lineStyle, ally?.directed], ['solid', false]);
  const war = edges.find((edge) => edge.linkType === 'politics.at_war_with');
  eq('敌对双线、对称', [war?.lineStyle, war?.directed], ['double', false]);
  eq('敌对读取 meta.strength（沙盘映射线宽）', war?.strength, 3);
  eq('敌对备注进入边卡', war?.note, '边境冲突');
  const vassal = edges.find((edge) => edge.linkType === 'politics.vassal_of');
  eq('附庸虚线、有向', [vassal?.lineStyle, vassal?.directed], ['dashed', true]);

  const trimmed = SUBMODULES.filter((submodule) => submodule.id !== 'pol2');
  const danglingEdges = buildEdgeViews(
    { ...input, submodules: trimmed } as never,
    buildIndex(buildEntities(trimmed as never))
  );
  check('失效引用标记 dangling 而不是静默丢失', danglingEdges.some((edge) => edge.dangling));

  const dup = [...edges, { ...edges[0], link: { ...edges[0].link, id: 'dup-1' } }];
  const aggregated = aggregateEdges(dup);
  eq(
    '同类边聚合为一条并保留成员 id',
    aggregated.find((edge) => edge.linkType === 'politics.ally_of')?.memberIds.length,
    2
  );
  eq('聚合后条目数少于原始边数', aggregated.length < dup.length, true);
};

// ---------- 9. 名录 ----------

const testRoster = () => {
  const { input, index, ownership, ribbons } = atlasFixture();
  const rows = buildRosterPolities(input as never, index, ownership, ribbons);
  eq('主行是政权且按 rank 排序', rows.map((row) => row.polity.id), ['pol1', 'pol2']);
  eq('政权甲卫星数', rows[0].satelliteCount, 1);
  eq('政权甲人物数', rows[0].figureCount, 2);
  eq('政权甲条约数（含旧边转换）', rows[0].treatyCount, 2);
  eq('人物子行任职', rows[0].figures.map((figure) => figure.office).sort(), ['君主', '摄政']);
  eq('政权乙没有子行', rows[1].organizations.length + rows[1].figures.length, 0);
  eq('终端状态政权仍出现在名录', rows[1].terminal, true);

  const treatyRows = buildRosterTreaties(input as never, ribbons);
  const t1 = treatyRows.find((row) => row.treaty.id === 'treaty1');
  eq('条约簿条款数', t1?.termCount, 2);
  eq('条约簿修订数', t1?.amendmentCount, 1);
  eq('条约簿缔约方数', t1?.parties.length, 3);
};

// ---------- 10. 沿革 ----------

const testChronicle = () => {
  const refs = makeRefs();
  const input = selectorInput(refs);
  const index = buildIndex(buildEntities(SUBMODULES as never));

  const anchors = chronicleAnchorsOf(input as never, 'pol1', refs as never);
  eq(
    '沿革锚点双来源合并（chronicle + history）',
    anchors.map((anchor) => anchor.source).sort(),
    ['chronicle', 'chronicle', 'history']
  );
  eq(
    '政治侧锚点来自 items.chronicle',
    anchors.filter((anchor) => anchor.source === 'chronicle').map((anchor) => anchor.label),
    ['建立', '扩张']
  );
  eq('历史锚点带跳转 ref', anchors.find((anchor) => anchor.source === 'history')?.ref, {
    module: 'history',
    kind: 'event',
    id: 'ev1',
  });
  eq(
    '历史锚点 linkType',
    anchors.find((anchor) => anchor.source === 'history')?.linkType,
    'history.involves'
  );
  eq('锚点按时间排序', anchors.map((anchor) => anchor.time.start), [
    '100-01-01',
    '150-01-01',
    '150-06-01',
  ]);
  eq('沿革消费的历史关联类型', CHRONICLE_HISTORY_LINK_TYPES, [
    'history.milestone_of',
    'history.occurs_at',
    'history.involves',
  ]);

  const lanes = buildChronicleLanes(input as never, index, refs as never);
  eq('主泳道是政权，组织在后', lanes.map((lane) => lane.entity.id), ['pol1', 'pol2', 'org1', 'org2']);
  eq('组织泳道标记 isOrganization', lanes.map((lane) => lane.isOrganization), [
    false,
    false,
    true,
    true,
  ]);
  // rank 是政权与组织的共同权重（§2.1 补充规则 1：人物不用等级尺寸）；
  // org1 与 pol2 同为 l1（rank 10），故两者泳道等高
  eq('泳道高度随 rank', lanes.map((lane) => lane.weight), [30, 10, 10, 0]);
  eq('人物不参与泳道（无等级尺寸）', lanes.some((lane) => lane.entity.kind === 'figure'), false);
  eq('政权甲泳道区间', [lanes[0].start, lanes[0].end], ['100-01-01', undefined]);

  const bands = buildChronicleTreatyBands(index, POLITICS_CONFIG.statuses ?? []);
  eq(
    '条约有效期带来源 effectiveAt/expiresAt',
    bands.map((band) => [band.treaty.id, band.start, band.end]),
    [
      ['treaty1', '110-01-01', '120-01-01'],
      ['treaty2', '115-01-01', undefined],
    ]
  );

  const range = chronicleRangeOf(lanes, bands);
  check('可解析端点推出时间范围', !!range?.start && !!range?.end);
  eq(
    '不可解析时间不参与范围（返回 undefined，不伪造刻度）',
    chronicleRangeOf(
      [
        {
          entity: lanes[0].entity,
          weight: 0,
          start: '约三百年前',
          end: undefined,
          terminal: false,
          anchors: [],
          isOrganization: false,
        },
      ],
      []
    ),
    undefined
  );
  const spans = chronicleSpansOf(lanes, bands);
  check(
    '刻度由可解析端点去重排序',
    spans.length > 0 && (spans[0].year ?? 0) <= (spans[spans.length - 1].year ?? 0)
  );
  eq('无端点时无刻度（UI 显示空态）', chronicleSpansOf([], []), []);

  const noHistory = buildChronicleLanes({ ...input, links: [] } as never, index, refs as never);
  check(
    '历史模块为空时沿革只显示政治侧锚点，不报错',
    noHistory
      .find((lane) => lane.entity.id === 'pol1')
      ?.anchors.every((anchor) => anchor.source === 'chronicle') === true
  );
};

// ---------- 11. 筛选与校验 ----------

const testFilterAndValidation = () => {
  const polities = buildEntities(SUBMODULES as never).filter((entity) => entity.kind === 'polity');
  eq('按 kind 过滤', filterPolities(polities, { ...EMPTY_POLITICS_FILTER, kind: 'figure' }), []);
  eq(
    '按等级过滤',
    filterPolities(polities, { ...EMPTY_POLITICS_FILTER, level: 'l3' }).map((p) => p.id),
    ['pol1']
  );
  eq(
    '按状态过滤',
    filterPolities(polities, { ...EMPTY_POLITICS_FILTER, status: 'gone' }).map((p) => p.id),
    ['pol2']
  );
  eq(
    '关键词命中名称',
    filterPolities(polities, { ...EMPTY_POLITICS_FILTER, search: '政权乙' }).map((p) => p.id),
    ['pol2']
  );
  eq(
    '关键词命中 meta.note',
    filterPolities(polities, { ...EMPTY_POLITICS_FILTER, search: '主干' }).map((p) => p.id),
    ['pol1']
  );
  eq(
    '筛选无结果返回空数组（不抛错）',
    filterPolities(polities, { ...EMPTY_POLITICS_FILTER, search: '不存在' }),
    []
  );
  check(
    'matchesFilter 可查自定义字段值',
    matchesFilter(
      {
        ...(polities[0] as never),
        meta: { ...(polities[0].meta as object), customFields: { motto: '以农立国' } },
      } as never,
      { ...EMPTY_POLITICS_FILTER, search: '以农立国' }
    )
  );

  eq('政权缺名称被拒', validatePoliticsForm('polity', { name: '  ' }), '名称不能为空');
  eq('政权缺等级被拒', validatePoliticsForm('polity', { name: '甲' }), '政权必须选择等级');
  eq('政权合通过', validatePoliticsForm('polity', { name: '甲', level: 'l3' }), null);
  eq('组织缺 scope 被拒', validatePoliticsForm('organization', { name: '甲' }), '组织必须选择归属范围');
  eq('组织合通过', validatePoliticsForm('organization', { name: '甲', scope: 'independent' }), null);
  eq('人物缺 characterId 被拒', validatePoliticsForm('figure', { name: '甲' }), '人物必须绑定全局角色');
  eq('人物合通过', validatePoliticsForm('figure', { name: '甲', characterId: 'c1' }), null);
  eq('条约只需名称', validatePoliticsForm('treaty', { name: '条约X' }), null);
};

// ---------- 12. 四类详情分段（权重落在数据形态上） ----------

const testDetailSections = () => {
  const { input, index, ownership, ribbons, refs } = atlasFixture();

  const polityDetail = buildFocusDetail(index.byId.get('pol1'), input as never, index, ownership, ribbons);
  eq('政权详情 kind', polityDetail?.kind, 'polity');
  const polityView = polityDetail?.kind === 'polity' ? polityDetail.view : undefined;
  eq('政体来自 items.government', polityView?.government.formLabel, '政体A');
  eq('人口来自 items.demographics', polityView?.demographics.population, 100000);
  eq('经济基础来自 items.economy_base', polityView?.economyBase.summary, '以农立国');
  eq('机构段为卫星组织', polityView?.organizations.map((org) => org.id), ['org1']);
  eq('人物段', polityView?.figures.map((figure) => figure.id).sort(), ['fig1', 'fig2']);
  eq(
    '条约段来自缔约投影（含旧边转换）',
    polityView?.treaties.map((entry) => entry.ribbon.treaty.id),
    ['treaty1', 'treaty2']
  );
  eq('沿革段来自 items.chronicle', polityView?.chronicle.map((entry) => entry.id), ['ce1', 'ce2']);
  eq('人口构成来自 politics.includes_race', polityView?.races.map((entry) => entry.ref.id), ['race1']);
  eq('种族占比存在边 meta 上', polityView?.races[0].share, 0.6);
  eq('历史事件段来自 history 入链', polityView?.historyEvents.map((entry) => entry.ref.id), ['ev1']);
  eq('经济关联分组齐全', polityView?.economyLinks.map((entry) => entry.id), [
    'economy.regulated_by',
    'economy.taxed_by',
    'economy.supplies',
    'economy.owned_by',
    'economy.currency_of',
  ]);

  const orgDetail = buildFocusDetail(index.byId.get('org1'), input as never, index, ownership, ribbons);
  eq('组织详情 kind', orgDetail?.kind, 'organization');
  const orgView = orgDetail?.kind === 'organization' ? orgDetail.view : undefined;
  eq('组织 scope', orgView?.scope, 'intra_polity');
  eq('宗旨来自 items.org_doctrine', orgView?.doctrine.creed, '守序');
  eq('架构来自 items.org_structure', orgView?.structure.map((entry) => entry.id), ['os1']);
  eq('组织上级', orgView?.parents.map((entry) => entry.ref.id), ['pol1']);

  const figDetail = buildFocusDetail(index.byId.get('fig1'), input as never, index, ownership, ribbons);
  const figView = figDetail?.kind === 'figure' ? figDetail.view : undefined;
  eq('人物身份来自 items.figure_identity', figView?.identity.publicStanding, '强硬');
  eq('绑定角色实时解析（不复制人物档案）', figView?.character?.name, '青云子');
  eq('人物任职带', figView?.bands.map((band) => band.edgeId), ['lk-fig1']);
  eq('任职目标', figView?.offices.map((office) => office.ref?.id), ['pol1']);

  const orphan = buildFocusDetail(index.byId.get('fig2'), input as never, index, ownership, ribbons);
  const orphanView = orphan?.kind === 'figure' ? orphan.view : undefined;
  eq('未绑定角色时 character 为 undefined（给修补入口）', orphanView?.character, undefined);
  eq('未绑定角色不阻塞任职带', orphanView?.bands.length, 1);

  const treatyDetail = buildFocusDetail(index.byId.get('treaty1'), input as never, index, ownership, ribbons);
  const treatyView = treatyDetail?.kind === 'treaty' ? treatyDetail.view : undefined;
  eq('缔约方', treatyView?.parties.map((party) => party.ref.id), ['pol1', 'pol2', 'org1']);
  eq('条款来自 items.treaty_terms', treatyView?.terms.map((term) => term.id), ['tm1', 'tm2']);
  eq('条款属性 binding/secret', [treatyView?.terms[0].binding, treatyView?.terms[1].secret], [true, true]);
  eq('修订来自 items.treaty_amendments', treatyView?.amendments.map((amendment) => amendment.id), ['am1']);
  eq('多缔约方时不画单方旌旗', treatyView?.singleParty, false);

  const soloLinks = [LINKS[3]];
  const solo = buildFocusDetail(
    index.byId.get('treaty1'),
    { ...input, links: soloLinks } as never,
    index,
    ownership,
    buildRibbons(index.treaties, soloLinks, POLITICS_CONFIG.statuses ?? [], refs as never)
  );
  const soloView = solo?.kind === 'treaty' ? solo.view : undefined;
  eq('单缔约方时 singleParty = true（画节点旌旗）', soloView?.singleParty, true);
  eq(
    '未知实体返回 undefined',
    buildFocusDetail(undefined, input as never, index, ownership, ribbons),
    undefined
  );
};

// ---------- 13. 计数与分组 ----------

const testCounts = () => {
  const ref = entityRefOf(SUBMODULES[0] as never);
  const out = splitForRef(LINKS, ref);
  eq(
    '政权甲出链（已转换的废弃条约边不再计入）',
    out.outgoing.map((each) => each.link_type).sort(),
    ['politics.ally_of', 'politics.includes_race', 'politics.signatory_of']
  );
  eq(
    '废弃条约边保留在原始数据里（不删除）',
    LINKS.filter((each) => isLegacyTreatyLink(each)).length,
    1
  );
  // signatory_of 的有向语义是「政权/组织 -> 条约」，所以政权永远只会是它的 source，
  // 不会作为 target 出现在入链里（缔约方集合由 signatory_of 投影得到，见 buildRibbons）。
  eq('政权甲入链', out.incoming.map((each) => each.link_type).sort(), [
    'history.involves',
    'politics.at_war_with',
    'politics.leads',
    'politics.member_of',
    'politics.subordinate_to',
    'politics.vassal_of',
  ]);
  const counts = countForRef(LINKS, ref);
  eq('出/入计数与分组一致（废弃边已剔除）', [counts.out, counts.in], [3, 6]);
  eq('无关联实体计数为 0', countForRef(LINKS, politicsRefOf('nope', 'polity')), { out: 0, in: 0 });
};

// ---------- 14. DOM：三视图壳 / 过滤器 / 空态 / 条约簿 / 详情 ----------

const findButtons = (view: Mounted, text: string) =>
  view.queryAll('button').filter((button) => (button.textContent ?? '').includes(text));

const testDomEmpty = async () => {
  const client = seededClient();
  client.setQueryData(worldbuildingKeys.world(WORLD_ID), EMPTY_WORLD);
  client.setQueryData(worldbuildingKeys.linkRegistry(), REGISTRY);
  client.setQueryData(['characters-simple', PROJECT_ID], CHARACTERS);
  client.setQueryData(worldbuildingKeys.links(WORLD_ID), []);
  client.setQueryData(worldbuildingKeys.linkCounts(WORLD_ID), []);
  const view = mount(
    <World client={client} level="sketch">
      <PoliticsView worldId={WORLD_ID} moduleId={POLITICS_MODULE_ID} onNavigateToEntity={() => {}} />
    </World>
  );
  await settle();

  check('空世界渲染 politics-view', !!view.query('[data-testid="politics-view"]'));
  check('空世界渲染空态', !!view.query('[data-testid="politics-empty"]'));
  check('空世界渲染 3 分钟路径', view.text().includes('3 分钟最小可用路径'));

  const tabs = view.queryAll('[data-testid^="politics-view-tab-"]');
  eq('视图切换只有三个', tabs.length, 3);
  eq(
    '视图切换为 版图/名录/沿革',
    tabs.map((tab) => tab.textContent ?? ''),
    ['版图', '名录', '沿革']
  );
  check(
    '没有四个平级 Tab（国家 / 领袖不作为一级视图）',
    !['国家', '领袖'].some((label) => tabs.some((tab) => (tab.textContent ?? '') === label))
  );

  const kindButtons = view.queryAll('[data-testid="politics-kind-filter"] button');
  eq('层级导航是五个过滤器', kindButtons.length, 5);
  eq(
    '层级导航项',
    kindButtons.map((button) => (button.textContent ?? '').replace(/\d+$/, '')),
    ['全部', '政权', '组织', '人物', '条约']
  );

  check('空态有创建第一个政权入口', findButtons(view, '新建政权').length > 0);
  check('空态有了解权力版图入口', findButtons(view, '了解权力版图').length > 0);
  eq('sketch 档不提供模块配置入口', findButtons(view, '模块配置').length, 0);
  check('sketch 档仍可直接新建政权', !!view.query('[data-testid="new-polity"]'));

  view.unmount();
};

const testDomData = async () => {
  const client = seededClient();
  seedWorld(client);
  const view = mount(
    <World client={client} level="structure">
      <PoliticsView worldId={WORLD_ID} moduleId={POLITICS_MODULE_ID} onNavigateToEntity={() => {}} />
    </World>
  );
  await settle();

  const root = view.query('[data-testid="politics-view"]');
  check('渲染 politics-view', !!root);
  eq('默认视图为 atlas', root?.getAttribute('data-view'), 'atlas');
  eq('结构档提供模块配置入口', findButtons(view, '模块配置').length, 1);
  check('提供搜索控件', !!view.query('[data-testid="politics-search"]'));
  check('条约簿入口存在', !!view.query('[data-testid="open-treaty-book"]'));
  check('夹具政权名出现在页面文本中', view.text().includes('政权甲'));

  for (const id of ['roster', 'chronicle', 'atlas']) {
    const ok = clickTestId(view, `politics-view-tab-${id}`);
    await settle(4);
    eq(
      `可切换到 ${id} 视图且不崩`,
      ok && view.query('[data-testid="politics-view"]')?.getAttribute('data-view'),
      id
    );
  }

  const kindButtons = view.queryAll('[data-testid="politics-kind-filter"] button');
  const treatyFilter = kindButtons.find((button) => (button.textContent ?? '').includes('条约'));
  if (treatyFilter) flushSync(() => (treatyFilter as HTMLButtonElement).click());
  await settle(4);
  eq(
    '切换层级过滤器后仍是三视图壳（过滤器不是四个页面）',
    view.queryAll('[data-testid^="politics-view-tab-"]').length,
    3
  );
  check('切换过滤器后页面仍渲染', !!view.query('[data-testid="politics-view"]'));

  const polityButton = [...view.queryAll('button, [role="button"]')].find((element) =>
    (element.textContent ?? '').includes('政权甲')
  );
  if (polityButton) {
    flushSync(() => (polityButton as HTMLElement).click());
    await settle(6);
    eq('点击政权后打开聚焦详情抽屉', !!view.query('[data-testid="focus-panel"]'), true);
    check('聚焦详情包含统一关联面板标题', view.text().includes('关联'));
  } else {
    check('夹具政权名可在画布命中（可交互元素）', false);
  }

  const opened = clickTestId(view, 'open-treaty-book');
  await settle(4);
  check('条约簿可打开', opened && !!view.query('[data-testid="treaty-book"]'));
  // 只在条约簿内部找关闭按钮：全局找「关闭」会误命中聚焦详情抽屉的同名按钮
  const closeButton = view.query('[data-testid="treaty-book"] [data-testid="treaty-book-close"]');
  if (closeButton) {
    flushSync(() => (closeButton as HTMLButtonElement).click());
    await settle(4);
  }
  check('条约簿可关闭', !!closeButton && !view.query('[data-testid="treaty-book"]'));

  check('页面无 emoji 文本', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(view.text()));

  view.unmount();
};

const testDomMissingWorld = async () => {
  const client = seededClient();
  client.setQueryData(worldbuildingKeys.linkRegistry(), REGISTRY);
  const view = mount(
    <World client={client} level="structure">
      <PoliticsView worldId="missing-world" moduleId={POLITICS_MODULE_ID} onNavigateToEntity={() => {}} />
    </World>
  );
  await settle();
  check('缺世界数据时不抛错（渲染壳或空态）', !!view.query('[data-testid="politics-view"]'));
  view.unmount();
};

// ---------- 运行 ----------

const run = async () => {
  try {
    testConfigContract();
    testMetaReaders();
    testWeightAndThresholds();
    testTreatyRibbon();
    testTenure();
    testScope();
    testAtlas();
    testOwnership();
    testEdges();
    testRoster();
    testChronicle();
    testFilterAndValidation();
    testDetailSections();
    testCounts();
    await testDomEmpty();
    await testDomData();
    await testDomMissingWorld();
  } catch (error) {
    check(
      'harness 未捕获异常',
      false,
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    );
  }

  (window as unknown as Record<string, unknown>).__PHASE4_TESTS__ = {
    done: true,
    checks,
  } satisfies { done: boolean; checks: Check[] };
};

void run();
