// 把浏览器侧的 Phase 2 / Phase 3 / Phase 4 用例（harness.tsx、harness3.tsx、harness4.tsx）打成单文件 IIFE，供 Playwright 注入。
// 与 tests/export/bundle.mjs 同构，区别：本套用例要渲染 React 组件，故启用 @vitejs/plugin-react。
// vite / plugin-react 走动态 import：spec 在收集阶段就 import 本文件，顶层 import vite
// 会让 node_modules 缺失时连带既有导出套件一起收集失败。
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FRONTEND_ROOT = path.resolve(here, '../..');
export const HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase2-harness/harness.js'
);
export const PHASE3_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase3-harness/harness.js'
);
export const PHASE4_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase4-harness/harness.js'
);
export const PHASE5_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase5-harness/harness.js'
);
/** Phase 6 世界容器（设置 / 备份 / 搜索 / 世界脉络） */
export const PHASE6_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase6-harness/harness.js'
);
/** Phase 6 模块配置（子模块管理器 / 字段编辑器 / 模块配置面板） */
export const PHASE6B_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase6b-harness/harness.js'
);
/** Phase 6 世界脉络（P6-T8 纯逻辑：图构造 / 降级 / 筛选 / 布局 / 推荐） */
export const PHASE6W_HARNESS_PATH = path.resolve(
  FRONTEND_ROOT,
  'node_modules/.cache/phase6w-harness/harness.js'
);

const buildHarnessFile = async ({ entry, outFile, name }) => {
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;

  await build({
    configFile: false,
    root: FRONTEND_ROOT,
    logLevel: 'error',
    plugins: [react()],
    publicDir: false,
    resolve: {
      alias: { '@': path.resolve(FRONTEND_ROOT, 'src') },
      // 固定解析顺序：`.ts`/`.tsx` 必须优先于同名 `.js` 影子文件，
      // 否则误编译出的 CJS `.js` 会静默顶掉真实源码（测试仍全绿但验的是废文件）
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: path.dirname(outFile),
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      lib: {
        entry: path.resolve(FRONTEND_ROOT, entry),
        formats: ['iife'],
        name,
        fileName: () => path.basename(outFile),
      },
    },
  });

  return outFile;
};

export const buildHarness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness.tsx',
    outFile: HARNESS_PATH,
    name: 'Phase2Harness',
  });

export const buildPhase3Harness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness3.tsx',
    outFile: PHASE3_HARNESS_PATH,
    name: 'Phase3Harness',
  });

export const buildPhase4Harness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness4.tsx',
    outFile: PHASE4_HARNESS_PATH,
    name: 'Phase4Harness',
  });

export const buildPhase5Harness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness5.tsx',
    outFile: PHASE5_HARNESS_PATH,
    name: 'Phase5Harness',
  });

export const buildPhase6Harness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness6.tsx',
    outFile: PHASE6_HARNESS_PATH,
    name: 'Phase6Harness',
  });

export const buildPhase6bHarness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness6b.tsx',
    outFile: PHASE6B_HARNESS_PATH,
    name: 'Phase6bHarness',
  });

export const buildPhase6wHarness = async () =>
  buildHarnessFile({
    entry: 'tests/worldbuilding/harness6w.tsx',
    outFile: PHASE6W_HARNESS_PATH,
    name: 'Phase6wHarness',
  });
