/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 6 世界容器用例（浏览器侧，P6-T1/T2/T6/T7 验收）
 *
 * 由 tests/worldbuilding/phase6.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE6_TESTS__（与 harness5.tsx 的 __PHASE5_TESTS__ 同构）。
 *
 * 覆盖：
 * 1) 世界列表：排序（updated_at 倒序 + 名称/id 稳定兜底）、当前世界收敛与记忆（按项目分键）；
 * 2) 空白创建：载荷形状（无任何预设/类型/模板字段）、复杂度三档、默认模块；
 * 3) 世界设置：settings 浅合并保留未知键、复杂度落库补丁、术语空值回退与同名冲突、历法归一；
 * 4) 模块行：七个模块一行（含缺失模块）、kind/字段/自定义统计；
 * 5) 世界脉络入口与输入：sandbox / structure 可见、sketch 不提供；节点上限 800 降级判定；
 * 6) 全局搜索：索引（子模块 + 条目 + 标签 + 字段 + 行内引用）、限定符（中文与 ASCII）、
 *    分组与排序、速写档缺关联数据时「关联:」的降级、最近记录按 项目+世界 隔离；
 * 7) 备份恢复：文件校验、版本守卫、恢复载荷（模式/确认位/未知键保留）、文件名、报告文案；
 * 8) 返回栈：pushFrame/popFrame/popToDepth/面包屑 与快照往返（P2 语义不变）；
 * 9) DOM：GlobalSearch 面板在预置缓存下渲染分组结果与「关联:」降级提示（不发网络请求）。
 *
 * 静态文件护栏（无 emoji、无 /templates|/instances|/worldviews 字符串）在 phase6.spec.ts 里做：
 * 浏览器侧没有 fs。
 */

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type {
  EntityRef,
  ModuleItemV2,
  SubmoduleV2,
  World,
  WorldLink,
  WorldModuleV2,
} from '@/services/worldbuildingApi';
import { worldbuildingKeys } from '@/components/Worldbuilding/hooks/worldQueryKeys';
import {
  DEFAULT_WORLD_CALENDAR,
  DEFAULT_WORLD_TERMINOLOGY,
  DEFAULT_WORLD_TONE,
  WORLD_COMPLEXITY_VALUES,
  WORLD_PALETTES,
  WORLD_WEB_NODE_LIMIT,
  auditTerminology,
  buildComplexityPatch,
  buildWorldCreatePayload,
  currentWorldStorageKey,
  formatWorldDate,
  mergeWorldSettings,
  normalizeWorldComplexity,
  parseWorldCalendar,
  parseWorldSettings,
  parseWorldTone,
  pickCurrentWorldId,
  readCurrentWorldId,
  resetTerminology,
  resolveCurrentWorldId,
  sortWorlds,
  termFor,
  webEntryDecision,
  worldListItemOf,
  worldModuleRows,
  writeCurrentWorldId,
} from '@/components/Worldbuilding/hooks/worldSettings';
import {
  WORLD_SCHEMA_VERSION,
  assertBackupVersion,
  backupFileName,
  buildImportPayload,
  canOverwriteWorld,
  danglingRefLabel,
  parseBackupText,
  summarizeImportReport,
} from '@/components/Worldbuilding/hooks/worldBackup';
import {
  RECENT_SEARCH_LIMIT,
  buildSearchIndex,
  countHits,
  isSearchQueryEmpty,
  loadRecentSearches,
  parseSearchQuery,
  pushRecentSearch,
  recentSearchKey,
  saveRecentSearches,
  searchIndex,
} from '@/components/Worldbuilding/hooks/globalSearch';
import {
  clearStack,
  createBackStack,
  isAtRoot,
  peekFrame,
  popFrame,
  popToDepth,
  pushFrame,
  toBreadcrumbs,
  type BackStackState,
  type ListSnapshot,
} from '@/components/Worldbuilding/navigation/backStack';
import { GlobalSearch } from '@/components/Worldbuilding/config/GlobalSearch';

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

// ---------- fixtures ----------

let seed = 0;
const nextId = (prefix: string) => `${prefix}-${(seed += 1)}`;

const world = (over: Partial<World> & { id: string; name: string }): World => ({
  description: null,
  cover_image: null,
  project_id: 'p1',
  tone: null,
  settings: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  module_count: 7,
  link_count: 0,
  ...over,
});

const submodule = (over: Partial<SubmoduleV2> & { id: string; name: string }): SubmoduleV2 => ({
  module_id: 'm1',
  description: null,
  order_index: 0,
  kind: 'polity',
  meta: null,
  color: null,
  icon: null,
  parent_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  item_count: 0,
  ...over,
});

const item = (over: Partial<ModuleItemV2> & { id: string; name: string }): ModuleItemV2 => ({
  module_id: 'm1',
  content: {},
  order_index: 0,
  is_published: true,
  submodule_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const module = (
  over: Partial<WorldModuleV2> & { id: string; module_type: WorldModuleV2['module_type']; name: string }
): WorldModuleV2 => ({
  world_id: 'w1',
  description: null,
  icon: null,
  order_index: 0,
  config: null,
  is_collapsible: true,
  is_required: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  submodule_count: 0,
  item_count: 0,
  submodules: [],
  items: [],
  ...over,
});

const link = (over: Partial<WorldLink> & { id: string; source: EntityRef; target: EntityRef }): WorldLink => ({
  world_id: 'w1',
  link_type: 'core.related_to',
  directed: false,
  label: null,
  reverse_label: null,
  note: null,
  meta: null,
  time: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

/** 内存版 localStorage：harness 在 about:blank 下无法用真实 localStorage */
const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    size: () => map.size,
    raw: map,
  };
};

// ---------- 1. 世界列表与切换 ----------

const testWorldList = () => {
  const list = [
    world({ id: 'b', name: '乙世界', updated_at: '2026-02-01T00:00:00Z' }),
    world({ id: 'a', name: '甲世界', updated_at: '2026-03-01T00:00:00Z' }),
    world({ id: 'c', name: '丙世界', updated_at: '2026-02-01T00:00:00Z' }),
  ];
  eq('世界列表按 updated_at 倒序（同级按名称稳定排序）', sortWorlds(list).map((w) => w.id), ['a', 'b', 'c']);

  eq('默认选中列表首位', pickCurrentWorldId(list, null), 'a');
  eq('记忆值仍存在时保持不变', pickCurrentWorldId(list, 'c'), 'c');
  eq('记忆值已删除时回退首位', pickCurrentWorldId(list, 'gone'), 'a');
  eq('空列表返回 null', pickCurrentWorldId([], 'a'), null);
  eq('排序不修改入参', list.map((w) => w.id), ['b', 'a', 'c']);

  const storage = memoryStorage();
  writeCurrentWorldId('p1', 'c', storage);
  eq('当前世界按项目分键记忆', readCurrentWorldId('p1', storage), 'c');
  eq('换项目不串世界', readCurrentWorldId('p2', storage), null);
  eq('键名带项目作用域', currentWorldStorageKey('p1').endsWith('p1'), true);
  writeCurrentWorldId('p1', null, storage);
  eq('清空记忆写空串，读回归一为 null（不再被当作有效 id 参与收敛）', readCurrentWorldId('p1', storage), null);

  const listItem = worldListItemOf(
    world({ id: 'a', name: '甲世界', description: ' 一句话描述 ', link_count: 9, updated_at: '2026-03-01T08:30:00Z' }),
    12
  );
  eq('列表项字段与格式化', [listItem.name, listItem.description, listItem.linkCount, listItem.entityCount], [
    '甲世界',
    '一句话描述',
    9,
    12,
  ]);
  eq('列表接口无实体数时用 null', worldListItemOf(world({ id: 'x', name: 'X' })).entityCount, null);
  // 收敛：刚创建 / 刚恢复出来的世界在列表刷新回来之前不能被覆盖（P6 复审修复）
  eq('收敛：待选中世界不在列表时保持它', resolveCurrentWorldId([world({ id: 'a', name: 'A' })], 'a', 'pending-1'), 'pending-1');
  eq('收敛：待选中世界已在列表时选中它', resolveCurrentWorldId([world({ id: 'a', name: 'A' }), world({ id: 'b', name: 'B' })], 'a', 'b'), 'b');
  eq('收敛：无待选中时沿用记忆值', resolveCurrentWorldId([world({ id: 'a', name: 'A' }), world({ id: 'b', name: 'B' })], 'b'), 'b');
  eq(
    '收敛：记忆值失效时回落更新时间最新的世界',
    resolveCurrentWorldId(
      [
        world({ id: 'a', name: 'A', updated_at: '2026-02-01T00:00:00Z' }),
        world({ id: 'b', name: 'B', updated_at: '2026-03-01T00:00:00Z' }),
      ],
      'gone'
    ),
    'b'
  );
  eq('收敛：列表为空时返回 null', resolveCurrentWorldId([], 'a', null), null);
  check('日期格式化到分钟', formatWorldDate('2026-03-01T08:30:00Z').startsWith('2026-03-01'), formatWorldDate('2026-03-01T08:30:00Z'));
};

// ---------- 2. 空白创建载荷 ----------

const testBlankCreate = () => {
  const payload = buildWorldCreatePayload({ name: '  九州志 ', description: ' ', complexity: 'structure' }, 'p1');
  eq('创建载荷只含契约字段', Object.keys(payload).sort(), ['cover_image', 'description', 'name', 'project_id', 'settings', 'tone']);
  eq('名称去空格', payload.name, '九州志');
  eq('空描述写 null（不写空串）', payload.description, null);
  eq('封面缺省 null', payload.cover_image, null);
  eq('项目归属', payload.project_id, 'p1');
  eq('默认复杂度写入 settings.complexity', (payload.settings as { complexity?: string }).complexity, 'structure');
  eq('默认模块缺省历史', (payload.settings as { defaultModule?: string }).defaultModule, 'history');
  eq('基调缺省为羊皮纸 + 其强调色', payload.tone, {
    palette: 'parchment',
    accent: WORLD_PALETTES[0].accent,
    texture: DEFAULT_WORLD_TONE.texture,
    radius: DEFAULT_WORLD_TONE.radius,
  });

  const custom = buildWorldCreatePayload(
    { name: '甲', description: '一句话', palette: 'custom', accent: '#123456', texture: 'starfield', radius: 'lg', defaultModule: 'politics' },
    null
  );
  eq('自定义基调原样写入', custom.tone, { palette: 'custom', accent: '#123456', texture: 'starfield', radius: 'lg' });
  eq('自定义默认模块原样写入', (custom.settings as { defaultModule?: string }).defaultModule, 'politics');
  eq('无项目时 project_id 为 null', custom.project_id, null);

  // 禁止预设：载荷里不得出现任何模板 / 世界观类型 / 预设内容痕迹
  const serialized = JSON.stringify(payload);
  for (const forbidden of ['template', 'instance', 'worldview', 'preset', 'xianxia', 'scifi', 'example']) {
    check(`创建载荷不含 ${forbidden}`, !serialized.includes(forbidden), serialized);
  }
  eq('默认复杂度缺省速写', (buildWorldCreatePayload({ name: '甲' }).settings as { complexity?: string }).complexity, 'sketch');
  eq('复杂度三档是唯一合法值', WORLD_COMPLEXITY_VALUES, ['sketch', 'structure', 'sandbox']);
  for (const bad of ['simple', 'complex', 'highly_complex', '', null, 42]) {
    eq(`非法复杂度 ${String(bad)} 归一到速写`, normalizeWorldComplexity(bad), 'sketch');
  }
};

// ---------- 3. 世界设置：合并 / 复杂度 / 术语 / 历法 ----------

const testWorldSettings = () => {
  const raw = { complexity: 'sandbox', terminology: { politics: '朝堂' }, migrationContainer: true, futureKey: { a: 1 } };
  const merged = mergeWorldSettings(raw, { complexity: 'structure' });
  eq('浅合并覆盖受管键', merged.complexity, 'structure');
  eq('未知键原样保留（migrationContainer）', merged.migrationContainer, true);
  eq('未知嵌套键原样保留（futureKey）', merged.futureKey, { a: 1 });
  eq('未触碰的键不动（terminology）', merged.terminology, { politics: '朝堂' });

  const patch = buildComplexityPatch(world({ id: 'w', name: 'W', settings: raw }), 'sketch');
  eq('复杂度补丁是 settings.complexity', patch.settings.complexity, 'sketch');
  eq('复杂度补丁保留 migrationContainer', patch.settings.migrationContainer, true);
  eq('复杂度补丁保留 futureKey', patch.settings.futureKey, { a: 1 });

  const parsedSettings = parseWorldSettings({ complexity: 'nope', defaultModule: '  ', terminology: { a: '甲', b: '' } });
  eq('settings 解析：非法复杂度回退速写', parsedSettings.complexity, 'sketch');
  eq('settings 解析：空默认模块回退历史', parsedSettings.defaultModule, 'history');
  eq('settings 解析：术语只保留非空', parsedSettings.terminology, { a: '甲' });
  eq('settings 解析：raw 保留未知键', parseWorldSettings({ weird: 1 }).raw, { weird: 1 });

  // 术语：空值回退 + 同名冲突
  const audit = auditTerminology({ politics: '  ', economy: '政治', custom: '宗门' });
  eq('空术语进 empty 并从生效表剔除', audit.empty, ['politics']);
  eq('生效术语只有非空项', audit.entries, { economy: '政治', custom: '宗门' });
  eq('把政治叫成「经济」之外的默认名会提示冲突', audit.conflicts, ['economy']);
  eq('等于自身默认名不算冲突', auditTerminology({ politics: '政治' }).conflicts, []);
  eq('术语缺省回退默认表', termFor(undefined, 'politics'), DEFAULT_WORLD_TERMINOLOGY.politics);
  eq('术语命中用世界内称呼', termFor({ politics: '朝堂' }, 'politics'), '朝堂');
  eq('术语空串回退默认', termFor({ politics: '   ' }, 'politics'), '政治');
  eq('恢复默认 = 空覆盖表', resetTerminology(), {});
  eq('默认术语表覆盖模块与通用称谓', [DEFAULT_WORLD_TERMINOLOGY.politics, DEFAULT_WORLD_TERMINOLOGY.polity, DEFAULT_WORLD_TERMINOLOGY.figure], ['政治', '政权', '人物']);
  check('术语表不写 module_type 之外的语义（值均为显示名）', Object.values(DEFAULT_WORLD_TERMINOLOGY).every((value) => typeof value === 'string' && value.length > 0));

  // 历法
  const calendar = parseWorldCalendar({ eraName: '阳阙历', unified: true, customEpoch: 'x' });
  eq('历法字段归一', [calendar.eraName, calendar.epochLabel, calendar.timeFormat, calendar.unified], ['阳阙历', '', '', true]);
  eq('历法未知键保留', calendar.raw.customEpoch, 'x');
  eq('历法缺省值', parseWorldCalendar(null), { ...DEFAULT_WORLD_CALENDAR, raw: {} });
  eq('历法自然语言原文不动', parseWorldCalendar({ epochLabel: '阳阙历三年' }).epochLabel, '阳阙历三年');

  // 基调
  const tone = parseWorldTone({ palette: 'nope', accent: '  ', texture: 'grid', radius: 'xl', legacy: 7 });
  eq('非法 palette 回退默认', tone.palette, 'parchment');
  eq('空白 accent 回退 palette 默认色', tone.accent, WORLD_PALETTES[0].accent);
  eq('texture 合法即生效', tone.texture, 'grid');
  eq('非法 radius 回退默认', tone.radius, 'md');
  eq('基调未知键保留', tone.raw.legacy, 7);

  // 模块行
  const modules = [
    module({
      id: 'm-pol',
      module_type: 'politics',
      name: '政治',
      submodule_count: 2,
      item_count: 1,
      config: { entityTypes: [{ id: 'polity', label: '政权' }], fieldSchema: { polity: [{ id: 'f1' }, { id: 'f2' }] } },
      submodules: [submodule({ id: 's1', name: 'S1' }), submodule({ id: 's2', name: 'S2' })],
      items: [item({ id: 'i1', name: 'I1' })],
    }),
  ];
  const rows = worldModuleRows(modules, (moduleType) => (moduleType === 'races' ? [{ id: 'race', label: '种族' }] : []));
  eq('模块页恒有七行', rows.length, 7);
  eq('模块页顺序固定', rows.map((row) => row.moduleType), ['map', 'history', 'politics', 'economy', 'races', 'systems', 'special']);
  const politicsRow = rows.find((row) => row.moduleType === 'politics')!;
  eq('已自定义模块的 kind/字段统计', [politicsRow.kindCount, politicsRow.fieldCount, politicsRow.customised], [1, 2, true]);
  eq('缺少模块的行仍占位且未自定义', [rows[0].moduleId, rows[0].customised], [null, false]);
  eq('未配置模块用内置 kind 数兜底', rows.find((row) => row.moduleType === 'races')!.kindCount, 1);
  eq('模块行带实体/条目计数', [politicsRow.submoduleCount, politicsRow.itemCount], [2, 1]);
};

// ---------- 4. 世界脉络入口与输入 ----------

const testWorldWebInputs = () => {
  eq('沙盘档入口默认可见', webEntryDecision('sandbox').visible, true);
  eq('结构档入口可见（手动点击开启）', webEntryDecision('structure').visible, true);
  eq('速写档不提供入口', webEntryDecision('sketch').visible, false);
  check('入口原因有文案', webEntryDecision('structure').reason.length > 0);
  // 节点上限是共享常量，phase6.spec 另有一条静态护栏保证它与 worldWebGraph 的实现一致
  eq('节点上限常量 800', WORLD_WEB_NODE_LIMIT, 800);
};

// ---------- 5. 全局搜索 ----------

const searchModules = () => [
  module({
    id: 'm-pol',
    module_type: 'politics',
    name: '政治',
    submodules: [
      submodule({
        id: 'p1',
        name: '大汉帝国',
        kind: 'polity',
        description: '北方强权',
        meta: { tags: ['古老', '中原'], 都城: '长安', note: '提及 [[history:event:e1|楚汉争霸]]' },
      }),
      submodule({ id: 'p2', name: '漕帮', kind: 'organization', meta: { tags: ['江湖'] } }),
    ],
    items: [item({ id: 'i1', name: '官制条目', content: { 说明: '三公九卿', tags: ['古老'] } })],
  }),
  module({
    id: 'm-his',
    module_type: 'history',
    name: '历史',
    submodules: [submodule({ id: 'e1', name: '楚汉争霸', kind: 'event', description: '四年内战' })],
  }),
];

const SEARCH_LABELS = { politics: '朝堂', history: '历史' };

const testGlobalSearch = () => {
  eq('ASCII 与中文限定符同义', (() => {
    const cn = parseSearchQuery('模块:政治 kind:polity 关联:历史 标签:古老 长安');
    const en = parseSearchQuery('module:politics kind:polity link:history tag:古老 长安');
    return [cn.module, cn.kind, cn.link, cn.tag, cn.text, en.module, en.kind, en.link, en.tag, en.text];
  })(), ['政治', 'polity', '历史', '古老', '长安', 'politics', 'polity', 'history', '古老', '长安']);
  eq('带引号的限定符值', parseSearchQuery('标签:"古老 中原" 都城').tag, '古老 中原');
  eq('无自由文本也算有效查询', isSearchQueryEmpty(parseSearchQuery('kind:polity')), false);
  eq('空查询无效', isSearchQueryEmpty(parseSearchQuery('   ')), true);

  const links = [
    link({ id: 'l1', source: { module: 'politics', kind: 'polity', id: 'p1' }, target: { module: 'history', kind: 'event', id: 'e1' } }),
  ];
  const index = buildSearchIndex(searchModules(), { links, moduleLabels: SEARCH_LABELS });
  eq('索引覆盖子模块与条目', index.entities.length, 4);
  eq('索引带上了关联数据', index.linkData, true);
  const hanEntity = index.entities.find((entity) => entity.id === 'p1')!;
  eq('标签进索引', hanEntity.tags, ['古老', '中原']);
  eq('行内引用显示名进索引', hanEntity.inlineNames, ['楚汉争霸']);
  eq('关联数按对端计入', hanEntity.linkCount, 1);
  eq('对端模块可被「关联:」命中', hanEntity.linkedModules, ['history']);
  eq('模块/kind 展示名用术语', [hanEntity.moduleLabel, hanEntity.kindLabel], ['朝堂', 'polity']);

  const byName = searchIndex(index, '大汉');
  eq('按名称命中并归属政治模块', [byName.length, byName[0].module, countHits(byName)], [1, 'politics', 1]);
  eq('命中字段是名称', byName[0].hits[0].field, '名称');
  eq('分组标题用术语', byName[0].label, '朝堂');

  eq('字段文本可命中', searchIndex(index, '长安')[0].hits[0].field, '都城');
  eq('描述可命中', searchIndex(index, '四年内战')[0].hits[0].field, '描述');
  eq('标签可命中', searchIndex(index, '古老').flatMap((group) => group.hits.map((hit) => hit.entity.id)).sort(), ['i1', 'p1']);
  eq('行内引用显示名可命中', searchIndex(index, '楚汉争霸').map((group) => group.module).sort(), ['history', 'politics']);
  eq('kind 限定符按 id 过滤', countHits(searchIndex(index, 'kind:polity')), 1);
  eq('kind 限定符找不到时为空', countHits(searchIndex(index, 'kind:nope')), 0);
  eq('模块限定符按展示名过滤', searchIndex(index, { module: '朝堂' }).map((group) => group.module), ['politics']);
  eq('模块限定符按 id 过滤', searchIndex(index, { module: 'history' }).map((group) => group.module), ['history']);
  eq('标签限定符', countHits(searchIndex(index, '标签:江湖')), 1);
  eq(
    '关联限定符按对端模块（展示名）',
    searchIndex(index, '关联:历史', { moduleLabels: SEARCH_LABELS }).flatMap((group) => group.hits.map((hit) => hit.entity.id)),
    ['p1']
  );
  eq(
    '关联限定符按对端模块（id）',
    searchIndex(index, '关联:history', { moduleLabels: SEARCH_LABELS }).flatMap((group) => group.hits.map((hit) => hit.entity.id)),
    ['p1']
  );
  eq(
    '关联限定符搭配自由文本',
    searchIndex(index, '关联:历史 大汉', { moduleLabels: SEARCH_LABELS }).flatMap((group) => group.hits.map((hit) => hit.entity.id)),
    ['p1']
  );
  eq('限定符 + 自由文本多条件', countHits(searchIndex(index, '模块:朝堂 长安')), 1);
  eq(
    '组内按命中字段权重排序（名称优先于字段/行内引用）',
    searchIndex(index, '楚汉争霸').flatMap((group) => group.hits.map((hit) => hit.field)),
    ['行内引用', '名称']
  );
  eq('同组内名称命中排最前', searchIndex(index, '大汉').flatMap((group) => group.hits.map((hit) => hit.field)), ['名称']);

  // 速写档：没有关联数据时只有「关联:」降级，其余照常
  const noLink = buildSearchIndex(searchModules(), {});
  eq('无关联数据标记 linkData=false', noLink.linkData, false);
  eq('无关联数据时「关联:」返回空', countHits(searchIndex(noLink, '关联:历史')), 0);
  eq('无关联数据时普通搜索仍可用', countHits(searchIndex(noLink, '大汉')), 1);
  eq('无关联数据时关联数为 0', noLink.entities.find((entity) => entity.id === 'p1')!.linkCount, 0);

  // 最近记录：按 项目 + 世界 隔离（P5 曾跨世界泄漏）
  eq('最近记录按项目+世界分键', recentSearchKey('p1', 'w1') === recentSearchKey('p1', 'w2'), false);
  eq('不同项目也不同键', recentSearchKey('p1', 'w1') === recentSearchKey('p2', 'w1'), false);
  eq('新查询置顶去重', pushRecentSearch('长安', ['大汉', '长安']), ['长安', '大汉']);
  eq('最近记录有上限', pushRecentSearch('x', Array.from({ length: RECENT_SEARCH_LIMIT }, (_, index) => `q${index}`)).length, RECENT_SEARCH_LIMIT);
  eq('空白查询不入最近记录', pushRecentSearch('   ', ['大汉']), ['大汉']);

  const storage = memoryStorage();
  saveRecentSearches('p1', 'w1', ['大汉'], storage);
  saveRecentSearches('p1', 'w2', ['漕帮'], storage);
  eq('世界内记录可读回', loadRecentSearches('p1', 'w1', storage), ['大汉']);
  eq('切世界不读回上一个世界的记录', loadRecentSearches('p1', 'w2', storage), ['漕帮']);
  eq('未记录过的世界为空', loadRecentSearches('p1', 'w3', storage), []);
  eq('项目隔离', loadRecentSearches('p2', 'w1', storage), []);
  eq('坏数据回退空数组', (() => {
    const broken = memoryStorage();
    broken.setItem(recentSearchKey('p1', 'w1'), '{not json');
    return loadRecentSearches('p1', 'w1', broken);
  })(), []);
};

// ---------- 6. 备份与恢复 ----------

const testBackup = () => {
  const document = {
    schema_version: WORLD_SCHEMA_VERSION,
    world: { id: 'w1', name: '九州志' },
    modules: [{ id: 'm1' }],
    links: [{ id: 'l1' }],
    customTopLevel: { keep: true },
  };
  const parsed = parseBackupText(JSON.stringify(document));
  eq('解析出世界段', (parsed.world as { name?: string }).name, '九州志');
  eq('未知顶层键保留', parsed.extra.customTopLevel, { keep: true });
  eq('缺 schema_version 时按当前版本兜底', parseBackupText('{"world":{}}').schema_version, WORLD_SCHEMA_VERSION);

  const failures: string[] = [];
  for (const [label, text] of [
    ['非 JSON', 'not json'],
    ['顶层是数组', '[1,2,3]'],
    ['缺 world 段', '{"modules":[]}'],
    ['modules 段不是数组', '{"world":{},"modules":{}}'],
    ['links 段不是数组', '{"world":{},"links":{}}'],
  ] as const) {
    try {
      parseBackupText(text);
      failures.push(label);
    } catch {
      // 期望抛错
    }
  }
  eq('非法备份一律抛错（不静默吞）', failures, []);

  let versionRejected = false;
  try {
    assertBackupVersion({ schema_version: WORLD_SCHEMA_VERSION + 1 });
  } catch {
    versionRejected = true;
  }
  check('备份版本高于本应用即拒绝', versionRejected);
  let sameVersionOk = true;
  try {
    assertBackupVersion({ schema_version: WORLD_SCHEMA_VERSION });
  } catch {
    sameVersionOk = false;
  }
  check('同版本可恢复', sameVersionOk);

  const payload = buildImportPayload(parsed, { mode: 'overwrite', targetWorldId: 'w9', confirmOverwrite: true, projectId: 'p1' });
  eq('恢复模式写入载荷', payload.mode, 'overwrite');
  eq('覆盖目标写入载荷', payload.target_world_id, 'w9');
  eq('显式确认位写入载荷', payload.confirm_overwrite, true);
  eq('项目归属写入载荷', payload.project_id, 'p1');
  eq('未知顶层键随载荷回传', (payload as unknown as { customTopLevel?: unknown }).customTopLevel, { keep: true });
  const newPayload = buildImportPayload(parsed, { mode: 'new', confirmOverwrite: true });
  eq('新世界模式清掉目标与确认位', [newPayload.mode, newPayload.target_world_id, newPayload.confirm_overwrite], ['new', null, false]);
  eq('默认保留失效引用', buildImportPayload(parsed).keep_dangling, true);
  eq('可显式丢弃失效引用', buildImportPayload(parsed, { keepDangling: false }).keep_dangling, false);

  eq('非空世界覆盖需要显式确认', [
    canOverwriteWorld('overwrite', true, false),
    canOverwriteWorld('overwrite', true, true),
    canOverwriteWorld('overwrite', false, false),
    canOverwriteWorld('new', true, false),
  ], [false, true, true, true]);

  eq('备份文件名 世界名-日期.world.json', backupFileName('九州志', new Date('2026-03-01T00:00:00Z')), '九州志-20260301.world.json');
  eq('文件名里的非法字符被替换', backupFileName('九/州:志', new Date('2026-03-01T00:00:00Z')), '九_州_志-20260301.world.json');
  eq('空名称有兜底', backupFileName('', new Date('2026-03-01T00:00:00Z')), '世界-20260301.world.json');

  const summary = summarizeImportReport({
    entity_count: 12,
    link_count: 7,
    merged_duplicates: 2,
    skipped_links: 1,
    id_map: { a: 'b', c: 'd' },
    dangling_refs: [{ role: 'target', module: 'history', kind: 'event', id: 'abcdef123', link_type: 'core.related_to' }],
    unknown_kinds: ['dragon'],
    unknown_link_types: ['custom.x'],
    warnings: ['有两个模块缺少 config'],
  });
  eq('报告计数映射', [summary.entityCount, summary.linkCount, summary.linkCount === 7, summary.idMapCount, summary.danglingCount], [12, 7, true, 2, 1]);
  eq('失效引用保留标记', summary.keptDangling, true);
  check('报告列出失效引用与降级项', summary.lines.some((line) => line.includes('失效引用')) && summary.lines.some((line) => line.includes('dragon')) && summary.warnings.length === 1, summary.lines);
  eq('失效引用 chip 标签', danglingRefLabel({ role: 'target', module: 'history', kind: 'event', id: 'abcdef123', link_type: 'core.related_to' }), 'target · history/event · core.related_to · abcdef12');
  check('无失效引用时不标记保留', !summarizeImportReport({ entity_count: 0, link_count: 0, merged_duplicates: 0, skipped_links: 0, id_map: {}, dangling_refs: [], unknown_kinds: [], unknown_link_types: [], warnings: [] }).keptDangling);
  check('未知 kind 的文案与后端一致（只报告、不降级）', summary.lines.some((line) => line.includes('未做降级')), summary.lines);
  check('未知关联类型说明是「回落」而不是「降级」', summary.lines.some((line) => line.includes('回落为 core.related_to')), summary.lines);

  // keep_dangling=false 时后端仍会把解析不到的端点列进 dangling_refs（只是不建这条关联），
  // 所以文案与 keptDangling 必须由调用方的真实选择决定，不能只看计数
  const droppedSummary = summarizeImportReport(
    {
      entity_count: 12,
      link_count: 6,
      merged_duplicates: 2,
      skipped_links: 1,
      id_map: { a: 'b' },
      dangling_refs: [{ role: 'target', module: 'history', kind: 'event', id: 'abcdef123', link_type: 'core.related_to' }],
      unknown_kinds: [],
      unknown_link_types: [],
      warnings: [],
    },
    { keepDangling: false }
  );
  eq('keep_dangling=false 时不再标记保留', [droppedSummary.keptDangling, droppedSummary.danglingCount], [false, 1]);
  check('keep_dangling=false 的文案说明已丢弃', droppedSummary.lines.some((line) => line.includes('已按设置丢弃')), droppedSummary.lines);
};

// ---------- 7. 返回栈快照往返（P2 语义不变） ----------

const testBackStack = () => {
  const snapshot = (ref?: EntityRef): ListSnapshot => ({
    tab: 'politics',
    scrollTop: 420,
    expandedIds: ['s1', 's2'],
    selectedRef: ref,
  });
  const ref: EntityRef = { module: 'history', kind: 'event', id: 'e1' };
  let stack: BackStackState = createBackStack();
  check('空栈在根', isAtRoot(stack));
  stack = pushFrame(stack, { ref, label: '楚汉争霸', snapshot: snapshot() });
  eq('入栈后深度 1', stack.frames.length, 1);
  eq('栈顶就是刚进入的实体', peekFrame(stack)?.ref.id, 'e1');

  const back = popFrame(stack);
  eq('出栈返回原快照', back.popped?.snapshot, snapshot());
  check('出栈后回到根', isAtRoot(back.stack));

  stack = pushFrame(pushFrame(createBackStack(), { ref, label: 'A', snapshot: snapshot() }), {
    ref: { module: 'politics', kind: 'polity', id: 'p1' },
    label: 'B',
    snapshot: snapshot(ref),
  });
  eq('面包屑 = 根 + 每一帧', toBreadcrumbs(stack, '世界观').map((item) => item.label), ['世界观', 'A', 'B']);
  const jumped = popToDepth(stack, 0);
  eq('面包屑点根退出最浅帧并带回它的快照', jumped.exited?.snapshot, snapshot());
  eq('面包屑跳转后栈清空', jumped.stack.frames.length, 0);
  const kept = popToDepth(stack, 1);
  eq('面包屑跳转保留指定帧数', kept.stack.frames.length, 1);
  eq('已在目标深度时不改变栈', popToDepth(stack, 2).stack, stack);
  eq('清栈是幂等空操作', clearStack(createBackStack()).frames.length, 0);

  // 快照往返：进入实体前捕获 -> 返回时恢复，字段逐项相等
  const captured: ListSnapshot = {
    tab: 'races',
    scrollTop: 1234,
    expandedIds: ['r1'],
    selectedRef: { module: 'races', kind: 'race', id: 'r1' },
  };
  const deep = pushFrame(createBackStack(), { ref, label: 'X', snapshot: captured });
  const restored = popFrame(deep).popped!.snapshot;
  eq('快照往返：tab / 滚动 / 展开 / 选中项全部还原', restored, captured);
  eq('栈深度上限仍是 8（P2 语义不变）', (() => {
    let s = createBackStack();
    for (let index = 0; index < 12; index += 1) {
      s = pushFrame(s, { ref: { module: 'history', kind: 'event', id: `e${index}` }, label: `E${index}`, snapshot: snapshot() });
    }
    return s.frames.length;
  })(), 8);
};

// ---------- 8. DOM：全局搜索面板（预置缓存，不发请求） ----------

interface Mounted {
  container: HTMLElement;
  text: () => string;
  query: (selector: string) => Element | null;
  queryAll: (selector: string) => Element[];
  click: (selector: string) => void;
  key: (key: string) => void;
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
    click: (selector) => {
      const element = container.querySelector(selector) as HTMLElement | null;
      flushSync(() => element?.click());
    },
    key: (value) => {
      const input = container.querySelector('input[aria-label="搜索关键词"]') as HTMLInputElement | null;
      if (!input) return;
      // React 用 value tracker 去重：必须走原生 setter，否则 onChange 不会触发
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      flushSync(() => {
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
};

const seededClient = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false, staleTime: Infinity, gcTime: Infinity } },
  });
  // 预置 links 缓存：面板打开后不会发任何请求
  client.setQueryData(worldbuildingKeys.links('w1'), [] as WorldLink[]);
  return client;
};

const testDomGlobalSearch = () => {
  const client = seededClient();
  const navigated: EntityRef[] = [];
  let closed = false;
  const view = mount(
    <QueryClientProvider client={client}>
      <GlobalSearch
        open
        onClose={() => {
          closed = true;
        }}
        modules={searchModules()}
        worldId="w1"
        projectId="p1"
        moduleLabels={SEARCH_LABELS}
        onNavigate={(ref) => navigated.push(ref)}
      />
    </QueryClientProvider>
  );
  check('搜索面板渲染出来', !!view.query('[role="dialog"][aria-label="全局搜索"]'));
  check('面板有 aria 标注的输入框', !!view.query('input[aria-label="搜索关键词"]'));
  check('空查询时给搜索范围引导', view.text().includes('搜索全部模块的实体'), view.text().slice(0, 120));

  view.key('大汉');
  check('输入后按模块分组渲染结果', view.text().includes('朝堂') && view.text().includes('大汉帝国'), view.text().slice(0, 200));
  check('命中字段摘要可见', view.text().includes('名称'), view.text().slice(0, 200));
  check('结果行带可点击的命中项', view.queryAll('[data-testid="global-search-hit"]').length > 0, view.queryAll('[data-testid="global-search-hit"]').length);

  view.click('[data-testid="global-search-hit"]');
  eq('选中结果通过 onNavigate 跳转', navigated, [{ module: 'politics', kind: 'polity', id: 'p1' }]);
  check('点击结果后调用方负责关闭面板（onClose 被调用）', closed === true, closed);

  view.unmount();

  // 「关联:」在无关联数据时的降级提示
  const noLinkClient = seededClient();
  const plain = mount(
    <QueryClientProvider client={noLinkClient}>
      <GlobalSearch open onClose={() => undefined} modules={searchModules()} worldId="w1" projectId="p1" onNavigate={() => undefined} />
    </QueryClientProvider>
  );
  plain.key('关联:历史');
  check('「关联:」缺少关联数据时给出降级提示', plain.text().includes('未加载关联数据'), plain.text().slice(0, 200));
  plain.unmount();
};

// ---------- 运行 ----------

const run = async () => {
  try {
    testWorldList();
    testBlankCreate();
    testWorldSettings();
    testWorldWebInputs();
    testGlobalSearch();
    testBackup();
    testBackStack();
    testDomGlobalSearch();
  } catch (error) {
    check(
      'harness 未捕获异常',
      false,
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    );
  }

  (window as unknown as Record<string, unknown>).__PHASE6_TESTS__ = {
    done: true,
    checks,
  } satisfies { done: boolean; checks: Check[] };
};

void run();
