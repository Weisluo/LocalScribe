/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 2 回归用例（浏览器侧）
 *
 * 由 tests/worldbuilding/phase2.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE2_TESTS__。这里只放需要 DOM/React 的断言；
 * 纯静态检查（link_type 白名单、无 emoji、冻结接口）放在 Node 侧的 spec 里。
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { worldbuildingKeys, linkScopeKey } from '@/components/Worldbuilding/hooks/worldQueryKeys';
import {
  buildInlineToken,
  groupLinksByModule,
  isMigrationContainer,
  kindLabel,
  linkCounterpart,
  linkDisplayLabel,
  linkInvolves,
  moduleBadgeClass,
  parseInlineTokens,
  refKey,
  sameRef,
  splitLinks,
  submoduleToRef,
} from '@/components/Worldbuilding/types';
import {
  COMPLEXITY_CAPABILITIES,
  ComplexityProvider,
  ComplexitySwitcher,
  normalizeComplexity,
  useComplexity,
} from '@/components/common/ComplexitySwitcher';
import { EntityBadge } from '@/components/common/EntityBadge';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import { filterLinkTypes } from '@/components/common/EntityPicker/linkTypes';
import { InlineReference } from '@/components/common/InlineReference';
import { LinkPanel } from '@/components/common/LinkPanel';
import { CharacterReference } from '@/components/Worldbuilding/HistoryView/CharacterReference';
import { MigrationContainerPanel } from '@/components/Worldbuilding/MigrationContainerPanel';
import type { EventItem } from '@/components/Worldbuilding/HistoryView/types';
import {
  clearStack,
  createBackStack,
  depthOf,
  isAtRoot,
  peekFrame,
  popFrame,
  popToDepth,
  pushFrame,
  resetStack,
  toBreadcrumbs,
  type NavFrame,
} from '@/components/Worldbuilding/navigation/backStack';
import { worldbuildingApi } from '@/services/worldbuildingApi';
import type { EntityRef, LinkTypeDef, World, WorldLink, WorldWithModules } from '@/services/worldbuildingApi';

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
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    { actual, expected }
  );

// ---------- 渲染工具 ----------

const mount = (node: ReactNode) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(node));
  return {
    container,
    text: () => container.textContent ?? '',
    query: (selector: string) => container.querySelector(selector),
    queryAll: (selector: string) => [...container.querySelectorAll(selector)],
    unmount: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
};

const seededClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      mutations: { retry: false },
    },
  });

// ---------- 测试数据 ----------

const WORLD_ID = 'w1';
const PROJECT_ID = 'p1';

const ref = (module: string, kind: string, id: string): EntityRef => ({ module, kind, id });

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

const REGISTRY: LinkTypeDef[] = [
  {
    id: 'history.involves',
    label: '涉及',
    reverse_label: '被涉及',
    directed: true,
    icon: 'users',
    color: 'amber',
    line_style: 'solid',
    group: 'history',
    source: [ref('history', 'event', '*')],
    target: [ref('character', 'character', '*')],
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
  // 契约 §4.1 另外两条通用类型：source/target 为 null，作为不匹配时的回退
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
    color: 'slate',
    line_style: 'dashed',
    group: 'general',
    source: null,
    target: null,
  },
  // 需要 (module, kind) 同时匹配的专用类型（源为政治人物，用于证明匹配而非仅回退）
  {
    id: 'politics.member_of',
    label: '效忠/隶属',
    reverse_label: '拥有成员',
    directed: true,
    icon: 'users-round',
    color: 'red',
    line_style: 'solid',
    group: 'politics',
    source: [ref('politics', 'figure', '*')],
    target: [ref('politics', 'polity', '*')],
  },
  {
    id: 'character.serves',
    label: '效力于',
    reverse_label: '效力于',
    directed: true,
    icon: 'briefcase',
    color: 'red',
    line_style: 'solid',
    group: 'character',
    source: [ref('character', 'character', '*')],
    target: [ref('politics', 'polity', '*')],
  },
];

/** 契约 §4.1 的三条通用类型（不匹配专用类型时的回退集合） */
const GENERIC_LINK_TYPES = ['core.related_to', 'core.references', 'custom.link'];

// ---------- A. 查询键与参数快照（P2-T1） ----------

const testQueryKeys = () => {
  eq('queryKey: worlds 按项目作用域', worldbuildingKeys.worlds('p1'), [
    'worldbuilding',
    'worlds',
    'p1',
  ]);
  eq('queryKey: worlds 缺省作用域为 all', worldbuildingKeys.worlds(), [
    'worldbuilding',
    'worlds',
    'all',
  ]);
  eq('queryKey: world', worldbuildingKeys.world('w1'), [
    'worldbuilding',
    'world',
    'w1',
    true,
  ]);
  eq('queryKey: world 的 includeItems 参与区分', worldbuildingKeys.world('w1', false), [
    'worldbuilding',
    'world',
    'w1',
    false,
  ]);
  eq('queryKey: links 归一到 links 资源前缀', worldbuildingKeys.links('w1', { module: 'history', entityId: 'e1' })[0], 'worldbuilding');
  eq('queryKey: links 前两位固定', worldbuildingKeys.links('w1', { module: 'history', entityId: 'e1' }).slice(0, 3), [
    'worldbuilding',
    'links',
    'w1',
  ]);
  eq('queryKey: counts 与 links 同前缀', worldbuildingKeys.linkCounts('w1'), [
    'worldbuilding',
    'links',
    'counts',
    'w1',
  ]);
  eq('queryKey: 迁移容器（P2-T13 冻结形状）', worldbuildingKeys.migrationContainer('p1'), [
    'worldbuilding',
    'migration-container',
    'p1',
  ]);
  eq('queryKey: link registry', worldbuildingKeys.linkRegistry(), [
    'worldbuilding',
    'link-registry',
  ]);

  // 稳定性：同样参数得到同样 key；不同参数必须区分
  const a = linkScopeKey({ module: 'history', entityId: 'e1' });
  const b = linkScopeKey({ module: 'history', entityId: 'e1' });
  const c = linkScopeKey({ module: 'history', entityId: 'e2' });
  const d = linkScopeKey({ module: 'politics', entityId: 'e1' });
  check('linkScopeKey 同参数稳定', a === b, { a, b });
  check('linkScopeKey 不同实体区分', a !== c, { a, c });
  check('linkScopeKey 不同模块区分', a !== d, { a, d });
  check('linkScopeKey 缺省为 all', linkScopeKey() === 'all', linkScopeKey());
  eq(
    'queryKey: links 用 scopeKey 而非对象（可比较）',
    worldbuildingKeys.links('w1', { module: 'history', entityId: 'e1' })[3],
    a
  );
};

// ---------- B. types 纯函数（P2-T1/T2） ----------

const testTypeHelpers = () => {
  const eventRef = ref('history', 'event', 'e1');
  eq('refKey 三元组', refKey(eventRef), 'history:event:e1');
  check('sameRef 相等', sameRef(eventRef, { ...eventRef }));
  check('sameRef 不同 kind', !sameRef(eventRef, ref('history', 'era', 'e1')));

  // history submodule 无 kind 时按契约 §2.3 退化为 event
  const noKind = submoduleToRef('history', {
    id: 's1',
    name: 'x',
    order_index: 0,
    item_count: 0,
    module_id: 'm1',
  } as never);
  eq('submoduleToRef: history 缺 kind 退化为 event', noKind.kind, 'event');
  const kinded = submoduleToRef('history', {
    id: 's2',
    name: 'x',
    order_index: 0,
    item_count: 0,
    module_id: 'm1',
    kind: 'era',
  } as never);
  eq('submoduleToRef: 显式 kind 优先', kinded.kind, 'era');

  const out1 = link('l1', eventRef, ref('character', 'character', 'c1'), 'history.involves');
  const out2 = link('l2', eventRef, ref('politics', 'polity', 'n1'), 'history.involves');
  const in1 = link('l3', ref('politics', 'polity', 'n2'), eventRef, 'history.involves');
  const all = [out1, out2, in1];

  const grouped = splitLinks(all, eventRef);
  eq('splitLinks 出链', grouped.outgoing.map((l) => l.id), ['l1', 'l2']);
  eq('splitLinks 入链', grouped.incoming.map((l) => l.id), ['l3']);

  // v1.1：入参是世界级共享列表，与 ref 无关的关联不得计入出链/入链（否则计数与分组会串）
  const unrelated = link(
    'l4',
    ref('map', 'region', 'r1'),
    ref('economy', 'resource', 'e1'),
    'core.related_to'
  );
  const mixed = splitLinks([out1, out2, in1, unrelated], eventRef);
  eq('splitLinks 忽略无关关联（出链）', mixed.outgoing.map((l) => l.id), ['l1', 'l2']);
  eq('splitLinks 忽略无关关联（入链）', mixed.incoming.map((l) => l.id), ['l3']);
  eq('linkInvolves 无关关联为 false', linkInvolves(unrelated, eventRef), false);
  eq('linkInvolves 出链为 true', linkInvolves(out1, eventRef), true);
  eq('linkInvolves 入链为 true', linkInvolves(in1, eventRef), true);

  eq(
    'linkCounterpart 出链取 target',
    linkCounterpart(out1, eventRef).id,
    'c1'
  );
  eq(
    'linkCounterpart 入链取 source',
    linkCounterpart(in1, eventRef).id,
    'n2'
  );

  const registry = new Map(REGISTRY.map((d) => [d.id, d]));
  eq(
    'linkDisplayLabel 出链用 label',
    linkDisplayLabel(out1, eventRef, registry),
    '涉及'
  );
  eq(
    'linkDisplayLabel 入链用 reverse_label',
    linkDisplayLabel(in1, eventRef, registry),
    '被涉及'
  );
  eq(
    'linkDisplayLabel 入链 label 覆盖失效时仍用 reverse_label',
    linkDisplayLabel({ ...in1, label: null }, eventRef, registry),
    '被涉及'
  );
  eq(
    'linkDisplayLabel 未知类型回退 id',
    linkDisplayLabel(
      link('l9', eventRef, ref('x', 'y', 'z'), 'unknown.type'),
      eventRef,
      registry
    ),
    'unknown.type'
  );

  const groups = groupLinksByModule(all, eventRef);
  eq('groupLinksByModule 模块分组', groups.map((g) => g.module), ['politics', 'character']);
  eq('groupLinksByModule 组内成员', groups.find((g) => g.module === 'character')?.links.map((l) => l.id), ['l1']);

  // 行内引用 token
  const text = '赤壁之后，[[character:character:c1|诸葛亮]] 出使江东。';
  const tokens = parseInlineTokens(text);
  eq('parseInlineTokens 命中 1 个 token', tokens.length, 1);
  eq('parseInlineTokens 解析 ref', tokens[0]?.ref, {
    module: 'character',
    kind: 'character',
    id: 'c1',
  });
  eq('parseInlineTokens 带显示名', tokens[0]?.displayName, '诸葛亮');
  eq(
    'parseInlineTokens 忽略非法 token',
    parseInlineTokens('[[broken]] 与 [[a:b]] 都不算').length,
    0
  );
  eq(
    'buildInlineToken 与 parse 往返',
    parseInlineTokens(buildInlineToken(ref('history', 'event', 'e9'), '长平之战'))[0]?.ref,
    { module: 'history', kind: 'event', id: 'e9' }
  );

  check(
    'isMigrationContainer 只认 settings.migrationContainer === true',
    isMigrationContainer({ settings: { migrationContainer: true } } as never) &&
      !isMigrationContainer({ settings: { migrationContainer: false } } as never) &&
      !isMigrationContainer({ settings: {} } as never) &&
      !isMigrationContainer({} as never)
  );

  check(
    'moduleBadgeClass 未知模块回退 special',
    moduleBadgeClass('unknown') === moduleBadgeClass('special')
  );
  eq('kindLabel 已知 kind 转中文', kindLabel('polity'), '政权');
  eq('kindLabel 未知 kind 原样返回', kindLabel('custom_thing'), 'custom_thing');
};

// ---------- C. 复杂度（P2-T5） ----------

const ComplexityProbe = () => {
  const { level, capabilities, can } = useComplexity();
  return (
    <div
      data-testid="probe"
      data-level={level}
      data-link-panel={String(capabilities.linkPanel)}
      data-can-web={String(can('worldWeb'))}
    />
  );
};

/** 受控探针：让键盘/点击真的改变选中档，从而验证 aria 与 onChange 同步 */
const SwitcherHarness = () => {
  const [level, setLevel] = useState<'sketch' | 'structure' | 'sandbox'>('structure');
  return <ComplexitySwitcher value={level} onChange={setLevel} />;
};

const testComplexity = () => {
  check(
    '能力矩阵：sketch 只有计数与行内引用',
    COMPLEXITY_CAPABILITIES.sketch.linkCounts &&
      COMPLEXITY_CAPABILITIES.sketch.inlineReference &&
      !COMPLEXITY_CAPABILITIES.sketch.linkPanel &&
      !COMPLEXITY_CAPABILITIES.sketch.linkPicker &&
      !COMPLEXITY_CAPABILITIES.sketch.worldWeb
  );
  check(
    '能力矩阵：structure 追加面板/选择器/画布，未开沙盘能力',
    COMPLEXITY_CAPABILITIES.structure.linkPanel &&
      COMPLEXITY_CAPABILITIES.structure.linkPicker &&
      COMPLEXITY_CAPABILITIES.structure.canvas &&
      !COMPLEXITY_CAPABILITIES.structure.linkTimeline &&
      !COMPLEXITY_CAPABILITIES.structure.worldWeb
  );
  check(
    '能力矩阵：sandbox 全开',
    Object.values(COMPLEXITY_CAPABILITIES.sandbox).every(Boolean)
  );
  check(
    '能力矩阵：只控制披露，不删数据（各档 linkCounts/inlineReference 恒为 true）',
    (['sketch', 'structure', 'sandbox'] as const).every(
      (level) =>
        COMPLEXITY_CAPABILITIES[level].linkCounts &&
        COMPLEXITY_CAPABILITIES[level].inlineReference
    )
  );
  eq('normalizeComplexity 合法值', normalizeComplexity('sandbox'), 'sandbox');
  eq('normalizeComplexity 非法值退化 sketch', normalizeComplexity('complex'), 'sketch');
  eq('normalizeComplexity null 退化 sketch', normalizeComplexity(null), 'sketch');

  // 无 Provider 降级
  const probe = mount(<ComplexityProbe />);
  eq('useComplexity 无 Provider 降级 sketch', probe.query('[data-testid="probe"]')?.getAttribute('data-level'), 'sketch');
  check('useComplexity 无 Provider 时 linkPanel 关闭', probe.query('[data-testid="probe"]')?.getAttribute('data-link-panel') === 'false');
  probe.unmount();

  // Provider + Switcher
  const view = mount(
    <ComplexityProvider defaultLevel="structure">
      <ComplexityProbe />
      <SwitcherHarness />
    </ComplexityProvider>
  );
  eq(
    'ComplexityProvider 采用 defaultLevel',
    view.query('[data-testid="probe"]')?.getAttribute('data-level'),
    'structure'
  );

  const radios = view.queryAll('[role="radio"]');
  eq('ComplexitySwitcher 渲染三档', radios.length, 3);
  eq(
    'ComplexitySwitcher 选中态 aria-checked',
    radios.map((r) => r.getAttribute('aria-checked')),
    ['false', 'true', 'false']
  );
  check(
    'ComplexitySwitcher 仅选中项可 Tab 进入',
    radios.map((r) => r.getAttribute('tabindex')).join(',') === '-1,0,-1'
  );
  eq(
    'ComplexitySwitcher 展示三档中文标签',
    radios.map((r) => r.textContent).join('|'),
    '速写|结构|沙盘'
  );

  // 方向键切换（radiogroup 键盘交互）
  const group = view.query('[role="radiogroup"]');
  dispatchKey(group, 'ArrowRight');
  eq(
    'ComplexitySwitcher 方向键右移一档',
    view
      .queryAll('[role="radio"]')
      .map((r) => r.getAttribute('aria-checked'))
      .join(','),
    'false,false,true'
  );
  dispatchKey(group, 'ArrowRight');
  eq(
    'ComplexitySwitcher 方向键在末尾环绕',
    view
      .queryAll('[role="radio"]')
      .map((r) => r.getAttribute('aria-checked'))
      .join(','),
    'true,false,false'
  );
  dispatchKey(group, 'ArrowLeft');
  eq(
    'ComplexitySwitcher 方向键左移并环绕',
    view
      .queryAll('[role="radio"]')
      .map((r) => r.getAttribute('aria-checked'))
      .join(','),
    'false,false,true'
  );

  // 点击切换
  flushSync(() => {
    (view.queryAll('[role="radio"]')[1] as HTMLButtonElement).click();
  });
  eq(
    'ComplexitySwitcher 点击切换档位',
    view
      .queryAll('[role="radio"]')
      .map((r) => r.getAttribute('aria-checked'))
      .join(','),
    'false,true,false'
  );

  view.unmount();
};

const dispatchKey = (element: Element | null, key: string) => {
  if (!element) return;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  flushSync(() => {
    element.dispatchEvent(event);
  });
};

// ---------- D. EntityBadge（P2-T2） ----------

const testEntityBadge = () => {
  let clicked: EntityRef | null = null;

  const valid = mount(
    <EntityBadge
      entityRef={ref('politics', 'polity', 'n1')}
      name="荆州牧"
      onClick={(target) => {
        clicked = target;
      }}
    />
  );
  check('EntityBadge 展示解析后的名称', valid.text().includes('荆州牧'), valid.text());
  check('EntityBadge 展示 kind 标签', valid.text().includes('政权'), valid.text());
  check('EntityBadge 默认不展示模块名', !valid.text().includes('政治'), valid.text());
  const button = valid.query('button');
  check('EntityBadge 可点击时渲染 button', !!button);
  flushSync(() => {
    (button as HTMLButtonElement).click();
  });
  eq('EntityBadge onClick 回传 ref', clicked, ref('politics', 'polity', 'n1'));
  valid.unmount();

  const withModule = mount(
    <EntityBadge entityRef={ref('races', 'race', 'r1')} name="灵族" showModule />
  );
  check('EntityBadge showModule 展示模块名', withModule.text().includes('种族'), withModule.text());
  withModule.unmount();

  const invalid = mount(
    <EntityBadge entityRef={ref('history', 'event', 'gone')} name="已删事件" invalid />
  );
  check('EntityBadge 失效态标注', invalid.text().includes('已失效'), invalid.text());
  const invalidEl = invalid.query('span');
  check(
    'EntityBadge 失效态使用警示样式',
    (invalidEl?.className ?? '').includes('border-dashed'),
    invalidEl?.className
  );
  check(
    'EntityBadge 失效态 title 提示目标已不存在',
    (invalidEl?.getAttribute('title') ?? '').includes('目标已不存在'),
    invalidEl?.getAttribute('title')
  );
  invalid.unmount();

  const anonymous = mount(
    <EntityBadge entityRef={ref('economy', 'good', 'abcdefghijklmnop')} />
  );
  check(
    'EntityBadge 无名称时回退 id 短号',
    anonymous.text().includes('abcdefgh'),
    anonymous.text()
  );
  anonymous.unmount();
};

// ---------- E. 共用件：LinkPanel / EntityPicker / InlineReference（P2-T3/T4/T8） ----------

type Mounted = ReturnType<typeof mount>;

const EVENT_REF = ref('history', 'event', 'e1');

/** 等 React 的被动副作用与 mutation 微任务落定后再断言 */
const settle = async (rounds = 4) => {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const renderClient = (client: QueryClient, node: ReactNode) =>
  mount(<QueryClientProvider client={client}>{node}</QueryClientProvider>);

const submoduleFixture = (
  id: string,
  moduleId: string,
  name: string,
  kind: string,
  order: number
) => ({
  id,
  module_id: moduleId,
  name,
  kind,
  description: null,
  meta: null,
  color: null,
  icon: null,
  parent_id: null,
  order_index: order,
  item_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const moduleFixture = (
  id: string,
  moduleType: string,
  name: string,
  order: number,
  submodules: unknown[]
) => ({
  id,
  template_id: WORLD_ID,
  module_type: moduleType,
  name,
  description: null,
  icon: null,
  order_index: order,
  config: null,
  is_collapsible: true,
  is_required: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  submodule_count: submodules.length,
  item_count: 0,
  submodules,
  items: [],
});

/** 世界 fixture：含 project_id（供角色索引派生）与未接入的 map/special 模块 */
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
  module_count: 4,
  link_count: 4,
  modules: [
    moduleFixture('m-history', 'history', '历史', 0, [
      submoduleFixture('e1', 'm-history', '赤壁之战', 'event', 0),
      submoduleFixture('e2', 'm-history', '官渡之战', 'event', 1),
      submoduleFixture('e3', 'm-history', '三国时代', 'era', 2),
    ]),
    moduleFixture('m-politics', 'politics', '政治', 1, [
      submoduleFixture('n1', 'm-politics', '荆州牧', 'polity', 0),
      submoduleFixture('n2', 'm-politics', '孙氏政权', 'polity', 1),
    ]),
    moduleFixture('m-map', 'map', '地图', 2, [
      submoduleFixture('g1', 'm-map', '荆州', 'region', 0),
    ]),
    moduleFixture('m-special', 'special', '特殊', 3, [
      submoduleFixture('x1', 'm-special', '秘辛', 'custom', 0),
    ]),
  ],
} as unknown as WorldWithModules;

const CHARACTERS = [
  { id: 'c1', name: '诸葛亮' },
  { id: 'c2', name: '周瑜' },
];

/** 完整角色行：CharacterBarCard 按 level 取尺寸/配色，缺 level 会渲染时报错 */
const CHARACTER_ROWS = [
  { id: 'c1', name: '诸葛亮', level: 'support' },
  { id: 'c2', name: '周瑜', level: 'support' },
  { id: 'c3', name: '曹操', level: 'support' },
];

/** 全部查询都从缓存预置，绝不发真实请求 */
const seedWorld = (client: QueryClient, links: WorldLink[] = []) => {
  client.setQueryData(worldbuildingKeys.world(WORLD_ID), WORLD_FIXTURE);
  client.setQueryData(worldbuildingKeys.linkRegistry(), REGISTRY);
  client.setQueryData(['characters-simple', PROJECT_ID], CHARACTERS);
  // LinkPanel / CharacterReference / useEntityLinkCounts 都读世界级共享列表（无 scope）
  client.setQueryData(worldbuildingKeys.links(WORLD_ID), links);
  client.setQueryData(
    worldbuildingKeys.links(WORLD_ID, { module: 'history', entityId: 'e1' }),
    links
  );
  client.setQueryData(worldbuildingKeys.linkCounts(WORLD_ID), [
    { module: 'history', outgoing: 3, incoming: 1, total: 4 },
  ]);
};

/** 出链 l1/l2/l4（l4 对端不存在，用于失效态）+ 入链 l3 */
const LINK_FIXTURE: WorldLink[] = [
  link('l1', EVENT_REF, ref('character', 'character', 'c1'), 'history.involves'),
  link('l2', EVENT_REF, ref('politics', 'polity', 'n1'), 'core.related_to', {
    note: '荆州牧与赤壁',
    time: { start: '208 年', end: null },
  }),
  link('l3', ref('politics', 'polity', 'n2'), EVENT_REF, 'history.involves'),
  link('l4', EVENT_REF, ref('races', 'race', 'gone'), 'core.related_to'),
];

/** React 受控输入：绕过 value tracker 后派发 input/change */
const setFieldValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null,
  next: string
) => {
  if (!element) return;
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, next);
  flushSync(() => {
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {
        bubbles: true,
      })
    );
  });
};

const rowsOf = (view: Mounted) =>
  [...view.container.querySelectorAll('div.group')] as HTMLElement[];

const rowOf = (view: Mounted, needle: string) =>
  rowsOf(view).find((row) => (row.textContent ?? '').includes(needle)) ?? null;

/** 按可见文案点按钮（找不到返回 false，便于 check 里断言） */
const clickButton = (view: Mounted, text: string) => {
  const button = [...view.queryAll('button')].find(
    (candidate) => (candidate.textContent ?? '').trim() === text
  );
  flushSync(() => {
    (button as HTMLButtonElement | undefined)?.click();
  });
  return !!button;
};

// ---- A. LinkPanel ----

const testLinkPanel = async () => {
  const client = seededClient();
  seedWorld(client, LINK_FIXTURE);
  const view = renderClient(
    client,
    <LinkPanel
      worldId={WORLD_ID}
      entity={EVENT_REF}
      complexity="structure"
      title="关联"
      onNavigate={() => undefined}
    />
  );
  await settle();

  check('LinkPanel 出链计数', view.text().includes('出链 3'), view.text());
  check('LinkPanel 入链计数', view.text().includes('入链 1'), view.text());

  check(
    'LinkPanel 出链显示 registry 的 label',
    (rowOf(view, '诸葛亮')?.textContent ?? '').includes('涉及'),
    rowOf(view, '诸葛亮')?.textContent
  );
  check(
    'LinkPanel 入链显示 reverse_label',
    (rowOf(view, '孙氏政权')?.textContent ?? '').includes('被涉及'),
    rowOf(view, '孙氏政权')?.textContent
  );
  check(
    'LinkPanel 行内显示 kind 徽章与 time/note 摘要',
    (rowOf(view, '荆州牧')?.textContent ?? '').includes('政权') &&
      (rowOf(view, '荆州牧')?.textContent ?? '').includes('208 年') &&
      (rowOf(view, '荆州牧')?.textContent ?? '').includes('荆州牧与赤壁'),
    rowOf(view, '荆州牧')?.textContent
  );

  const outRow = rowOf(view, '诸葛亮');
  const inRow = rowOf(view, '孙氏政权');
  check(
    'LinkPanel 出链行有编辑与删除入口',
    !!outRow?.querySelector('[aria-label="编辑关联"]') &&
      !!outRow?.querySelector('[aria-label="删除关联"]'),
    outRow?.textContent
  );
  check(
    'LinkPanel 入链行只读（无编辑/删除入口）',
    !!inRow &&
      !inRow.querySelector(
        '[aria-label="编辑关联"], [aria-label="删除关联"], [aria-label="清理失效关联"]'
      ),
    inRow?.textContent
  );

  const invalidRow = rowOf(view, 'gone');
  check(
    'LinkPanel 失效引用渲染警示 chip',
    !!invalidRow?.querySelector('.border-dashed'),
    invalidRow?.textContent
  );
  check(
    'LinkPanel 失效引用提供一键清理',
    !!invalidRow?.querySelector('[aria-label="清理失效关联"]'),
    invalidRow?.textContent
  );

  // 删除：monkeypatch API 与缓存失效，避免真实请求
  const api = worldbuildingApi as unknown as {
    deleteWorldLink: (linkId: string) => Promise<unknown>;
  };
  const originalDelete = api.deleteWorldLink;
  const originalInvalidate = client.invalidateQueries.bind(client);
  const deleted: string[] = [];
  const invalidatedKeys: string[] = [];
  api.deleteWorldLink = (linkId: string) => {
    deleted.push(linkId);
    return Promise.resolve(undefined);
  };
  client.invalidateQueries = ((filters?: { queryKey?: unknown[] }) => {
    invalidatedKeys.push(JSON.stringify(filters?.queryKey ?? []));
    return Promise.resolve();
  }) as unknown as typeof client.invalidateQueries;
  try {
    const deleteButton = outRow?.querySelector(
      '[aria-label="删除关联"]'
    ) as HTMLButtonElement | null;
    flushSync(() => {
      deleteButton?.click();
    });
    await settle();
    eq('LinkPanel 删除出链调用 deleteWorldLink(linkId)', deleted, ['l1']);
    check(
      'LinkPanel 删除后整批失效 links 缓存（不逐卡请求）',
      invalidatedKeys.includes(JSON.stringify(['worldbuilding', 'links'])),
      invalidatedKeys
    );
    check(
      'LinkPanel 删除后同时失效世界列表/详情（link_count 徽章）',
      invalidatedKeys.includes(JSON.stringify(['worldbuilding', 'worlds'])) &&
        invalidatedKeys.includes(JSON.stringify(['worldbuilding', 'world'])),
      invalidatedKeys
    );
  } finally {
    api.deleteWorldLink = originalDelete;
    client.invalidateQueries = originalInvalidate;
  }
  view.unmount();

  // sketch（无 Provider 退化为 sketch）：默认收起但添加入口必须可见
  const sketchClient = seededClient();
  seedWorld(sketchClient, LINK_FIXTURE);
  const sketchView = renderClient(
    sketchClient,
    <LinkPanel worldId={WORLD_ID} entity={EVENT_REF} />
  );
  await settle();
  check(
    'LinkPanel sketch 默认收起（不展开关联明细）',
    !sketchView.text().includes('诸葛亮'),
    sketchView.text()
  );
  check(
    'LinkPanel sketch 仍显示关联计数',
    sketchView.text().includes('出链 3') && sketchView.text().includes('入链 1'),
    sketchView.text()
  );
  check(
    'LinkPanel sketch 仍有添加关联入口',
    [...sketchView.queryAll('button')].some((button) =>
      (button.textContent ?? '').includes('添加关联')
    ),
    sketchView.text()
  );
  sketchView.unmount();
};

// ---- B. EntityPicker ----

const testEntityPicker = async () => {
  // 类型过滤纯函数：id="*" 必须被忽略，不匹配时回退三种通用类型
  eq(
    'filterLinkTypes 忽略 registry 中 EntityRef 的 id="*"',
    filterLinkTypes(REGISTRY, EVENT_REF, [ref('character', 'character', 'c1')]).map(
      (definition) => definition.id
    ),
    ['history.involves', 'core.related_to', 'core.references', 'custom.link']
  );
  eq(
    'filterLinkTypes 不匹配时回退三种通用类型',
    filterLinkTypes(REGISTRY, EVENT_REF, [ref('races', 'race', 'r9')]).map(
      (definition) => definition.id
    ),
    GENERIC_LINK_TYPES
  );

  const client = seededClient();
  seedWorld(client);
  const confirmed: EntityPickerSelection[] = [];
  const view = renderClient(
    client,
    <EntityPicker
      open
      worldId={WORLD_ID}
      source={EVENT_REF}
      multi
      onClose={() => undefined}
      onConfirm={(selection) => confirmed.push(selection)}
    />
  );
  await settle();

  const options = () => [...view.queryAll('[role="option"]')] as HTMLElement[];
  const optionTexts = () => options().map((option) => option.textContent ?? '');
  const clickOption = (needle: string) => {
    const target = options().find((option) =>
      (option.textContent ?? '').includes(needle)
    );
    flushSync(() => {
      (target as HTMLButtonElement | undefined)?.click();
    });
  };

  const moduleText = optionTexts().join('|');
  check(
    'EntityPicker 步骤一展示已接入模块',
    moduleText.includes('历史') && moduleText.includes('政治'),
    moduleText
  );
  check(
    'EntityPicker 步骤一隐藏未接入的 map/special',
    !moduleText.includes('地图') && !moduleText.includes('特殊'),
    moduleText
  );

  clickOption('历史');
  await settle();
  eq('EntityPicker 实体候选排除关联源自身', optionTexts().length, 2);
  check(
    'EntityPicker 实体候选不含源实体',
    optionTexts().every((text) => !text.includes('赤壁之战')),
    optionTexts()
  );

  const searchInput = view.query('input[type="text"]') as HTMLInputElement | null;
  setFieldValue(searchInput, '官渡');
  await settle();
  eq('EntityPicker 搜索过滤候选集', optionTexts(), ['事件官渡之战']);

  setFieldValue(searchInput, '');
  const kindSelect = view.query('select') as HTMLSelectElement | null;
  setFieldValue(kindSelect, 'era');
  await settle();
  eq('EntityPicker kind 过滤候选集', optionTexts(), ['时代三国时代']);
  setFieldValue(kindSelect, 'all');
  await settle();

  // 回到模块步骤改选角色，验证 registry 只按 (module,kind) 匹配
  clickButton(view, '历史');
  await settle();
  clickOption('角色');
  await settle();
  check(
    'EntityPicker 角色模块候选来自 characters-simple',
    optionTexts().some((text) => text.includes('诸葛亮')),
    optionTexts()
  );

  clickOption('诸葛亮');
  await settle();
  clickButton(view, '下一步');
  await settle();
  eq(
    'EntityPicker 关联类型按 (module,kind) 过滤（忽略 id="*"）',
    options().map((option) => option.getAttribute('title')),
    ['history.involves', 'core.related_to', 'core.references', 'custom.link']
  );

  // 多选批量：再选一个角色后保存
  clickButton(view, '上一步');
  await settle();
  clickOption('周瑜');
  await settle();
  clickButton(view, '下一步');
  await settle();
  clickButton(view, '保存');
  await settle();
  eq('EntityPicker multi 批量 targets 数量', confirmed[0]?.targets.length, 2);
  eq(
    'EntityPicker multi 批量 targets 顺序',
    confirmed[0]?.targets.map((target) => target.id),
    ['c1', 'c2']
  );
  eq(
    'EntityPicker 默认关联类型为第一条合法类型',
    confirmed[0]?.linkType,
    'history.involves'
  );
  view.unmount();

  // 键盘：上下键移动高亮 + Enter 确认
  const enterClient = seededClient();
  seedWorld(enterClient);
  const enterView = renderClient(
    enterClient,
    <EntityPicker
      open
      worldId={WORLD_ID}
      source={EVENT_REF}
      presetModule="history"
      onClose={() => undefined}
      onConfirm={() => undefined}
    />
  );
  await settle();
  // 真实路径：Modal 自动聚焦搜索框，键盘事件应从搜索框进入列表（挂在步骤容器上）
  const keyboardField = enterView.query('input[type="text"]');
  check(
    'EntityPicker 搜索框存在（键盘入口）',
    !!keyboardField,
    keyboardField?.outerHTML ?? null
  );
  dispatchKey(keyboardField, 'ArrowDown');
  dispatchKey(keyboardField, 'Enter');
  await settle();
  eq(
    'EntityPicker 从搜索框按上下键 + Enter 确认高亮项',
    ([...enterView.queryAll('[role="option"]')] as HTMLElement[]).map((option) =>
      option.getAttribute('aria-selected')
    ),
    ['false', 'true']
  );
  enterView.unmount();

  // 键盘：Esc 触发 onClose（Modal 承担）
  const escClient = seededClient();
  seedWorld(escClient);
  let closedCount = 0;
  const escView = renderClient(
    escClient,
    <EntityPicker
      open
      worldId={WORLD_ID}
      source={EVENT_REF}
      onClose={() => {
        closedCount += 1;
      }}
      onConfirm={() => undefined}
    />
  );
  await settle();
  flushSync(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  eq('EntityPicker Esc 触发 onClose', closedCount, 1);
  escView.unmount();
};

// ---- C. InlineReference ----

const InlineHarness = ({
  initial,
  readOnly = false,
}: {
  initial: string;
  readOnly?: boolean;
}) => {
  const [current, setCurrent] = useState(initial);
  return (
    <div>
      <InlineReference
        value={current}
        onChange={readOnly ? undefined : setCurrent}
        worldId={WORLD_ID}
        projectId={PROJECT_ID}
        readOnly={readOnly}
      />
      <div data-testid="inline-value">{current}</div>
    </div>
  );
};

const inlineValue = (view: Mounted) =>
  view.query('[data-testid="inline-value"]')?.textContent ?? '';

const testInlineReference = async () => {
  // readOnly：chip 渲染 + 实时解析 + 失效态
  const client = seededClient();
  seedWorld(client);
  const view = renderClient(
    client,
    <InlineHarness
      initial="前文 [[history:event:e1|旧名]] 后文 [[races:race:gone|消失的族]]"
      readOnly
    />
  );
  await settle();
  check(
    'InlineReference readOnly 有效 token 显示实时解析名',
    view.text().includes('赤壁之战'),
    view.text()
  );
  check(
    'InlineReference readOnly 保留 token 之外的正文',
    view.text().includes('前文') && view.text().includes('后文'),
    view.text()
  );
  check(
    'InlineReference readOnly 失效 token 显示失效态',
    view.text().includes('已失效'),
    view.text()
  );
  check(
    'InlineReference readOnly 失效 chip 使用警示样式',
    !!view.query('.border-dashed')
  );
  check(
    'InlineReference readOnly 不渲染输入控件',
    !view.query('textarea') && !view.query('input')
  );
  view.unmount();

  // 编辑态：输入 @ 打开选择器，确认后插入 token 并恢复焦点
  const editClient = seededClient();
  seedWorld(editClient);
  const editView = renderClient(editClient, <InlineHarness initial="赤壁之后，" />);
  await settle();
  const textarea = editView.query('textarea') as HTMLTextAreaElement | null;
  check('InlineReference 编辑态渲染 textarea', !!textarea);

  if (textarea) {
    const prefix = '赤壁之后，';
    const expected = `${prefix}${buildInlineToken(EVENT_REF, '赤壁之战')}`;
    textarea.focus();
    textarea.setSelectionRange(prefix.length, prefix.length);
    dispatchKey(textarea, '@');
    // 模拟浏览器把 @ 写进正文
    setFieldValue(textarea, `${prefix}@`);
    await settle();
    check(
      'InlineReference 输入 @ 打开 EntityPicker',
      ([...editView.queryAll('[role="option"]')] as HTMLElement[]).length > 0,
      ([...editView.queryAll('[role="option"]')] as HTMLElement[]).map(
        (option) => option.textContent
      )
    );

    const pickOption = (needle: string) => {
      const target = ([...editView.queryAll('[role="option"]')] as HTMLElement[]).find(
        (option) => (option.textContent ?? '').includes(needle)
      );
      flushSync(() => {
        (target as HTMLButtonElement | undefined)?.click();
      });
    };
    pickOption('历史');
    await settle();
    pickOption('赤壁之战');
    await settle();
    clickButton(editView, '保存');
    await settle();

    eq('InlineReference 确认后插入 token', inlineValue(editView), expected);
    check(
      'InlineReference 确认后不残留触发用 @',
      !inlineValue(editView).includes('@'),
      inlineValue(editView)
    );
    check(
      'InlineReference 确认后焦点回到输入框',
      document.activeElement === textarea,
      document.activeElement?.tagName
    );
    check(
      'InlineReference 确认后 caret 落在 token 之后',
      textarea.selectionStart === expected.length,
      textarea.selectionStart
    );
  }
  editView.unmount();

  // 取消选择器：清掉触发用的孤立 @
  const cancelClient = seededClient();
  seedWorld(cancelClient);
  const cancelView = renderClient(cancelClient, <InlineHarness initial="赤壁之后，" />);
  await settle();
  const cancelTextarea = cancelView.query('textarea') as HTMLTextAreaElement | null;
  if (cancelTextarea) {
    const prefix = '赤壁之后，';
    cancelTextarea.focus();
    cancelTextarea.setSelectionRange(prefix.length, prefix.length);
    dispatchKey(cancelTextarea, '@');
    setFieldValue(cancelTextarea, `${prefix}@`);
    await settle();
    eq('InlineReference 取消前正文含触发用 @', inlineValue(cancelView), `${prefix}@`);
    flushSync(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    await settle();
    eq('InlineReference 取消选择器不残留孤立 @', inlineValue(cancelView), prefix);
  }
  cancelView.unmount();
};

// ---------- E. 返回栈（P2-T7） ----------

const testBackStack = () => {
  const frameOf = (
    id: string,
    label: string,
    tab = 'history',
    scrollTop = 0
  ): NavFrame => ({
    ref: ref('history', 'event', id),
    label,
    snapshot: { tab, scrollTop, expandedIds: [`exp-${id}`] },
  });

  const empty = createBackStack();
  check('backStack 初始为空栈', isAtRoot(empty) && depthOf(empty) === 0);
  check('backStack 空栈 peek 为 undefined', peekFrame(empty) === undefined);

  const one = pushFrame(empty, frameOf('e1', '赤壁之战', 'history', 120));
  check(
    'backStack push 不可变（原栈不受影响）',
    empty.frames.length === 0 && one.frames.length === 1
  );
  check('backStack push 后非根', !isAtRoot(one) && depthOf(one) === 1);
  eq('backStack peek 取栈顶', peekFrame(one)?.label, '赤壁之战');

  const two = pushFrame(one, frameOf('e2', '官渡之战'));
  eq('backStack 顺序为先进后出', two.frames.map((frame) => frame.label), [
    '赤壁之战',
    '官渡之战',
  ]);
  eq('backStack 快照随帧保存', peekFrame(two)?.snapshot.tab, 'history');
  eq('backStack 底层快照保留滚动位置', two.frames[0].snapshot.scrollTop, 120);
  eq('backStack 快照保留展开态', two.frames[0].snapshot.expandedIds, ['exp-e1']);

  const popped = popFrame(two);
  eq('backStack pop 返回被退出帧', popped.popped?.label, '官渡之战');
  eq('backStack pop 后深度减一', depthOf(popped.stack), 1);
  eq('backStack pop 保留较早帧', peekFrame(popped.stack)?.label, '赤壁之战');

  const popRoot = popFrame(empty);
  check(
    'backStack 空栈 pop 幂等且不改状态',
    popRoot.popped === undefined && popRoot.stack.frames.length === 0
  );

  const deep = pushFrame(two, frameOf('e3', '长平之战'));
  eq(
    'backStack 面包屑含根与全部帧',
    toBreadcrumbs(deep, '世界观').map((item) => item.label),
    ['世界观', '赤壁之战', '官渡之战', '长平之战']
  );
  check('backStack 面包屑根项无 ref', toBreadcrumbs(deep, '世界观')[0].ref === undefined);
  check('backStack 面包屑帧项带 ref', toBreadcrumbs(deep, '世界观')[2].ref?.id === 'e2');

  const to1 = popToDepth(deep, 1);
  eq(
    'backStack popToDepth 截断到指定深度',
    to1.stack.frames.map((frame) => frame.label),
    ['赤壁之战']
  );
  eq('backStack popToDepth 返回离开的视图', to1.exited?.label, '官渡之战');
  const noop = popToDepth(deep, 3);
  check(
    'backStack popToDepth 越界深度不改变栈',
    noop.exited === undefined && noop.stack === deep
  );
  const toZero = popToDepth(deep, -5);
  check('backStack popToDepth 负数按 0 处理', depthOf(toZero.stack) === 0);

  check('backStack clearStack 清空', isAtRoot(clearStack(deep)));
  check(
    'backStack clearStack 空栈返回同一引用（避免多余渲染）',
    clearStack(empty) === empty
  );
  check('backStack resetStack 新建空栈', isAtRoot(resetStack()));
};

// ---------- F. 世界级共享请求 + 历史纵切 + 迁移面板（Lead 审查补测） ----------

const buttonByText = (view: Mounted, text: string) =>
  (view.queryAll('button') as HTMLButtonElement[]).find((button) =>
    (button.textContent ?? '').includes(text)
  ) ?? null;

const buttonByTitle = (view: Mounted, title: string) =>
  (view.queryAll('button') as HTMLButtonElement[]).find(
    (button) => (button.getAttribute('title') ?? '') === title
  ) ?? null;

/** 6 张卡片同时挂载时，世界级 links 必须并发去重成 1 次请求，且不带逐实体参数 */
const testLinkRequestFanout = async () => {
  const client = seededClient();
  seedWorld(client);
  // 故意不预置 links：让查询真的发一次，验证去重
  client.removeQueries({ queryKey: ['worldbuilding', 'links'] });
  client.setQueryData(['characters', PROJECT_ID], CHARACTER_ROWS);

  const calls: Array<Record<string, unknown> | undefined> = [];
  const api = worldbuildingApi as unknown as {
    getWorldLinks: (
      worldId: string,
      params?: Record<string, unknown>
    ) => Promise<WorldLink[]>;
  };
  const original = api.getWorldLinks;
  api.getWorldLinks = (worldId, params) => {
    calls.push(params);
    return Promise.resolve(LINK_FIXTURE);
  };
  try {
    const view = renderClient(
      client,
      <>
        {[0, 1, 2].map((index) => (
          <LinkPanel
            key={`panel-${index}`}
            worldId={WORLD_ID}
            entity={ref('history', 'event', `e${index}`)}
          />
        ))}
        {[0, 1, 2].map((index) => (
          <CharacterReference
            key={`ref-${index}`}
            eventId={`e${index}`}
            eventKind="event"
            worldId={WORLD_ID}
            projectId={PROJECT_ID}
            eventItems={[]}
          />
        ))}
      </>
    );
    await settle();
    eq('世界级 links 请求只发一次（React Query 去重）', calls.length, 1);
    check(
      'links 请求不带 module/entity_id（不再逐卡请求）',
      calls.every((params) => !params?.module && !params?.entity_id),
      calls
    );
    view.unmount();
  } finally {
    api.getWorldLinks = original;
  }
};

/** 双读窗口：回填链按旧条目顺序展示，旧 _char_ref 只读 */
const testCharacterReference = async () => {
  const client = seededClient();
  const itemForC2 = {
    id: 'iA',
    name: '条目A',
    content: { '_char_ref:c2': '周瑜' },
    order_index: 0,
  } as unknown as EventItem;
  const itemForC1 = {
    id: 'iB',
    name: '条目B',
    content: { '_char_ref:c1': '诸葛亮' },
    order_index: 1,
  } as unknown as EventItem;
  const itemForC3 = {
    id: 'iC',
    name: '条目C',
    content: { '_char_ref:c3': '曹操' },
    order_index: 2,
  } as unknown as EventItem;

  // 回填链：id 顺序与条目顺序相反，只有读 meta.legacyItemId 才能排回原顺序
  const links = [
    link('a1', EVENT_REF, ref('character', 'character', 'c1'), 'history.involves', {
      meta: { migratedFrom: '_char_ref', legacyItemId: 'iB' },
    }),
    link('z1', EVENT_REF, ref('character', 'character', 'c2'), 'history.involves', {
      meta: { migratedFrom: '_char_ref', legacyItemId: 'iA' },
    }),
  ];
  client.setQueryData(worldbuildingKeys.links(WORLD_ID), links);
  client.setQueryData(['characters', PROJECT_ID], CHARACTER_ROWS);

  const view = renderClient(
    client,
    <CharacterReference
      eventId="e1"
      eventKind="event"
      worldId={WORLD_ID}
      projectId={PROJECT_ID}
      eventItems={[itemForC2, itemForC1, itemForC3]}
    />
  );
  await settle();

  const html = view.container.innerHTML;
  check(
    'CharacterReference 回填链按原条目顺序（周瑜在诸葛亮之前）',
    html.indexOf('周瑜') >= 0 && html.indexOf('周瑜') < html.indexOf('诸葛亮'),
    { 周瑜: html.indexOf('周瑜'), 诸葛亮: html.indexOf('诸葛亮') }
  );
  check('CharacterReference 旧 _char_ref 人物仍只读展示', html.includes('曹操'), html);
  const removeButtons = (view.queryAll('button') as HTMLButtonElement[]).filter(
    (button) => (button.getAttribute('title') ?? '').startsWith('移除')
  );
  eq('CharacterReference 旧键人物无移除入口（双读窗口只读）', removeButtons.length, 2);
  check(
    'CharacterReference 提供添加入口（写入走 history.involves）',
    !!buttonByText(view, '添加'),
    view.text()
  );
  view.unmount();
};

/** 迁移面板：请求体形状 + 两种 409 的处置差异 */
const testMigrationPanel = async () => {
  const containerId = 'w-container';
  const targetId = 'w-target';
  const worlds = [
    {
      id: containerId,
      name: '关联迁移容器',
      project_id: PROJECT_ID,
      settings: { migrationContainer: true },
      module_count: 7,
      link_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: targetId,
      name: '归位目标世界',
      project_id: PROJECT_ID,
      settings: null,
      module_count: 7,
      link_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ] as unknown as World[];

  const containerLinks = [
    link('l1', EVENT_REF, ref('politics', 'polity', 'n1'), 'core.related_to'),
    link('l2', EVENT_REF, ref('politics', 'polity', 'n2'), 'history.involves'),
    link('l3', ref('history', 'event', 'gone'), ref('politics', 'polity', 'gone2'), 'core.references'),
  ];

  const seedPanel = (links: WorldLink[]) => {
    const client = seededClient();
    client.setQueryData(['worldbuilding', 'worlds', PROJECT_ID], worlds);
    client.setQueryData(worldbuildingKeys.world(targetId), WORLD_FIXTURE);
    client.setQueryData(['characters-simple', PROJECT_ID], CHARACTERS);
    client.setQueryData(worldbuildingKeys.links(containerId), links);
    return client;
  };

  const payloads: unknown[] = [];
  const api = worldbuildingApi as unknown as {
    moveWorldLinks: (worldId: string, data: unknown) => Promise<unknown>;
    moveWorldLink: (linkId: string, data?: unknown) => Promise<unknown>;
  };
  const originalMany = api.moveWorldLinks;
  const originalOne = api.moveWorldLink;
  api.moveWorldLinks = (worldId, data) => {
    payloads.push({ kind: 'batch', worldId, data });
    return Promise.resolve({
      moved: 1,
      conflicts: [{ link_id: 'l2', code: 'duplicate_link', existing_id: 'existing-1' }],
      invalid: [
        { link_id: 'l3', code: 'endpoint_world_conflict', reason: '两端分属不同世界' },
      ],
    });
  };
  api.moveWorldLink = (linkId, data) => {
    payloads.push({ kind: 'single', linkId, data: data ?? null });
    return Promise.reject({
      status: 409,
      message: '关联两端分属不同世界，请显式指定 world_id',
      details: {
        detail: {
          code: 'endpoint_world_conflict',
          message: '关联两端分属不同世界，请显式指定 world_id',
        },
      },
    });
  };

  try {
    const view = renderClient(
      seedPanel(containerLinks),
      <MigrationContainerPanel worldId={containerId} projectId={PROJECT_ID} />
    );
    await settle();

    const selectAll = buttonByText(view, '全选');
    flushSync(() => selectAll?.click());
    const batch = buttonByText(view, '批量归位');
    flushSync(() => batch?.click());
    await settle();
    eq('迁移面板批量归位请求体形状', payloads[0], {
      kind: 'batch',
      worldId: containerId,
      data: { link_ids: ['l1', 'l2', 'l3'] },
    });
    check(
      '批量 conflicts(code=duplicate_link) 才给出「改用已有边」动作',
      !!buttonByTitle(view, '目标世界已有等价边：删除容器边并保留已有边'),
      view.text()
    );
    view.unmount();

    // 单条 409（端点分属不同世界）：没有替代边 → 不得出现破坏性删除动作
    const singleClient = seedPanel([
      link('l9', ref('history', 'event', 'gone'), ref('politics', 'polity', 'gone2'), 'core.references'),
    ]);
    const singleView = renderClient(
      singleClient,
      <MigrationContainerPanel worldId={containerId} projectId={PROJECT_ID} />
    );
    await settle();
    const moveButton = buttonByTitle(singleView, '按端点自动归位到端点所属世界');
    flushSync(() => moveButton?.click());
    await settle();
    eq('迁移面板单条归位请求体形状', payloads.at(-1), {
      kind: 'single',
      linkId: 'l9',
      data: null,
    });
    check(
      '端点冲突 409 不给出「改用已有边」破坏性动作',
      !buttonByTitle(singleView, '目标世界已有等价边：删除容器边并保留已有边'),
      singleView.text()
    );
    singleView.unmount();
  } finally {
    api.moveWorldLinks = originalMany;
    api.moveWorldLink = originalOne;
  }
};

// ---------- 入口 ----------

const run = async () => {
  testQueryKeys();
  testTypeHelpers();
  testComplexity();
  testEntityBadge();
  testBackStack();
  await testLinkPanel();
  await testEntityPicker();
  await testInlineReference();
  await testLinkRequestFanout();
  await testCharacterReference();
  await testMigrationPanel();
};

void run()
  .then(() => {
    (window as never as Record<string, unknown>).__PHASE2_TESTS__ = {
      done: true,
      checks,
    };
  })
  .catch((error) => {
    (window as never as Record<string, unknown>).__PHASE2_TESTS__ = {
      done: true,
      checks: [
        ...checks,
        {
          name: '用例执行未抛异常',
          ok: false,
          detail:
            error instanceof Error ? `${error.message}\n${error.stack}` : String(error),
        },
      ],
    };
  });
