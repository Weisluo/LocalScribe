/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 6 模块配置回归用例（浏览器侧，P6-T3 / T4 / T5 / T9）
 *
 * 由 tests/worldbuilding/phase6b.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE6B__。分五类：
 * 1) 纯函数：字段契约（八种类型）、复杂度可见性、归档 / 恢复 / 排序、自定义关联类型校验、
 *    子模块层级（深度 / 重排 / 父级环拒绝 / 删除影响 / 子级上移计划）、
 *    ModuleConfigPanel 的补丁构造（保留未知键、不冻结前端默认值）；
 * 2) 组件：SubmoduleManagerPanel / FieldSchemaEditorPanel / ModuleConfigPanel 用
 *    renderToStaticMarkup 独立渲染（不需要网络与 TanStack Query 缓存）；
 * 3) 图标：HistoryView 的事件类型 / 等级图标与子模块图标候选全为 lucide-react 真实导出的
 *    kebab-case 名；等级文案不含星号 / 圆圈符号；
 * 4) 渲染产物无 emoji。
 *
 * 不发任何网络请求，也不触发任何 mutation（mutation 只在真实外壳里发生）。
 */

import { renderToStaticMarkup } from 'react-dom/server';

import { lucideIcon } from '@/components/Worldbuilding/shared/lucideIcon';
import {
  COMPLEXITY_LEVELS,
  COMPLEXITY_LABELS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  LINK_TYPE_FALLBACK_ID,
  activeFieldsOf,
  archiveField,
  complexityRank,
  fieldVisibleAt,
  formatFieldDefaultValue,
  mergeModuleConfig,
  nextFieldOrder,
  parseFieldDefaultValue,
  parseModuleConfig,
  restoreField,
  sortFields,
  toFieldId,
  toLinkTypeId,
  updateField,
  validateCustomLinkType,
  type CustomFieldDef,
  type CustomLinkTypeDef,
  type EntityTypeDef,
  type ModuleConfig,
} from '@/components/Worldbuilding/shared/moduleConfig';
import {
  ModuleConfigPanelBody,
  buildModuleConfigPatch,
} from '@/components/Worldbuilding/shared/ModuleConfigPanel';
import {
  DeleteImpactPanel,
  SUBMODULE_ICON_CHOICES,
  SUBMODULE_PALETTE,
  SubmoduleManagerPanel,
  canReparentSubmodule,
  moveChildrenPlan,
  reparentSubmodule,
  reorderSubmodules,
  submoduleDeleteImpact,
  submoduleDepth,
  submoduleDescendantIds,
  submoduleItemCount,
  submoduleRows,
  submoduleSiblings,
} from '@/components/Worldbuilding/config/SubmoduleManager';
import {
  FIELD_TYPE_IDS,
  FieldSchemaEditorPanel,
  fieldsForKind,
} from '@/components/Worldbuilding/config/FieldSchemaEditor';
import { EVENT_TYPE_CONFIG, LEVEL_CONFIG } from '@/components/Worldbuilding/HistoryView/config';
import { CustomFieldRenderer, toMultiValue } from '@/components/Worldbuilding/shared/CustomFieldRenderer';
import { EventCard } from '@/components/Worldbuilding/HistoryView/EventCard';
import type { Event } from '@/components/Worldbuilding/HistoryView/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  EntityRef,
  LinkTypeDef,
  ModuleItemV2,
  SubmoduleV2,
} from '@/services/worldbuildingApi';

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

/** 与 phase5.spec.ts 同口径的 emoji 扫描（额外含 ★ ○ 这类符号） */
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}|[★☆○●◯]/u;

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * SSR 产物里相邻文本节点之间会有 `<!-- -->` 分隔注释、元素内还有换行缩进，
 * 断言文案前统一去掉注释并折叠空白，避免「文本其实渲染了但匹配不到」的假阴性。
 */
const plain = (html: string): string =>
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');

/** 契约 §4 关联类型注册表（54 条，写死字面量避免「解析器与断言同时失效」） */
const CONTRACT_LINK_TYPE_IDS = [
  'core.references',
  'core.related_to',
  'custom.link',
  'history.occurs_at',
  'history.involves',
  'history.causes',
  'history.caused_by',
  'history.milestone_of',
  'politics.controls_region',
  'politics.capital_at',
  'politics.member_of',
  'politics.leads',
  'politics.founded_by',
  'politics.subordinate_to',
  'politics.signatory_of',
  'politics.includes_race',
  'politics.ally_of',
  'politics.at_war_with',
  'politics.vassal_of',
  'politics.trades_with',
  'politics.marriage_tie',
  'politics.succeeds',
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
  'races.inhabits',
  'races.origin_at',
  'races.related_to',
  'races.notable_figure',
  'races.affinity_with',
  'races.specialty',
  'races.prefers',
  'character.belongs_to_race',
  'systems.advances_to',
  'systems.requires',
  'systems.grants',
  'systems.costs',
  'systems.practiced_by',
  'systems.enables',
  'systems.countered_by',
  'character.practices_system',
  'character.attained',
  'character.appears_in',
  'character.serves',
  'character.owns',
];

// ---------- 夹具 ----------

const BUILTINS: EntityTypeDef[] = [
  { id: 'polity', label: '政权', icon: 'landmark', color: '#b91c1c' },
  { id: 'organization', label: '组织', icon: 'users', color: '#b45309' },
];

const sub = (over: Partial<SubmoduleV2> & { id: string; name: string }): SubmoduleV2 => ({
  description: null,
  order_index: 0,
  kind: 'polity',
  meta: null,
  color: null,
  icon: null,
  parent_id: null,
  module_id: 'm-politics',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  item_count: 0,
  ...over,
});

const item = (over: Partial<ModuleItemV2> & { id: string; name: string }): ModuleItemV2 => ({
  content: {},
  order_index: 0,
  is_published: true,
  module_id: 'm-politics',
  submodule_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const FIELD_FIXTURE: CustomFieldDef[] = [
  { id: 'motto', label: '箴言', type: 'text', order: 20, group: '概览' },
  { id: 'capital', label: '都城', type: 'entityRef', order: 10 },
  { id: 'founded', label: '立国时间', type: 'date' },
];

const TREE: SubmoduleV2[] = [
  sub({ id: 'root-a', name: '甲国', order_index: 0, item_count: 2 }),
  sub({ id: 'root-b', name: '乙国', order_index: 1, kind: 'organization', icon: 'users' }),
  sub({ id: 'child-a1', name: '甲国行省', order_index: 0, parent_id: 'root-a' }),
  sub({ id: 'child-a2', name: '甲国都城', order_index: 1, parent_id: 'root-a' }),
  sub({ id: 'grand-a1', name: '行省属城', order_index: 0, parent_id: 'child-a1' }),
  sub({ id: 'orphan', name: '失父节点', order_index: 0, parent_id: 'missing-parent' }),
];

const ITEMS: ModuleItemV2[] = [
  item({ id: 'i1', name: '概览', submodule_id: 'root-a' }),
  item({ id: 'i2', name: '沿革', submodule_id: 'root-a' }),
  item({ id: 'i3', name: '属城志', submodule_id: 'grand-a1' }),
  item({ id: 'i4', name: '世界级条目', submodule_id: null }),
];

const LINK_COUNTS = new Map<string, number>([
  ['root-a', 3],
  ['child-a1', 2],
  ['grand-a1', 1],
  ['orphan', 5],
]);

const LINK_REGISTRY: LinkTypeDef[] = [
  {
    id: 'core.related_to',
    label: '相关',
    reverse_label: '相关',
    directed: false,
    icon: 'git-branch',
    color: 'slate',
    line_style: 'dotted',
    group: '通用',
    source: null,
    target: null,
  },
  {
    id: 'politics.leads',
    label: '领导',
    reverse_label: '被领导',
    directed: true,
    icon: 'crown',
    color: 'red',
    line_style: 'solid',
    group: '政治',
    source: [{ module: 'politics', kind: 'figure', id: '*' } as EntityRef],
    target: null,
  },
];

// ---------- 1. 字段契约与纯函数 ----------

const testFieldSchema = () => {
  eq('八种字段类型与契约 §2.7 一致（含 multiselect）', FIELD_TYPE_IDS, [
    'text',
    'textarea',
    'number',
    'select',
    'multiselect',
    'date',
    'entityRef',
    'image',
  ]);
  eq('字段类型来源于 shared/moduleConfig 的同一份定义', FIELD_TYPE_IDS, CUSTOM_FIELD_TYPES);
  eq(
    '每种类型都有中文标签',
    FIELD_TYPE_IDS.map((type) => CUSTOM_FIELD_TYPE_LABELS[type]),
    ['单行文本', '多行文本', '数字', '单选', '多选', '日期', '实体引用', '图片']
  );
  eq('复杂度分档顺序为 速写 / 结构 / 沙盘', COMPLEXITY_LEVELS, [
    'sketch',
    'structure',
    'sandbox',
  ]);
  eq('复杂度标签', COMPLEXITY_LEVELS.map((level) => COMPLEXITY_LABELS[level]), [
    '速写',
    '结构',
    '沙盘',
  ]);
  eq('复杂度序号', COMPLEXITY_LEVELS.map(complexityRank), [0, 1, 2]);
  eq('未知复杂度按速写处理', [complexityRank(undefined), complexityRank(null)], [0, 0]);

  const always: CustomFieldDef = { id: 'a', label: 'A', type: 'text' };
  const fromStructure: CustomFieldDef = {
    id: 'b',
    label: 'B',
    type: 'text',
    visibleComplexity: 'structure',
  };
  const fromSandbox: CustomFieldDef = {
    id: 'c',
    label: 'C',
    type: 'text',
    visibleComplexity: 'sandbox',
  };
  eq(
    'fieldVisibleAt：缺省字段三档都可见',
    COMPLEXITY_LEVELS.map((level) => fieldVisibleAt(always, level)),
    [true, true, true]
  );
  eq(
    'fieldVisibleAt：结构起可见（速写隐藏）',
    COMPLEXITY_LEVELS.map((level) => fieldVisibleAt(fromStructure, level)),
    [false, true, true]
  );
  eq(
    'fieldVisibleAt：沙盘起可见',
    COMPLEXITY_LEVELS.map((level) => fieldVisibleAt(fromSandbox, level)),
    [false, false, true]
  );
  eq(
    'fieldVisibleAt：复杂度为 undefined 时按速写（不泄露高复杂字段）',
    [fieldVisibleAt(fromStructure, undefined), fieldVisibleAt(always, undefined)],
    [false, true]
  );

  const archived = archiveField(FIELD_FIXTURE, 'capital');
  eq('归档只标记目标字段', archived.map((field) => !!field.archived), [false, true, false]);
  eq(
    '归档保留字段全部原属性（数据不丢）',
    [archived[1].label, archived[1].type, archived[1].order],
    ['都城', 'entityRef', 10]
  );
  eq('归档不改变字段数量', archived.length, FIELD_FIXTURE.length);
  eq(
    '归档保留未知键',
    archiveField([{ ...FIELD_FIXTURE[0], legacyKey: { keep: true } } as CustomFieldDef], 'motto')[0]
      .legacyKey,
    { keep: true }
  );

  const restored = restoreField(archived, 'capital');
  eq('恢复清除归档标记', restored[1].archived, false);
  eq(
    '归档 -> 恢复 往返后字段属性不变',
    restored.map((field) => [field.id, field.label, field.type, field.order ?? null]),
    FIELD_FIXTURE.map((field) => [field.id, field.label, field.type, field.order ?? null])
  );
  eq(
    '归档 -> 恢复 往返：归档确实生效且恢复后无残留',
    archived.some((field) => field.archived === true) &&
      restored.every((field) => field.archived !== true),
    true
  );
  eq(
    '生效字段排除归档字段',
    activeFieldsOf(archived).map((field) => field.id),
    ['founded', 'motto']
  );
  eq(
    'activeFieldsOf 不含任何归档字段',
    activeFieldsOf(archived).every((field) => !field.archived),
    true
  );

  eq(
    'sortFields：显式 order 优先，未设 order 的按原下标参与比较',
    sortFields(FIELD_FIXTURE).map((field) => field.id),
    ['founded', 'capital', 'motto']
  );
  eq(
    'sortFields 是稳定排序（同键保持原相对顺序）',
    sortFields([
      { id: 'x', label: 'X', type: 'text' },
      { id: 'y', label: 'Y', type: 'text' },
    ]).map((field) => field.id),
    ['x', 'y']
  );
  eq('nextFieldOrder = 现有最大 order + 10', nextFieldOrder(FIELD_FIXTURE), 30);
  eq('nextFieldOrder 空表从 10 起', nextFieldOrder([]), 10);

  const patched = updateField(
    [{ id: 'a', label: 'A', type: 'text', legacyKey: 'keep' } as CustomFieldDef],
    'a',
    { label: '改名', required: true, placeholder: undefined }
  );
  eq(
    'updateField 改名不动 id、不丢未知键、undefined 不写回',
    [patched[0].id, patched[0].label, patched[0].legacyKey, 'placeholder' in patched[0], patched[0].required],
    ['a', '改名', 'keep', false, true]
  );

  eq(
    'parseFieldDefaultValue：数字 / 多选 / 文本 / 空',
    [
      parseFieldDefaultValue('number', '42'),
      parseFieldDefaultValue('number', '不是数字'),
      parseFieldDefaultValue('multiselect', '甲, 乙，丙'),
      parseFieldDefaultValue('text', ' 你好 '),
      parseFieldDefaultValue('text', '   '),
    ],
    [42, undefined, ['甲', '乙', '丙'], '你好', undefined]
  );
  eq(
    'formatFieldDefaultValue 与解析互逆',
    [formatFieldDefaultValue(['甲', '乙']), formatFieldDefaultValue(null), formatFieldDefaultValue(7)],
    ['甲, 乙', '', '7']
  );
  eq(
    'toFieldId 生成 ASCII 唯一 id',
    [
      toFieldId('首都', []),
      toFieldId('Capital City', []),
      toFieldId('Capital City', ['capital_city']),
    ],
    ['field', 'capital_city', 'capital_city_2']
  );

  eq(
    'fieldsForKind：fieldSchema 为空时回退内置 defaultFields',
    fieldsForKind({}, 'polity', [
      { id: 'polity', label: '政权', defaultFields: [{ id: 'motto', label: '箴言', type: 'text' }] },
    ]).map((field) => field.id),
    ['motto']
  );
  eq(
    'fieldsForKind：显式定义优先于内置',
    fieldsForKind({ fieldSchema: { polity: FIELD_FIXTURE } }, 'polity', [
      { id: 'polity', label: '政权', defaultFields: [{ id: 'motto', label: '箴言', type: 'text' }] },
    ]).map((field) => field.id),
    ['motto', 'capital', 'founded']
  );
};

// ---------- 2. 自定义关联类型 ----------

const baseLinkType: CustomLinkTypeDef = {
  id: 'custom_alliance',
  label: '结盟',
  reverseLabel: '结盟',
  directed: false,
  icon: 'handshake',
  color: 'emerald',
  source: { module: 'politics', kind: 'polity' },
  target: { module: 'politics', kind: 'polity' },
};

const testLinkTypes = () => {
  eq('合法的自定义关联类型通过校验', validateCustomLinkType(baseLinkType), null);
  eq('id 不能为空', validateCustomLinkType({ ...baseLinkType, id: '  ' }), '关联类型 id 不能为空');
  eq(
    'id 必须唯一',
    validateCustomLinkType(baseLinkType, { existing: [baseLinkType], editingId: 'custom_other' }),
    '关联类型 id custom_alliance 已存在'
  );
  eq(
    '编辑自身时不算重复',
    validateCustomLinkType(baseLinkType, { existing: [baseLinkType], editingId: 'custom_alliance' }),
    null
  );
  eq('标签不能为空', validateCustomLinkType({ ...baseLinkType, label: ' ' }), '关联类型标签不能为空');
  eq(
    '必须声明源模块',
    validateCustomLinkType({ ...baseLinkType, source: {} }),
    '必须声明源模块'
  );
  eq(
    '必须声明目标模块',
    validateCustomLinkType({ ...baseLinkType, target: undefined }),
    '必须声明目标模块'
  );
  eq(
    '方向必须是布尔值',
    validateCustomLinkType({ ...baseLinkType, directed: undefined }),
    '关联方向必须是布尔值'
  );
  eq(
    '核心 id 视为覆盖项：只允许改名改色',
    validateCustomLinkType(
      { id: 'core.related_to', label: '相关（改名）' },
      { coreIds: ['core.related_to'] }
    ),
    null
  );
  eq(
    '自定义 id 前缀固定为 custom_',
    [toLinkTypeId('Alliance', []), toLinkTypeId('Alliance', ['custom_alliance'])],
    ['custom_alliance', 'custom_alliance_2']
  );
  eq('删除自定义类型的回退目标是契约 §4.1 的 core.related_to', LINK_TYPE_FALLBACK_ID, 'core.related_to');
  eq('契约 §4 注册表共 54 条（本用例的硬编码清单必须与之等长）', CONTRACT_LINK_TYPE_IDS.length, 54);
  check(
    '回退目标在契约 §4 内（自定义类型不得引入契约外 link_type）',
    CONTRACT_LINK_TYPE_IDS.includes(LINK_TYPE_FALLBACK_ID)
  );
  check(
    '所有硬编码 id 都形如 module.name',
    CONTRACT_LINK_TYPE_IDS.every((id) => /^[a-z_]+\.[a-z_]+$/.test(id))
  );
};

// ---------- 3. 子模块层级纯函数 ----------

const testSubmoduleHelpers = () => {
  eq(
    '同级列表按 order_index 排序',
    submoduleSiblings(TREE, null).map((node) => node.id),
    ['root-a', 'root-b']
  );
  eq(
    '子级列表按 order_index 排序',
    submoduleSiblings(TREE, 'root-a').map((node) => node.id),
    ['child-a1', 'child-a2']
  );

  const rows = submoduleRows(TREE);
  eq(
    '树展开：深度优先且子级紧跟父级',
    rows.map((row) => row.submodule.id),
    ['root-a', 'child-a1', 'grand-a1', 'child-a2', 'root-b', 'orphan']
  );
  eq(
    '树展开：缩进深度正确',
    rows.map((row) => row.depth),
    [0, 1, 2, 1, 0, 0]
  );
  eq('深度：根 / 二级 / 三级', [
    submoduleDepth(TREE, 'root-a'),
    submoduleDepth(TREE, 'child-a1'),
    submoduleDepth(TREE, 'grand-a1'),
  ], [1, 2, 3]);
  eq('深度：未知 id 按 1（不抛错）', submoduleDepth(TREE, 'nope'), 1);
  eq(
    '后代 id（不含自身）',
    submoduleDescendantIds(TREE, 'root-a'),
    ['child-a1', 'child-a2', 'grand-a1']
  );
  eq('叶子节点没有后代', submoduleDescendantIds(TREE, 'root-b'), []);

  eq('父级环拒绝：不能挂到自己', canReparentSubmodule(TREE, 'root-a', 'root-a'), false);
  eq(
    '父级环拒绝：不能挂到自己的后代',
    canReparentSubmodule(TREE, 'root-a', 'grand-a1'),
    false
  );
  eq('父级环拒绝：不能挂到不存在的节点', canReparentSubmodule(TREE, 'root-a', 'ghost'), false);
  eq('可以移到顶层', canReparentSubmodule(TREE, 'child-a1', null), true);
  eq('可以挂到非后代节点', canReparentSubmodule(TREE, 'child-a1', 'root-b'), true);
  eq(
    '非法的父级调整不改动数据',
    reparentSubmodule(TREE, 'root-a', 'grand-a1').find((node) => node.id === 'root-a')?.parent_id,
    null
  );

  const reparented = reparentSubmodule(TREE, 'child-a1', 'root-b');
  eq(
    '合法父级调整：改 parent_id 并排到新同级末尾',
    [
      reparented.find((node) => node.id === 'child-a1')?.parent_id,
      reparented.find((node) => node.id === 'child-a1')?.order_index,
    ],
    ['root-b', 0]
  );
  eq(
    '合法父级调整：出现在新父级的子级列表里',
    submoduleSiblings(reparented, 'root-b').map((node) => node.id),
    ['child-a1']
  );
  eq(
    '合法父级调整：原父级只剩下另一个子级',
    submoduleSiblings(reparented, 'root-a').map((node) => node.id),
    ['child-a2']
  );
  eq(
    '父级调整不动其它节点',
    reparented.filter((node) => node.id !== 'child-a1').map((node) => [node.id, node.parent_id, node.order_index]),
    TREE.filter((node) => node.id !== 'child-a1').map((node) => [node.id, node.parent_id, node.order_index])
  );

  const reordered = reorderSubmodules(TREE, 'root-a', ['child-a2', 'child-a1']);
  eq(
    '同级重排：order_index 重写为 0..n',
    [
      reordered.find((node) => node.id === 'child-a2')?.order_index,
      reordered.find((node) => node.id === 'child-a1')?.order_index,
    ],
    [0, 1]
  );
  eq(
    '同级重排：子级顺序随 order_index 变化',
    submoduleSiblings(reordered, 'root-a').map((node) => node.id),
    ['child-a2', 'child-a1']
  );
  eq(
    '同级重排：id 集合不匹配时原样返回',
    reorderSubmodules(TREE, 'root-a', ['child-a1']),
    TREE
  );
  eq(
    '重排不改父子关系',
    reordered.filter((node) => node.parent_id === 'root-a').map((node) => node.id).sort(),
    ['child-a1', 'child-a2']
  );

  const plan = moveChildrenPlan(TREE, 'root-a');
  eq(
    '子级上移计划：直接子级挂到被删节点的父级',
    plan.map((step) => step.submoduleId),
    ['child-a1', 'child-a2']
  );
  eq(
    '子级上移计划：父级为顶层且顺序排在现有同级之后',
    plan.map((step) => [step.parentId, step.orderIndex]),
    [
      [null, 2],
      [null, 3],
    ]
  );
  eq('叶子节点的上移计划为空', moveChildrenPlan(TREE, 'grand-a1'), []);

  const impact = submoduleDeleteImpact(TREE, ITEMS, LINK_COUNTS, 'root-a');
  eq(
    '删除影响：后代数量',
    impact.descendants,
    ['child-a1', 'child-a2', 'grand-a1']
  );
  eq('删除影响：条目数（含后代挂载的条目）', impact.items, 3);
  eq('删除影响：关联数（含后代）', impact.links, 6);
  eq('删除影响：父级用于「上移」选项', impact.parentId, null);
  eq(
    '删除影响：被删节点自身信息',
    [impact.id, impact.name],
    ['root-a', '甲国']
  );
  eq(
    '叶子节点删除影响只算自己',
    [
      submoduleDeleteImpact(TREE, ITEMS, LINK_COUNTS, 'root-b').descendants.length,
      submoduleDeleteImpact(TREE, ITEMS, LINK_COUNTS, 'root-b').items,
      submoduleDeleteImpact(TREE, ITEMS, LINK_COUNTS, 'root-b').links,
    ],
    [0, 0, 0]
  );
  eq(
    '条目数取后端 item_count 与本地条目的较大值',
    [
      submoduleItemCount(ITEMS, sub({ id: 'root-a', name: '甲国', item_count: 2 })),
      submoduleItemCount(ITEMS, sub({ id: 'root-a', name: '甲国', item_count: 9 })),
      submoduleItemCount(ITEMS, sub({ id: 'grand-a1', name: '行省属城' })),
      submoduleItemCount(ITEMS, sub({ id: 'root-b', name: '乙国' })),
    ],
    [2, 9, 1, 0]
  );
};

// ---------- 4. ModuleConfigPanel 补丁构造 ----------

const testBuildPatch = () => {
  const resolvedDefaults: ModuleConfig = {
    defaultComplexity: 'sketch',
    displayMode: 'atlas',
    entityTypes: [],
    levels: [],
    statuses: [],
    fieldSchema: {},
    linkTypes: [],
    terminology: {},
    // 前端默认值（不应被冻结进 config）
    emblemPalette: ['#0f766e'],
    nodeStyles: { polity: { icon: 'landmark' } },
    unknownKey: { keep: true },
  };

  eq(
    '未改动任何键时不产生补丁（不冻结前端默认值）',
    buildModuleConfigPatch({
      source: resolvedDefaults,
      baseline: resolvedDefaults,
      stored: {},
      hasRacesKeys: false,
      hasSystemsKeys: false,
    }),
    {}
  );

  const edited: ModuleConfig = {
    ...resolvedDefaults,
    displayMode: 'roster',
    terminology: { polity: '宗门' },
  };
  const patch = buildModuleConfigPatch({
    source: edited,
    baseline: resolvedDefaults,
    stored: {},
    hasRacesKeys: false,
    hasSystemsKeys: false,
  });
  eq('只提交改动过的标量键', patch.displayMode, 'roster');
  eq(
    '未改动的键不出现在补丁里',
    Object.keys(patch).sort(),
    ['displayMode', 'terminology']
  );
  eq('未知键不参与补丁（避免把未识别配置写回）', 'unknownKey' in patch, false);
  eq('races 专属键未开启时不提交', 'emblemPalette' in patch, false);
  eq('systems 专属键未开启时不提交', 'nodeStyles' in patch, false);

  const storedWithSibling: ModuleConfig = {
    fieldSchema: {
      polity: [{ id: 'motto', label: '箴言', type: 'text' }],
      organization: [{ id: 'scope', label: '范围', type: 'text' }],
    },
    terminology: { polity: '政权', race: '种族' },
    legacyConfig: { keep: true },
  };
  const draftWithEdit: ModuleConfig = {
    ...storedWithSibling,
    fieldSchema: {
      polity: [{ id: 'motto', label: '格言', type: 'text' }],
      organization: [{ id: 'scope', label: '范围', type: 'text' }],
    },
  };
  const objectPatch = buildModuleConfigPatch({
    source: draftWithEdit,
    baseline: storedWithSibling,
    stored: storedWithSibling,
    hasRacesKeys: false,
    hasSystemsKeys: false,
  });
  eq(
    '对象键提交完整目标对象：未编辑的同级 kind 字段定义保留',
    Object.keys(objectPatch.fieldSchema ?? {}).sort(),
    ['organization', 'polity']
  );
  eq(
    '对象键只包含有改动的子键（这里两个 kind 都提交，因为 fieldSchema 整体变化）',
    objectPatch.fieldSchema?.organization,
    [{ id: 'scope', label: '范围', type: 'text' }]
  );

  const removedTerm: ModuleConfig = {
    ...storedWithSibling,
    terminology: { polity: '政权' },
  };
  const removedPatch = buildModuleConfigPatch({
    source: removedTerm,
    baseline: storedWithSibling,
    stored: storedWithSibling,
    hasRacesKeys: false,
    hasSystemsKeys: false,
  });
  eq(
    '显式删除的子键不再出现（浅合并也无法保留旧子键）',
    removedPatch.terminology,
    { polity: '政权' }
  );

  const withLinkType: ModuleConfig = {
    ...resolvedDefaults,
    linkTypes: [baseLinkType],
  };
  const linkPatch = buildModuleConfigPatch({
    source: withLinkType,
    baseline: resolvedDefaults,
    stored: {},
    hasRacesKeys: false,
    hasSystemsKeys: false,
  });
  eq('自定义关联类型通过 linkTypes 键落库', linkPatch.linkTypes, [baseLinkType]);

  eq(
    'parseModuleConfig 保留未知键',
    parseModuleConfig({ a: 1, customKey: { keep: true } }).customKey,
    { keep: true }
  );
  eq('parseModuleConfig 对 null / 数组回退空对象', [
    parseModuleConfig(null),
    parseModuleConfig([1, 2]),
  ], [{}, {}]);
  eq(
    'mergeModuleConfig：undefined 不覆盖原值',
    mergeModuleConfig({ displayMode: 'atlas' }, { displayMode: undefined }).displayMode,
    'atlas'
  );
  eq(
    'mergeModuleConfig 保留未提及的未知键',
    mergeModuleConfig({ customKey: 1, displayMode: 'atlas' }, { displayMode: 'roster' }).customKey,
    1
  );
};

// ---------- 5. 组件渲染（SSR，无网络） ----------

const renderSubmoduleManager = (overrides: Partial<Parameters<typeof SubmoduleManagerPanel>[0]> = {}) =>
  renderToStaticMarkup(
    <SubmoduleManagerPanel
      open
      onClose={() => undefined}
      worldId="w1"
      moduleId="m-politics"
      moduleType="politics"
      config={{ entityTypes: [] }}
      builtins={BUILTINS}
      worldTerminology={{ polity: '宗门' }}
      submodules={TREE}
      items={ITEMS}
      linkCounts={LINK_COUNTS}
      {...overrides}
    />
  );

const testSubmoduleMarkup = () => {
  const markup = renderSubmoduleManager();
  const text = plain(markup);
  check('子模块管理器渲染根节点', markup.includes('data-testid="submodule-manager"'));
  check(
    '每一行都带 data-submodule-id 与缩进深度',
    markup.includes('data-submodule-id="root-a"') &&
      markup.includes('data-depth="0"') &&
      markup.includes('data-depth="2"')
  );
  check(
    '行内显示名称 / kind（术语替换后）/ 条目数与关联数',
    text.includes('甲国') &&
      text.includes('宗门') &&
      text.includes('条目 2 · 关联 3'),
    text.slice(0, 240)
  );
  check('图标走 lucideIcon 组件而不是打印原始字符串', markup.includes('<svg'));
  check('推荐 kind 只是快捷项并明确「不预置任何内容」', text.includes('不预置任何内容'));
  check('提供新建顶层分类入口', markup.includes('data-testid="submodule-create-root"'));
  const emptyMarkup = renderSubmoduleManager({ submodules: [] });
  check('空树给出空状态而不是错误页', emptyMarkup.includes('data-testid="submodule-empty"'));

  const impactMarkup = renderToStaticMarkup(
    <DeleteImpactPanel
      impact={submoduleDeleteImpact(TREE, ITEMS, LINK_COUNTS, 'root-a')}
      onCancel={() => undefined}
      onCascade={() => undefined}
      onMoveUp={() => undefined}
    />
  );
  const impactText = plain(impactMarkup);
  check(
    '删除影响面板给出条目数与关联数',
    impactText.includes('3 个子级') &&
      impactText.includes('3 个条目') &&
      impactText.includes('6 条关联'),
    impactText.slice(0, 200)
  );
  check(
    '删除影响面板同时给出级联删除与子级上移两个选项',
    impactMarkup.includes('data-testid="submodule-delete-cascade"') &&
      impactMarkup.includes('data-testid="submodule-delete-move-up"')
  );
};

const testFieldEditorMarkup = () => {
  const markup = renderToStaticMarkup(
    <FieldSchemaEditorPanel
      open
      onClose={() => undefined}
      moduleId="m-politics"
      builtins={BUILTINS}
      config={{ fieldSchema: { polity: FIELD_FIXTURE } }}
      onSave={async () => undefined}
      initialKind="polity"
    />
  );
  const text = plain(markup);
  check(
    '字段编辑器渲染根节点与模块 id',
    markup.includes('data-testid="field-schema-editor"') && markup.includes('data-module-id="m-politics"')
  );
  check('按 kind 分组：有 kind 页签', markup.includes('data-testid="field-kind-tab"'));
  check(
    '字段行按 fieldSchema 渲染',
    markup.includes('data-field-id="motto"') && markup.includes('data-field-type="entityRef"')
  );
  const typeOptions = [...markup.matchAll(/<option value="([A-Za-z]+)"/g)].map(
    (match) => match[1]
  );
  check(
    '字段类型下拉覆盖契约八种类型',
    FIELD_TYPE_IDS.every((type) => typeOptions.includes(type)),
    typeOptions
  );
  check(
    '归档而非硬删除：有归档入口且没有删除字段的入口',
    text.includes('归档') && !markup.includes('aria-label="删除字段')
  );
  check('无归档字段时不渲染归档区', !markup.includes('data-testid="field-archived"'));
  const archivedMarkup = renderToStaticMarkup(
    <FieldSchemaEditorPanel
      open
      onClose={() => undefined}
      moduleId="m-politics"
      builtins={BUILTINS}
      config={{ fieldSchema: { polity: archiveField(FIELD_FIXTURE, 'capital') } }}
      onSave={async () => undefined}
      initialKind="polity"
    />
  );
  check(
    '归档字段进入「已归档（数据保留）」区并可恢复',
    archivedMarkup.includes('data-testid="field-archived"') && plain(archivedMarkup).includes('恢复')
  );
  check(
    '实体引用字段明确不创建关联记录',
    plain(archivedMarkup).includes('不创建关联')
  );
  check('字段编辑器不出现 emoji', !EMOJI_PATTERN.test(archivedMarkup));
};

const testConfigPanelMarkup = () => {
  const markup = renderToStaticMarkup(
    <ModuleConfigPanelBody
      open
      onClose={() => undefined}
      config={{ entityTypes: [] }}
      onSave={async () => undefined}
      builtins={BUILTINS}
      maxDepth={3}
      moduleType="races"
      linkRegistry={LINK_REGISTRY}
      initialTab="linkTypes"
    />
  );
  const text = plain(markup);
  for (const label of ['类型', '字段', '等级', '状态', '关联类型', '展示', '术语', '模块专属']) {
    check(`模块配置面板包含「${label}」页`, text.includes(`>${label}</button>`), label);
  }
  check(
    '存在 module-config-panel 根节点（P3/P4/P5 harness 依赖的 testid）',
    markup.includes('data-testid="module-config-panel"')
  );
  check(
    '关联类型页展示核心注册表条目（只读覆盖改名改色，不可删除）',
    markup.includes('data-testid="config-core-link-type"') &&
      markup.includes('data-link-type="core.related_to"') &&
      text.includes('politics.leads')
  );
  check('核心类型带「核心」标记', text.includes('核心'));
  const customMarkup = renderToStaticMarkup(
    <ModuleConfigPanelBody
      open
      onClose={() => undefined}
      config={{ linkTypes: [baseLinkType] }}
      onSave={async () => undefined}
      builtins={BUILTINS}
      maxDepth={3}
      linkRegistry={LINK_REGISTRY}
      initialTab="linkTypes"
    />
  );
  const customText = plain(customMarkup);
  check(
    '自定义关联类型列出源 / 目标范围，并可删除',
    customMarkup.includes('data-testid="config-custom-link-type"') &&
      customText.includes('源 politics/polity') &&
      customMarkup.includes('aria-label="删除关联类型 结盟"')
  );
  check(
    '删除自定义类型时说明回退为 core.related_to 且备注保留',
    customText.includes('core.related_to') && customText.includes('保留备注')
  );
  check(
    '明确自定义类型只写 module.config、不入注册表',
    customText.includes('不写入后端注册表')
  );
  const levelsMarkup = renderToStaticMarkup(
    <ModuleConfigPanelBody
      open
      onClose={() => undefined}
      config={{ levels: [{ id: 'super', label: '超级大国', rank: 10 }] }}
      onSave={async () => undefined}
      builtins={BUILTINS}
      maxDepth={3}
      initialTab="levels"
    />
  );
  check(
    '等级页独立存在并显示等级名',
    levelsMarkup.includes('data-testid="config-levels"') &&
      plain(levelsMarkup).includes('超级大国')
  );
  const displayMarkup = renderToStaticMarkup(
    <ModuleConfigPanelBody
      open
      onClose={() => undefined}
      config={{}}
      onSave={async () => undefined}
      builtins={BUILTINS}
      maxDepth={3}
      initialTab="display"
    />
  );
  const displayText = plain(displayMarkup);
  check(
    '展示页包含默认复杂度与默认视图',
    displayMarkup.includes('data-testid="config-display"') &&
      displayText.includes('默认复杂度') &&
      displayText.includes('默认视图')
  );
  check('模块配置面板不出现 emoji', !EMOJI_PATTERN.test(markup));
};

const testSubmoduleMarkupNoEmoji = () => {
  check('子模块管理器渲染产物不含 emoji', !EMOJI_PATTERN.test(renderSubmoduleManager()));
};

// ---------- 5b. CustomFieldRenderer（multiselect / 复杂度可见性） ----------

const MULTISELECT_FIELD: CustomFieldDef = {
  id: 'goods',
  label: '特产',
  type: 'multiselect',
  options: ['茶叶', '瓷器'],
};

const SELECT_FIELD: CustomFieldDef = {
  id: 'form',
  label: '形态',
  type: 'select',
  options: ['集市', '官营'],
};

const renderFields = (
  fields: CustomFieldDef[],
  props: { readOnly?: boolean; values?: Record<string, unknown>; showEmpty?: boolean; complexity?: 'sketch' | 'structure' | 'sandbox' } = {}
) =>
  renderToStaticMarkup(
    <CustomFieldRenderer
      fields={fields}
      values={props.values as never}
      readOnly={props.readOnly}
      showEmpty={props.showEmpty}
      complexity={props.complexity}
    />
  );

const testCustomFieldRenderer = () => {
  eq(
    'toMultiValue 把多选值归一为字符串数组（空值 -> []）',
    [
      toMultiValue(null),
      toMultiValue(undefined),
      toMultiValue(''),
      toMultiValue('茶叶'),
      toMultiValue(['茶叶', '瓷器']),
      toMultiValue(['茶叶', '', '瓷器']),
    ],
    [[], [], [], ['茶叶'], ['茶叶', '瓷器'], ['茶叶', '瓷器']]
  );

  const editable = renderFields([MULTISELECT_FIELD]);
  check(
    '可编辑多选渲染成多选控件而不是文本输入',
    editable.includes('data-testid="custom-field-multiselect"')
  );
  eq(
    '多选控件为每个 option 生成一个勾选输入',
    [...editable.matchAll(/type="checkbox"/g)].length,
    MULTISELECT_FIELD.options?.length ?? 0
  );
  check(
    '多选字段不再落进单行文本输入分支',
    !/data-field-id="goods"[\s\S]{0,200}type="text"/.test(editable)
  );

  const readOnly = renderFields([MULTISELECT_FIELD], {
    readOnly: true,
    values: { goods: ['茶叶'] },
  });
  check(
    '只读多选渲染为标签而不是逗号拼接文本',
    readOnly.includes('data-testid="custom-field-multiselect-value"') &&
      readOnly.includes('茶叶') &&
      !readOnly.includes('茶叶,瓷器')
  );
  check(
    '只读多选空值默认不渲染（showEmpty=false）',
    !renderFields([MULTISELECT_FIELD], { readOnly: true, values: {} }).includes(
      'data-field-id="goods"'
    )
  );
  check(
    '只读多选空值在 showEmpty 下渲染「未填写」',
    plain(
      renderFields([MULTISELECT_FIELD], { readOnly: true, values: {}, showEmpty: true })
    ).includes('未填写')
  );

  const hiddenAtSketch = renderFields(
    [{ id: 'detail', label: '细目', type: 'text', visibleComplexity: 'structure' }],
    { complexity: 'sketch' }
  );
  check('复杂度为速写时隐藏「结构起可见」的字段', !hiddenAtSketch.includes('data-field-id="detail"'));
  check(
    '复杂度为结构时显示「结构起可见」的字段',
    renderFields([{ id: 'detail', label: '细目', type: 'text', visibleComplexity: 'structure' }], {
      complexity: 'structure',
    }).includes('data-field-id="detail"')
  );
  check(
    '不传 complexity 时按上下文过滤（无 Provider 退化为速写档，沙盘字段隐藏）',
    !renderFields(
      [{ id: 'detail', label: '细目', type: 'text', visibleComplexity: 'sandbox' }],
      { readOnly: true, values: { detail: '值' } }
    ).includes('data-field-id="detail"')
  );

  const selectMarkup = renderFields([SELECT_FIELD], { values: { form: '集市' } });
  check(
    '单选 select 分支行为不变（仍是 select + 选项）',
    selectMarkup.includes('<select') &&
      selectMarkup.includes('data-field-id="form"') &&
      selectMarkup.includes('<option value="集市"')
  );
};

// ---------- 5c. EventCard 图标渲染（P6-T9 回归） ----------

const eventFixture = (over: Partial<Event> = {}): Event => ({
  id: 'e1',
  name: '赤壁之战',
  description: '关键事件',
  level: 'major',
  eventDate: '208',
  order_index: 0,
  items: [],
  ...over,
});

const renderEventCard = (event: Event) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <EventCard
        event={event}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onAddItem={() => undefined}
        onEditItem={() => undefined}
        onDeleteItem={() => undefined}
        onUpdateDescription={() => undefined}
      />
    </QueryClientProvider>
  );
};

/**
 * 卡片的可见文本（去掉全部标签与 SSR 注释）：Lucide 会把图标名写进 `<svg class="lucide lucide-swords">`，
 * 因此「不显示裸名字」必须按可见文本断言，而不是整段 HTML。
 */
const visibleText = (html: string): string => plain(html.replace(/<[^>]*>/g, ' '));

const testEventCardIcons = () => {
  const typed = renderEventCard(eventFixture({ eventType: 'war' }));
  check('事件类型图标渲染成 SVG 组件', typed.includes('<svg'));
  check(
    '事件类型图标不再以文本打印（可见文本里没有 swords 字面量）',
    !visibleText(typed).includes('swords'),
    visibleText(typed).slice(0, 200)
  );

  const typedMinor = renderEventCard(eventFixture({ eventType: 'war', level: 'minor' }));
  check(
    '小事件卡片同样渲染图标组件而不是字面量',
    typedMinor.includes('<svg') && !visibleText(typedMinor).includes('swords')
  );

  const custom = renderEventCard(eventFixture({ icon: 'crown' }));
  check(
    '事件自带 icon 渲染成组件且不打印名字',
    custom.includes('<svg') && !visibleText(custom).includes('crown')
  );

  const unknown = renderEventCard(eventFixture({ icon: 'not-a-real-lucide-icon' }));
  check(
    '无法解析的 icon 名不显示裸字符串',
    !unknown.includes('not-a-real-lucide-icon'),
    unknown.slice(0, 200)
  );
  check('EventCard 渲染产物不含 emoji', !EMOJI_PATTERN.test(typed) && !EMOJI_PATTERN.test(typedMinor));
};

// ---------- 6. 图标规范（P6-T9） ----------

const testIcons = () => {
  const eventIcons = Object.values(EVENT_TYPE_CONFIG).map((config) => config.icon);
  eq(
    '事件类型图标换成 Lucide kebab-case 名',
    eventIcons,
    ['crown', 'swords', 'scroll-text', 'lightbulb', 'mountain', 'building-2', 'globe', 'landmark']
  );
  check(
    '事件类型图标全部可解析为 lucide-react 组件',
    eventIcons.every((name) => KEBAB_PATTERN.test(name) && !!lucideIcon(name)),
    eventIcons.filter((name) => !lucideIcon(name))
  );
  const levelIcons = Object.values(LEVEL_CONFIG).map((config) => config.icon);
  check(
    '等级图标全部可解析为 lucide-react 组件',
    levelIcons.every((name) => KEBAB_PATTERN.test(name) && !!lucideIcon(name)),
    levelIcons.filter((name) => !lucideIcon(name))
  );
  eq(
    '等级图标不再是星号 / 圆圈',
    levelIcons.filter((name) => EMOJI_PATTERN.test(name)),
    []
  );
  eq(
    '等级文案改成纯文本（无星号 / 圆圈拼贴）',
    Object.values(LEVEL_CONFIG).map((config) => config.labelCn),
    ['重点', '大事件', '普通', '小事件']
  );
  check(
    '等级文案不含 emoji 或星号',
    Object.values(LEVEL_CONFIG).every((config) => !EMOJI_PATTERN.test(config.labelCn))
  );
  eq(
    '等级顺序仍是 重点 / 大 / 普通 / 小',
    Object.keys(LEVEL_CONFIG),
    ['critical', 'major', 'normal', 'minor']
  );

  check(
    '子模块图标候选都是 kebab-case 的 lucide 导出',
    SUBMODULE_ICON_CHOICES.length >= 20 &&
      SUBMODULE_ICON_CHOICES.every((name) => KEBAB_PATTERN.test(name) && !!lucideIcon(name)),
    SUBMODULE_ICON_CHOICES.filter((name) => !lucideIcon(name))
  );
  check(
    '颜色候选都是 hex 色块（不用 emoji 色块）',
    SUBMODULE_PALETTE.every((color) => /^#[0-9a-f]{6}$/i.test(color)),
    SUBMODULE_PALETTE
  );
  check(
    '图标候选与色板都不含 emoji',
    !EMOJI_PATTERN.test([...SUBMODULE_ICON_CHOICES, ...SUBMODULE_PALETTE].join(' '))
  );
};

// ---------- 运行 ----------

const run = () => {
  try {
    testFieldSchema();
    testLinkTypes();
    testSubmoduleHelpers();
    testBuildPatch();
    testSubmoduleMarkup();
    testFieldEditorMarkup();
    testConfigPanelMarkup();
    testSubmoduleMarkupNoEmoji();
    testCustomFieldRenderer();
    testEventCardIcons();
    testIcons();
  } catch (error) {
    check(
      'harness 未捕获异常',
      false,
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    );
  }

  (window as unknown as Record<string, unknown>).__PHASE6B__ = {
    done: true,
    checks,
  } satisfies { done: boolean; checks: Check[] };
};

void run();
