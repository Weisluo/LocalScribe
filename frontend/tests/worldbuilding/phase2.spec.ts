/**
 * Phase 2 回归与验收（P2-T11）
 *
 * 两部分：
 * 1) 浏览器侧：tests/worldbuilding/harness.tsx 打成单文件注入真实浏览器，跑 DOM/React 断言；
 * 2) Node 侧：静态验收 —— link_type 契约白名单、新增文件无 emoji、图标只用 Lucide、冻结接口存在。
 *
 * 不需要后端与 dev server：浏览器侧用例把 TanStack Query 缓存预置好，不发任何网络请求。
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_PATH, FRONTEND_ROOT, buildHarness } from './bundle.mjs';

interface HarnessReport {
  done: boolean;
  checks: { name: string; ok: boolean; detail?: unknown }[];
}

const SRC = path.resolve(FRONTEND_ROOT, 'src');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CONTRACT = path.resolve(
  REPO_ROOT,
  'docs/worldbuilding/cross_module_link_design.md'
);

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

/** Phase 2 新增/改动的代码路径（静态验收范围）；SRC 已是 frontend/src */
const PHASE2_PATHS = [
  'components/common/EntityBadge',
  'components/common/EntityPicker',
  'components/common/LinkPanel',
  'components/common/ComplexitySwitcher',
  'components/common/InlineReference',
  'components/Worldbuilding/types.ts',
  'components/Worldbuilding/hooks',
  'components/Worldbuilding/navigation',
  'components/Worldbuilding/MigrationContainerPanel',
  'components/Worldbuilding/HistoryView/useEntityLinkCounts.ts',
  'components/Worldbuilding/HistoryView.tsx',
  'services/worldbuildingApi.ts',
].map((relative) => path.resolve(SRC, relative));

test.describe('Phase 2 前端地基与历史纵切', () => {
  test('浏览器侧用例：查询键、类型纯函数、复杂度、EntityBadge、共用件', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await buildHarness();
    expect(fs.existsSync(HARNESS_PATH), `用例打包失败：${HARNESS_PATH}`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: HARNESS_PATH, type: 'text/javascript' });
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE2_TESTS__ !== undefined,
      null,
      { timeout: 60_000 }
    );

    const report = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__PHASE2_TESTS__ as
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
    // 精确地板：当前用例数（删掉任何一组断言都会被这条守卫发现）
    // v1.1 起 +5：新增 splitLinks/linkInvolves 的「无关关联不计入出链/入链」用例
    expect(
      (report?.checks ?? []).length,
      '用例数量明显不足，可能有大段断言被跳过'
    ).toBeGreaterThanOrEqual(148);
  });

  test('link_type 白名单：前端不得出现契约 §4 之外的类型', () => {
    const contractText = fs.readFileSync(CONTRACT, 'utf8');
    const whitelist = new Set(
      [...contractText.matchAll(/^\|\s*([a-z_]+\.[a-z_]+)\s*\|/gm)].map(
        (match) => match[1]
      )
    );
    // 契约 §4 七个小节的登记数（4.1=3、4.2=5、4.3=14、4.4=12、4.5=8、4.6=9、4.7=3）
    expect(
      whitelist.size,
      `契约 §4 表格行数异常：${[...whitelist].sort().join(', ')}`
    ).toBe(54);
    expect(whitelist.has('history.involves')).toBe(true);
    expect(whitelist.has('core.related_to')).toBe(true);

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
            offenders.push(
              `${path.relative(REPO_ROOT, file)}:${index + 1}: ${match[1]}`
            );
          }
        }
      });
    }
    // 防止正则失效导致的「空过」：Phase 2 明确依赖的这两个字面量必须被扫到
    expect(
      [...scanned].sort(),
      'link_type 字面量扫描结果异常，白名单检查可能失效'
    ).toEqual(expect.arrayContaining(['core.related_to', 'history.involves']));
    expect(
      offenders,
      `出现契约 §4 之外的 link_type：\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  test('新增文件无 emoji、图标只用 Lucide 名', () => {
    // 拆成多个区间而不是一个大字符类：字符类里混入变体选择符会触发
    // no-misleading-character-class（lint error），语义保持一致
    const emojiPattern =
      /[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{21FF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0F}/u;
    const emojiOffenders: string[] = [];
    const iconLibraryOffenders: string[] = [];

    const files = PHASE2_PATHS.flatMap((target) => codeFiles(target));
    expect(files.length, 'Phase 2 代码文件数量异常').toBeGreaterThanOrEqual(8);

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

  test('共用件接口冻结：导出符号与冻结记录一致（P3-P5 可直接引用）', () => {
    // 目录内任意文件导出即算通过：barrel 可能用 `export *` 转发（无法靠 barrel 字面量匹配）
    const EXPORT_DECL =
      /export\s+(?:default\s+)?(?:type\s+)?(?:const|let|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
    const EXPORT_LIST = /export\s+(?:type\s+)?\{([^}]*)\}/g;

    const exportedSymbols = (relativeDir: string): Set<string> => {
      const dir = path.resolve(SRC, relativeDir);
      const symbols = new Set<string>();
      if (!fs.existsSync(dir)) return symbols;
      for (const file of codeFiles(dir)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const match of content.matchAll(EXPORT_DECL)) {
          symbols.add(match[1]);
        }
        for (const match of content.matchAll(EXPORT_LIST)) {
          for (const raw of match[1].split(',')) {
            const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
            if (name) symbols.add(name);
          }
        }
      }
      return symbols;
    };

    const barrels: Record<string, string[]> = {
      'components/common/EntityBadge': ['EntityBadge', 'EntityBadgeProps'],
      'components/common/ComplexitySwitcher': [
        'ComplexitySwitcher',
        'ComplexitySwitcherProps',
        'ComplexityProvider',
        'useComplexity',
        'COMPLEXITY_CAPABILITIES',
        'normalizeComplexity',
      ],
      'components/common/EntityPicker': ['EntityPicker', 'EntityPickerProps'],
      'components/common/LinkPanel': ['LinkPanel', 'LinkPanelProps'],
      'components/common/InlineReference': ['InlineReference', 'InlineReferenceProps'],
      'components/Worldbuilding/hooks': [
        'worldbuildingKeys',
        'useWorlds',
        'useEntityLinks',
        'useLinkCounts',
        'useEntityRefs',
        'useMigrationLinks',
      ],
    };

    const missing: string[] = [];
    for (const [dir, symbols] of Object.entries(barrels)) {
      const index = path.resolve(SRC, dir, 'index.ts');
      const indexTsx = path.resolve(SRC, dir, 'index.tsx');
      if (!fs.existsSync(index) && !fs.existsSync(indexTsx)) {
        missing.push(`${dir}（缺少 index barrel）`);
      }
      const exported = exportedSymbols(dir);
      for (const symbol of symbols) {
        if (!exported.has(symbol)) missing.push(`${dir}: ${symbol}`);
      }
    }
    expect(missing, `冻结接口缺失：\n${missing.join('\n')}`).toEqual([]);

    // 复杂度能力矩阵与契约 §5.5 一致
    const complexityTypes = fs.readFileSync(
      path.resolve(SRC, 'components/common/ComplexitySwitcher/types.ts'),
      'utf8'
    );
    for (const key of [
      'linkCounts',
      'inlineReference',
      'linkPanel',
      'linkPicker',
      'simpleLinkAdd',
      'linkTimeline',
      'linkMeta',
      'canvas',
      'worldWeb',
    ]) {
      expect(complexityTypes, `能力矩阵缺少 ${key}`).toContain(key);
    }
  });

  test('历史纵切：旧 _char_ref/_char_link 不再新写（回归红线）', () => {
    const historyDir = path.resolve(SRC, 'components/Worldbuilding/HistoryView');
    const files = codeFiles(historyDir).concat([
      path.resolve(SRC, 'components/Worldbuilding/HistoryView.tsx'),
    ]);

    const writes: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        // 允许只读扫描（startsWith / slice / 常量声明），禁止 createItem/updateItem 写入这些键
        const writesCharKey =
          /_char_(ref|link)/.test(line) &&
          /(createItem|updateItem|newContent|\[`|\[\s*`)/.test(line);
        if (writesCharKey) {
          writes.push(`${path.relative(REPO_ROOT, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      writes,
      `仍在写旧人物关联键：\n${writes.join('\n')}`
    ).toEqual([]);

    // 必须已切到 history.involves
    const all = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(all, '历史纵切未接入 history.involves').toContain('history.involves');
  });

  test('迁移容器归位：前端已接上 P2-T12 的两个端点', () => {
    const api = fs.readFileSync(
      path.resolve(SRC, 'services/worldbuildingApi.ts'),
      'utf8'
    );
    expect(api).toContain('/links/${linkId}/move');
    expect(api).toContain("/links/move");
    expect(api).toContain('moveWorldLink');
    expect(api).toContain('moveWorldLinks');

    const hooks = fs.readFileSync(
      path.resolve(SRC, 'components/Worldbuilding/hooks/useMigrationLinks.ts'),
      'utf8'
    );
    expect(hooks, 'useMigrationLinks 未使用冻结 queryKey').toContain(
      'migration-container'
    );
    expect(hooks).toContain('hasEntryPoint');
  });
});
