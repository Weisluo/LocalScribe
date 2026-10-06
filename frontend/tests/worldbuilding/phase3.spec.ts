/**
 * Phase 3 回归与验收（P3-T10）
 *
 * 三部分：
 * 1) 浏览器侧：tests/worldbuilding/harness3.tsx 打成单文件注入真实浏览器，跑纯函数 + RacesView/SystemsView DOM 断言；
 * 2) Node 侧静态验收：link_type 契约白名单、无 emoji、图标只用 Lucide、Phase 3 目录与冻结接口齐全；
 * 3) 边界验收：P3 不新增后端表 / 专用路由、不预置种族与体系内容。
 *
 * 不需要后端与 dev server：浏览器侧用例把 TanStack Query 缓存预置好，不发任何网络请求。
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE3_HARNESS_PATH, buildPhase3Harness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(REPO_ROOT, 'docs/worldbuilding/cross_module_link_design.md');

/** Phase 3 新增/改动的代码路径（静态验收范围）；SRC 已是 frontend/src */
const PHASE3_PATHS = [
  'components/Worldbuilding/RacesView',
  'components/Worldbuilding/SystemsView',
  'components/Worldbuilding/shared',
  'components/Worldbuilding/WorldbuildingView.tsx',
  'services/worldbuildingApi.ts',
].map((relative) => path.resolve(SRC, relative));

const walk = (target: string): string[] => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => walk(path.join(target, entry.name)));
};

const codeFiles = (target: string): string[] =>
  walk(target).filter((file) => /\.(ts|tsx)$/.test(file));

const read = (relative: string) => fs.readFileSync(path.resolve(SRC, relative), 'utf8');

test.describe('Phase 3 种族与体系轻量模块', () => {
  test('浏览器侧用例：纯函数与 RacesView/SystemsView DOM 行为', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase3Harness();
    expect(fs.existsSync(PHASE3_HARNESS_PATH), `用例打包失败：${PHASE3_HARNESS_PATH}`).toBe(
      true
    );

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE3_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE3_TESTS__ !== undefined,
      null,
      { timeout: 60_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE3_TESTS__ as
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
    expect(
      (report?.checks ?? []).length,
      '用例数量不足，可能有断言被跳过或删除'
    ).toBeGreaterThanOrEqual(158);
  });

  test('link_type 白名单：新增代码不得出现契约 §4 之外的类型', () => {
    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(whitelist.size, '契约 §4 表格行数异常').toBe(54);
    expect(whitelist.has('races.related_to')).toBe(true);
    expect(whitelist.has('systems.grants')).toBe(true);

    const linkTypePattern =
      /['"`]((?:core|history|politics|economy|races|systems|character|custom)\.[a-z_]+)['"`]/g;
    const offenders: string[] = [];
    const scanned = new Set<string>();
    // Phase 4 明确废弃 politics.treaty_between（politics_ui_design §3.8.1）：唯一允许的落点是
    // `components/Worldbuilding/PoliticsView/types.ts` 里那一行读取侧常量定义。只放行
    // 「该文件 + 该行含 `LEGACY_TREATY_LINK_TYPE =`」，其它任何位置（含别的模块的写入路径）照旧拦截。
    const LEGACY_DEF_FILE = path.resolve(
      SRC,
      'components/Worldbuilding/PoliticsView/types.ts'
    );
    for (const file of codeFiles(SRC)) {
      const content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach((line, index) => {
        for (const match of line.matchAll(linkTypePattern)) {
          scanned.add(match[1]);
          if (
            match[1] === 'politics.treaty_between' &&
            file === LEGACY_DEF_FILE &&
            line.includes('LEGACY_TREATY_LINK_TYPE =')
          ) {
            continue;
          }
          if (!whitelist.has(match[1])) {
            offenders.push(`${path.relative(REPO_ROOT, file)}:${index + 1}: ${match[1]}`);
          }
        }
      });
    }
    // 防止正则失效导致的「空过」：P3 明确依赖的这些字面量必须被扫到
    expect([...scanned].sort(), 'link_type 字面量扫描结果异常').toEqual(
      expect.arrayContaining([
        'races.related_to',
        'races.notable_figure',
        'systems.advances_to',
        'systems.grants',
        'systems.costs',
      ])
    );
    expect(offenders, `出现契约 §4 之外的 link_type：\n${offenders.join('\n')}`).toEqual([]);
  });

  test('新增文件无 emoji、图标只用 Lucide 名', () => {
    const emojiPattern =
      /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}/u;
    const emojiOffenders: string[] = [];
    const iconLibraryOffenders: string[] = [];

    const files = PHASE3_PATHS.flatMap((target) => codeFiles(target));
    expect(files.length, 'Phase 3 代码文件数量异常').toBeGreaterThanOrEqual(44);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (emojiPattern.test(content)) {
        emojiOffenders.push(path.relative(REPO_ROOT, file));
      }
      for (const match of content.matchAll(/from\s+['"]([^'"]*icons?[^'"]*)['"]/g)) {
        if (!match[1].includes('lucide-react')) {
          iconLibraryOffenders.push(`${path.relative(REPO_ROOT, file)}: ${match[1]}`);
        }
      }
    }

    expect(emojiOffenders, `以下文件含 emoji：\n${emojiOffenders.join('\n')}`).toEqual([]);
    expect(
      iconLibraryOffenders,
      `图标必须来自 lucide-react：\n${iconLibraryOffenders.join('\n')}`
    ).toEqual([]);
  });

  test('P3 交付面：目录、视图分支、共享件与冻结接口齐全', () => {
    const required: [string, string[]][] = [
      ['components/Worldbuilding/RacesView/index.tsx', ['RacesView']],
      ['components/Worldbuilding/SystemsView/index.tsx', ['SystemsView']],
      ['components/Worldbuilding/RacesView/hooks/useRaces.ts', ['useRaces']],
      ['components/Worldbuilding/SystemsView/hooks/useSystems.ts', ['useSystems']],
      ['components/Worldbuilding/shared/ModuleConfigPanel.tsx', ['ModuleConfigPanel']],
      ['components/Worldbuilding/shared/CustomFieldRenderer.tsx', ['CustomFieldRenderer']],
      ['components/Worldbuilding/shared/EmptyState.tsx', ['EmptyState']],
      ['components/Worldbuilding/shared/QuickStart.tsx', ['QuickStart']],
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
    expect(missing, `P3 交付面缺失：\n${missing.join('\n')}`).toEqual([]);

    // tab 接入：WorldbuildingView 必须同时渲染两个新视图
    const view = read('components/Worldbuilding/WorldbuildingView.tsx');
    for (const token of ["from './RacesView'", "from './SystemsView'", '<RacesView', '<SystemsView', 'MissingModuleState']) {
      expect(view, `WorldbuildingView 未接入 ${token}`).toContain(token);
    }

    // 复杂度阈值与层级上限写在类型层
    const racesTypes = read('components/Worldbuilding/RacesView/types.ts');
    expect(racesTypes).toContain('RACES_MAX_DEPTH = 2');
    expect(racesTypes).toContain('RACE_LINEAGE_LIMIT = 80');
    expect(racesTypes).toContain('RACE_CARD_VIRTUAL_LIMIT = 200');
    const systemsTypes = read('components/Worldbuilding/SystemsView/types.ts');
    expect(systemsTypes).toContain('SYSTEMS_MAX_DEPTH = 3');
    expect(systemsTypes).toContain('SYSTEM_NODE_LIMIT = 300');

    // sketch 档不加载血缘布局 / 典籍：血缘开关受能力矩阵约束
    const racesHook = read('components/Worldbuilding/RacesView/hooks/useRaces.ts');
    expect(racesHook).toContain('capabilities.canvas');
  });

  test('边界：P3 不新增后端表 / 专用路由，不预置种族与体系内容', () => {
    // 1) 不存在 races/systems 专用后端路由文件
    for (const forbidden of [
      'backend/app/api/v1/races.py',
      'backend/app/api/v1/systems.py',
    ]) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, forbidden)), `不应新增 ${forbidden}`).toBe(
        false
      );
    }

    // 2) 后端不得出现 races/systems 专用表名或路由前缀
    const backendFiles = walk(path.resolve(REPO_ROOT, 'backend/app')).filter((file) =>
      file.endsWith('.py')
    );
    const backendOffenders: string[] = [];
    for (const file of backendFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const token of ['world_races', 'world_systems', 'race_submodules', 'system_tiers']) {
        if (content.includes(token)) {
          backendOffenders.push(`${path.relative(REPO_ROOT, file)}: ${token}`);
        }
      }
      for (const token of ['"/races', '"/systems', '"/worldbuilding/races', '"/worldbuilding/systems']) {
        if (content.includes(token)) {
          backendOffenders.push(`${path.relative(REPO_ROOT, file)}: ${token}`);
        }
      }
    }
    expect(
      backendOffenders,
      `后端出现 P3 不应新增的表名/路由：\n${backendOffenders.join('\n')}`
    ).toEqual([]);

    // 3) 迁移目录不新增与种族/体系相关的迁移
    const migrations = walk(path.resolve(REPO_ROOT, 'backend/migrations/versions')).filter(
      (file) => file.endsWith('.py')
    );
    const migrationOffenders = migrations.filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /races|systems/i.test(content) && /create_table|add_column/i.test(content);
    });
    expect(
      migrationOffenders.map((file) => path.relative(REPO_ROOT, file)),
      'P3 不应新增与种族/体系相关的数据迁移'
    ).toEqual([]);

    // 4) 模块默认配置里不预置内容：不能出现 presets / seeded / sampleData 之类的字段。
    //    这是静态黑名单（防呆），不等于「新建世界的两个模块为空」——后者由后端
    //    world_service 只建骨架保证，见 00_overview/phase1，不在本 spec 的断言范围内。
    for (const relative of [
      'components/Worldbuilding/RacesView/config.ts',
      'components/Worldbuilding/SystemsView/config.ts',
    ]) {
      const content = read(relative);
      for (const token of [
        'presets',
        'seeded',
        'sampleData',
        'exampleRaces',
        'exampleSystems',
        'defaultRaces',
        'defaultSystems',
        'starterTiers',
      ]) {
        expect(content, `${relative} 不应预置内容字段 ${token}`).not.toContain(token);
      }
    }

    // 5) 前端不得为两个模块自建专用后端路径
    const api = read('services/worldbuildingApi.ts');
    for (const token of ['/worldbuilding/races', '/worldbuilding/systems']) {
      expect(api, `worldbuildingApi 不应新增专用路径 ${token}`).not.toContain(token);
    }

    // 6) 前端源码（非同构测试）不引入 d3 / vis / cytoscape 等图库：血缘树与阶梯为自绘
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(FRONTEND_ROOT, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    for (const banned of ['d3', 'vis-network', 'cytoscape', 'react-flow-renderer', 'dagre']) {
      expect(
        Object.keys(pkg.dependencies ?? {}).some((name) => name.includes(banned)),
        `不应为血缘/阶梯引入图库 ${banned}`
      ).toBe(false);
    }
  });

  test('工作区卫生：Phase 3 只调用既有的 worldbuildingApi 方法', () => {
    // 说明：这里原来用 `git diff <硬编码 SHA> -- backend` 判定「未改后端」。
    // 那是工作区快照而不是回归：浅克隆/导出包会直接报错，后续阶段正常改后端也会失败，
    // 且对 P3 自身代码零覆盖。改为可长期运行的结构断言：
    // P3 前端只能调用 worldbuildingApi 上真实存在的方法（专用路径/拼错方法名一律拦下）。
    const api = read('services/worldbuildingApi.ts');
    const defined = new Set(
      [...api.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1])
    );
    const used = new Set<string>();
    for (const file of PHASE3_PATHS.flatMap((target) => codeFiles(target))) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/worldbuildingApi\.(\w+)/g)) {
        used.add(match[1]);
      }
    }
    expect(
      [...used].length,
      'P3 未调用 worldbuildingApi，断言可能失效'
    ).toBeGreaterThan(0);
    const missing = [...used].filter((name) => !defined.has(name)).sort();
    expect(missing, `调用了未定义的 worldbuildingApi 方法：\n${missing.join('\n')}`).toEqual(
      []
    );
  });
});
