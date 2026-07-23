import path from 'node:path';
import { defineConfig } from '@playwright/test';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  testDir: './visual-tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/ui' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter academy-web exec next start -p 3001',
      cwd: workspaceRoot,
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter staff-admin exec next start -p 3002',
      cwd: workspaceRoot,
      url: 'http://127.0.0.1:3002/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
