import { defineConfig } from '@playwright/test';

/**
 * 导出回归测试配置。
 *
 * 仓库里没有下载 Playwright 自带浏览器，默认用系统 Edge（Windows 自带）；
 * 其他环境可以用 PW_CHANNEL 指定已安装的 channel（如 chrome），
 * 或先执行 `npx playwright install chromium` 再设置 PW_CHANNEL 为空。
 */
export default defineConfig({
  testDir: './tests',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    acceptDownloads: true,
  },
});
