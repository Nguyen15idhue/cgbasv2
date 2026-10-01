// Playwright config - FE tests for CGBAS v2 (Chromium only).
// App runs separately (docker cgbas-app-dev :3001); config reuses it, does NOT start a server
// to avoid double schedulers.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/fe',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'chromium',
      use: { browserName: 'chromium', storageState: 'tests/fe/.auth.json' },
      dependencies: ['setup'],
    },
  ],
});
