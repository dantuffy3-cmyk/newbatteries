/*
 * tests/browser-integration.spec.js
 *
 * Real Playwright browser integration tests for finder.html.
 *
 * These tests exercise the full browser pipeline:
 *   HTML → <script> tags → finder.js → observation-adapter.js → sessionStorage
 *
 * They verify the end-to-end storeDevelopmentSnapshot(resolved) pathway by
 * serving finder.html with a local HTTP server and driving the page through
 * Playwright's Chromium browser.
 *
 * What these tests verify:
 *   T-BROWSER-1: Public mode (no ?nb_dev=true) — submitting a battery code must
 *                NOT write the nb_dev_observation_snapshot_v1 sessionStorage key.
 *   T-BROWSER-2: Dev mode (?nb_dev=true) — submitting a battery code MUST write
 *                nb_dev_observation_snapshot_v1 to sessionStorage, and the stored
 *                value must parse as valid JSON containing an enteredCode field.
 *   T-BROWSER-3: observation-adapter.js loads correctly and NBObservationAdapter
 *                is available on window after page load.
 *
 * Prerequisites (install once):
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *
 * Run:
 *   npx playwright test tests/browser-integration.spec.js
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

/* ──────────────────────────────────────────────────────────────────────────
 * Minimal static file server
 * Serves files from the repository root so that relative paths in finder.html
 * (assets/js/...) resolve correctly.
 * ────────────────────────────────────────────────────────────────────────── */

const REPO_ROOT = path.resolve(__dirname, '..');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
};

let server;
let baseURL;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const filePath = path.join(REPO_ROOT, urlPath === '/' ? '/index.html' : urlPath);
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseURL = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

/* ──────────────────────────────────────────────────────────────────────────
 * T-BROWSER-3: observation-adapter loads and NBObservationAdapter is on window
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BROWSER-3: NBObservationAdapter is available on window after page load', async ({ page }) => {
  await page.goto(`${baseURL}/finder.html`);

  const adapterType = await page.evaluate(() => typeof window.NBObservationAdapter);
  expect(adapterType).toBe('object');

  const hasSave = await page.evaluate(() => typeof window.NBObservationAdapter.saveObservationSnapshot);
  expect(hasSave).toBe('function');
});

/* ──────────────────────────────────────────────────────────────────────────
 * T-BROWSER-1: Public mode — no snapshot written after battery code entry
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BROWSER-1: public mode — battery code entry must NOT write snapshot', async ({ page }) => {
  // Load page without ?nb_dev=true
  await page.goto(`${baseURL}/finder.html`);

  // Proceed through step 1 (category selection) to reach the battery code step.
  // Step 1 presents a category fieldset; pick the first radio option.
  const firstCategoryRadio = page.locator('#step-category input[type="radio"]').first();
  await firstCategoryRadio.waitFor({ state: 'visible', timeout: 5000 });
  await firstCategoryRadio.check();

  // Click the continue button for step 1.
  const btnContinueCategory = page.locator('#step-category button[id^="btn-continue"], #step-category input[type="submit"], #btn-continue-category').first();
  if (await btnContinueCategory.count() > 0) {
    await btnContinueCategory.click();
  }

  // Wait for the battery code input to appear.
  const battCodeInput = page.locator('#battCode');
  await battCodeInput.waitFor({ state: 'visible', timeout: 5000 });
  await battCodeInput.fill('CR2032');

  // Submit the battery code.
  const btnContinueBattCode = page.locator('#btn-continue-batt-code');
  await btnContinueBattCode.click();

  // Allow the async data load to settle.
  await page.waitForTimeout(500);

  // Assert that no snapshot was written.
  const snapshot = await page.evaluate(() => sessionStorage.getItem('nb_dev_observation_snapshot_v1'));
  expect(snapshot).toBeNull();
});

/* ──────────────────────────────────────────────────────────────────────────
 * T-BROWSER-2: Dev mode — snapshot is written after battery code entry
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BROWSER-2: dev mode — battery code entry MUST write snapshot with enteredCode', async ({ page }) => {
  // Load page WITH ?nb_dev=true to activate development mode.
  await page.goto(`${baseURL}/finder.html?nb_dev=true`);

  // Proceed through step 1 (category selection).
  const firstCategoryRadio = page.locator('#step-category input[type="radio"]').first();
  await firstCategoryRadio.waitFor({ state: 'visible', timeout: 5000 });
  await firstCategoryRadio.check();

  const btnContinueCategory = page.locator('#step-category button[id^="btn-continue"], #step-category input[type="submit"], #btn-continue-category').first();
  if (await btnContinueCategory.count() > 0) {
    await btnContinueCategory.click();
  }

  // Wait for the battery code input.
  const battCodeInput = page.locator('#battCode');
  await battCodeInput.waitFor({ state: 'visible', timeout: 5000 });
  await battCodeInput.fill('CR2032');

  // Submit the battery code.
  const btnContinueBattCode = page.locator('#btn-continue-batt-code');
  await btnContinueBattCode.click();

  // Wait for the async data load and snapshot write to settle.
  await page.waitForTimeout(1000);

  // Assert that the snapshot was written.
  const raw = await page.evaluate(() => sessionStorage.getItem('nb_dev_observation_snapshot_v1'));
  expect(raw).not.toBeNull();

  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('enteredCode');
  expect(typeof parsed.enteredCode).toBe('string');
});
