// 把浏览器侧的导出回归用例（harness.ts）打成单文件 IIFE，供 Playwright 注入。
// 产物写进 node_modules/.cache/，不污染仓库。
import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FRONTEND_ROOT = path.resolve(here, '../..');
export const HARNESS_PATH = path.resolve(FRONTEND_ROOT, 'node_modules/.cache/export-harness/harness.js');

export const buildHarness = async () => {
  await build({
    configFile: false,
    root: FRONTEND_ROOT,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve(FRONTEND_ROOT, 'src') } },
    build: {
      outDir: path.dirname(HARNESS_PATH),
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      lib: {
        entry: path.resolve(FRONTEND_ROOT, 'tests/export/harness.ts'),
        formats: ['iife'],
        name: 'ExportHarness',
        fileName: () => 'harness.js',
      },
    },
  });

  return HARNESS_PATH;
};
