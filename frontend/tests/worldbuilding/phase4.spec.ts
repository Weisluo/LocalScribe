/**
 * Phase 4 回归与验收（P4-T12 / 验收收口）
 *
 * 四部分：
 * 1) 浏览器侧：tests/worldbuilding/harness4.tsx 打成单文件注入真实浏览器，跑政治派生选择器纯函数
 *    与 PoliticsView 的三视图壳 / 过滤器 / 空态 / 条约簿 / 聚焦详情 DOM 断言；
 * 2) Node 侧静态验收：link_type 契约白名单、无 emoji、图标只用 Lucide（含 icon 字面量校验）、
 *    契约 §4.3 关联类型与代码常量清单一致、权重形态未被拉平；
 * 3) 交付面验收：PoliticsView 目录与冻结接口齐全、WorldbuildingView 已接入；
 * 4) 边界验收：P4 不新增后端表 / 专用路由（语义扫描 app + migrations）、不新增 JS 影子产物、
 *    不预置政治内容，不出现 treaty_between 写入（含常量间接写入）。
 *
 * 不需要后端与 dev server：浏览器侧用例把 TanStack Query 缓存预置好，不发任何网络请求。
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, PHASE4_HARNESS_PATH, buildPhase4Harness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(REPO_ROOT, 'docs/worldbuilding/cross_module_link_design.md');
const UI_DESIGN = path.resolve(REPO_ROOT, 'docs/worldbuilding/politics_ui_design.md');
const LUCIDE_DTS = path.resolve(
  FRONTEND_ROOT,
  'node_modules/lucide-react/dist/lucide-react.d.ts'
);
const POLITICS_TYPES = path.resolve(SRC, 'components/Worldbuilding/PoliticsView/types.ts');

/** Phase 4 新增/改动的代码路径（静态验收范围） */
const PHASE4_PATHS = [
  'components/Worldbuilding/PoliticsView',
].map((relative) => path.resolve(SRC, relative));

const walk = (target: string): string[] => {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .flatMap((entry) => walk(path.join(target, entry.name)));
};

/**
 * 静态扫描的源文件：必须覆盖 `.js`/`.jsx`/`.mjs`/`.cjs`——只扫 `.ts`/`.tsx` 时，
 * 误编译出的 CJS `.js` 影子文件（含违规字面量）会完全绕过检查。
 */
const codeFiles = (target: string): string[] =>
  walk(target).filter((file) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file));

const read = (relative: string) => fs.readFileSync(path.resolve(SRC, relative), 'utf8');

/** lucide-react 的真实导出名（PascalCase）：解析它的类型入口，比 import 整个包便宜得多 */
const lucideExportNames = (): Set<string> => {
  const text = fs.readFileSync(LUCIDE_DTS, 'utf8');
  const names = new Set<string>();
  for (const match of text.matchAll(/\bas\s+([A-Za-z][A-Za-z0-9]*)/g)) {
    names.add(match[1]);
  }
  for (const match of text.matchAll(/^declare const ([A-Za-z][A-Za-z0-9]*)\b/gm)) {
    names.add(match[1]);
  }
  return names;
};

/** politics 代码里 `icon: 'some-name'` 的字符串字面量（排除 `icon: Landmark` 这类组件引用） */
const politicsIconNames = (files: string[]): Set<string> => {
  const names = new Set<string>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bicon:\s*['"]([a-zA-Z0-9_ -]+)['"]/g)) {
      names.add(match[1]);
    }
  }
  return names;
};

const pascalName = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/** 仓库相对路径统一成正斜杠（git 输出与 Windows 的 path.relative 分隔符不同） */
const toPosix = (value: string): string => value.split(path.sep).join('/');

/** 契约 §4.3（政治）注册的 14 个自有边；写成字面量避免「解析器与断言同时失效」 */
const CONTRACT_POLITICS_LINK_TYPES = [
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
].sort();

test.describe('Phase 4 政治模块', () => {
  test('浏览器侧用例：选择器纯函数与 PoliticsView DOM 行为', async ({ page }) => {
    test.setTimeout(300_000);
    await buildPhase4Harness();
    expect(fs.existsSync(PHASE4_HARNESS_PATH), `用例打包失败：${PHASE4_HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: PHASE4_HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__PHASE4_TESTS__ !== undefined,
      null,
      { timeout: 60_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE4_TESTS__ as
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
    // 实测 267 条（选择器纯函数与契约占多数，DOM 占少数）；harness4.tsx 的断言数变化时必须同步这里
    expect(
      (report?.checks ?? []).length,
      '用例数量不足，可能有断言被跳过或删除'
    ).toBe(267);
  });

  test('link_type 白名单：政治代码不得出现契约 §4 之外的类型', () => {
    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(whitelist.size, '契约 §4 表格行数异常').toBe(54);
    expect(whitelist.has('politics.signatory_of')).toBe(true);
    expect(whitelist.has('politics.controls_region')).toBe(true);
    expect(whitelist.has('politics.treaty_between'), '废弃类型不应在注册表').toBe(false);

    const linkTypePattern =
      /['"`]((?:core|history|politics|economy|races|systems|character|custom)\.[a-z_]+)['"`]/g;
    const offenders: string[] = [];
    const scanned = new Set<string>();
    for (const file of codeFiles(SRC)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(linkTypePattern)) {
        scanned.add(match[1]);
        // 唯一例外：废弃类型的常量定义（只用于读取侧的等价转换，不写库）
        if (match[1] === 'politics.treaty_between') continue;
        if (!whitelist.has(match[1])) {
          offenders.push(`${path.relative(REPO_ROOT, file)}: ${match[1]}`);
        }
      }
    }
    expect([...scanned].sort(), 'link_type 字面量扫描结果异常').toEqual(
      expect.arrayContaining([
        'politics.signatory_of',
        'politics.subordinate_to',
        'politics.member_of',
        'politics.leads',
        'politics.ally_of',
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
    const legacyHandleOffenders: string[] = [];
    const writeTypeOffenders: string[] = [];

    const files = PHASE4_PATHS.flatMap((target) => codeFiles(target));
    expect(files.length, 'Phase 4 代码文件数量异常').toBeGreaterThanOrEqual(30);

    // ① 废弃边常量只允许在 types.ts 定义；别处只能「读取侧」引用（比较 / 过滤 / 三元），
    //    写成 `link_type: LEGACY_TREATY_LINK_TYPE` 这类常量间接写入必须被拦下。
    //    若某个 symbol 被当成值赋给 link_type，或在 hooks / modals 里出现，即视为写入路径。
    const WRITE_DIRS = ['hooks', 'modals'].map((dir) =>
      path.join('components', 'Worldbuilding', 'PoliticsView', dir)
    );
    for (const file of files) {
      const relative = toPosix(path.relative(REPO_ROOT, file));
      if (path.resolve(file) === POLITICS_TYPES) continue;
      const content = fs.readFileSync(file, 'utf8');
      const inWriteDir = WRITE_DIRS.some((dir) => relative.includes(`/${dir}/`));
      for (const symbol of ['LEGACY_TREATY_LINK_TYPE', 'isLegacyTreatyLink']) {
        if (!content.includes(symbol)) continue;
        // 该 symbol 是否被当作 link_type 的值写出去（`link_type: X` / `link_type = X`）
        const usedAsWriteValue = new RegExp(
          `\\blink_type\\s*[:=]\\s*${symbol}\\b`
        ).test(content);
        if (inWriteDir || usedAsWriteValue) {
          legacyHandleOffenders.push(
            `${relative}: ${symbol}${inWriteDir ? '（写入层目录）' : '（被写进 link_type）'}`
          );
        }
      }
    }
    expect(
      legacyHandleOffenders,
      `废弃边不得在写入层引用、也不得被写成 link_type：\n${legacyHandleOffenders.join('\n')}`
    ).toEqual([]);

    // 读取侧转换只应集中在 types.ts + selectors 两处，防止废弃常量扩散到更多文件
    const legacyConstantFiles = files
      .filter((file) => fs.readFileSync(file, 'utf8').includes('LEGACY_TREATY_LINK_TYPE'))
      .map((file) => toPosix(path.relative(REPO_ROOT, file)))
      .sort();
    expect(
      legacyConstantFiles,
      '废弃边常量的引用面异常（应只有类型层与读取侧转换）'
    ).toEqual([
      'frontend/src/components/Worldbuilding/PoliticsView/hooks/selectors.ts',
      'frontend/src/components/Worldbuilding/PoliticsView/types.ts',
    ]);

    // ② 写入层的 link_type 只允许：字面量的 APPROVED_LINK_TYPE 常量、POLITICS_LINK_TYPES.*、
    //    变量/属性读取（`linkType` / `item.linkType` / `link_type`）。把 `link_type: <任意表达式>`
    //    写死成废弃边或新造类型都会被拦下（字面量扫描看不到的常量间接写入也覆盖）。
    //    范围 = PoliticsView/hooks + PoliticsView/modals（真正的写入口）。
    const APPROVED_LINK_TYPE = /^[A-Z][A-Z0-9_]*LINK_TYPE$/;
    const linkTypeAssign = /\blink_type:\s*([^,}\n]+)/g;
    const writeDirs = [
      path.resolve(SRC, 'components/Worldbuilding/PoliticsView/hooks'),
      path.resolve(SRC, 'components/Worldbuilding/PoliticsView/modals'),
    ];
    const writeFiles = writeDirs.flatMap((dir) => codeFiles(dir));
    expect(writeFiles.length, '写入层文件数量异常').toBeGreaterThanOrEqual(5);
    for (const file of writeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const [index, line] of content.split('\n').entries()) {
        for (const match of line.matchAll(linkTypeAssign)) {
          const value = match[1].trim().replace(/,$/, '');
          const allowed =
            APPROVED_LINK_TYPE.test(value) ||
            /^POLITICS_LINK_TYPES\.[A-Za-z0-9_]+$/.test(value) ||
            /^[A-Za-z_$][\w$.]*linkType$/.test(value) ||
            /^[A-Za-z_$][\w$.]*\.link_type$/.test(value) ||
            value === 'link_type';
          if (!allowed) {
            writeTypeOffenders.push(
              `${path.relative(REPO_ROOT, file)}:${index + 1}: link_type: ${value}`
            );
          }
        }
      }
    }
    expect(
      writeTypeOffenders,
      `写入层的 link_type 只允许显式常量或变量：\n${writeTypeOffenders.join('\n')}`
    ).toEqual([]);

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
      // 政治只走 world_links：不得调用旧的 bidirectional relations 客户端。
      // treaty_between 允许作为「读取侧等价转换」的常量出现在 types.ts（§3.8.1），
      // 但不得作为写入用的 link_type 字面量出现。
      for (const token of ['bidirectionalRelations', 'relationsApi.create']) {
        if (content.includes(token)) {
          legacyWrites.push(`${path.relative(REPO_ROOT, file)}: ${token}`);
        }
      }
      if (/link_type:\s*['"]politics\.treaty_between['"]/.test(content)) {
        legacyWrites.push(`${path.relative(REPO_ROOT, file)}: link_type = treaty_between`);
      }
    }

    expect(emojiOffenders, `以下文件含 emoji：\n${emojiOffenders.join('\n')}`).toEqual([]);
    expect(
      iconLibraryOffenders,
      `图标必须来自 lucide-react：\n${iconLibraryOffenders.join('\n')}`
    ).toEqual([]);
    expect(
      legacyWrites,
      `政治代码出现私有关系写入路径：\n${legacyWrites.join('\n')}`
    ).toEqual([]);

    // ③ `icon:` 字符串字面量必须是 lucide-react 的真实导出名（kebab-case -> PascalCase，
    //    与 shared/lucideIcon.ts 的解析口径一致）。只查 import 路径时
    //    `icon: 'definitely-not-a-lucide-icon'` 会静默通过。
    const iconNames = politicsIconNames(files);
    expect(iconNames.size, '未扫描到任何 icon 字符串字面量，断言可能失效').toBeGreaterThan(0);
    const lucideNames = lucideExportNames();
    expect(lucideNames.size, 'lucide-react 导出表解析失败').toBeGreaterThan(1000);
    const fakeIcons = [...iconNames]
      .filter((name) => !lucideNames.has(pascalName(name)))
      .sort();
    expect(
      fakeIcons,
      `以下 icon 名不是 lucide-react 导出：\n${fakeIcons.join('\n')}`
    ).toEqual([]);
    expect(
      [...iconNames].sort(),
      'icon 字面量清单异常（应有内置四 kind 的图标）'
    ).toEqual(expect.arrayContaining(['landmark', 'shield', 'user-round', 'scroll-text']));
  });

  test('权重形态未被拉平：政权/组织/人物/条约四类各有独立组件', () => {
    const required: [string, string[]][] = [
      ['components/Worldbuilding/PoliticsView/index.tsx', ['PoliticsView']],
      ['components/Worldbuilding/PoliticsView/types.ts', ['POLITICS_ITEM_GROUPS', 'POLITICS_RELATION_LAYERS']],
      ['components/Worldbuilding/PoliticsView/config.ts', ['POLITICS_CONFIG_DEFAULTS', 'resolvePoliticsConfig', 'validatePoliticsKind']],
      ['components/Worldbuilding/PoliticsView/hooks/usePolitics.ts', ['usePolitics']],
      ['components/Worldbuilding/PoliticsView/hooks/selectors.ts', ['buildAtlasNodes', 'buildRibbons', 'buildRosterPolities', 'buildChronicleLanes', 'buildFocusDetail']],
      ['components/Worldbuilding/PoliticsView/EmptyState.tsx', ['PoliticsEmptyState']],
      // 四类形态各自独立，不能只有一套同构卡片
      ['components/Worldbuilding/PoliticsView/PowerAtlas/index.tsx', ['PowerAtlas']],
      ['components/Worldbuilding/PoliticsView/FocusPanel/index.tsx', ['FocusPanel']],
      ['components/Worldbuilding/PoliticsView/Roster/index.tsx', ['Roster']],
      ['components/Worldbuilding/PoliticsView/Chronicle/index.tsx', ['Chronicle']],
      ['components/Worldbuilding/PoliticsView/TreatyBook/index.tsx', ['TreatyBook']],
      ['components/Worldbuilding/PoliticsView/modals/PoliticsFormModal.tsx', ['PoliticsFormModal']],
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
    expect(missing, `P4 交付面缺失：\n${missing.join('\n')}`).toEqual([]);

    // 政权 / 组织 / 人物 / 条约四类形态组件齐全（删掉任何一个都会被拦下）
    const atlasFiles = walk(path.resolve(SRC, 'components/Worldbuilding/PoliticsView/PowerAtlas'))
      .map((file) => path.basename(file))
      .join('|');
    for (const token of ['PolityNode', 'OrganizationCluster', 'IndependentLane', 'FigureStrip', 'TreatyRibbonLayer', 'RelationEdgeLayer']) {
      expect(atlasFiles, `PowerAtlas 缺少 ${token}`).toContain(token);
    }

    // WorldbuildingView 已接入 PoliticsView 分支
    const view = read('components/Worldbuilding/WorldbuildingView.tsx');
    for (const token of ["from './PoliticsView'", '<PoliticsView', "activeTab === 'politics'"]) {
      expect(view, `WorldbuildingView 未接入 ${token}`).toContain(token);
    }

    // 三视图只有三个 Tab（没有四个平级 Tab）
    const config = read('components/Worldbuilding/PoliticsView/config.ts');
    expect(config, '主视图必须恰好三个').toContain("POLITICS_VIEWS = ['atlas', 'roster', 'chronicle']");

    // 阈值写在类型层（可被测试直接断言）
    const types = read('components/Worldbuilding/PoliticsView/types.ts');
    expect(types).toContain('ATLAS_FULL_POLITY_LIMIT = 60');
    expect(types).toContain('ATLAS_FOLD_POLITY_LIMIT = 200');
    expect(types).toContain('ROSTER_VIRTUAL_LIMIT = 200');
    expect(types).toContain('FOCUS_PIN_LIMIT = 3');
    expect(types).toContain('POLITICS_MAX_ORG_DEPTH = 3');
  });

  test('边界：P4 不新增后端表 / 专用路由，不预置政治内容', () => {
    for (const forbidden of [
      'backend/app/api/v1/politics.py',
      'backend/app/api/v1/polities.py',
      'backend/app/models/politics.py',
      'backend/app/models/polity.py',
    ]) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, forbidden)), `不应新增 ${forbidden}`).toBe(false);
    }

    // 后端不得新增政治专用表 / 路由前缀：语义扫描（文件名、表名、路由前缀与路径），
    // 而不是几个固定 token —— `api/v1/polities.py` + `models/polity.py`（`__tablename__ = 'polity_treaty'`）
    // 或迁移里 `create_table('world_polities')` 都必须被拦下。
    // 已发布迁移是基线（git index 里的那些 + 它们作为基座衍生出的新迁移）；
    // 新迁移只允许出现在既有线性链之后，不得另起炉灶。
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
    const isPublished = (file: string): boolean => {
      if (publishedMigrations.has(toPosix(path.relative(REPO_ROOT, file)))) return true;
      const down = downRevisionOf(file);
      if (!down) return false;
      for (const candidate of publishedMigrations) {
        const candidateFile = path.resolve(REPO_ROOT, candidate);
        if (revisionOf(candidateFile) === down) return isPublished(candidateFile);
      }
      return false;
    };
    const backendFiles = [
      ...walk(path.resolve(REPO_ROOT, 'backend/app')),
      ...walk(path.resolve(REPO_ROOT, 'backend/migrations/versions')),
    ].filter((file) => file.endsWith('.py'));

    const backendOffenders: string[] = [];
    const TABLE_PATTERN = /(polit|treat)/i;
    const tableDecl =
      /(?:__tablename__\s*=\s*|create_table\(\s*)[rubfRUBF]{0,2}['"]([A-Za-z0-9_]+)['"]/g;
    const routerPrefix = /APIRouter\([^)]*prefix\s*=\s*[rubfRUBF]{0,2}['"]([^'"]+)['"]/g;
    // 只认真正的路由装饰器 @router.get("/politics/...")，避免把 domain 字符串（"politics"）当路径
    const routeDecorator =
      /@\w+\.(?:get|post|put|patch|delete)\(\s*[rubfRUBF]{0,2}['"]([^'"]*(?:polit|treat)[^'"]*)['"]/gi;

    for (const file of backendFiles) {
      const relative = toPosix(path.relative(REPO_ROOT, file));
      if (relative.startsWith('backend/migrations/versions/') && isPublished(file)) {
        continue; // 已发布迁移是基线，不在 P4 新增范围内
      }
      if (
        relative.startsWith('backend/migrations/versions/') &&
        (downRevisionOf(file) === null || !isPublished(file))
      ) {
        backendOffenders.push(`${relative}: 新增迁移未接在已发布链之后`);
        continue;
      }
      if (
        relative.startsWith('backend/migrations/versions/') &&
        /polit|treat/i.test(path.basename(file))
      ) {
        backendOffenders.push(`${relative}: 迁移文件名带政治语义`);
      }
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(tableDecl)) {
        if (TABLE_PATTERN.test(match[1])) {
          backendOffenders.push(`${relative}: 表名 ${match[1]}`);
        }
      }
      for (const match of content.matchAll(routerPrefix)) {
        if (/polit|treat/i.test(match[1])) {
          backendOffenders.push(`${relative}: APIRouter prefix ${match[1]}`);
        }
      }
      for (const match of content.matchAll(routeDecorator)) {
        backendOffenders.push(`${relative}: 路由路径 ${match[1]}`);
      }
    }
    expect(
      backendOffenders,
      `后端出现 P4 不应新增的表名/路由：\n${backendOffenders.join('\n')}`
    ).toEqual([]);

    // 模块默认配置里不预置政治内容
    const config = read('components/Worldbuilding/PoliticsView/config.ts');
    for (const token of [
      'presets',
      'seeded',
      'sampleData',
      'examplePolities',
      'starterLevels',
      'defaultPolities',
      'PRESET_TEMPLATES',
    ]) {
      expect(config, `config.ts 不应预置内容字段 ${token}`).not.toContain(token);
    }
    // levels / statuses / fieldSchema / linkTypes / terminology 默认必须为空
    expect(config).toMatch(/levels:\s*\[\s*\]/);
    expect(config).toMatch(/statuses:\s*\[\s*\]/);
    expect(config).toMatch(/fieldSchema:\s*\{\s*\}/);
    expect(config).toMatch(/linkTypes:\s*\[\s*\]/);
    expect(config).toMatch(/terminology:\s*\{\s*\}/);

    // 不引入图库：画布与沿革为自绘
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(FRONTEND_ROOT, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    for (const banned of ['d3', 'vis-network', 'cytoscape', 'react-flow-renderer', 'dagre']) {
      expect(
        Object.keys(pkg.dependencies ?? {}).some((name) => name.includes(banned)),
        `不应为版图/沿革引入图库 ${banned}`
      ).toBe(false);
    }

    const api = read('services/worldbuildingApi.ts');
    for (const token of ['/worldbuilding/politics', '/worldbuilding/treaties']) {
      expect(api, `worldbuildingApi 不应新增专用路径 ${token}`).not.toContain(token);
    }
  });

  test('静态扫描护栏：src 下没有 .js 影子文件，扫描扩展名已覆盖 js', () => {
    // 静态验收项目标是 `.ts/.tsx`；一旦出现同名 `.js` 影子（例如误跑 tsc 产出的 CJS），
    // 扫描与打包都可能落到废文件上。这里显式拦下「有 .ts/.tsx 同名兄弟的 .js/.jsx」，
    // 并断言扫描函数确实把 js 系列算进来。
    const allFiles = walk(SRC);
    const tsStems = new Set(
      allFiles
        .filter((file) => /\.(ts|tsx)$/.test(file))
        .map((file) => file.replace(/\.(ts|tsx)$/, ''))
    );
    const shadowArtifacts = allFiles
      .filter((file) => /\.(js|jsx|mjs|cjs)$/.test(file))
      .filter((file) => tsStems.has(file.replace(/\.(js|jsx|mjs|cjs)$/, '')))
      .map((file) => path.relative(REPO_ROOT, file));
    expect(
      shadowArtifacts,
      `frontend/src 下出现影子 JS 产物（会顶掉同名 TS 源码）：\n${shadowArtifacts.join('\n')}`
    ).toEqual([]);

    const probeDir = path.resolve(SRC, 'components/Worldbuilding/PoliticsView');
    const scannedExtensions = new Set(
      codeFiles(probeDir).map((file) => path.extname(file))
    );
    expect(
      [...scannedExtensions].every((extension) =>
        ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)
      ),
      '静态扫描扩展名覆盖不全'
    ).toBe(true);

    // 已跟踪的 src 产物必须都是 TS：git index 里不得有 js 系列文件
    const trackedJs = execFileSync('git', ['ls-files', 'frontend/src'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((line) => /\.(js|jsx|mjs|cjs)$/.test(line.trim()));
    expect(trackedJs, `frontend/src 不应跟踪 JS 文件：\n${trackedJs.join('\n')}`).toEqual([]);
  });

  test('工作区卫生：政治组件不直接调用 API，写入只经 hooks', () => {
    // P4 的分层口径：数据访问集中在 PoliticsView/hooks（usePolitics 经 shared/useModuleEntities
    // 与 hooks/useLinks 触达 worldbuildingApi），视图组件一律不发请求。
    // 因此这里断言三件事：
    // 1) hooks 层调用的 worldbuildingApi 方法都真实存在（拼错方法名一律拦下）；
    // 2) 视图层（除 hooks 外）不出现任何 `<any>Api.<method>` 调用——只看 worldbuildingApi 会漏掉
    //    `characterApi.createCharacter(...)`（modals/PoliticsFormModal.tsx）；
    // 3) 视图层直接 import 的 api 客户端只能是白名单里的服务模块。
    const SERVICE_MODULES = new Set([
      'worldbuildingApi',
      'characterApi',
      'worldApi',
      'projectApi',
    ]);
    const apiDefined = (relative: string): Set<string> => {
      const content = read(relative);
      const names = new Set<string>();
      // 两种形态都覆盖：`name: (...) => {}` 与对象简写 `name,`
      for (const match of content.matchAll(/^\s{2}(\w+)\s*:\s*\(/gm)) names.add(match[1]);
      for (const match of content.matchAll(/^\s{2}(\w+),\s*$/gm)) names.add(match[1]);
      return names;
    };
    const definedByModule = new Map<string, Set<string>>([
      ['worldbuildingApi', apiDefined('services/worldbuildingApi.ts')],
      ['characterApi', apiDefined('services/characterApi.ts')],
    ]);

    const hookFiles = codeFiles(
      path.resolve(SRC, 'components/Worldbuilding/PoliticsView/hooks')
    ).concat(
      codeFiles(path.resolve(SRC, 'components/Worldbuilding/shared')).filter((file) =>
        /useModuleEntities|useLinkCountMap|useModuleConfig/.test(file)
      ),
      codeFiles(path.resolve(SRC, 'components/Worldbuilding/hooks'))
    );

    const used = new Set<string>();
    for (const file of hookFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/worldbuildingApi\.(\w+)/g)) used.add(match[1]);
    }
    expect([...used].length, '数据层未经 worldbuildingApi，断言可能失效').toBeGreaterThan(0);
    const missing = [...used]
      .filter((name) => !definedByModule.get('worldbuildingApi')?.has(name))
      .sort();
    expect(missing, `调用了未定义的 worldbuildingApi 方法：\n${missing.join('\n')}`).toEqual([]);

    // 视图层不得直接发请求（否则会绕过 React Query 缓存与统一失效口径）
    const viewFiles = codeFiles(path.resolve(SRC, 'components/Worldbuilding/PoliticsView')).filter(
      (file) => !file.includes(`${path.sep}hooks${path.sep}`)
    );
    expect(viewFiles.length, 'P4 视图文件数量异常').toBeGreaterThanOrEqual(20);

    const directCallers: string[] = [];
    const unknownApi: string[] = [];
    const unknownImports: string[] = [];
    // 视图层允许的越层调用：只列明确批准的这一条（modals/PoliticsFormModal.tsx 建全局 Character）。
    // 除它之外的任何 `<any>Api.<method>` 仍然一律拦下。
    const APPROVED_VIEW_API_CALLS = new Set(['characterApi.createCharacter']);
    for (const file of viewFiles) {
      const relative = path.relative(REPO_ROOT, file);
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/\b(\w+Api)\.(\w+)\b/g)) {
        const [, apiName, method] = match;
        if (APPROVED_VIEW_API_CALLS.has(`${apiName}.${method}`)) continue;
        directCallers.push(`${relative}: ${apiName}.${method}`);
        const defined = definedByModule.get(apiName);
        if (defined && !defined.has(method)) {
          unknownApi.push(`${relative}: ${apiName}.${method}`);
        }
      }
      for (const match of content.matchAll(/from\s+['"]@\/services\/([\w-]+)['"]/g)) {
        if (!SERVICE_MODULES.has(match[1])) unknownImports.push(`${relative}: ${match[1]}`);
      }
    }
    expect(
      directCallers.sort(),
      '政治视图组件不得直接调用 api 客户端（应经 hooks；白名单见 APPROVED_VIEW_API_CALLS）'
    ).toEqual([]);
    expect(unknownApi, `调用了未定义的 api 方法：\n${unknownApi.join('\n')}`).toEqual([]);
    expect(
      unknownImports,
      `视图层引入了白名单外的服务模块：\n${unknownImports.join('\n')}`
    ).toEqual([]);
  });

  test('契约 §4.3 的政治关联类型与代码两侧清单一致（设计文档已声明废弃）', () => {
    // 原用例只断言设计文档「含某些字面词」，近似恒真；改为真正的漂移检查：
    // 契约 §4.3 表格里的 link_type 集合 === POLITICS_LINK_TYPES 的值 ∪ 跨模块引用清单。
    const design = fs.readFileSync(UI_DESIGN, 'utf8');
    expect(design, '设计文档应写明 treaty_between 已废弃').toContain('treaty_between');

    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const lines = contractText.split('\n');
    const start = lines.findIndex((line) => line.startsWith('### 4.3 '));
    expect(start, '契约缺少 §4.3 小节').toBeGreaterThanOrEqual(0);
    const contractPolitics = new Set<string>();
    for (const line of lines.slice(start + 1)) {
      if (line.startsWith('### ') || line.startsWith('## ')) break;
      const match = /^\|\s*([a-z_]+\.[a-z_]+)\s*\|/.exec(line);
      if (match) contractPolitics.add(match[1]);
    }

    const types = read('components/Worldbuilding/PoliticsView/types.ts');
    const values = new Set(
      [...types.matchAll(/^\s{2}\w+:\s*'([a-z_]+\.[a-z_]+)',?$/gm)].map((match) => match[1])
    );
    const crossStart = types.indexOf('POLITICS_CROSS_MODULE_LINK_TYPES');
    const crossEnd = types.indexOf('];', crossStart);
    expect(crossStart, 'types.ts 缺少跨模块引用清单').toBeGreaterThanOrEqual(0);
    const cross = new Set(
      [...types.slice(crossStart, crossEnd).matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(
        (match) => match[1]
      )
    );

    expect([...values].length, '未解析到 POLITICS_LINK_TYPES 的值').toBeGreaterThanOrEqual(14);
    expect(cross.size, '未解析到跨模块引用清单').toBeGreaterThanOrEqual(10);
    expect([...contractPolitics].sort(), '契约 §4.3 行数异常').toEqual(CONTRACT_POLITICS_LINK_TYPES);
    expect(cross.size, '跨模块引用清单条数异常').toBe(18);

    // §4.3 里本模块自有的边必须与 POLITICS_LINK_TYPES 逐一对应（两个方向都要相等）
    expect([...values].sort(), 'POLITICS_LINK_TYPES 与契约 §4.3 不一致').toEqual(
      CONTRACT_POLITICS_LINK_TYPES
    );
    // 跨模块引用清单里的类型必须都在契约 §4.4-§4.7 注册（这里用整份文档的 §4 表格做超集校验）
    const contractRegistry = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map((match) => match[1])
    );
    expect(contractRegistry.size, '契约 §4 表格行数异常').toBe(54);
    const notRegistered = [...cross].filter((id) => !contractRegistry.has(id)).sort();
    expect(
      notRegistered,
      `跨模块引用清单出现契约 §4 未注册的类型：\n${notRegistered.join('\n')}`
    ).toEqual([]);
    expect(
      contractRegistry.has('politics.treaty_between'),
      '废弃类型不应出现在契约 §4 注册表'
    ).toBe(false);
  });
});
