// 把浏览器侧的 Phase 2 / Phase 3 用例（harness.tsx、harness3.tsx）打成单文件 IIFE，供 Playwright 注入。
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

const buildHarnessFile = async ({ entry, outFile, name }) => {
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;

  await build({
    configFile: false,
    root: FRONTEND_ROOT,
    logLevel: 'error',
    plugins: [react()],
    publicDir: false,
    resolve: { alias: { '@': path.resolve(FRONTEND_ROOT, 'src') } },
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
