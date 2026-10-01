// One-time login, saves session to tests/fe/.auth.json (see playwright.config.js).
const { test: setup } = require('@playwright/test');

setup('login as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#username, input[name="username"]', 'admin');
  await page.fill('#password, input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  // Login shows Swal 1.5s then redirects to /dashboard.
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.context().storageState({ path: 'tests/fe/.auth.json' });
});
