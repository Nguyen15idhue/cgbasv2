// FE spec: Configs -> shutdown history drill-down (plan docs/plan/01).
// Seeds its own history rows (marked total_stations 77/78) and cleans up afterwards.
const { test, expect } = require('@playwright/test');
const mysql = require('mysql2/promise');
require('dotenv').config();

let HID = 0;
let OLDID = 0;

async function db() {
  return mysql.createConnection({
    host: '127.0.0.1', port: 3307,
    user: process.env.DB_USER, password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
}

test.beforeAll(async () => {
  const c = await db();
  const [h] = await c.execute(
    "INSERT INTO scheduled_shutdown_history (execution_date, started_at, completed_at, total_stations, successful_stations, failed_stations, status) VALUES (CURDATE(), NOW(), NOW(), 77, 1, 1, 'completed')"
  );
  HID = h.insertId;
  await c.execute(
    "INSERT INTO scheduled_shutdown_details (history_id, station_id, device_id, shutdown_ok, shutdown_at, poweron_ok, poweron_at, final_status) VALUES (?, '10', 'dev10', 1, NOW(), 1, NOW(), 'completed')",
    [HID]
  );
  await c.execute(
    "INSERT INTO scheduled_shutdown_details (history_id, station_id, device_id, shutdown_ok, shutdown_error, shutdown_at, final_status) VALUES (?, '16', 'dev16', 0, 'Seed loi tat', NOW(), 'failed')",
    [HID]
  );
  await c.execute(
    "INSERT INTO scheduled_shutdown_details (history_id, station_id, device_id, shutdown_ok, shutdown_at, final_status) VALUES (?, '17', 'dev17', 1, NOW(), 'skipped')",
    [HID]
  );
  const [h2] = await c.execute(
    "INSERT INTO scheduled_shutdown_history (execution_date, started_at, completed_at, total_stations, successful_stations, failed_stations, status) VALUES (CURDATE(), NOW(), NOW(), 78, 0, 0, 'completed')"
  );
  OLDID = h2.insertId;
  // P2: verified states 1 / 0 / NULL
  await c.execute(
    'UPDATE scheduled_shutdown_details SET verified_online = 1, verified_at = NOW(), verified_status = 1 WHERE history_id = ? AND station_id = ?',
    [HID, '10']
  );
  await c.execute(
    'UPDATE scheduled_shutdown_details SET verified_online = 0, verified_at = NOW(), verified_status = 3 WHERE history_id = ? AND station_id = ?',
    [HID, '16']
  );
  await c.end();
});

test.afterAll(async () => {
  const c = await db();
  await c.execute('DELETE FROM scheduled_shutdown_history WHERE id IN (?, ?)', [HID, OLDID]);
  await c.end();
});

test.describe('shutdown history drill-down', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/configs');
    await expect(page.locator('#shutdownHistoryTable')).toBeVisible();
  });

  test('success count opens details modal with matching rows (B4)', async ({ page }) => {
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    const modal = page.locator('#historyDetailsModal.show');
    await expect(modal).toBeVisible();
    // opened with completed filter preselected -> 1 row
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(1);
    await expect(page.locator('#historyDetailsTitle')).toContainText('Ngày');
    // switch to All -> 3 rows
    await page.locator('#historyDetailsTabs [data-filter=""]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(3);
  });

  test('failed/skipped tabs filter rows (B4)', async ({ page }) => {
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="failed"]`).click();
    await expect(page.locator('#historyDetailsModal.show')).toBeVisible();
    // opened with failed filter preselected
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(1);
    await page.locator('#historyDetailsTabs [data-filter="skipped"]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(1);
    await page.locator('#historyDetailsTabs [data-filter=""]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(3);
  });

  test('old record without details has no clickable button (B4)', async ({ page }) => {
    await expect(page.locator(`button.history-count-btn[data-history-id="${OLDID}"]`)).toHaveCount(0);
  });

  test('works after SPA reload (B4)', async ({ page }) => {
    await page.reload();
    await expect(page.locator('#shutdownHistoryTable')).toBeVisible();
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    await expect(page.locator('#historyDetailsModal.show')).toBeVisible();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(1);
    await page.locator('#historyDetailsTabs [data-filter=""]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(3);
  });

  test('details API shape via authenticated page request (B3)', async ({ page }) => {
    const res = await page.request.get(`/api/scheduled-shutdown/history/${HID}/details`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.has_details).toBe(true);
    expect(body.data).toHaveLength(3);
  });

  test('config API includes verify fields (P2-B3)', async ({ page }) => {
    const res = await page.request.get('/api/scheduled-shutdown/config');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('verify_enabled');
    expect(body.data).toHaveProperty('verify_delay_minutes');
  });

  test('eye button opens log sub-modal, close returns to same tab (B5)', async ({ page }) => {
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    await expect(page.locator('#historyDetailsModal.show')).toBeVisible();
    await page.locator('#historyDetailsTabs [data-filter=""]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(3);
    // open failed row eye -> error text shown
    await page.locator('#historyDetailsTabs [data-filter="failed"]').click();
    await page.locator('#historyDetailsBody .history-log-btn').click();
    const sub = page.locator('#stationLogModal.show');
    await expect(sub).toBeVisible();
    await expect(sub.locator('pre').first()).toContainText('Seed loi tat');
    // close sub-modal only
    await sub.locator('.modal-footer [data-dismiss="modal"]').click();
    await expect(sub).toBeHidden();
    // modal 1 still open on same failed tab
    await expect(page.locator('#historyDetailsModal.show')).toBeVisible();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(1);
  });

  test('mobile 390px: modals usable (B5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    await expect(page.locator('#historyDetailsModal.show')).toBeVisible();
    await page.locator('#historyDetailsBody .history-log-btn').first().click();
    await expect(page.locator('#stationLogModal.show')).toBeVisible();
    await expect(page.locator('#stationLogBody .log-timeline li').first()).toBeVisible();
  });

  test('verified column icons + not-online tab (P2-B4)', async ({ page }) => {
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    await page.locator('#historyDetailsTabs [data-filter=""]').click();
    const cells = page.locator('#historyDetailsBody tr td:nth-child(5)');
    await expect(cells).toHaveCount(3);
    await expect(page.locator('#historyDetailsBody tr td:nth-child(5):has-text("✅")')).toHaveCount(1);
    await expect(page.locator('#historyDetailsBody tr td:nth-child(5):has-text("❌")')).toHaveCount(1);
    await expect(page.locator('#historyDetailsBody tr td:nth-child(5):has-text("⏳")')).toHaveCount(1);
    await page.locator('#historyDetailsTabs [data-filter="not_online"]').click();
    await expect(page.locator('#historyDetailsBody tr')).toHaveCount(2);
  });

  test('sub-modal line 5 shows verified online time (P2-B4)', async ({ page }) => {
    await page.locator(`button.history-count-btn[data-history-id="${HID}"][data-filter="completed"]`).click();
    await page.locator('#historyDetailsBody .history-log-btn').first().click();
    const sub = page.locator('#stationLogModal.show');
    await expect(sub).toBeVisible();
    await expect(sub.locator('.log-timeline')).toContainText('Online lại:');
    await expect(sub.locator('.log-timeline')).toContainText('đã online');
  });

  test('toggle switches do not overlap labels (UI fix)', async ({ page }) => {
    for (const id of ['newShutdownEnabled', 'newVerifyEnabled']) {
      const input = page.locator(`#${id}`);
      const label = page.locator(`label[for="${id}"]`);
      await expect(input).toBeVisible();
      const ib = await input.boundingBox();
      const lb = await label.boundingBox();
      expect(lb.x, `${id} label overlaps switch`).toBeGreaterThan(ib.x + ib.width);
    }
  });
});

test.describe('smoke (B6 regression)', () => {
  for (const path of ['/dashboard', '/stations', '/devices', '/history', '/configs']) {
    test(`page ${path} loads 200`, async ({ request }) => {
      const res = await request.get(path);
      expect([200, 304]).toContain(res.status());
    });
  }
});
