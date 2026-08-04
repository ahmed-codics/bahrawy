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
  webServer: {
    command: 'npm run start -w academy-web',
    cwd: workspaceRoot,
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
