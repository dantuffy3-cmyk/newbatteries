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

/* ──────────────────────────────────────────────────────────────────────────
 * BER-1 browser tests
 *
 * The Finder renders the identification result and then transitions to
 * step-review within 20 ms. These tests check element attributes directly
 * via page.evaluate rather than relying on Playwright visibility (which
 * also requires parent elements to be visible).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Helper: navigate to finder, enter a battery code, wait for data load.
 * The step transitions to step-review after ~20 ms, so we wait a short
 * time for the async fetch to complete, then check rendered state.
 */
async function enterBatteryCodeAndWait(page, baseURL, code) {
  await page.goto(`${baseURL}/finder.html`);
  const battCodeInput = page.locator('#battCode');
  await battCodeInput.waitFor({ state: 'visible', timeout: 5000 });
  await battCodeInput.fill(code);
  await page.locator('#btn-continue-batt-code').click();
  // Wait for the async data fetch to complete and render
  await page.waitForTimeout(1000);
}

/* ──────────────────────────────────────────────────────────────────────────
 * T-BER1-BROWSER-1: Exact known battery — correct state stored,
 * "What to check next" section not shown (no blocking evidence for CR2032).
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BER1-BROWSER-1: exact known battery — correct state and next-evidence section not shown', async ({ page }) => {
  await enterBatteryCodeAndWait(page, baseURL, 'CR2032');

  // Check session state captured confidence and canonical
  const state = await page.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem('nb_finder_state_v2') || '{}'); } catch (e) { return {}; }
  });
  expect(state.battIdConfidence).toBe('exact');
  expect(state.battIdCanonical).toBe('CR2032');

  // "What to check next" must not be rendered (hidden attribute present)
  const nextEvidenceHidden = await page.evaluate(() => {
    var el = document.getElementById('biv-next-evidence-wrap');
    return !el || el.hidden;
  });
  expect(nextEvidenceHidden).toBe(true);
});

/* ──────────────────────────────────────────────────────────────────────────
 * T-BER1-BROWSER-2: Unknown battery — no identity invented,
 * "What to check next" section rendered with guidance.
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BER1-BROWSER-2: unknown battery — no identity invented, next-evidence section shown', async ({ page }) => {
  await enterBatteryCodeAndWait(page, baseURL, 'XXXXXUNKNOWNCODE99999');

  // Session state must have unknown confidence and no canonical
  const state = await page.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem('nb_finder_state_v2') || '{}'); } catch (e) { return {}; }
  });
  expect(state.battIdConfidence).toBe('unknown');
  expect(state.battIdCanonical).toBeFalsy();

  // "What to check next" must be shown (hidden=false)
  const nextEvidenceState = await page.evaluate(() => {
    var el = document.getElementById('biv-next-evidence-wrap');
    if (!el) return { found: false };
    return {
      found: true,
      hidden: el.hidden,
      title: (document.getElementById('biv-next-evidence-title') || {}).textContent || '',
      instruction: (document.getElementById('biv-next-evidence-instruction') || {}).textContent || ''
    };
  });
  expect(nextEvidenceState.found).toBe(true);
  expect(nextEvidenceState.hidden).toBe(false);
  expect(nextEvidenceState.title.trim().length).toBeGreaterThan(0);
  expect(nextEvidenceState.instruction.trim().length).toBeGreaterThan(0);
});

/* ──────────────────────────────────────────────────────────────────────────
 * T-BER1-BROWSER-3: Family match (N70Z) — next-evidence section shown
 * with distinguishing evidence guidance. No console errors.
 * ────────────────────────────────────────────────────────────────────────── */
test('T-BER1-BROWSER-3: family match N70Z — next-evidence section shown, no console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await enterBatteryCodeAndWait(page, baseURL, 'N70Z');

  // Session state must have family confidence
  const state = await page.evaluate(() => {
    try { return JSON.parse(sessionStorage.getItem('nb_finder_state_v2') || '{}'); } catch (e) { return {}; }
  });
  expect(state.battIdConfidence).toBe('family');

  // "What to check next" must be shown
  const nextEvidenceState = await page.evaluate(() => {
    var el = document.getElementById('biv-next-evidence-wrap');
    if (!el) return { found: false };
    return {
      found: true,
      hidden: el.hidden,
      title: (document.getElementById('biv-next-evidence-title') || {}).textContent || ''
    };
  });
  expect(nextEvidenceState.found).toBe(true);
  expect(nextEvidenceState.hidden).toBe(false);
  expect(nextEvidenceState.title.trim().length).toBeGreaterThan(0);

  // No console errors
  expect(consoleErrors).toHaveLength(0);
});


/* ──────────────────────────────────────────────────────────────────────────
 * BER-1 browser tests
 *
 * These tests verify the "What to check next" section (BER-1).
 * The finder starts directly on step-batt-code (default step).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Helper: navigate to finder, enter a battery code, wait for result.
 */


