/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 3 回归用例（浏览器侧，P3-T10）
 *
 * 由 tests/worldbuilding/phase3.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE3_TESTS__。分两类：
 * 1) 纯函数：moduleConfig 解析/校验、种族血缘、体系阶梯与环路、典籍卷册（最强不变量）；
 * 2) 组件：RacesView / SystemsView 在预置缓存下的 DOM 行为（空态、网格、阶梯、典籍、降级）。
 * 不发任何网络请求：TanStack Query 缓存由 seedWorld 预置，mutation 不参与断言。
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ComplexityProvider } from '@/components/common/ComplexitySwitcher';
import { RacesView } from '@/components/Worldbuilding/RacesView';
import { SystemsView } from '@/components/Worldbuilding/SystemsView';
import { WorldbuildingView } from '@/components/Worldbuilding/WorldbuildingView';
import { useProjectStore } from '@/stores/projectStore';
import { worldbuildingKeys } from '@/components/Worldbuilding/hooks/worldQueryKeys';
import { metaFromRaceForm, mergeEmblemMeta } from '@/components/Worldbuilding/RacesView/hooks/useRaces';
import {
  RACES_CONFIG_DEFAULTS,
  RACES_TERM_DEFAULTS,
  EMBLEM_PALETTE,
  emblemColorOf,
  emblemLetter,
  resolveRacesConfig,
  validateRaceKind,
} from '@/components/Worldbuilding/RacesView/config';
import {
  RACE_KINDS,
  RACE_LINEAGE_LIMIT,
  atlasContentOf,
  buildLineage,
  buildRaceTree,
  canReparent,
  flattenRaceTree,
  raceRefOf,
  raceRelationKinds,
  readRaceMeta,
  relationKindDef,
  relationKindOfEdge,
  shouldDegradeLineage,
} from '@/components/Worldbuilding/RacesView/types';
import { metaFromTierForm, metaFromMemberForm, metaFromSystemForm } from '@/components/Worldbuilding/SystemsView/hooks/useSystems';
import {
  DEFAULT_RANK_STEP,
  SYSTEM_KINDS,
  SYSTEM_NODE_LIMIT,
  buildCodexVolumes,
  buildStair,
  isTierNode,
  nextRankOf,
  normalizeTierRanks,
  readSystemMeta,
  readTierMeta,
  shouldDegradeStair,
  sortTiersByRank,
  toSystemNode,
  wouldCreateStairCycle,
} from '@/components/Worldbuilding/SystemsView/types';
import {
  DEFAULT_NODE_STYLES,
  SYSTEMS_TERM_DEFAULTS,
  nodeStyleOf,
  rankStepOf,
  resolveSystemsConfig,
  tierTermOf,
  validateSystemKind,
} from '@/components/Worldbuilding/SystemsView/config';
import {
  customFieldsOf,
  kindDefOf,
  kindDefsOf,
  kindDepth,
  mergeMeta,
  mergeModuleConfig,
  parseModuleConfig,
  readMetaString,
  statusLabelOf,
  termOf,
  toKindId,
  validateEntityType,
} from '@/components/Worldbuilding/shared/moduleConfig';
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

const clickIncludes = (view: Mounted, text: string): boolean => {
  const button = [...view.queryAll('button')].find((candidate) =>
    (candidate.textContent ?? '').includes(text)
  );
  if (button) flushSync(() => (button as HTMLButtonElement).click());
  return !!button;
};

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

// ---------- 数据夹具 ----------

const WORLD_ID = 'w1';
const PROJECT_ID = 'p1';
const RACES_MODULE_ID = 'm-races';
const SYSTEMS_MODULE_ID = 'm-systems';
const HISTORY_MODULE_ID = 'm-history';

const ref = (module: string, kind: string, id: string): EntityRef => ({ module, kind, id });

interface SubFixtureInput {
  id: string;
  moduleId: string;
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
  moduleId,
  name,
  kind,
  order,
  parentId = null,
  meta = null,
  color = null,
  icon = null,
}: SubFixtureInput) => ({
  id,
  module_id: moduleId,
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
  moduleId: string,
  submoduleId: string,
  name: string,
  content: Record<string, unknown>
) => ({
  id,
  module_id: moduleId,
  submodule_id: submoduleId,
  name,
  content,
  order_index: 0,
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
  template_id: WORLD_ID,
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

const RACES_SUBS = [
  sub({
    id: 'r1',
    moduleId: RACES_MODULE_ID,
    name: '人类',
    kind: 'race',
    order: 0,
    meta: {
      tagline: '善于开拓',
      traits: ['坚韧', '务实'],
      emblem: { icon: 'book-marked', color: '#0f766e' },
      unknownKey: '保留我',
    },
  }),
  sub({
    id: 'r2',
    moduleId: RACES_MODULE_ID,
    name: '精灵',
    kind: 'race',
    order: 1,
    meta: { tagline: '与林共生' },
  }),
  sub({
    id: 'sr1',
    moduleId: RACES_MODULE_ID,
    name: '森精灵',
    kind: 'subrace',
    order: 0,
    parentId: 'r2',
    meta: { tagline: '林间支系' },
  }),
  sub({
    id: 'r3',
    moduleId: RACES_MODULE_ID,
    name: '矮人',
    kind: 'race',
    order: 2,
    meta: { habitatText: '北岭' },
  }),
];

const SYSTEMS_SUBS = [
  sub({
    id: 's1',
    moduleId: SYSTEMS_MODULE_ID,
    name: '炼气体系',
    kind: 'system',
    order: 0,
    meta: { tagline: '循序而进', rankDirection: 'ascending' },
  }),
  sub({
    id: 't1',
    moduleId: SYSTEMS_MODULE_ID,
    name: '一阶',
    kind: 'tier',
    order: 0,
    parentId: 's1',
    meta: { rank: 10, branch: '主线' },
  }),
  sub({
    id: 't2',
    moduleId: SYSTEMS_MODULE_ID,
    name: '二阶',
    kind: 'tier',
    order: 1,
    parentId: 's1',
    meta: { rank: 20, breakthrough: '心法贯通' },
  }),
  sub({
    id: 't3',
    moduleId: SYSTEMS_MODULE_ID,
    name: '三阶',
    kind: 'tier',
    order: 2,
    parentId: 's1',
    meta: { rank: 30 },
  }),
  sub({
    id: 'a1',
    moduleId: SYSTEMS_MODULE_ID,
    name: '纳气',
    kind: 'ability',
    order: 3,
    parentId: 's1',
    meta: { nodeType: 'ability', summary: '吸纳灵气', reusable: true },
  }),
  sub({
    id: 'c1',
    moduleId: SYSTEMS_MODULE_ID,
    name: '耗材',
    kind: 'cost',
    order: 4,
    parentId: 's1',
    meta: { nodeType: 'cost', costHint: '灵石' },
  }),
];

const RACES_ITEMS = [
  itemFixture('i1', RACES_MODULE_ID, 'r1', 'atlas.profile', {
    appearance: '高大',
    lifespan: '百年',
  }),
  itemFixture('i2', RACES_MODULE_ID, 'r1', 'atlas.talents', { talents: '善战' }),
];

const SYSTEMS_ITEMS = [
  itemFixture('i3', SYSTEMS_MODULE_ID, 't2', 'tier.breakthrough', {
    condition: '心法贯通',
    examples: '三例',
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
  link_count: 8,
  modules: [
    moduleFixture(RACES_MODULE_ID, 'races', '种族', 4, RACES_SUBS, RACES_ITEMS, {
      entityTypes: RACE_KINDS,
      relationKinds: [
        { id: 'bloodline', label: '血缘', color: 'emerald', lineStyle: 'double' },
      ],
    }),
    moduleFixture(SYSTEMS_MODULE_ID, 'systems', '体系', 5, SYSTEMS_SUBS, SYSTEMS_ITEMS, {
      entityTypes: SYSTEM_KINDS,
      tierTerm: '阶位',
      rankStep: 10,
    }),
    moduleFixture(HISTORY_MODULE_ID, 'history', '历史', 1, [
      sub({ id: 'e1', moduleId: HISTORY_MODULE_ID, name: '赤壁之战', kind: 'event', order: 0 }),
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

const LINK_FIXTURE: WorldLink[] = [
  link('l1', ref('races', 'race', 'r1'), ref('races', 'race', 'r2'), 'races.related_to', {
    directed: false,
    meta: { relationKind: 'bloodline' },
  }),
  link('l2', ref('races', 'race', 'r1'), ref('character', 'character', 'c1'), 'races.notable_figure'),
  link('l3', ref('races', 'race', 'r3'), ref('races', 'race', 'r1'), 'races.related_to', {
    directed: false,
    meta: { relationKind: 'hostility' },
  }),
  link('l4', ref('systems', 'tier', 't1'), ref('systems', 'tier', 't2'), 'systems.advances_to'),
  link('l5', ref('systems', 'tier', 't2'), ref('systems', 'tier', 't3'), 'systems.advances_to'),
  link('l6', ref('systems', 'tier', 't1'), ref('systems', 'ability', 'a1'), 'systems.grants'),
  link('l7', ref('systems', 'tier', 't1'), ref('economy', 'resource', 'res1'), 'systems.costs'),
  link('l8', ref('character', 'character', 'c1'), ref('systems', 'tier', 't2'), 'character.attained'),
];

const REGISTRY: LinkTypeDef[] = [
  {
    id: 'races.related_to',
    label: '血缘/渊源',
    reverse_label: '血缘/渊源',
    directed: false,
    icon: 'git-merge',
    color: 'emerald',
    line_style: 'double',
    group: 'races',
    // 与真实注册表一致（link_registry.py：races.related_to 限定 race ↔ race）；
    // EntityPicker.filterLinkTypes 会把 null 当作「任意端点」，fixture 失真会误证错误行为
    source: [ref('races', 'race', '*')],
    target: [ref('races', 'race', '*')],
  },
  {
    id: 'races.notable_figure',
    label: '代表人物',
    reverse_label: '代表种族',
    directed: true,
    icon: 'user-round',
    color: 'teal',
    line_style: 'solid',
    group: 'races',
    source: [ref('races', 'race', '*')],
    target: [ref('character', 'character', '*')],
  },
  {
    id: 'races.inhabits',
    label: '聚居',
    reverse_label: '有该族聚居',
    directed: true,
    icon: 'map-pin',
    color: 'teal',
    line_style: 'solid',
    group: 'races',
    source: [ref('races', 'race', '*'), ref('races', 'subrace', '*')],
    target: [ref('map', 'region', '*')],
  },
  {
    id: 'systems.advances_to',
    label: '进阶',
    reverse_label: '前身',
    directed: true,
    icon: 'arrow-up-right',
    color: 'violet',
    line_style: 'solid',
    group: 'systems',
    source: [ref('systems', 'tier', '*')],
    target: [ref('systems', 'tier', '*')],
  },
  {
    id: 'systems.requires',
    label: '前置',
    reverse_label: '后续',
    directed: true,
    icon: 'lock',
    color: 'violet',
    line_style: 'dashed',
    group: 'systems',
    source: [ref('systems', 'tier', '*'), ref('systems', 'ability', '*')],
    target: [ref('systems', 'tier', '*'), ref('systems', 'ability', '*')],
  },
  {
    id: 'systems.grants',
    label: '赋予',
    reverse_label: '由该节点赋予',
    directed: true,
    icon: 'gift',
    color: 'purple',
    line_style: 'solid',
    group: 'systems',
    source: [ref('systems', 'tier', '*'), ref('systems', 'system', '*')],
    target: [ref('systems', 'ability', '*')],
  },
  {
    id: 'systems.costs',
    label: '代价',
    reverse_label: '消耗于',
    directed: true,
    icon: 'flame',
    color: 'orange',
    line_style: 'dashed',
    group: 'systems',
    source: [ref('systems', 'ability', '*'), ref('systems', 'tier', '*')],
    target: [ref('economy', 'resource', '*'), ref('economy', 'good', '*')],
  },
  {
    id: 'character.attained',
    label: '达到境界',
    reverse_label: '境界达成者',
    directed: true,
    icon: 'chevrons-up',
    color: 'violet',
    line_style: 'solid',
    group: 'character',
    source: [ref('character', 'character', '*')],
    target: [ref('systems', 'tier', '*')],
  },
  {
    id: 'character.belongs_to_race',
    label: '种族归属',
    reverse_label: '拥有族裔',
    directed: true,
    icon: 'user-round',
    color: 'teal',
    line_style: 'solid',
    group: 'character',
    source: [ref('character', 'character', '*')],
    target: [ref('races', 'race', '*'), ref('races', 'subrace', '*')],
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
  {
    id: 'core.references',
    label: '引用',
    reverse_label: '被引用',
    directed: true,
    icon: 'link',
    color: 'slate',
    line_style: 'dotted',
    group: 'general',
    source: null,
    target: null,
  },
  {
    id: 'custom.link',
    label: '自定义关联',
    reverse_label: '自定义关联',
    directed: true,
    icon: 'link-2',
    color: 'neutral',
    line_style: 'dotted',
    group: 'custom',
    source: null,
    target: null,
  },
];

const CHARACTERS = [
  { id: 'c1', name: '青云子' },
  { id: 'c2', name: '无名氏' },
];

const seedWorld = (client: QueryClient, world: WorldWithModules, links: WorldLink[] = LINK_FIXTURE) => {
  client.setQueryData(worldbuildingKeys.world(WORLD_ID), world);
  client.setQueryData(worldbuildingKeys.linkRegistry(), REGISTRY);
  client.setQueryData(['characters-simple', PROJECT_ID], CHARACTERS);
  client.setQueryData(worldbuildingKeys.links(WORLD_ID), links);
  client.setQueryData(worldbuildingKeys.linkCounts(WORLD_ID), [
    { module: 'races', outgoing: 3, incoming: 1, total: 4 },
    { module: 'systems', outgoing: 4, incoming: 1, total: 5 },
  ]);
};

// ---------- 1. moduleConfig 纯函数 ----------

const testModuleConfig = () => {
  eq('parseModuleConfig(null) 归一化为空对象', parseModuleConfig(null), {});
  eq('parseModuleConfig 丢弃数组', parseModuleConfig([1, 2]), {});

  const raw = { entityTypes: [{ id: 'race', label: '族裔' }], unknownKey: { deep: 1 } };
  const parsed = parseModuleConfig(raw);
  eq('parseModuleConfig 保留未知键', parsed.unknownKey, { deep: 1 });

  const merged = mergeModuleConfig(parsed, { displayMode: 'atlas', tierTerm: undefined });
  eq('mergeModuleConfig 写入新键', merged.displayMode, 'atlas');
  check('mergeModuleConfig 忽略 undefined', !('tierTerm' in merged), merged);

  eq(
    'mergeMeta 保留未知字段',
    mergeMeta({ keep: 1, drop: 2, customFields: { a: 'x' } }, { drop: undefined, next: 3 }),
    { keep: 1, customFields: { a: 'x' }, next: 3 }
  );
  eq('mergeMeta 空基底', mergeMeta(null, { a: 1 }), { a: 1 });

  const kinds = kindDefsOf(parsed, RACE_KINDS);
  check('kindDefsOf 内置顺序在前', kinds[0].id === 'race' && kinds[1].id === 'subrace', kinds);
  check('kindDefsOf 配置覆盖展示信息', kindDefOf(parsed, 'race', RACE_KINDS)?.label === '族裔');

  const withCustom = parseModuleConfig({
    entityTypes: [
      ...RACE_KINDS,
      { id: 'custom_clan', label: '部族', parentKind: 'race' },
    ],
  });
  const customKinds = kindDefsOf(withCustom, RACE_KINDS);
  check('kindDefsOf 追加自定义 kind', customKinds.some((def) => def.id === 'custom_clan'));
  eq('kindDepth 根 kind 为 1', kindDepth(withCustom, 'race', RACE_KINDS), 1);
  eq('kindDepth 子级为 2', kindDepth(withCustom, 'subrace', RACE_KINDS), 2);
  eq('kindDepth 自定义为 2', kindDepth(withCustom, 'custom_clan', RACE_KINDS), 2);

  check(
    'validateEntityType 拒绝覆盖内置',
    validateEntityType(withCustom, { id: 'race', label: 'x' }, { builtins: RACE_KINDS, maxDepth: 2 }) !== null
  );
  check(
    'validateEntityType 要求 custom_ 前缀',
    validateEntityType(withCustom, { id: 'clan', label: 'x', parentKind: 'race' }, {
      builtins: RACE_KINDS,
      maxDepth: 2,
    }) !== null
  );
  check(
    'validateEntityType 要求 parentKind',
    validateEntityType(withCustom, { id: 'custom_x', label: 'x' }, {
      builtins: RACE_KINDS,
      maxDepth: 2,
    }) !== null
  );
  check(
    'validateEntityType 拒绝不存在的 parentKind',
    validateEntityType(withCustom, { id: 'custom_x', label: 'x', parentKind: 'custom_none' }, {
      builtins: RACE_KINDS,
      maxDepth: 2,
    }) !== null
  );
  check(
    'validateEntityType 拒绝超深（种族 3 层）',
    validateEntityType(withCustom, { id: 'custom_deep', label: 'x', parentKind: 'subrace' }, {
      builtins: RACE_KINDS,
      maxDepth: 2,
    }) !== null
  );
  eq(
    'validateEntityType 合法自定义 kind 通过',
    validateEntityType(withCustom, { id: 'custom_clan2', label: '部族二', parentKind: 'race' }, {
      builtins: RACE_KINDS,
      maxDepth: 2,
    }),
    null
  );

  check('toKindId 生成 custom_ 前缀', toKindId('部族', []).startsWith('custom_'));
  eq('toKindId 去重', toKindId('clan', ['custom_clan']), 'custom_clan_2');

  eq('statusLabelOf 回退原值', statusLabelOf({}, 'alive'), 'alive');
  eq(
    'statusLabelOf 命中配置',
    statusLabelOf({ statuses: [{ id: 'alive', label: '存续' }] }, 'alive'),
    '存续'
  );
  eq('termOf 模块覆盖世界', termOf({ terminology: { race: '族裔' } }, 'race', '种族', { race: '种族' }), '族裔');
  eq('termOf 回退世界术语', termOf({}, 'race', '种族', { race: '人种' }), '人种');
  eq('termOf 回退默认', termOf({}, 'race', '种族'), '种族');

  const defaultFieldKinds = kindDefsOf({}, [
    { id: 'ability', label: '能力', defaultFields: [{ id: 'summary', label: '摘要', type: 'text' }] },
  ]);
  eq(
    'customFieldsOf 回退 defaultFields',
    customFieldsOf({}, 'ability', defaultFieldKinds).length,
    1
  );
  eq(
    'customFieldsOf 优先 fieldSchema',
    customFieldsOf({ fieldSchema: { ability: [{ id: 'x', label: 'X', type: 'text' }] } }, 'ability', defaultFieldKinds)[0].id,
    'x'
  );
  eq('readMetaString 空值', readMetaString({ a: '' }, 'a'), undefined);
};

// ---------- 2. 种族纯函数 ----------

const testRacesPure = () => {
  const subs = RACES_SUBS as never[];
  const tree = buildRaceTree(subs);
  eq('buildRaceTree 顶层数量', tree.length, 3);
  const flat = flattenRaceTree(tree);
  eq('flattenRaceTree 全量数量', flat.length, 4);
  eq('索精灵挂在精灵下', tree.find((node) => node.name === '精灵')?.children[0].name, '森精灵');
  eq('第三层不存在', flattenRaceTree(tree).every((node) => node.children.every((child) => child.children.length === 0)), true);

  const meta = readRaceMeta(RACES_SUBS[0].meta);
  eq('readRaceMeta 读 tagline', meta.tagline, '善于开拓');
  eq('readRaceMeta 读 traits', meta.traits, ['坚韧', '务实']);
  eq('readRaceMeta 保留未知字段', meta.raw.unknownKey, '保留我');

  const lineage = buildLineage(subs, LINK_FIXTURE, RACES_CONFIG_DEFAULTS);
  eq('buildLineage 跨族边数量', lineage.crossEdges.length, 2);
  eq('buildLineage 不降级', lineage.degraded, false);
  eq('血缘语义取 meta.relationKind', lineage.crossEdges[0].relationKind, 'bloodline');
  const fallbackKind = relationKindDef('hostility', raceRelationKinds(RACES_CONFIG_DEFAULTS));
  eq('relationKindDef 命中', fallbackKind.label, '敌对');
  eq('relationKindDef 未知回退原值', relationKindDef('zzz', []).label, 'zzz');
  eq(
    'relationKindOfEdge 无 meta 时取首条',
    relationKindOfEdge(link('x', ref('races', 'race', 'a'), ref('races', 'race', 'b'), 'races.related_to'), raceRelationKinds({})),
    'bloodline'
  );
  eq('shouldDegradeLineage 阈值内', shouldDegradeLineage(RACE_LINEAGE_LIMIT), false);
  eq('shouldDegradeLineage 超阈值', shouldDegradeLineage(RACE_LINEAGE_LIMIT + 1), true);

  check('canReparent 拒绝自指', !canReparent(flat, 'r2', 'r2'));
  check('canReparent 拒绝挂到自己的后代', !canReparent(flat, 'r2', 'sr1'));
  check('canReparent 允许换到另一根', canReparent(flat, 'sr1', 'r1'));
  check('canReparent 允许升为顶层', canReparent(flat, 'sr1', null));

  eq('emblemLetter 取首字', emblemLetter('人类'), '人');
  eq('emblemLetter 空名兜底', emblemLetter('  '), '?');
  const human = flat.find((node) => node.id === 'r1')!;
  eq('emblemColorOf 用 meta.emblem.color', emblemColorOf(human, RACES_CONFIG_DEFAULTS), '#0f766e');
  const elf = flat.find((node) => node.id === 'r2')!;
  eq('emblemColorOf 回退色板首项', emblemColorOf(elf, RACES_CONFIG_DEFAULTS), EMBLEM_PALETTE[0]);

  eq('atlasContentOf 读 item content', atlasContentOf(RACES_ITEMS as never[], 'r1', 'atlas.profile').appearance, '高大');
  eq('atlasContentOf 未命中为空对象', atlasContentOf(RACES_ITEMS as never[], 'r1', 'atlas.missing'), {});

  const resolved = resolveRacesConfig({});
  eq('resolveRacesConfig 默认 displayMode', resolved.displayMode, 'atlas');
  eq('resolveRacesConfig 默认复杂度', resolved.defaultComplexity, 'sketch');
  eq('RACES_TERM_DEFAULTS 含 atlas', RACES_TERM_DEFAULTS.atlas, '图鉴');
  eq('raceRefOf 形状', raceRefOf('r1'), { module: 'races', kind: 'race', id: 'r1' });

  check('validateRaceKind 拒绝第三层', validateRaceKind({}, { id: 'custom_x', label: 'x', parentKind: 'subrace' }) !== null);
  eq('validateRaceKind 允许第二层', validateRaceKind({}, { id: 'custom_x', label: 'x', parentKind: 'race' }), null);

  const formMeta = metaFromRaceForm({ name: 'x', tagline: '  ', traits: [' a ', ''], emblemColor: '#123456' });
  check('metaFromRaceForm 空 tagline 不写入', formMeta.tagline === undefined, formMeta);
  eq('metaFromRaceForm 过滤空标签', formMeta.traits, ['a']);
  eq('metaFromRaceForm 写 emblem', formMeta.emblem, { icon: undefined, color: '#123456' });
  eq('metaFromRaceForm 未提交字段不出现', 'habitatText' in formMeta, false);
  eq(
    'mergeEmblemMeta 保留 motif 等既有键',
    mergeEmblemMeta({ motif: '月', icon: 'moon' }, { color: '#111111' }),
    { motif: '月', icon: 'moon', color: '#111111' }
  );
  eq('mergeEmblemMeta 空基底', mergeEmblemMeta(undefined, { icon: 'leaf' }), { icon: 'leaf' });
};

// ---------- 3. 体系纯函数 ----------

const systemNodeOf = (id: string) =>
  toSystemNode((SYSTEMS_SUBS as never[]).find((node: { id: string }) => node.id === id) as never);

const testSystemsPure = () => {
  const tiers = ['t1', 't2', 't3'].map(systemNodeOf);
  const ranks = normalizeTierRanks(tiers, DEFAULT_RANK_STEP);
  eq('normalizeTierRanks 唯一 rank 原样保留', [...ranks.values()], [10, 20, 30]);
  eq('normalizeTierRanks 顺序为升序', ranks.get('t1'), 10);

  const duplicated = [
    toSystemNode({
      ...(SYSTEMS_SUBS[1] as never as Record<string, unknown>),
      id: 'd1',
      meta: { rank: 10 },
      order_index: 0,
    } as never),
    toSystemNode({
      ...(SYSTEMS_SUBS[1] as never as Record<string, unknown>),
      id: 'd2',
      meta: { rank: 10 },
      order_index: 1,
    } as never),
  ];
  const normalized = normalizeTierRanks(duplicated, 10);
  eq('normalizeTierRanks 重复 rank 归一化', [normalized.get('d1'), normalized.get('d2')], [10, 20]);

  const descending = sortTiersByRank(tiers, ranks, 'descending');
  eq('sortTiersByRank 降序', descending.map((tier) => tier.id), ['t3', 't2', 't1']);
  eq('nextRankOf 空阶梯', nextRankOf([], 10), 10);
  eq('nextRankOf 接续最大 rank', nextRankOf(tiers, 10), 40);

  eq('readTierMeta 读 rank', readTierMeta({ rank: 42 }).rank, 42);
  eq('readTierMeta 缺省回退', readTierMeta({}, 7).rank, 7);
  eq('readSystemMeta 默认升序', readSystemMeta({}).rankDirection, 'ascending');
  check('isTierNode 识别内置 tier', isTierNode(tiers[0]));
  check(
    'isTierNode 识别带 rank 的自定义 kind',
    isTierNode(
      toSystemNode({
        ...(SYSTEMS_SUBS[1] as never as Record<string, unknown>),
        id: 'cx',
        kind: 'custom_realm',
        meta: { rank: 5 },
      } as never)
    )
  );

  const nodes = SYSTEMS_SUBS.map((node) => toSystemNode(node as never));
  const stair = buildStair(nodes, LINK_FIXTURE, 's1', 10, 'ascending');
  eq('buildStair 阶位数', stair.tiers.length, 3);
  eq('buildStair 阶位顺序', stair.tiers.map((tier) => tier.name), ['一阶', '二阶', '三阶']);
  eq('buildStair members 数量', stair.members.length, 2);
  eq('buildStair 捕获进阶边', stair.edges.filter((edge) => edge.type === 'advances_to').length, 2);
  eq('buildStair grants 边', stair.edges.filter((edge) => edge.type === 'grants').length, 1);
  eq('buildStair 外部代价边标记 external', stair.edges.find((edge) => edge.type === 'costs')?.external, true);
  eq('buildStair 不降级', stair.degraded, false);
  eq('shouldDegradeStair 超阈值', shouldDegradeStair(SYSTEM_NODE_LIMIT + 1), true);

  const advanceEdges = stair.edges
    .filter((edge) => edge.type === 'advances_to')
    .map((edge) => ({ sourceId: edge.sourceId, targetId: edge.targetId }));
  check('环路检测：t3 -> t1 成环', wouldCreateStairCycle(advanceEdges, 't3', 't1'));
  check('环路检测：t1 -> t3 不成环', !wouldCreateStairCycle(advanceEdges, 't1', 't3'));
  check('环路检测：自指成环', wouldCreateStairCycle(advanceEdges, 't2', 't2'));

  const volumes = buildCodexVolumes(stair, (nodeId) => (nodeId === 't2' ? 2 : 0));
  eq('典籍卷册数量', volumes.length, 3);
  eq('典籍按 rank 排列', volumes.map((volume) => volume.rank), [10, 20, 30]);
  eq('典籍卷内能力分类', volumes[0].abilities.map((node) => node.name), ['纳气']);
  // 经济资源代价是体系外目标（byId 解析不到），不进 system 内代价列表，只走外部文本回退
  eq('典籍不把体系外代价当成员', volumes[0].costs.length, 0);
  eq('典籍突破条件来自 meta', volumes[1].breakthrough, '心法贯通');
  eq('典籍关联计数', volumes[1].linkCount, 2);

  // 体系内「代价节点」（kind=cost）历史上/导入数据可能挂在阶位上，必须归入代价而不是从卷册消失
  // （新建路径已被注册表限制为 grants→ability，见 link_registry.py:613-623）
  const costNode = toSystemNode(
    sub({
      id: 'c9',
      moduleId: SYSTEMS_MODULE_ID,
      name: '代价样本',
      kind: 'cost',
      order: 9,
      parentId: 's1',
      meta: { nodeType: 'cost', costHint: '灵石' },
    })
  );
  const costStair = {
    ...stair,
    members: [...stair.members, costNode],
    edges: [
      ...stair.edges,
      { link: LINK_FIXTURE[5], type: 'grants', sourceId: 't1', targetId: 'c9', external: false },
    ],
  };
  const costVolumes = buildCodexVolumes(costStair, () => 0);
  eq('典籍卷内代价分类（体系内代价节点）', costVolumes[0].costs.map((node) => node.id), ['c9']);
  eq('代价节点不计入赋予能力', costVolumes[0].abilities.map((node) => node.id), ['a1']);
  eq('代价节点不计入规则', costVolumes[0].rules.length, 0);

  eq('tierTermOf 默认', tierTermOf({}), '阶位');
  eq('tierTermOf 覆盖', tierTermOf({ tierTerm: '境界' }), '境界');
  eq('rankStepOf 默认', rankStepOf({}), 10);
  eq('rankStepOf 非法值回退', rankStepOf({ rankStep: 0 }), 10);
  eq('nodeStyleOf 默认图标', nodeStyleOf({}, 'tier').icon, DEFAULT_NODE_STYLES.tier.icon);
  eq('nodeStyleOf 覆盖图标', nodeStyleOf({ nodeStyles: { tier: { icon: 'mountain' } } }, 'tier').icon, 'mountain');
  eq('resolveSystemsConfig 默认视图', resolveSystemsConfig({}).displayMode, 'stair');
  eq('SYSTEMS_TERM_DEFAULTS 含 codex', SYSTEMS_TERM_DEFAULTS.codex, '典籍');

  check(
    'validateSystemKind 允许第三层',
    validateSystemKind({}, { id: 'custom_realm', label: '秘境', parentKind: 'tier' }) === null
  );
  check(
    'validateSystemKind 拒绝第四层',
    validateSystemKind(
      { entityTypes: [...SYSTEM_KINDS, { id: 'custom_realm', label: '秘境', parentKind: 'tier' }] },
      { id: 'custom_deep', label: '深', parentKind: 'custom_realm' }
    ) !== null
  );

  const tierForm = metaFromTierForm({ name: 'x', rank: 50, branch: '支线' });
  eq('metaFromTierForm 写 rank/branch', [tierForm.rank, tierForm.branch], [50, '支线']);
  const memberForm = metaFromMemberForm({ name: 'x', kind: 'ability', reusable: false });
  eq('metaFromMemberForm 写 nodeType/reusable', [memberForm.nodeType, memberForm.reusable], ['ability', false]);
  const systemForm = metaFromSystemForm({ name: 'x', tagline: '体系', rankDirection: 'descending' });
  eq('metaFromSystemForm 写 rankDirection', systemForm.rankDirection, 'descending');
};

// ---------- 4. RacesView 组件 ----------

const racesRender = async (
  level: 'sketch' | 'structure' | 'sandbox',
  mutate?: (world: WorldWithModules) => WorldWithModules
) => {
  const client = seededClient();
  const world = mutate ? mutate(WORLD_FIXTURE) : WORLD_FIXTURE;
  seedWorld(client, world);
  const view = mount(
    <World client={client} level={level}>
      <RacesView worldId={WORLD_ID} moduleId={RACES_MODULE_ID} onNavigateToEntity={() => undefined} />
    </World>
  );
  await settle();
  return view;
};

const testRacesView = async () => {
  const view = await racesRender('structure');
  check('RacesView 根节点渲染', !!view.query('[data-testid="races-view"]'), view.text().slice(0, 200));
  const cards = view.queryAll('[data-testid="race-card"]');
  eq('图鉴网格卡片数（含支系）', cards.length, 4);
  check('卡片展示族名', view.text().includes('人类') && view.text().includes('精灵'));
  check('卡片展示一句话特征', view.text().includes('善于开拓'));
  check('卡片展示文本回退居住地', view.text().includes('北岭'));
  check('卡片带 subrace kind 标记', view.queryAll('[data-kind="subrace"]').length >= 1);
  eq(
    '未超过阈值不启用视口裁剪',
    view.query('[data-testid="races-grid"]')?.getAttribute('data-virtualized'),
    'false'
  );
  view.unmount();

  // 空模块 -> 空态 + 快速路径
  const empty = await racesRender('structure', (world) => ({
    ...world,
    modules: world.modules.map((module) =>
      module.id === RACES_MODULE_ID ? { ...module, submodules: [], items: [] } : module
    ),
  }) as WorldWithModules);
  check('模块为空渲染空态', !!empty.query('[data-testid="empty-state"]'), empty.text().slice(0, 200));
  check('空态文案', empty.text().includes('还没有') || empty.text().includes('没有种族'));
  empty.unmount();

  // structure 血缘：树 + 跨族边
  const tree = await racesRender('structure');
  const switched = clickIncludes(tree, '血缘');
  await settle();
  check('切换到血缘视图', switched);
  check('structure 档渲染血缘树', !!tree.query('[data-testid="lineage-tree"]'), tree.text().slice(0, 200));
  check('血缘树未降级', !tree.query('[data-testid="lineage-fallback"]'));
  // 跨族边必须真的画出来（l1: r1-r2 bloodline、l3: r3-r1 hostility），不能只看文案
  eq('血缘树跨族边数量', tree.queryAll('[data-testid="lineage-edge"]').length, 2);
  // 只渲染 root -> 直接子级：3 个顶层分支 + 1 个支系节点 = 4，第三层不可出现
  eq('血缘树节点总数（无第三层）', tree.queryAll('[data-testid="lineage-node"]').length, 4);
  eq('血缘树分支数（顶层）', tree.queryAll('[data-testid="lineage-branch"]').length, 3);
  tree.unmount();

  // sketch 档不加载血缘布局：开关本身也不应存在（负向对照，结构档已断言 switched === true）
  const sketch = await racesRender('sketch');
  const switchedSketch = clickIncludes(sketch, '血缘');
  await settle();
  check('sketch 档不提供血缘视图开关', switchedSketch === false, sketch.text().slice(0, 200));
  check('sketch 档不渲染血缘树', !sketch.query('[data-testid="lineage-tree"]'), sketch.text().slice(0, 200));
  sketch.unmount();

  // 超阈值降级
  const manySubmodules = Array.from({ length: 90 }, (_, index) =>
    sub({
      id: `bulk-${index}`,
      moduleId: RACES_MODULE_ID,
      name: `族裔${index}`,
      kind: 'race',
      order: index,
      meta: { tagline: `第 ${index} 族` },
    })
  );
  const degraded = await racesRender('structure', (world) => ({
    ...world,
    modules: world.modules.map((module) =>
      module.id === RACES_MODULE_ID ? { ...module, submodules: manySubmodules, items: [] } : module
    ),
  }) as WorldWithModules);
  clickIncludes(degraded, '血缘');
  await settle();
  check('超过阈值降级为列表', !!degraded.query('[data-testid="lineage-fallback"]'), degraded.text().slice(0, 200));
  check('降级时不渲染树布局', !degraded.query('[data-testid="lineage-tree"]'));
  degraded.unmount();

  // 视口裁剪（§11）：>200 张卡且在可测量容器里只挂载窗口内的行。
  // harness 默认没有 CSS，clientHeight 为 0 会走「不可测量则全量渲染」的降级分支，
  // 故显式注入容器高度，让真实窗口化路径也被跑到。
  const virtualStyle = document.createElement('style');
  virtualStyle.textContent = '[data-testid="races-grid"]{height:600px;overflow-y:auto}';
  document.head.appendChild(virtualStyle);
  const manyCards = Array.from({ length: 240 }, (_, index) =>
    sub({
      id: `card-${index}`,
      moduleId: RACES_MODULE_ID,
      name: `族${index}`,
      kind: 'race',
      order: index,
      meta: { tagline: `第 ${index} 族` },
    })
  );
  const virtual = await racesRender('structure', (world) => ({
    ...world,
    modules: world.modules.map((module) =>
      module.id === RACES_MODULE_ID ? { ...module, submodules: manyCards, items: [] } : module
    ),
  }) as WorldWithModules);
  await settle();
  eq(
    '超过 200 张卡启用视口裁剪',
    virtual.query('[data-testid="races-grid"]')?.getAttribute('data-virtualized'),
    'true'
  );
  const renderedCards = virtual.queryAll('[data-testid="race-card"]').length;
  check(
    '视口裁剪只挂载窗口内的卡',
    renderedCards > 0 && renderedCards < manyCards.length,
    { renderedCards, total: manyCards.length }
  );
  virtual.unmount();
  virtualStyle.remove();

  // 详情：网格默认按名称排序，首张卡不一定是「人类」，显式点开目标卡
  const detail = await racesRender('structure');
  const humanCard = detail
    .queryAll('[data-testid="race-card"]')
    .find((element) => (element.textContent ?? '').includes('人类'));
  check('找到「人类」卡片', !!humanCard);
  const humanClickable = humanCard
    ? humanCard.querySelector('button') ?? humanCard
    : null;
  if (humanClickable) flushSync(() => (humanClickable as HTMLElement).click());
  await settle();
  check('点击卡片打开详情', !!detail.query('[data-testid="race-detail"]'), detail.text().slice(0, 300));
  check('详情含档案字段组', detail.text().includes('生理') || detail.text().includes('外貌'));
  // r1(人类) 自身的关联：出链 l1(r1→r2) + l2(r1→c1)，入链 l3(r3→r1)；世界级列表里其余 5 条与 r1 无关
  // （旧 splitLinks 只判 source，会把无关边算进入链 → 这里会变成「入链 6」）
  check(
    '详情关联计数只算该实体自身（出链 2 / 入链 1）',
    detail.text().includes('出链 2') && detail.text().includes('入链 1'),
    detail.text().slice(0, 400)
  );
  check('详情不含无关关联计数', !detail.text().includes('入链 6'), detail.text().slice(0, 400));
  detail.unmount();

  // 新建表单（不发请求：仅校验表单出现与必填拦截）
  const form = await racesRender('structure');
  clickIncludes(form, '新建');
  await settle();
  check('打开新建种族表单', !!form.query('[data-testid="race-form"]'), form.text().slice(0, 200));
  form.unmount();
};

// ---------- 5. SystemsView 组件 ----------

const systemsRender = async (
  level: 'sketch' | 'structure' | 'sandbox',
  mutate?: (world: WorldWithModules) => WorldWithModules
) => {
  const client = seededClient();
  const world = mutate ? mutate(WORLD_FIXTURE) : WORLD_FIXTURE;
  seedWorld(client, world);
  const view = mount(
    <World client={client} level={level}>
      <SystemsView worldId={WORLD_ID} moduleId={SYSTEMS_MODULE_ID} onNavigateToEntity={() => undefined} />
    </World>
  );
  await settle();
  return view;
};

const testSystemsView = async () => {
  const view = await systemsRender('structure');
  check('SystemsView 根节点渲染', !!view.query('[data-testid="systems-view"]'), view.text().slice(0, 200));
  const rows = view.queryAll('[data-testid="system-row"]');
  eq('体系列表行数', rows.length, 1);
  check('体系列表展示体系名', view.text().includes('炼气体系'));
  const tierNodes = view.queryAll('[data-testid="tier-node"]');
  eq('阶梯节点数', tierNodes.length, 3);
  check(
    '阶梯按 rank 升序',
    tierNodes.map((node) => node.getAttribute('data-tier-rank')).join(',') === '10,20,30',
    tierNodes.map((node) => node.getAttribute('data-tier-rank'))
  );
  check('阶梯展示赋予能力 chip', view.text().includes('纳气'));
  view.unmount();

  // 典籍视图
  const codex = await systemsRender('structure');
  clickIncludes(codex, '典籍');
  await settle();
  check('切换到典籍视图', !!codex.query('[data-testid="codex-view"]'), codex.text().slice(0, 200));
  const volumes = codex.queryAll('[data-testid="codex-volume"]');
  eq('典籍卷册数', volumes.length, 3);
  eq(
    '典籍按 rank 排列',
    volumes.map((volume) => volume.getAttribute('data-rank')).join(','),
    '10,20,30'
  );
  codex.unmount();

  // 节点详情
  const detail = await systemsRender('structure');
  clickTestId(detail, 'tier-node');
  await settle();
  check('选中阶位显示节点详情', !!detail.query('[data-testid="node-detail"]'), detail.text().slice(0, 300));
  check(
    '节点详情含关联面板',
    detail.text().includes('出链') && detail.text().includes('入链'),
    detail.text().slice(0, 300)
  );
  detail.unmount();

  // 空体系 -> 空态 + 批量录入
  const empty = await systemsRender('structure', (world) => ({
    ...world,
    modules: world.modules.map((module) =>
      module.id === SYSTEMS_MODULE_ID ? { ...module, submodules: [], items: [] } : module
    ),
  }) as WorldWithModules);
  check('体系为空渲染空态', !!empty.query('[data-testid="empty-state"]'), empty.text().slice(0, 200));
  check('空态文案', empty.text().includes('还没有体系'));
  empty.unmount();

  // 有体系无阶位 -> 批量录入入口
  const noTiers = await systemsRender('structure', (world) => ({
    ...world,
    modules: world.modules.map((module) =>
      module.id === SYSTEMS_MODULE_ID
        ? { ...module, submodules: [SYSTEMS_SUBS[0]], items: [] }
        : module
    ),
  }) as WorldWithModules);
  check(
    '无阶位时提供多行录入',
    !!noTiers.query('[data-testid="tier-bulk-input"]') || noTiers.text().includes('添加第一个阶位'),
    noTiers.text().slice(0, 300)
  );
  noTiers.unmount();

  // sketch 档：阶梯只读、典籍隐藏
  const sketch = await systemsRender('sketch');
  check('sketch 档渲染阶梯容器', !!sketch.query('[data-testid="stair-board"]'), sketch.text().slice(0, 200));
  sketch.unmount();
};

// ---------- 6. WorldbuildingView tab 接入（P3-T1） ----------

const WORLDS_SUMMARY = [
  {
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
    link_count: 8,
  },
];

const worldbuildingRender = async (world: WorldWithModules) => {
  const client = seededClient();
  seedWorld(client, world);
  client.setQueryData(worldbuildingKeys.worlds(PROJECT_ID), WORLDS_SUMMARY);
  client.setQueryData(worldbuildingKeys.migrationContainer(PROJECT_ID), null);
  useProjectStore.setState({ currentProjectId: PROJECT_ID });
  const view = mount(
    <QueryClientProvider client={client}>
      <WorldbuildingView />
    </QueryClientProvider>
  );
  await settle();
  return view;
};

const testWorldbuildingTabs = async () => {
  const view = await worldbuildingRender(WORLD_FIXTURE);
  check('WorldbuildingView 渲染', view.text().includes('世界观设定'), view.text().slice(0, 200));
  const switchedRaces = clickIncludes(view, '种族');
  await settle();
  check('可切到种族 tab', switchedRaces);
  check('种族 tab 渲染 RacesView', !!view.query('[data-testid="races-view"]'), view.text().slice(0, 200));
  clickIncludes(view, '体系');
  await settle();
  check('体系 tab 渲染 SystemsView', !!view.query('[data-testid="systems-view"]'), view.text().slice(0, 200));
  view.unmount();

  // 模块缺失：走显式创建入口 + 空态，不静默建模块
  const missing = await worldbuildingRender({
    ...WORLD_FIXTURE,
    modules: WORLD_FIXTURE.modules.filter((module) => module.id !== RACES_MODULE_ID),
  } as WorldWithModules);
  clickIncludes(missing, '种族');
  await settle();
  check('缺模块时显示空态', !!missing.query('[data-testid="empty-state"]'), missing.text().slice(0, 200));
  check('缺模块时给出创建入口', missing.text().includes('种族模块尚未创建'));
  missing.unmount();
};

// ---------- 入口 ----------

const run = async () => {
  testModuleConfig();
  testRacesPure();
  testSystemsPure();
  await testRacesView();
  await testSystemsView();
  await testWorldbuildingTabs();
};

void run()
  .then(() => {
    (window as never as Record<string, unknown>).__PHASE3_TESTS__ = {
      done: true,
      checks,
    };
  })
  .catch((error) => {
    (window as never as Record<string, unknown>).__PHASE3_TESTS__ = {
      done: true,
      checks: [
        ...checks,
        {
          name: '用例执行未抛异常',
          ok: false,
          detail: error instanceof Error ? `${error.message}\n${error.stack}` : String(error),
        },
      ],
    };
  });

export {};
