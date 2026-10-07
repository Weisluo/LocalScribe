/**
 * Phase 5 回归与验收（P5-T15 / 验收收口）
 *
 * 五部分：
 * 1) 浏览器侧：tests/worldbuilding/harness5.tsx 打成单文件注入真实浏览器，跑经济纯函数
 *    （config 契约、normalize 数值口径、guards 降级与窗口）+ EconomyView 三档 DOM 断言；
 * 2) 静态护栏：link_type 白名单、无 emoji、图标只用 Lucide（含 icon 字面量校验）、
 *    graph/ 纯函数不得引入 React、领域色只有 green / cyan（禁用 Tailwind emerald-*，
 *    且 ECONOMY_PALETTE 与设计文档 §4.7.1 表格逐值相等）；
 * 3) 交付面：EconomyView（P6 由 EconomyViewV2 改名）文件与导出的冻结清单、
 *    WorldbuildingView 固定渲染新视图（旧经济视图与 feature flag 已在 P6 删除）；
 * 4) 边界：不新增表、经济 API 只有只读 GET、注册表仍是 54 条、不引入图库；
 * 5) gen:types 无漂移：src/types/api.ts 的经济字段与 app/schemas/economy.py 逐字段对齐。
 *
 * 不需要后端与 dev server：浏览器侧用例把 TanStack Query 缓存预置好，不发任何网络请求。
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE5_HARNESS_PATH, buildPhase5Harness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

/**
 * 精确地板 = harness5.tsx 当前的断言数（删掉任何一条/一组断言都会被这条守卫发现）。
 * P6 交接：删掉 feature flag 的 4 条断言（flag 默认关闭 / 可开 / 可关 / 键名固定），
 * 其余覆盖不变；harness5.tsx 断言数变化时必须同步这里。
 */
const PHASE5_CHECK_FLOOR = 127;

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(REPO_ROOT, 'docs/worldbuilding/cross_module_link_design.md');
const ECONOMY_SCHEMA = path.resolve(REPO_ROOT, 'backend/app/schemas/economy.py');
const ECONOMY_ROUTER = path.resolve(REPO_ROOT, 'backend/app/api/v1/economy.py');
const ECONOMY_MIGRATION_DIR = path.resolve(REPO_ROOT, 'backend/migrations/versions');
const REGISTRY = path.resolve(REPO_ROOT, 'backend/app/services/link_registry.py');
const API_TYPES = path.resolve(SRC, 'types/api.ts');
const LUCIDE_DTS = path.resolve(FRONTEND_ROOT, 'node_modules/lucide-react/dist/lucide-react.d.ts');

/**
 * 领域色（§4.7.1）扫描范围：覆盖经济视图的全部绘制代码。
 * - `graph/layout.ts` 单独断言（见用例 ③）：那里的 `emerald` / `green` 是契约 §4.4 的线色**色名**，
 *   只有 `emerald` 这个色名允许用 emerald-* class；`green` 色名必须是 green-*（契约绿 #16A34A）。
 */
const DOMAIN_COLOR_PATHS = [
  'components/Worldbuilding/EconomyView/components',
  'components/Worldbuilding/EconomyView/modals',
  'components/Worldbuilding/EconomyView/config.ts',
  'components/Worldbuilding/EconomyView/EconomyView.tsx',
].map((relative) => path.resolve(SRC, relative));

/**
 * 设计文档 docs/worldbuilding/economy_ui_design.md §4.7.1 的颜色表（写死字面量，
 * 避免「解析文档与断言同时失效」）。emerald 的 #059669 / #10B981 必须让这条断言失败。
 */
const DESIGN_DOMAIN_PALETTE = {
  green600: { light: '#16A34A', dark: '#4ADE80' },
  green500: { light: '#22C55E', dark: '#86EFAC' },
  cyan600: { light: '#0891B2', dark: '#22D3EE' },
  cyan400: { light: '#22D3EE', dark: '#67E8F9' },
} as const;

/**
 * Phase 5 代码的静态验收范围（P6 起目录改名为 EconomyView；
 * utils/featureFlags.ts 已随 P6 删除，flag 由 P6 的静态守卫单独断言「文件不存在」）。
 */
const PHASE5_PATHS = ['components/Worldbuilding/EconomyView'].map((relative) =>
  path.resolve(SRC, relative)
);

const walk = (target: string): string[] => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => walk(path.join(target, entry.name)));
};

/** 静态扫描必须覆盖 js 系列：只扫 .ts/.tsx 时影子 JS 产物会绕过检查 */
const codeFiles = (target: string): string[] =>
  walk(target).filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));

const read = (relative: string) => fs.readFileSync(path.resolve(SRC, relative), 'utf8');

const toPosix = (value: string) => value.split(path.sep).join('/');

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

/** 契约 §4 注册的 12 条经济自有边；写成字面量避免「解析器与断言同时失效」 */
const CONTRACT_ECONOMY_LINK_TYPES = [
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
].sort();

/** P5 交付面：文件 -> 必须出现的符号 */
const REQUIRED_DELIVERABLES: [string, string[]][] = [
  ['components/Worldbuilding/EconomyView/EconomyView.tsx', ['EconomyView']],
  ['components/Worldbuilding/EconomyView/index.ts', ['EconomyView']],
  ['components/Worldbuilding/EconomyView/config.ts', ['ECONOMY_CONFIG_DEFAULTS', 'resolveEconomyConfig', 'ECONOMY_VERBS', 'ECONOMY_LAYERS']],
  ['components/Worldbuilding/EconomyView/types.ts', ['EconomyViewProps', 'EconomyVisualModel', 'SketchLedgerProps', 'FlowCanvasProps', 'SandboxOverlayProps', 'DegradeLedgerMatrixProps']],
  ['components/Worldbuilding/EconomyView/hooks/useEconomyViewState.ts', ['useEconomyViewState']],
  ['components/Worldbuilding/EconomyView/hooks/useEconomyData.ts', ['useEconomyData']],
  ['components/Worldbuilding/EconomyView/hooks/useTimeline.ts', ['useTimeline']],
  ['components/Worldbuilding/EconomyView/graph/layout.ts', ['buildLaneLayout']],
  ['components/Worldbuilding/EconomyView/graph/normalize.ts', ['buildVisualModel']],
  ['components/Worldbuilding/EconomyView/graph/guards.ts', ['shouldDegradeMatrix']],
  ['components/Worldbuilding/EconomyView/components/SketchLedger.tsx', ['SketchLedger']],
  ['components/Worldbuilding/EconomyView/components/ChipList.tsx', ['ChipList']],
  ['components/Worldbuilding/EconomyView/components/FlowCanvas.tsx', ['FlowCanvas']],
  ['components/Worldbuilding/EconomyView/components/GraphNode.tsx', ['GraphNode']],
  ['components/Worldbuilding/EconomyView/components/GraphEdge.tsx', ['GraphEdge']],
  ['components/Worldbuilding/EconomyView/components/LedgerList.tsx', ['LedgerList']],
  ['components/Worldbuilding/EconomyView/components/InspectorPanel.tsx', ['InspectorPanel']],
  ['components/Worldbuilding/EconomyView/components/SandboxOverlay.tsx', ['SandboxOverlay']],
  ['components/Worldbuilding/EconomyView/components/StatsPanel.tsx', ['StatsPanel']],
  ['components/Worldbuilding/EconomyView/components/LayerRail.tsx', ['LayerRail']],
  ['components/Worldbuilding/EconomyView/components/TimeBrush.tsx', ['TimeBrush']],
  ['components/Worldbuilding/EconomyView/components/DegradeLedgerMatrix.tsx', ['DegradeLedgerMatrix']],
  ['components/Worldbuilding/EconomyView/components/EmptyState.tsx', ['EconomyEmptyState']],
  ['components/Worldbuilding/EconomyView/modals/PromoteChipModal.tsx', ['PromoteChipModal']],
];

test.describe('Phase 5 经济模块', () => {
  test('浏览器侧用例：纯函数与 EconomyView 三档 DOM', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase5Harness();
    expect(fs.existsSync(PHASE5_HARNESS_PATH), `用例打包失败：${PHASE5_HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE5_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__PHASE5_TESTS__ !== undefined,
      null,
      { timeout: 120_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE5_TESTS__ as
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

    // 精确地板 = 当前断言数：删掉任何一条/一组断言都会被这条守卫发现（不要留余量）
    // 实测值见 PHASE5_CHECK_FLOOR；harness5.tsx 的断言数变化时必须同步这里
    expect(
      (report?.checks ?? []).length,
      '用例数量不足，可能有断言被跳过或删除'
    ).toBe(PHASE5_CHECK_FLOOR);
  });

  test('link_type 白名单：经济代码不得出现契约 §4 之外的类型', () => {
    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(whitelist.size, '契约 §4 表格行数异常').toBe(54);
    for (const id of CONTRACT_ECONOMY_LINK_TYPES) {
      expect(whitelist.has(id), `契约 §4 缺少 ${id}`).toBe(true);
    }

    const linkTypePattern =
      /['"`]((?:core|history|politics|economy|races|systems|character|custom)\.[a-z_]+)['"`]/g;
    const offenders: string[] = [];
    const scanned = new Set<string>();
    for (const file of PHASE5_PATHS.flatMap((target) => codeFiles(target))) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(linkTypePattern)) {
        scanned.add(match[1]);
        if (!whitelist.has(match[1])) {
          offenders.push(`${toPosix(path.relative(REPO_ROOT, file))}: ${match[1]}`);
        }
      }
    }
    expect([...scanned].sort(), 'link_type 字面量扫描结果异常').toEqual(
      expect.arrayContaining([
        'economy.produces',
        'economy.consumes',
        'economy.flows_to',
        'economy.supplies',
        'core.related_to',
      ])
    );
    expect(offenders, `出现契约 §4 之外的 link_type：\n${offenders.join('\n')}`).toEqual([]);
  });

  test('无 emoji、图标只用 Lucide 名、无私有关系写入路径', () => {
    const emojiPattern =
      /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}/u;
    const emojiOffenders: string[] = [];
    const iconLibraryOffenders: string[] = [];
    const legacyWrites: string[] = [];

    const files = PHASE5_PATHS.flatMap((target) => codeFiles(target));
    expect(files.length, 'Phase 5 代码文件数量异常').toBeGreaterThanOrEqual(24);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (emojiPattern.test(content)) emojiOffenders.push(toPosix(path.relative(REPO_ROOT, file)));
      for (const match of content.matchAll(/from\s+['"]([^'"]*icons?[^'"]*)['"]/g)) {
        if (!match[1].includes('lucide-react')) {
          iconLibraryOffenders.push(`${toPosix(path.relative(REPO_ROOT, file))}: ${match[1]}`);
        }
      }
      for (const token of ['bidirectionalRelations', 'relationsApi.create']) {
        if (content.includes(token)) {
          legacyWrites.push(`${toPosix(path.relative(REPO_ROOT, file))}: ${token}`);
        }
      }
    }
    expect(emojiOffenders, `以下文件含 emoji：\n${emojiOffenders.join('\n')}`).toEqual([]);
    expect(
      iconLibraryOffenders,
      `图标必须来自 lucide-react：\n${iconLibraryOffenders.join('\n')}`
    ).toEqual([]);
    expect(
      legacyWrites,
      `经济代码出现私有关系写入路径：\n${legacyWrites.join('\n')}`
    ).toEqual([]);

    // `icon: 'kebab-name'` 必须是 lucide-react 的真实导出名（PascalCase 转换后）
    const iconNames = new Set<string>();
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bicon:\s*['"]([a-zA-Z0-9_ -]+)['"]/g)) {
        iconNames.add(match[1]);
      }
    }
    expect(iconNames.size, '未扫描到任何 icon 字符串字面量，断言可能失效').toBeGreaterThan(5);
    const lucideNames = lucideExportNames();
    expect(lucideNames.size, 'lucide-react 导出表解析失败').toBeGreaterThan(1000);
    const fakeIcons = [...iconNames]
      .filter((name) => !lucideNames.has(pascalName(name)))
      .sort();
    expect(fakeIcons, `以下 icon 名不是 lucide-react 导出：\n${fakeIcons.join('\n')}`).toEqual([]);
    expect(
      [...iconNames].sort(),
      'icon 字面量清单异常（应有 §3.4 推荐 kind 的图标）'
    ).toEqual(expect.arrayContaining(['gem', 'package', 'factory', 'store', 'coins', 'briefcase', 'scroll-text']));
  });

  test('领域色只有 green / cyan：不得出现 emerald-*，ECONOMY_PALETTE 与 §4.7.1 逐值相等', () => {
    // ① 经济视图代码里不得再出现 Tailwind emerald-*（§4.7.1 领域色固定 green / cyan）
    const emeraldOffenders: string[] = [];
    for (const file of DOMAIN_COLOR_PATHS.flatMap((target) => codeFiles(target))) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('emerald-')) {
        emeraldOffenders.push(toPosix(path.relative(REPO_ROOT, file)));
      }
    }
    expect(
      emeraldOffenders,
      `领域色必须用 green-*（docs/worldbuilding/economy_ui_design.md §4.7.1），仍在用 emerald-* 的文件：\n${emeraldOffenders.join('\n')}`
    ).toEqual([]);

    // ② ECONOMY_PALETTE 的 green / cyan 两套 hex 必须等于设计文档表格里的精确值
    const config = read('components/Worldbuilding/EconomyView/config.ts');
    const paletteBlock = /export const ECONOMY_PALETTE = \{([\s\S]*?)\n\}/.exec(config);
    expect(paletteBlock, 'ECONOMY_PALETTE 未解析到（断言会失效）').toBeTruthy();
    const block = paletteBlock?.[1] ?? '';

    const actual: Record<string, { light: string; dark: string }> = {};
    for (const key of Object.keys(DESIGN_DOMAIN_PALETTE)) {
      const match = new RegExp(
        `${key}\\s*:\\s*\\{\\s*light:\\s*'([^']+)'\\s*,\\s*dark:\\s*'([^']+)'\\s*\\}`
      ).exec(block);
      expect(match, `ECONOMY_PALETTE 缺少 ${key}`).toBeTruthy();
      actual[key] = { light: match?.[1] ?? '', dark: match?.[2] ?? '' };
    }
    expect(actual, 'ECONOMY_PALETTE 与 §4.7.1 表格不一致').toEqual(DESIGN_DOMAIN_PALETTE);
    // emerald-600 的 #059669（或 emerald-500 的 #10B981）出现即失败
    expect(block, '领域色不得写成 emerald 的 hex').not.toContain('#059669');
    expect(block, '领域色不得写成 emerald 的 hex').not.toContain('#10B981');

    // ③ 画布线色换算：`green` 色名必须落到 green-*，emerald-* 只能属于 `emerald` 色名
    const layout = read('components/Worldbuilding/EconomyView/graph/layout.ts');
    expect(layout, 'green 色名必须用 green-600（§4.7.1）').toContain(
      "green: 'stroke-green-600 dark:stroke-green-400'"
    );
    expect(layout, 'green 色名必须用 green-400（§4.7.1）').toContain(
      "green: 'fill-green-600 dark:fill-green-400'"
    );
    const strayEmerald = layout
      .split('\n')
      .filter((line) => line.includes('emerald-') && !/^\s*emerald:\s/.test(line));
    expect(
      strayEmerald,
      `graph/layout.ts 里只有 emerald 色名可以用 emerald-*：\n${strayEmerald.join('\n')}`
    ).toEqual([]);
  });

  test('交付面齐全 + WorldbuildingView 固定渲染经济视图（旧视图与 flag 已删除）', () => {
    const missing: string[] = [];
    for (const [relative, symbols] of REQUIRED_DELIVERABLES) {
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
    expect(missing, `P5 交付面缺失：\n${missing.join('\n')}`).toEqual([]);

    // P6 交接后：WorldbuildingView 只认改名后的 EconomyView，不再有二选一分支
    const view = read('components/Worldbuilding/WorldbuildingView.tsx');
    for (const token of ["from './EconomyView'", '<EconomyView']) {
      expect(view, `WorldbuildingView 未接入 ${token}`).toContain(token);
    }
    for (const legacy of ['EconomyViewV2', 'isEconomyViewV2Enabled']) {
      expect(view, `P6 后不应再出现 ${legacy}`).not.toContain(legacy);
    }
    // 旧 UI 与 feature flag 必须在 P6 删除
    expect(
      fs.existsSync(path.resolve(SRC, 'components/Worldbuilding/EconomyView.tsx')),
      '旧 EconomyView.tsx 必须已删除（P6 全量切换）'
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve(SRC, 'utils/featureFlags.ts')),
      'utils/featureFlags.ts 必须已删除（P6 删除清单第 2 项）'
    ).toBe(false);

    // 三档共用一套数据的结构证据：graph/normalize + guards 是纯函数，不 import React
    for (const relative of [
      'components/Worldbuilding/EconomyView/graph/normalize.ts',
      'components/Worldbuilding/EconomyView/graph/guards.ts',
      'components/Worldbuilding/EconomyView/graph/layout.ts',
    ]) {
      const content = read(relative);
      expect(content, `${relative} 不应 import React（保持纯函数可断言）`).not.toMatch(
        /from\s+['"]react['"]/
      );
    }

    // 阈值与配置骨架写在可断言的文件里
    const config = read('components/Worldbuilding/EconomyView/config.ts');
    expect(config).toContain('ECONOMY_MATRIX_THRESHOLD = 800');
    expect(config).toContain("CYCLE_KIND = 'custom_cycle'");
    expect(config).toMatch(/ECONOMY_MIN_SKETCH_FIELDS = 3/);
    expect(config).toMatch(/ECONOMY_MAX_SKETCH_FIELDS = 5/);
    // 不预置世界观内容
    for (const token of ['presets', 'seeded', 'sampleData', 'defaultEntities', 'starterLevels']) {
      expect(config, `config.ts 不应预置内容字段 ${token}`).not.toContain(token);
    }
    expect(config).toMatch(/entityTypes:\s*\[\s*\]/);
    expect(config).toMatch(/levels:\s*\[\s*\]/);
    expect(config).toMatch(/metrics:\s*\[\s*\]/);
  });

  test('边界：不新增表 / 经济 API 只有只读 GET / 注册表仍是 54 条 / 不引入图库', () => {
    // ① 不新增表、不新增模型文件
    for (const forbidden of [
      'backend/app/models/economy.py',
      'backend/app/models/economy_entity.py',
    ]) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, forbidden)), `不应新增 ${forbidden}`).toBe(false);
    }
    const backendFiles = [
      ...walk(path.resolve(REPO_ROOT, 'backend/app')),
      ...walk(ECONOMY_MIGRATION_DIR),
    ].filter((file) => file.endsWith('.py'));
    const publishedMigrations = new Set(
      execFileSync('git', ['ls-files', 'backend/migrations/versions'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    );
    const revisionOf = (file: string): string | null => {
      const match = /^revision(?::\s*str)?\s*=\s*['"]([\w-]+)['"]/m.exec(
        fs.readFileSync(file, 'utf8')
      );
      return match ? match[1] : null;
    };
    const downRevisionOf = (file: string): string | null => {
      const match = /^down_revision[^=]*=\s*['"]([\w-]+)['"]/m.exec(
        fs.readFileSync(file, 'utf8')
      );
      return match ? match[1] : null;
    };
    const publishedRevisions = new Set(
      [...publishedMigrations].map((relative) => revisionOf(path.resolve(REPO_ROOT, relative)))
    );

    const tableOffenders: string[] = [];
    for (const file of backendFiles) {
      const relative = toPosix(path.relative(REPO_ROOT, file));
      const content = fs.readFileSync(file, 'utf8');
      if (relative.startsWith('backend/migrations/versions/')) {
        const isPublished = publishedMigrations.has(relative);
        if (!isPublished) {
          const down = downRevisionOf(file);
          // 新迁移必须接在已发布链之后（线性历史）——对所有阶段的迁移都成立
          if (!down || !publishedRevisions.has(down)) {
            tableOffenders.push(`${relative}: 新增迁移未接在已发布链之后（down_revision=${down}）`);
          }
          // 「P5 不应建表」只针对 P5 自己的迁移：后续阶段（P6 删表迁移的 downgrade 会重建表）
          // 不属于 P5 冻结范围，这里按文件名收敛，避免把别阶段的迁移算到 P5 头上。
          const isP5Migration = /p5|econom/i.test(path.basename(relative));
          if (isP5Migration && /create_table\s*\(/.test(content)) {
            tableOffenders.push(`${relative}: P5 不应建表`);
          }
        }
        continue;
      }
      for (const match of content.matchAll(/__tablename__\s*=\s*['"]([A-Za-z0-9_]+)['"]/g)) {
        if (/econom|resource|market|trade|commod/i.test(match[1])) {
          tableOffenders.push(`${relative}: 表名 ${match[1]}`);
        }
      }
    }
    expect(tableOffenders, `后端出现 P5 不应新增的表：\n${tableOffenders.join('\n')}`).toEqual([]);

    // 经济迁移必须存在，且只处理回填（不新增列）
    const economyMigrations = fs
      .readdirSync(ECONOMY_MIGRATION_DIR)
      .filter((name) => name.includes('p5') || name.includes('economy'))
      .map((name) => path.join(ECONOMY_MIGRATION_DIR, name));
    expect(economyMigrations.length, '缺少 P5 经济回填迁移').toBeGreaterThanOrEqual(1);
    const migrationText = economyMigrations
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    expect(migrationText, '迁移必须是幂等回填（先读现值）').toMatch(/upgrade|def upgrade/);
    expect(migrationText, '迁移不得新增列').not.toMatch(/add_column\s*\(/);

    // ② 经济 API 只有 4 个只读 GET，没有写路径
    const routerText = fs.readFileSync(ECONOMY_ROUTER, 'utf8');
    const getRoutes = [...routerText.matchAll(/@router\.get\(\s*["']([^"']+)["']/g)].map(
      (match) => match[1]
    );
    expect(getRoutes.sort()).toEqual([
      '/modules/{module_id}/economy/graph',
      '/modules/{module_id}/economy/metrics',
      '/modules/{module_id}/economy/summary',
      '/modules/{module_id}/economy/timeline',
    ]);
    expect(routerText, '经济 API 不得有写路径').not.toMatch(
      /@router\.(post|put|patch|delete)\(/
    );

    // ③ 注册表仍是 54 条，经济自有边仍是契约 §4.4 的 12 条
    const registryText = fs.readFileSync(REGISTRY, 'utf8');
    const registryIds = [...registryText.matchAll(/id="([a-z_]+\.[a-z_]+)"/g)].map(
      (match) => match[1]
    );
    expect(registryIds.length, '注册表条数异常').toBe(54);
    const economyIds = registryIds.filter((id) => id.startsWith('economy.')).sort();
    expect(economyIds, '经济注册表与契约 §4.4 不一致').toEqual(CONTRACT_ECONOMY_LINK_TYPES);

    // ④ 不引入图库
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(FRONTEND_ROOT, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    for (const banned of ['d3', 'vis-network', 'cytoscape', 'react-flow', 'dagre', 'elkjs', 'sigma']) {
      expect(
        Object.keys(pkg.dependencies ?? {}).some((name) => name.includes(banned)),
        `不应为经济画布引入图库 ${banned}`
      ).toBe(false);
    }
  });

  test('gen:types 无漂移：src/types/api.ts 与 backend/app/schemas/economy.py 对齐', () => {
    const schemaText = fs.readFileSync(ECONOMY_SCHEMA, 'utf8');
    const apiTypes = fs.readFileSync(API_TYPES, 'utf8');

    // ① 4 条经济路径必须都在生成类型里（漏跑 gen:types 会立刻暴露）
    for (const route of ['graph', 'summary', 'timeline', 'metrics']) {
      expect(
        apiTypes,
        `src/types/api.ts 缺少 economy/${route} 路径（gen:types 未重生成？）`
      ).toContain(`/api/v1/worldbuilding/modules/{module_id}/economy/${route}`);
    }

    // ② 关键字段必须两段都成立：
    //    (a) 后端 schema 源码里确实存在这个 snake_case 字段（字段改名即失败，不再被静默过滤掉）；
    //    (b) 生成类型里存在对应 camelCase 字段（漏跑 gen:types 即失败）。
    const camel = (snake: string) =>
      snake.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
    const sampled = [
      'module_id',
      'node_limit',
      'degrade_reason',
      'skipped_edges',
      'applied_window',
      'flow_series',
      'price_band',
      'route_note',
      'surplus_derived',
      'cycle_phase_id',
      'custom_fields',
      'metric_ids',
      'default_complexity',
      'display_mode',
      'sketch_fields',
      'default_flow_unit',
      'min_complexity',
      'value_type',
      'stage_filter',
      'kind_filter',
      'metric_coverage',
      'entities_with_metrics',
      'total_flow',
      'flow_units',
      'multi_unit',
      'empty_entities',
      'time_order',
      'source_ref',
      'by_kind_stage',
    ];
    // (a) 后端改名时条目必须报错：这里用词边界匹配，不再用 includes 作过滤条件
    const missingInSchema = sampled.filter(
      (snake) => !new RegExp(`\\b${snake}\\b`).test(schemaText)
    );
    expect(
      missingInSchema,
      `backend/app/schemas/economy.py 里已不存在这些字段（改名后必须同步采样表并重跑 gen:types）：\n${missingInSchema.join('\n')}`
    ).toEqual([]);

    // (b) 生成类型必须带上每个采样的 camelCase 字段
    const missingInTypes = sampled.filter(
      (snake) =>
        !apiTypes.includes(`${camel(snake)}:`) && !apiTypes.includes(`${camel(snake)}?:`)
    );
    expect(
      missingInTypes.map(camel),
      `生成类型缺少后端字段（先重跑 gen:types）：\n${missingInTypes.join('\n')}`
    ).toEqual([]);

    // ③ 视图模型不得手写重复定义：EconomyView/types.ts 必须从生成类型取
    const viewTypes = read('components/Worldbuilding/EconomyView/types.ts');
    expect(viewTypes).toContain("components['schemas']['EconomyGraph']");
    expect(viewTypes).toContain("components['schemas']['EconomySummary']");
    expect(viewTypes).toContain("components['schemas']['EconomyEdge']");
    expect(viewTypes).toContain("components['schemas']['EconomyNode']");
    for (const handWritten of ['interface EconomyGraph ', 'interface EconomyNode ', 'interface EconomyEdge ']) {
      expect(viewTypes, `视图层不应手写契约类型 ${handWritten}`).not.toContain(handWritten);
    }
  });

  test('推荐 kind 骨架只在用户实际用到后写入 config.entityTypes（计划 §6）', () => {
    const view = read('components/Worldbuilding/EconomyView/EconomyView.tsx');
    expect(view, '缺少 rememberKind（推荐 kind 骨架的落库入口）').toContain(
      'const rememberKind = useCallback'
    );
    expect(view, 'kind 骨架没有写进 config.entityTypes').toContain(
      'entityTypes: [...config.entityTypes'
    );
    // 新建实体与 chip 展开两条路径都必须记账
    const callSites = view.match(/await rememberKind\(kind\);/g) ?? [];
    expect(
      callSites.length,
      'rememberKind 必须同时挂在新建实体与 chip 展开上（点击后才写入，不预置）'
    ).toBeGreaterThanOrEqual(2);
    // 不预置：config.ts 的出厂骨架里 entityTypes 必须为空数组
    expect(read('components/Worldbuilding/EconomyView/config.ts')).toMatch(
      /entityTypes:\s*\[\s*\]/
    );
  });
});
