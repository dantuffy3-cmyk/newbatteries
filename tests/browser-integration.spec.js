const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
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

function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    errors.push(String(error));
  });
  return errors;
}

async function enterBatteryCodeAndWait(page, code, query = '') {
  await page.goto(`${baseURL}/finder.html${query}`);
  const battCodeInput = page.locator('#battCode');
  await battCodeInput.waitFor({ state: 'visible', timeout: 5000 });
  await battCodeInput.fill(code);
  await page.locator('#btn-continue-batt-code').click();
  await page.waitForTimeout(1000);
}

async function openCompatibility(page, query = '') {
  await page.goto(`${baseURL}/compatibility.html${query}`);
  await page.locator('#compatForm').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => typeof window.NBCompatEngine === 'object' && typeof window.NBCompatEngine.assess === 'function');
}

test('homepage routes battery-code queries into the finder', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto(`${baseURL}/index.html`);
  await page.locator('#homeQuery').fill('CR2032');
  await page.locator('#homeIdForm').press('Enter');

  await expect(page).toHaveURL(/finder\.html\?path=number&query=CR2032$/);
  const storedQuery = await page.evaluate(() => sessionStorage.getItem('nb_home_query'));
  expect(storedQuery).toBe('CR2032');
  expect(consoleErrors).toHaveLength(0);
});

test('homepage photo guidance opens and closes accessibly', async ({ page }) => {
  await page.goto(`${baseURL}/index.html`);

  await page.locator('#homePhotoBtn').click();
  await expect(page.locator('#homePhotoGuidance')).toBeVisible();
  await expect(page.locator('#homePhotoBtn')).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('#homePhotoGuidance')).toBeHidden();
  await expect(page.locator('#homePhotoBtn')).toHaveAttribute('aria-expanded', 'false');
});

test('finder loads observation adapter on window and keeps public mode write-disabled', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await enterBatteryCodeAndWait(page, 'CR2032');

  const adapterState = await page.evaluate(() => ({
    adapterType: typeof window.NBObservationAdapter,
    hasSave: typeof window.NBObservationAdapter.saveObservationSnapshot,
    snapshot: sessionStorage.getItem('nb_dev_observation_snapshot_v1')
  }));

  expect(adapterState.adapterType).toBe('object');
  expect(adapterState.hasSave).toBe('function');
  expect(adapterState.snapshot).toBeNull();
  expect(consoleErrors).toHaveLength(0);
});

test('finder dev mode writes an observation snapshot only behind the dev flag', async ({ page }) => {
  await enterBatteryCodeAndWait(page, 'CR2032', '?nb_dev=true');

  const parsed = await page.evaluate(() => {
    const raw = sessionStorage.getItem('nb_dev_observation_snapshot_v1');
    return raw ? JSON.parse(raw) : null;
  });

  expect(parsed).not.toBeNull();
  expect(parsed).toHaveProperty('enteredCode');
  expect(typeof parsed.enteredCode).toBe('string');
});

test('finder preserves unknown handling and next-evidence guidance for unrecognised codes', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await enterBatteryCodeAndWait(page, 'XXXXXUNKNOWNCODE99999');

  const state = await page.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem('nb_finder_state_v2') || '{}');
    } catch (error) {
      return {};
    }
  });
  expect(state.battIdConfidence).toBe('unknown');
  expect(state.battIdCanonical).toBeFalsy();

  const nextEvidenceState = await page.evaluate(() => {
    const wrap = document.getElementById('biv-next-evidence-wrap');
    return {
      found: !!wrap,
      hidden: wrap ? wrap.hidden : true,
      title: (document.getElementById('biv-next-evidence-title') || {}).textContent || '',
      instruction: (document.getElementById('biv-next-evidence-instruction') || {}).textContent || ''
    };
  });

  expect(nextEvidenceState.found).toBe(true);
  expect(nextEvidenceState.hidden).toBe(false);
  expect(nextEvidenceState.title.trim().length).toBeGreaterThan(0);
  expect(nextEvidenceState.instruction.trim().length).toBeGreaterThan(0);
  expect(consoleErrors).toHaveLength(0);
});

test('finder recognised battery exposes compatibility handoff link with canonical code', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await enterBatteryCodeAndWait(page, 'CR2032');

  const link = page.locator('#biv-compare-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /compatibility\.html\?code=CR2032$/);
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility query pre-fills current battery but does not auto-run compatibility', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.addInitScript(() => {
    window.__nbAutoAssessCalls = 0;
    var compatValue;
    Object.defineProperty(window, 'NBCompatEngine', {
      configurable: true,
      get: function () { return compatValue; },
      set: function (value) {
        compatValue = value;
        if (value && typeof value.assess === 'function' && !value.__nbWrapped) {
          var original = value.assess;
          value.assess = function (a, b, cb) {
            window.__nbAutoAssessCalls += 1;
            return original.call(value, a, b, cb);
          };
          value.__nbWrapped = true;
        }
      }
    });
  });

  await openCompatibility(page, '?code=CR2032');

  await expect(page.locator('#inputA')).toHaveValue('CR2032');
  await expect(page.locator('#inputB')).toHaveValue('');

  const autoRunState = await page.evaluate(() => {
    const result = document.getElementById('compatResult');
    return {
      resultHidden: !!result && result.hidden,
      resultText: (result && result.textContent) ? result.textContent.trim() : '',
      loadingHidden: !!document.getElementById('compatLoading') && document.getElementById('compatLoading').hidden,
      assessCalls: window.__nbAutoAssessCalls
    };
  });
  expect(autoRunState.resultHidden).toBe(true);
  expect(autoRunState.resultText).toBe('');
  expect(autoRunState.loadingHidden).toBe(true);
  expect(autoRunState.assessCalls).toBe(0);
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility submit invokes existing engine and renders classification/headline', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page, '?code=CR2032');

  const expected = await page.evaluate(() => new Promise((resolve, reject) => {
    window.NBCompatEngine.assess('CR2032', 'CR2025', (error, assessment) => {
      if (error) return reject(String(error));
      resolve({ classification: assessment.classification, headline: assessment.headline });
    });
  }));

  await page.evaluate(() => {
    window.__nbCompatCallCount = 0;
    window.__nbCompatCalls = [];
    const original = window.NBCompatEngine.assess;
    window.NBCompatEngine.assess = function (a, b, cb) {
      window.__nbCompatCallCount += 1;
      window.__nbCompatCalls.push([a, b]);
      return original.call(window.NBCompatEngine, a, b, cb);
    };
  });

  await page.locator('#inputB').fill('CR2025');
  await page.locator('#compatForm').press('Enter');

  await expect(page.locator('#compatResult')).toBeVisible();
  await expect(page.locator('#compatResult h2')).toContainText(expected.headline);
  await expect(page.locator('#compatResult')).toContainText(expected.classification.replace(/_/g, ' '));

  const callState = await page.evaluate(() => ({
    count: window.__nbCompatCallCount,
    firstCall: window.__nbCompatCalls[0]
  }));

  expect(callState.count).toBe(1);
  expect(callState.firstCall).toEqual(['CR2032', 'CR2025']);
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility result keeps matches and differences distinct and unknowns visible', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);
  await page.locator('#inputA').fill('CR2032');
  await page.locator('#inputB').fill('CR2025');
  await page.locator('#btn-check').click();

  await expect(page.locator('#compatResult')).toBeVisible();
  await expect(page.locator('#compatResult .compat-section--matches')).toBeVisible();
  await expect(page.locator('#compatResult .compat-section--diffs')).toBeVisible();
  await expect(page.locator('#compatResult .compat-section--unknowns')).toBeVisible();

  const rendered = await page.evaluate(() => {
    function readItems(selector) {
      return Array.from(document.querySelectorAll(selector)).map((el) => (el.textContent || '').trim()).filter(Boolean);
    }
    return {
      matches: readItems('.compat-section--matches .compat-list li'),
      differences: readItems('.compat-section--diffs .compat-list li')
    };
  });

  expect(rendered.matches.length).toBeGreaterThan(0);
  expect(rendered.differences.length).toBeGreaterThan(0);
  rendered.matches.forEach((item) => {
    expect(rendered.differences).not.toContain(item);
  });
  expect(consoleErrors).toHaveLength(0);
});

test('blocking incompatibility is prominent and AA vs AAA cannot render direct equivalent', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);
  await page.locator('#inputA').fill('AA');
  await page.locator('#inputB').fill('AAA');
  await page.locator('#btn-check').click();

  await expect(page.locator('#compatResult')).toBeVisible();
  await expect(page.locator('#compatResult .notice.notice--warn')).toBeVisible();
  await expect(page.locator('#compatResult .notice.notice--warn')).toContainText('Blocking incompatibility warning');
  await expect(page.locator('#compatResult')).toContainText('not recommended');
  await expect(page.locator('#compatResult')).not.toContainText('direct equivalent');
  expect(consoleErrors).toHaveLength(0);
});

test('unknown battery code does not fabricate a supported relationship', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);
  await page.locator('#inputA').fill('UNKNOWNBATTERYCODE999');
  await page.locator('#inputB').fill('CR2032');
  await page.locator('#btn-check').click();

  await expect(page.locator('#compatResult')).toBeVisible();
  await expect(page.locator('#compatResult')).toContainText('Source battery "UNKNOWNBATTERYCODE999" was not found');
  await expect(page.locator('#compatResult')).toContainText('No explicit relationship record found between these two batteries.');
  await expect(page.locator('#compatResult')).not.toContainText('direct equivalent');
  expect(consoleErrors).toHaveLength(0);
});

test('engine failure shows technical failure and clears stale prior result on repeat submit', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);
  await page.locator('#inputA').fill('CR2032');
  await page.locator('#inputB').fill('CR2025');
  await page.locator('#btn-check').click();
  await expect(page.locator('#compatResult h2')).toContainText(/possible|same family|verified|insufficient|not recommended/i);

  const priorResult = await page.locator('#compatResult').textContent();
  expect(priorResult).toBeTruthy();

  await page.evaluate(() => {
    window.NBCompatEngine.assess = function (a, b, cb) {
      cb(new Error('compatibility_data_unavailable'), null);
    };
  });

  await page.locator('#inputB').fill('CR2032');
  await page.locator('#btn-check').click();

  await expect(page.locator('#compatResult .notice.notice--warn')).toBeVisible();
  await expect(page.locator('#compatResult')).toContainText('Technical failure');
  await expect(page.locator('#compatResult')).not.toContainText('Evidence summary');
  await expect(page.locator('#compatResult')).not.toContainText('Classification:');
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility form supports keyboard submission and blocks empty required fields', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page, '?code=CR2032');
  await page.locator('#inputB').press('Enter');
  await expect(page.locator('#error-inputB')).toBeVisible();

  await page.locator('#inputB').fill('CR2032');
  await page.locator('#inputB').press('Enter');

  await expect(page.locator('#compatResult')).toBeVisible();
  await expect(page.locator('#compatResult h2')).toContainText(/verified direct equivalent|possible|same family|not recommended|insufficient/i);
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility page loads production data scripts and returns a conservative assessment', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);

  const result = await page.evaluate(() => new Promise((resolve, reject) => {
    window.NBCompatEngine.assess('CR2032', 'CR2032', (error, assessment) => {
      if (error) {
        reject(String(error));
        return;
      }
      resolve({
        sourceBattery: assessment.sourceBattery,
        targetBattery: assessment.targetBattery,
        classification: assessment.classification,
        headline: assessment.headline,
        hasSourceRecord: !!assessment.sourceRecord,
        hasTargetRecord: !!assessment.targetRecord
      });
    });
  }));

  expect(result.sourceBattery).toBe('CR2032');
  expect(result.targetBattery).toBe('CR2032');
  expect(result.classification).toBeTruthy();
  expect(result.headline).toBeTruthy();
  expect(result.hasSourceRecord).toBe(true);
  expect(result.hasTargetRecord).toBe(true);
  expect(consoleErrors).toHaveLength(0);
});

test('physical fit lab loads live scenarios and renders the public test harness summary', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.goto(`${baseURL}/physical-fit-lab.html`);
  await page.waitForFunction(() => {
    const select = document.getElementById('compatDemoScenarioSelect');
    const status = document.getElementById('compatTestReportStatus');
    return select && select.options.length > 0 && status && /of .* passed|could not be loaded/i.test(status.textContent || '');
  });

  const summary = await page.evaluate(() => ({
    optionCount: (document.getElementById('compatDemoScenarioSelect') || {}).options?.length || 0,
    scenarioText: (document.getElementById('compatScenarioResult') || {}).textContent || '',
    statusText: (document.getElementById('compatTestReportStatus') || {}).textContent || ''
  }));

  expect(summary.optionCount).toBeGreaterThan(0);
  expect(summary.scenarioText.trim().length).toBeGreaterThan(0);
  expect(summary.statusText.trim().length).toBeGreaterThan(0);
  expect(consoleErrors).toHaveLength(0);
});

test('production pages serve all referenced assets without any same-origin 404', async ({ page }) => {
  const productionPages = [
    '/index.html',
    '/finder.html',
    '/compatibility.html',
    '/physical-fit-lab.html'
  ];

  for (const pagePath of productionPages) {
    const notFound = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(baseURL) && response.status() === 404) {
        notFound.push(`${response.status()} ${url}`);
      }
    });

    await page.goto(`${baseURL}${pagePath}`);
    await page.waitForLoadState('networkidle');

    expect(notFound, `Page ${pagePath} produced 404s: ${notFound.join(', ')}`).toHaveLength(0);

    page.removeAllListeners('response');
  }
});

test('finder resolves CR2032 to the exact governed public identification state', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await enterBatteryCodeAndWait(page, 'CR2032');

  const state = await page.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem('nb_finder_state_v2') || '{}');
    } catch (e) {
      return {};
    }
  });

  expect(state.battIdConfidence).toBe('exact');
  expect(state.battIdCanonical).toBe('CR2032');
  expect(consoleErrors).toHaveLength(0);
});

test('compatibility engine returns not_recommended for AA vs AAA — critical blocking incompatibility cannot resolve to direct_equivalent', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await openCompatibility(page);

  const result = await page.evaluate(() => new Promise((resolve, reject) => {
    window.NBCompatEngine.assess('AA', 'AAA', (error, assessment) => {
      if (error) {
        reject(String(error));
        return;
      }
      resolve({
        classification: assessment.classification,
        headline: assessment.headline,
        warnings: assessment.warnings
      });
    });
  }));

  // AA (household_primary, 1.5V, canonicalCode "AA") vs AAA (household_primary, 1.5V, canonicalCode "AAA"):
  // physical_size_designation blocking check fires because "AA" !== "AAA" → must not produce direct_equivalent
  expect(result.classification).toBe('not_recommended');
  expect(result.classification).not.toBe('direct_equivalent');
  expect(result.warnings.some((w) => /BLOCKING/i.test(w))).toBe(true);
  expect(consoleErrors).toHaveLength(0);
});
