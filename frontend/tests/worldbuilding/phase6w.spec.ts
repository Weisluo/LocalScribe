/**
 * Phase 6 世界脉络回归与验收（P6-T8）
 *
 * 两部分：
 * 1) 浏览器侧：tests/worldbuilding/harness6w.tsx 打成单文件注入真实浏览器，
 *    跑 worldWebGraph.ts 的全部纯函数断言（构造 / 降级 800 边界 / 筛选 / 布局确定性 /
 *    模块矩阵与推荐关联）；
 * 2) 静态护栏（node 侧读文件）：
 *    - 源码无 emoji；icon 字面量式断言不适用（本模块不落 icon 字段），改为断言
 *      WorldWeb.tsx 不含 emoji 与箭头字符；
 *    - 世界脉络只出现契约 §4 注册表内的 link_type；注册表仍是 54 条；
 *    - 世界脉络不引入除 lucide-react 之外的图库（无 d3 / vis / cytoscape 等依赖）；
 *    - 降级阈值常量 WEB_NODE_LIMIT === 800，且 degrade 判定在 800/801 边界正确。
 *
 * 不需要后端与 dev server。
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE6W_HARNESS_PATH, buildPhase6wHarness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

/** 精确地板 = harness6w.tsx 当前的断言数；删掉任何一条断言都会被这条守卫发现
 *  （实测 63 条；harness6w.tsx 里的 catch 分支断言不计入正常路径） */
const PHASE6W_CHECK_FLOOR = 63;

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(REPO_ROOT, 'docs/worldbuilding/cross_module_link_design.md');
const REGISTRY = path.resolve(REPO_ROOT, 'backend/app/services/link_registry.py');
const PACKAGE_JSON = path.resolve(FRONTEND_ROOT, 'package.json');

/** P6-T8 的静态扫描范围 */
const WORLD_WEB_PATHS = [
  'components/Worldbuilding/config/WorldWeb.tsx',
  'components/Worldbuilding/config/worldWebGraph.ts',
].map((relative) => path.resolve(SRC, relative));

/** 契约 §4 允许出现的 link_type 前缀 */
const CONTRACT_NAMESPACES = [
  'core',
  'history',
  'politics',
  'economy',
  'races',
  'systems',
  'character',
  'custom',
];

/** emoji / 装饰性箭头字符（curl 之外的一切符号区，含 U+2B00 与变体选择符） */
const EMOJI_PATTERN = /[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/u;

const read = (file: string) => fs.readFileSync(file, 'utf8');

test.describe('Phase 6 世界脉络', () => {
  test('浏览器侧用例：图构造 / 降级 / 筛选 / 布局 / 矩阵与推荐', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase6wHarness();
    expect(fs.existsSync(PHASE6W_HARNESS_PATH), `用例打包失败：${PHASE6W_HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE6W_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__PHASE6W_TESTS__ !== undefined,
      null,
      { timeout: 180_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE6W_TESTS__ as
          | HarnessReport
          | undefined
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
    ).toBe(PHASE6W_CHECK_FLOOR);
  });

  test('世界脉络：无 emoji、无契约外 link_type、不引入图库', () => {
    const contractText = read(CONTRACT);
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(whitelist.size, '契约 §4 表格行数异常').toBe(54);

    const registryText = read(REGISTRY);
    expect(
      (registryText.match(/LinkTypeDef\(/g) ?? []).length,
      '注册表条目数必须是契约 §4 的 54 条'
    ).toBe(54);

    const linkTypePattern = new RegExp(
      `['"\`]((?:${CONTRACT_NAMESPACES.join('|')})\\.[a-z_]+)['"\`]`,
      'g'
    );
    const offenders: string[] = [];
    for (const file of WORLD_WEB_PATHS) {
      const content = read(file);
      expect(
        EMOJI_PATTERN.test(content),
        `${path.relative(SRC, file)} 含 emoji 或装饰箭头字符`
      ).toBe(false);

      for (const match of content.matchAll(linkTypePattern)) {
        const id = match[1];
        if (id.startsWith('core.') || whitelist.has(id)) continue;
        offenders.push(`${path.relative(SRC, file)}: ${id}`);
      }
    }
    expect(offenders, `出现契约 §4 之外的 link_type：\n${offenders.join('\n')}`).toEqual([]);

    const packageJson = JSON.parse(read(PACKAGE_JSON)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };
    const graphLibraries = ['d3', 'd3-force', 'vis-network', 'cytoscape', 'sigma', 'react-force-graph', 'force-graph'];
    const introduced = graphLibraries.filter((name) => name in allDeps);
    expect(introduced, `世界脉络不得引入图库依赖：${introduced.join(', ')}`).toEqual([]);
  });

  test('世界脉络：800 节点降级阈值与只读契约', () => {
    const graphSource = read(WORLD_WEB_PATHS[1]);
    expect(
      graphSource.includes('export const WEB_NODE_LIMIT = 800'),
      '降级阈值必须显式写死 800'
    ).toBe(true);
    expect(graphSource.includes('nodeCount > WEB_NODE_LIMIT'), '降级判定必须是 > 阈值').toBe(true);

    const componentSource = read(WORLD_WEB_PATHS[0]);
    // 只读：不出现任何写关联的 API 调用
    for (const forbidden of [
      'createWorldLink',
      'updateWorldLink',
      'deleteWorldLink',
      'useCreateWorldLink',
      'useDeleteWorldLink',
      'useUpdateWorldLink',
    ]) {
      expect(
        componentSource.includes(forbidden),
        `世界脉络必须只读，不应调用 ${forbidden}`
      ).toBe(false);
    }
    // 降级态与画布态是互斥分支
    expect(componentSource.includes('world-web-degraded')).toBe(true);
    expect(componentSource.includes('world-web-canvas')).toBe(true);
    expect(componentSource.includes('world-web-matrix')).toBe(true);
  });
});
