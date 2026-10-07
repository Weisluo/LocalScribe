/**
 * Phase 6 世界容器回归与验收（P6-T1/T2/T6/T7）
 *
 * 五部分：
 * 1) 浏览器侧：tests/worldbuilding/harness6.tsx 打成单文件注入真实浏览器，跑
 *    世界列表/切换、空白创建载荷、世界设置合并与术语回退、模块行统计、世界脉络入口与降级判定、
 *    全局搜索索引与限定符、备份恢复载荷与报告、返回栈快照往返、GlobalSearch 面板 DOM；
 * 2) 静态护栏：P6 UI 范围无 emoji / 装饰箭头；
 * 3) 旧接口退场：全 src 无 /worldbuilding/templates|instances|worldviews 字符串，
 *    worldbuildingApi 不再有手写旧 interface 与旧方法；
 * 4) 交付面与删除面：新增文件存在、旧视图 / feature flag / 旧分发文案已删除，
 *    WorldbuildingView 固定渲染 EconomyView 并接入设置 / 搜索 / 世界脉络；
 * 5) 契约约束：复杂度只有 sketch/structure/sandbox、世界脉络 800 节点阈值两处一致。
 *
 * 不需要后端与 dev server：浏览器侧用例把 TanStack Query 缓存预置好，不发任何网络请求。
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE6_HARNESS_PATH, buildPhase6Harness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

/**
 * 精确地板 = harness6.tsx 当前的断言数（删掉任何一条/一组断言都会被这条守卫发现）。
 * 实测 173 条；harness6.tsx 断言数变化时必须同步这里（不要留余量）。
 */
const PHASE6_CHECK_FLOOR = 177;

const SRC = path.resolve(FRONTEND_ROOT, 'src');

const walk = (target: string): string[] => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => walk(path.join(target, entry.name)));
};

const read = (relative: string) => fs.readFileSync(path.resolve(SRC, relative), 'utf8');
const toPosix = (value: string) => value.split(path.sep).join('/');
const relToRepo = (file: string) => toPosix(path.relative(path.resolve(FRONTEND_ROOT, '..'), file));

/** P6 世界容器的 UI 静态扫描范围（覆盖 config/ 整目录，不只 GlobalSearch） */
const PHASE6_UI_PATHS = [
  'components/Worldbuilding/WorldbuildingView.tsx',
  'components/Worldbuilding/WorldSettingsPanel.tsx',
  'components/Worldbuilding/config',
  'components/Worldbuilding/hooks',
  'services/worldbuildingApi.ts',
].map((relative) => path.resolve(SRC, relative));

/** 与 phase5.spec.ts 同一条 emoji / 装饰箭头正则（U+2190-21FF 含 ↑↓→） */
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}/u;

const LEGACY_API_METHODS = [
  'getTemplates:',
  'getTemplate:',
  'createTemplate:',
  'updateTemplate:',
  'deleteTemplate:',
  'getModules:',
  'createModule:',
  'getInstances:',
  'createInstance:',
  'importTemplate:',
  'exportTemplate:',
  'downloadTemplateAsFile:',
  'uploadTemplateFromFile:',
  'deleteModule:',
];

test.describe('Phase 6 世界容器', () => {
  test('浏览器侧用例：世界列表 / 设置 / 搜索 / 备份 / 返回栈', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase6Harness();
    expect(fs.existsSync(PHASE6_HARNESS_PATH), `用例打包失败：${PHASE6_HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE6_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__PHASE6_TESTS__ !== undefined,
      null,
      { timeout: 120_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE6_TESTS__ as HarnessReport | undefined
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

    expect(
      (report?.checks ?? []).length,
      '用例数量不足，可能有断言被跳过或删除'
    ).toBe(PHASE6_CHECK_FLOOR);
  });

  test('静态护栏：P6 UI 范围无 emoji / 装饰箭头', () => {
    const files = PHASE6_UI_PATHS.flatMap((target) => walk(target)).filter((file) =>
      /\.(ts|tsx)$/.test(file)
    );
    expect(files.length, 'P6 代码文件数量异常').toBeGreaterThanOrEqual(8);
    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (EMOJI_PATTERN.test(content)) offenders.push(relToRepo(file));
    }
    expect(
      offenders,
      `禁止 emoji 与装饰箭头（cross_module_link_design §6.1/§6.3），以下文件命中：\n${offenders.join('\n')}`
    ).toEqual([]);

    // 图标一律 Lucide（不允许别的图标库）
    const iconLibraryOffenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/from\s+['"]([^'"]*icons?[^'"]*)['"]/g)) {
        if (!match[1].includes('lucide-react')) {
          iconLibraryOffenders.push(`${relToRepo(file)}: ${match[1]}`);
        }
      }
    }
    expect(iconLibraryOffenders, `图标必须来自 lucide-react：\n${iconLibraryOffenders.join('\n')}`).toEqual([]);
  });

  test('旧接口退场：手写代码无 templates / instances / worldviews 字符串，API 不再有旧方法', () => {
    const forbidden = [
      '/worldbuilding/templates',
      '/worldbuilding/instances',
      '/worldbuilding/worldviews',
    ];
    const offenders: string[] = [];
    for (const file of walk(SRC).filter((item) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(item))) {
      // src/types/api.ts 是后端 OpenAPI 的生成产物（npm run gen:types）：它也必须是干净的，
      // 单独在下面断言（后端下架 + 重跑 gen:types 之后旧路径自然消失）。
      const content = fs.readFileSync(file, 'utf8');
      for (const token of forbidden) {
        if (content.includes(token)) offenders.push(`${relToRepo(file)}: ${token}`);
      }
    }
    expect(offenders, `仍有旧接口调用：\n${offenders.join('\n')}`).toEqual([]);

    // 生成产物必须已经按后端的下架后 OpenAPI 重新生成（gen:types 漂移守卫）
    const generated = read('types/api.ts');
    for (const token of [...forbidden, 'WorldTemplate', 'WorldInstance']) {
      expect(generated, `src/types/api.ts 仍是旧 OpenAPI 生成物：${token}`).not.toContain(token);
    }

    const api = read('services/worldbuildingApi.ts');
    const leftovers = LEGACY_API_METHODS.filter((token) => api.includes(token));
    expect(leftovers, `worldbuildingApi 仍有旧方法：\n${leftovers.join('\n')}`).toEqual([]);
    for (const handWritten of [
      'interface WorldTemplate',
      'interface WorldModule {',
      'interface WorldSubmodule {',
      'interface WorldModuleItem {',
      'interface WorldInstance',
    ]) {
      expect(api, `不应再手写旧 interface：${handWritten}`).not.toContain(handWritten);
    }
    // 保留的方法必须指向正式路由，且返回类型来自 OpenAPI 生成
    expect(api, 'createWorldModule 必须走 POST /worlds/{id}/modules').toContain(
      '`/worldbuilding/worlds/${worldId}/modules`'
    );
    expect(api, '保留方法的返回类型应取自 OpenAPI').toContain(
      "components['schemas']['WorldSubmoduleResponse']"
    );
    expect(api, '保留方法的返回类型应取自 OpenAPI').toContain(
      "components['schemas']['WorldModuleItemResponse']"
    );
  });

  test('交付面齐全 + 旧视图 / feature flag / 旧分发文案已删除', () => {
    const required: [string, string[]][] = [
      ['components/Worldbuilding/WorldSettingsPanel.tsx', ['WorldSettingsPanel', '基础', '外观', '术语', '历法', '模块', '备份']],
      ['components/Worldbuilding/config/GlobalSearch.tsx', ['GlobalSearch', 'parseSearchQuery', 'buildSearchIndex']],
      ['components/Worldbuilding/hooks/worldSettings.ts', ['sortWorlds', 'pickCurrentWorldId', 'buildWorldCreatePayload', 'auditTerminology', 'webEntryDecision', 'WORLD_WEB_NODE_LIMIT']],
      ['components/Worldbuilding/hooks/worldBackup.ts', ['parseBackupText', 'assertBackupVersion', 'buildImportPayload', 'summarizeImportReport', 'backupFileName']],
      ['components/Worldbuilding/hooks/globalSearch.ts', ['buildSearchIndex', 'searchIndex', 'RECENT_SEARCH_LIMIT']],
      ['components/Worldbuilding/hooks/index.ts', ['./worldSettings', './worldBackup', './globalSearch']],
      ['components/Worldbuilding/EconomyView/index.ts', ['EconomyView']],
      ['components/Worldbuilding/EconomyView/EconomyView.tsx', ['export const EconomyView']],
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
    expect(missing, `P6 交付面缺失：\n${missing.join('\n')}`).toEqual([]);

    // 删除面：旧经济视图、feature flag、旧分发弹窗
    const deleted = [
      'utils/featureFlags.ts',
      'components/Worldbuilding/EconomyView.tsx',
      'components/Worldbuilding/EconomyView/modals/ConfigModal.tsx',
      'components/Worldbuilding/EconomyView/components/EconomicCard.tsx',
      'components/Worldbuilding/EconomyView/components/RelationGraph.tsx',
      'components/Worldbuilding/EconomyView/components/EntityTypeTabs.tsx',
    ];
    const stillThere = deleted.filter((relative) => fs.existsSync(path.resolve(SRC, relative)));
    expect(stillThere, `P6 删除清单未执行：\n${stillThere.join('\n')}`).toEqual([]);
    const economyFiles = walk(path.resolve(SRC, 'components/Worldbuilding/EconomyView'));
    expect(economyFiles.length, '经济视图文件数量异常（改名后应仍有 24 个左右）').toBeGreaterThanOrEqual(20);
    for (const file of economyFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${relToRepo(file)} 仍引用已删除的 feature flag`).not.toContain('featureFlags');
      expect(content, `${relToRepo(file)} 仍带 V2 后缀`).not.toContain('EconomyViewV2');
    }

    // WorldbuildingView 固定渲染新视图并接入 P6 入口
    const view = read('components/Worldbuilding/WorldbuildingView.tsx');
    for (const token of [
      "from './EconomyView'",
      '<EconomyView',
      'WorldSwitcher',
      'BlankWorldModal',
      'WorldSettingsPanel',
      'GlobalSearch',
      'WorldWeb',
      'buildComplexityPatch',
      'webEntryDecision',
      'sortWorlds',
      'resolveCurrentWorldId',
      'readCurrentWorldId',
      'writeCurrentWorldId',
    ]) {
      expect(view, `WorldbuildingView 未接入 ${token}`).toContain(token);
    }
    for (const legacy of ['EconomyViewV2', 'isEconomyViewV2Enabled', 'featureFlags', "from './EconomyViewV2'"]) {
      expect(view, `P6 后不应再出现 ${legacy}`).not.toContain(legacy);
    }

    // 旧分发文案退场、新的世界文案到位（只断言用户可见字符串，不断言注释）
    for (const legacyText of ['导入模板', '创建世界模板', '世界模板', '模板文件', '命名新建', '从JSON文件导入']) {
      expect(view, `用户可见文案仍残留：${legacyText}`).not.toContain(legacyText);
    }
    for (const newText of ['新建世界', '恢复世界备份', '创建空白世界', '新世界为空，不包含任何预设内容。', '世界设置']) {
      expect(view, `缺少新文案：${newText}`).toContain(newText);
    }
    expect(view, '世界列表按更新时间倒序的提示缺失').toContain('updatedLabel');
    expect(view, '复杂度切换必须落库（P2 遗留）').toContain('buildComplexityPatch');
    expect(view, '失效引用必须提供清理入口（T7）').toContain('清理引用');
    expect(view, '失效引用必须提供查看来源入口（T7）').toContain('查看来源');
  });

  test('契约约束：复杂度只有三档、世界脉络 800 节点阈值两处一致', () => {
    const settings = read('components/Worldbuilding/hooks/worldSettings.ts');
    expect(settings, '复杂度三档必须写死为契约值').toContain(
      "export const WORLD_COMPLEXITY_VALUES: ComplexityLevel[] = ['sketch', 'structure', 'sandbox'];"
    );
    for (const token of ['WORLD_WEB_NODE_LIMIT = 800', 'DEFAULT_WORLD_TERMINOLOGY', 'WORLD_DEFAULT_MODULE', 'auditTerminology']) {
      expect(settings, `worldSettings 缺少 ${token}`).toContain(token);
    }

    const view = read('components/Worldbuilding/WorldbuildingView.tsx');
    // 复杂度只经契约三档入口，不得再出现旧模板时代的三档枚举
    expect(view, 'WorldbuildingView 不应出现旧复杂度枚举').not.toContain('highly_complex');
    expect(view, '复杂度切换必须走 buildComplexityPatch').toContain('buildComplexityPatch');

    // 世界脉络：纯逻辑模块（config/worldWebGraph.ts）与本地入口阈值必须一致
    // （不一致会导致入口放行但图已降级，或反之，判断漂移）
    const webGraph = read('components/Worldbuilding/config/worldWebGraph.ts');
    const limitMatch = /WEB_NODE_LIMIT = (\d+)/.exec(webGraph);
    expect(limitMatch, 'worldWebGraph 未声明 WEB_NODE_LIMIT（断言会失效）').toBeTruthy();
    expect(settings, '本地阈值必须与 worldWebGraph 一致').toContain(
      `WORLD_WEB_NODE_LIMIT = ${limitMatch?.[1]}`
    );
    expect(Number(limitMatch?.[1]), '节点阈值应为 800（契约 §5.4 建议值）').toBe(800);

    // 搜索索引与最近记录必须按世界隔离（P5 跨世界泄漏的同类缺陷）
    const search = read('components/Worldbuilding/hooks/globalSearch.ts');
    expect(search, '最近记录键必须带项目 + 世界作用域').toContain('recentSearchKey');
    expect(search, '限定符必须同时支持中文与 ASCII').toContain('关联');
    expect(search, '速写档降级必须可判定').toContain('linkData');
  });
});
