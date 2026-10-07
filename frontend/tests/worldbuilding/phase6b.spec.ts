/**
 * Phase 6 模块配置回归与验收（P6-T3 / P6-T4 / P6-T5 / P6-T9）
 *
 * 三部分：
 * 1) 浏览器侧：tests/worldbuilding/harness6b.tsx 打成单文件注入真实浏览器，跑字段契约、
 *    复杂度可见性、归档 / 恢复、自定义关联类型校验、子模块层级纯函数与三个组件的 SSR 渲染；
 * 2) 静态护栏：写范围内无 emoji、icon 字面量都是 lucide-react 真实导出的 kebab-case 名、
 *    link_type 不超出契约 §4、我的新代码不出现 emerald-* 领域色；
 * 3) 交付面：文件与符号齐全、归档而非硬删除、自定义关联类型只落 module.config、
 *    推荐 kind 只是快捷项（不自动创建内容）、entityRef 字段不创建 WorldLink。
 *
 * 不需要后端与 dev server：harness 不发网络请求。
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE6B_HARNESS_PATH, buildPhase6bHarness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

/**
 * 精确地板 = harness6b.tsx 当前的断言数（删掉任何一条/一组断言都会被这条守卫发现）。
 * 实测 153 条；harness6b.tsx 的断言数变化时必须同步这里。
 */
const PHASE6B_CHECK_FLOOR = 153;

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(REPO_ROOT, 'docs/worldbuilding/cross_module_link_design.md');
const LUCIDE_DTS = path.resolve(FRONTEND_ROOT, 'node_modules/lucide-react/dist/lucide-react.d.ts');

/** P6-T3/T4/T5/T9 的写范围（静态验收范围；含 task-4 收口的图标渲染与多选渲染） */
const PHASE6B_FILES = [
  'components/Worldbuilding/config/SubmoduleManager.tsx',
  'components/Worldbuilding/config/FieldSchemaEditor.tsx',
  'components/Worldbuilding/config/index.ts',
  'components/Worldbuilding/shared/ModuleConfigPanel.tsx',
  'components/Worldbuilding/shared/moduleConfig.ts',
  'components/Worldbuilding/HistoryView/config.ts',
  'components/Worldbuilding/HistoryView/modals/EditEventModal.tsx',
  'components/Worldbuilding/HistoryView/modals/ConfigModal.tsx',
  'components/Worldbuilding/HistoryView/EventCard.tsx',
  'components/Worldbuilding/HistoryView/modals/AddEventModal.tsx',
  'components/Worldbuilding/shared/CustomFieldRenderer.tsx',
].map((relative) => path.resolve(SRC, relative));

/** task-4 收口文件：图标必须经 lucideIcon 渲染、多选必须有专用分支 */
const TASK4_FILES = [
  'components/Worldbuilding/HistoryView/EventCard.tsx',
  'components/Worldbuilding/HistoryView/modals/AddEventModal.tsx',
  'components/Worldbuilding/shared/CustomFieldRenderer.tsx',
].map((relative) => path.resolve(SRC, relative));

/** 本次新增代码（不含 HistoryView 既有的领域色 class，那些颜色本轮不动） */
const PHASE6B_NEW_FILES = PHASE6B_FILES.filter(
  (file) => !file.includes(`${path.sep}HistoryView${path.sep}`)
);

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}|[★☆○●◯]/u;

const read = (absolute: string) => fs.readFileSync(absolute, 'utf8');

const toPosix = (value: string) => value.split(path.sep).join('/');

const relativeTo = (file: string) => toPosix(path.relative(REPO_ROOT, file));

const lucideExportNames = (): Set<string> => {
  const text = fs.readFileSync(LUCIDE_DTS, 'utf8');
  const names = new Set<string>();
  for (const match of text.matchAll(/\bas\s+([A-Za-z][A-Za-z0-9]*)/g)) names.add(match[1]);
  for (const match of text.matchAll(/^declare const ([A-Za-z][A-Za-z0-9]*)\b/gm)) {
    names.add(match[1]);
  }
  return names;
};

const pascalName = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

test.describe('Phase 6 模块配置（P6-T3/T4/T5/T9）', () => {
  test('浏览器侧用例：字段契约 / 关联类型校验 / 子模块层级 / 三组件渲染', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase6bHarness();
    expect(fs.existsSync(PHASE6B_HARNESS_PATH), `用例打包失败：${PHASE6B_HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE6B_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__PHASE6B__ !== undefined,
      null,
      { timeout: 120_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE6B__ as HarnessReport | undefined
    );
    expect(report, '用例未产出结果').toBeTruthy();
    expect(pageErrors, `页面运行期报错：${pageErrors.join('\n')}`).toEqual([]);

    const failures = (report?.checks ?? []).filter((item) => !item.ok);
    expect(
      failures,
      `失败检查：\n${failures
        .map((item) => `- ${item.name}：${JSON.stringify(item.detail)}`)
        .join('\n')}`
    ).toEqual([]);

    // 精确地板 = 当前断言数：删掉任何一条/一组断言都会被这条守卫发现
    expect(
      (report?.checks ?? []).length,
      '用例数量不足，可能有断言被跳过或删除'
    ).toBe(PHASE6B_CHECK_FLOOR);
  });

  test('静态护栏：无 emoji、图标为 lucide kebab-case、无契约外 link_type', () => {
    const emojiOffenders: string[] = [];
    for (const file of PHASE6B_FILES) {
      const content = read(file);
      if (EMOJI_PATTERN.test(content)) emojiOffenders.push(relativeTo(file));
    }
    expect(
      emojiOffenders,
      `以下文件仍含 emoji 或星号 / 圆圈符号：\n${emojiOffenders.join('\n')}`
    ).toEqual([]);

    // `icon: 'kebab-name'` 必须是 lucide-react 的真实导出名（PascalCase 转换后）
    const iconNames = new Set<string>();
    for (const file of PHASE6B_FILES) {
      const text = read(file);
      for (const match of text.matchAll(/\bicon:\s*['"]([a-zA-Z0-9_ -]+)['"]/g)) {
        iconNames.add(match[1]);
      }
    }
    expect(iconNames.size, '未扫描到 icon 字符串字面量，断言可能失效').toBeGreaterThan(8);
    const lucideNames = lucideExportNames();
    expect(lucideNames.size, 'lucide-react 导出表解析失败').toBeGreaterThan(1000);
    const fakeIcons = [...iconNames].filter((name) => !lucideNames.has(pascalName(name))).sort();
    expect(fakeIcons, `以下 icon 名不是 lucide-react 导出：\n${fakeIcons.join('\n')}`).toEqual([]);
    expect(
      [...iconNames].sort(),
      'P6-T9 的事件类型图标未按 Lucide kebab-case 落地'
    ).toEqual(
      expect.arrayContaining([
        'crown',
        'swords',
        'scroll-text',
        'lightbulb',
        'mountain',
        'building-2',
        'globe',
        'landmark',
        'flame',
        'sparkles',
        'circle',
        'circle-dashed',
      ])
    );

    // 子模块图标候选数组也必须是 lucide 导出名
    const submoduleSource = read(
      path.resolve(SRC, 'components/Worldbuilding/config/SubmoduleManager.tsx')
    );
    const choices = /SUBMODULE_ICON_CHOICES[^=]*=\s*\[([\s\S]*?)\]/.exec(submoduleSource);
    expect(choices, 'SUBMODULE_ICON_CHOICES 未解析到（断言会失效）').toBeTruthy();
    const choiceNames = [...(choices?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map(
      (match) => match[1]
    );
    expect(choiceNames.length, '图标候选过少').toBeGreaterThan(20);
    const fakeChoices = choiceNames.filter((name) => !lucideNames.has(pascalName(name)));
    expect(fakeChoices, `图标候选不是 lucide-react 导出：\n${fakeChoices.join('\n')}`).toEqual([]);

    // link_type 白名单：只允许契约 §4 表格里的 id
    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(whitelist.size, '契约 §4 表格行数异常').toBe(54);
    const linkTypePattern =
      /['"`]((?:core|history|politics|economy|races|systems|character|custom)\.[a-z_]+)['"`]/g;
    const linkOffenders: string[] = [];
    const scanned = new Set<string>();
    for (const file of PHASE6B_FILES) {
      const content = read(file);
      for (const match of content.matchAll(linkTypePattern)) {
        scanned.add(match[1]);
        if (!whitelist.has(match[1])) {
          linkOffenders.push(`${relativeTo(file)}: ${match[1]}`);
        }
      }
    }
    expect([...scanned].sort(), '未扫描到 link_type 字面量（断言可能失效）').toEqual(
      ['core.related_to']
    );
    expect(linkOffenders, `出现契约 §4 之外的 link_type：\n${linkOffenders.join('\n')}`).toEqual([]);

    // 本次新增代码不得使用 emerald-*（领域色只用色板 hex 与既有 slate）
    const emeraldOffenders: string[] = [];
    for (const file of PHASE6B_NEW_FILES) {
      if (read(file).includes('emerald-')) emeraldOffenders.push(relativeTo(file));
    }
    expect(
      emeraldOffenders,
      `新增配置代码不得使用 emerald-* 领域色：\n${emeraldOffenders.join('\n')}`
    ).toEqual([]);
  });

  test('交付面与口径：归档而非删除、自定义类型只落 module.config、推荐 kind 不自动建内容', () => {
    // ① 冻结接口与关键符号必须存在
    const required: [string, string[]][] = [
      [
        'components/Worldbuilding/config/SubmoduleManager.tsx',
        [
          'export interface SubmoduleManagerProps',
          'export const SubmoduleManager =',
          'export const DeleteImpactPanel',
          'worldbuildingApi.createSubmodule',
          'worldbuildingApi.updateSubmodule',
          'worldbuildingApi.deleteSubmodule',
          'useSortable',
          'moveChildrenPlan',
        ],
      ],
      [
        'components/Worldbuilding/config/FieldSchemaEditor.tsx',
        [
          'export interface FieldSchemaEditorProps',
          'export const FieldSchemaEditor =',
          'export const FIELD_TYPE_IDS',
          'archiveField',
          'restoreField',
        ],
      ],
      [
        'components/Worldbuilding/config/index.ts',
        ["from './SubmoduleManager'", "from './FieldSchemaEditor'"],
      ],
      [
        'components/Worldbuilding/shared/ModuleConfigPanel.tsx',
        [
          'export const buildModuleConfigPatch',
          'data-testid="config-types"',
          'data-testid="config-fields"',
          'data-testid="config-levels"',
          'data-testid="config-statuses"',
          'data-testid="config-link-types"',
          'data-testid="config-display"',
          'data-testid="config-terms"',
        ],
      ],
      [
        'components/Worldbuilding/shared/moduleConfig.ts',
        [
          'export const fieldVisibleAt',
          'export const archiveField',
          'export const restoreField',
          'export const sortFields',
          'export const validateCustomLinkType',
          'visibleComplexity?: ComplexityLevel',
          'archived?: boolean',
        ],
      ],
      [
        'components/Worldbuilding/HistoryView/modals/EditEventModal.tsx',
        ["useState('scroll-text')", 'lucideIcon(typeConfig.icon)'],
      ],
      [
        'components/Worldbuilding/HistoryView/modals/ConfigModal.tsx',
        ['lucideIcon(type.icon)', 'lucideIcon(level.icon)'],
      ],
    ];
    const missing: string[] = [];
    for (const [relative, symbols] of required) {
      const absolute = path.resolve(SRC, relative);
      if (!fs.existsSync(absolute)) {
        missing.push(`${relative}（缺少文件）`);
        continue;
      }
      const content = fs.readFileSync(absolute, 'utf8');
      for (const symbol of symbols) {
        if (!content.includes(symbol)) missing.push(`${relative}: ${symbol}`);
      }
    }
    expect(missing, `P6-T3/T4/T5/T9 交付面缺失：\n${missing.join('\n')}`).toEqual([]);

    // index.ts 只导出本 workstream 的两个组件（GlobalSearch / WorldWeb 由各自文件直接导入）
    const configIndex = read(path.resolve(SRC, 'components/Worldbuilding/config/index.ts'));
    expect(configIndex, 'index.ts 不应转发 GlobalSearch').not.toContain("from './GlobalSearch'");
    expect(configIndex, 'index.ts 不应转发 WorldWeb').not.toContain("from './WorldWeb'");

    // ② 字段是归档而不是硬删除：FieldSchemaEditor 不得按 id 过滤掉字段
    const fieldEditor = read(
      path.resolve(SRC, 'components/Worldbuilding/config/FieldSchemaEditor.tsx')
    );
    expect(fieldEditor, '字段编辑器必须用 archiveField 软删除').toContain('archiveField(');
    expect(
      fieldEditor,
      '字段编辑器不得用 filter 硬删除字段定义'
    ).not.toMatch(/\.filter\(\s*\(?field\)?\s*=>\s*field\.id\s*!==/);
    expect(fieldEditor, 'entityRef 字段不得创建 WorldLink').not.toMatch(
      /createLink|relationService|worldbuildingApi/
    );

    // ③ 自定义关联类型只落 module.config：不得调用注册表写接口
    const panel = read(path.resolve(SRC, 'components/Worldbuilding/shared/ModuleConfigPanel.tsx'));
    expect(panel, '关联类型页必须只写 config.linkTypes').toContain('linkTypes');
    expect(panel, '配置面板不得调用注册表写接口').not.toMatch(
      /linkRegistry\s*\)\s*\.\s*(push|splice)|api\.(post|put|delete)\(\s*['"`]\/worldbuilding\/link-registry/
    );
    expect(panel, '核心关联类型必须标注不可删除').toContain('不可删除');

    // ④ 推荐 kind 只是快捷项：SubmoduleManager 里只有表单提交路径会调用 createSubmodule
    const submoduleSource = read(
      path.resolve(SRC, 'components/Worldbuilding/config/SubmoduleManager.tsx')
    );
    const createCalls = [...submoduleSource.matchAll(/worldbuildingApi\.createSubmodule\(/g)].length;
    expect(
      createCalls,
      'createSubmodule 只允许出现在表单提交这一处（推荐 kind 快捷项不得自动建内容）'
    ).toBe(1);
    expect(submoduleSource, '推荐 kind 必须说明只填充 kind').toContain('只填充 kind');
    expect(submoduleSource, '删除必须先给影响范围').toContain('submoduleDeleteImpact');

    // ⑤ ModuleConfigPanel 分页收敛为设计 §5.2 的页集合
    for (const label of ['类型', '字段', '等级', '状态', '关联类型', '展示', '术语', '模块专属']) {
      expect(panel, `模块配置面板缺少「${label}」页`).toContain(`label: '${label}'`);
    }

    // ⑥ HistoryView 等级文案与图标落成 Lucide / 纯文本
    const historyConfig = read(path.resolve(SRC, 'components/Worldbuilding/HistoryView/config.ts'));
    expect(historyConfig, '事件类型图标未换成 Lucide 名').toContain("icon: 'crown'");
    expect(historyConfig, '等级图标未换成 Lucide 名').toContain("icon: 'circle-dashed'");
    expect(historyConfig, '等级文案未改成纯文本').toContain("labelCn: '重点'");
    expect(historyConfig, '等级文案不得使用星号拼贴').not.toMatch(/labelCn: '[★○]/);
    expect(historyConfig, '等级图标不得使用星号 / 圆圈').not.toMatch(/icon: '[★○]/);

    // ⑦ task-4 收口：图标只能经 lucideIcon 渲染，多选必须有专用分支
    for (const file of TASK4_FILES) {
      const relative = path.relative(SRC, file);
      expect(fs.existsSync(file), `${relative} 不存在`).toBe(true);
    }
    for (const relative of [
      'components/Worldbuilding/HistoryView/EventCard.tsx',
      'components/Worldbuilding/HistoryView/modals/AddEventModal.tsx',
    ]) {
      const content = read(path.resolve(SRC, relative));
      expect(content, `${relative} 必须用 lucideIcon(name) 渲染图标`).toContain('lucideIcon(');
      expect(
        content,
        `${relative} 不得把 icon 名当文本打印（P6-T9 回归：会显示 crown / swords 字面量）`
      ).not.toMatch(/\{(?:typeConfig|event)\.icon\}/);
    }
    const eventCard = read(path.resolve(SRC, 'components/Worldbuilding/HistoryView/EventCard.tsx'));
    expect(eventCard, 'EventCard 必须为类型图标与事件图标分别解析组件').toMatch(
      /lucideIcon\(typeConfig\?\.icon\)/
    );
    const addEventModal = read(
      path.resolve(SRC, 'components/Worldbuilding/HistoryView/modals/AddEventModal.tsx')
    );
    expect(addEventModal, 'AddEventModal 默认图标必须与 EditEventModal 一致').toContain(
      "useState('scroll-text')"
    );
    expect(addEventModal, 'AddEventModal 图标占位不得再提 emoji').toContain(
      'Lucide 图标名，如 scroll-text'
    );

    const customFieldRenderer = read(
      path.resolve(SRC, 'components/Worldbuilding/shared/CustomFieldRenderer.tsx')
    );
    expect(customFieldRenderer, 'CustomFieldRenderer 缺少 multiselect 分支').toContain(
      "field.type === 'multiselect'"
    );
    expect(customFieldRenderer, 'CustomFieldRenderer 缺少多选控件 testid').toContain(
      'data-testid="custom-field-multiselect"'
    );
    expect(customFieldRenderer, 'CustomFieldRenderer 必须导出 toMultiValue 归一化').toContain(
      'export const toMultiValue'
    );
    expect(
      customFieldRenderer,
      'CustomFieldRenderer 必须按复杂度可见性过滤（fieldVisibleAt）'
    ).toContain('fieldVisibleAt(');
  });
});
