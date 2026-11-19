'use strict';
// Test tooling only: verifies the preserved public candidate and writes QC evidence.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const expectedTree = 'e6ea65efb7e52ea20a7abb99668fe6d0d5fee0a2a35b85cf5a5a0734bd5f3dd2';
const pages = ['index.html', 'about.html', 'suppliers.html', 'battery-guides.html', 'retailer-links.html'];
const widths = [360, 400, 768, 980, 981, 1200];
const requiredChecks = ['document structure', 'skip-link keyboard path', 'horizontal overflow', 'navigation toggle', 'local links', 'runtime resources'];
const evidence = path.resolve(process.env.NB_QC_EVIDENCE || path.join(os.tmpdir(), 'newbatteries-readiness-qc'));
fs.mkdirSync(evidence, { recursive: true });
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + '\n');
function sourceIdentity() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'readiness-source-manifest.json'), 'utf8'));
  assert.equal(manifest.base_commit, 'abc3e17394af51f68aec447f03c0bb3d8420f30c');
  assert.equal(manifest.source_tree_sha256, expectedTree);
  const files = Object.keys(manifest.source_files_sha256).sort();
  assert.equal(files.length, 46, 'Expected the exact 46-file public source snapshot');
  const actual = {};
  for (const f of files) {
    assert(!path.isAbsolute(f) && !f.split(/[\\/]/).includes('..'), 'Unsafe source path');
    actual[f] = sha256(fs.readFileSync(path.join(root, f)));
    assert.equal(actual[f], manifest.source_files_sha256[f], 'Source changed: ' + f);
  }
  assert.equal(sha256(JSON.stringify(actual)), expectedTree, 'Whole-source fingerprint mismatch');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (process.env.GITHUB_SHA) assert.equal(commit, process.env.GITHUB_SHA, 'Checkout does not match triggering commit');
  return { source_tree_sha256: expectedTree, source_files: files.length, commit, node: process.version };
}
function verify() {
  try { const result = { status: 'PASS', ...sourceIdentity(), observed_at: new Date().toISOString() }; write('source.json', result); return result; }
  catch (e) { write('source.json', { status: 'FAIL', reason: e.message, observed_at: new Date().toISOString() }); throw e; }
}
async function browserChecks() {
  const dir = fs.mkdtempSync(path.join(evidence, 'browser-run-'));
  const report = { started_at: new Date().toISOString(), status: 'BLOCKED', checks: [] };
  let browser, server;
  try {
    Object.assign(report, sourceIdentity());
    const { chromium } = require('playwright');
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
        fs.readFile(file, (e, bytes) => {
          const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.ico': 'image/x-icon' };
          res.writeHead(e ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
          res.end(e ? 'Not found' : bytes);
        });
      } catch { res.writeHead(400); res.end('Bad request'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch();
    report.browser_version = browser.version();
    for (const width of widths) for (const file of pages) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [], externalRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === base) return route.continue();
        externalRequests.push(route.request().url()); return route.abort();
      });
      const record = { file, width, status: 'FAIL', checks: [] };
      async function check(name, action) {
        const result = { name, status: 'FAIL' };
        try { await action(); result.status = 'PASS'; }
        catch (e) { result.reason = e.message; }
        record.checks.push(result);
      }
      try {
        assert.equal((await page.goto(base + '/' + file)).status(), 200);
        await check('document structure', async () => {
        assert.equal(await page.locator('h1').count(), 1);
        const duplicateIds = await page.locator('[id]').evaluateAll(nodes => { const ids = nodes.map(n => n.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
        assert.deepEqual(duplicateIds, [], 'Duplicate IDs');
        });
        await check('skip-link keyboard path', async () => {
          const focusState = () => page.evaluate(() => {
            const active = document.activeElement, main = document.getElementById('main-content');
            return { tag: active?.tagName || null, id: active?.id || null,
              href: active?.getAttribute('href') || null, hash: location.hash,
              inMain: !!main && !!active && main.contains(active),
              mainTop: main?.getBoundingClientRect().top ?? null, scrollY };
          });
          record.keyboard = { before: await focusState() };
          await page.keyboard.press('Tab');
          record.keyboard.firstTab = await focusState();
          assert.equal(await page.locator('.skip-link:focus').count(), 1, 'Initial Tab must focus the skip link');
          assert.equal(record.keyboard.firstTab.href, '#main-content', 'Skip-link target');
          await page.keyboard.press('Enter');
          await page.waitForURL(url => url.hash === '#main-content');
          record.keyboard.afterActivation = await focusState();
          await page.keyboard.press('Tab');
          record.keyboard.nextTab = await focusState();
          assert(record.keyboard.nextTab.inMain, 'Next Tab after skip must enter main content');
        });
        await check('horizontal overflow', async () => {
        const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
        assert(size.page <= size.viewport + 1, 'Horizontal overflow: ' + JSON.stringify(size));
        });
        await check('navigation toggle', async () => {
        const toggle = page.locator('#navToggle');
        if (await toggle.isVisible()) {
          await toggle.focus(); await page.keyboard.press('Enter');
          await page.locator('#primaryNav.is-open').waitFor();
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Space');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
          assert.equal(await page.locator('#primaryNav.is-open').count(), 0);
        }
        });
        await check('local links', async () => {
        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
        for (const href of links) {
          const url = new URL(href, base + '/' + file);
          if (url.origin !== base) continue;
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          assert(target.startsWith(root + path.sep) && fs.existsSync(target), 'Missing local link: ' + href);
          if (url.hash) {
            const html = fs.readFileSync(target, 'utf8'), id = decodeURIComponent(url.hash.slice(1));
            assert(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"), 'Missing fragment: ' + href);
          }
        }
        });
        await check('runtime resources', async () => {
        assert.deepEqual(externalRequests, [], 'Unexpected external resource requests');
        assert.deepEqual(errors, [], 'Page or console errors');
        });
        record.status = record.checks.length === requiredChecks.length && record.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
        if (record.status === 'FAIL') record.reason = record.checks.filter(c => c.status !== 'PASS').map(c => c.name + ': ' + c.reason).join('; ');
      } catch (e) { record.reason = e.message; }
      finally {
        try {
          const name = file.replace('.html', '') + '-' + width + '.png';
          await page.screenshot({ path: path.join(dir, name), fullPage: true }); record.screenshot = name;
        } catch (e) { record.status = 'FAIL'; record.screenshot_error = e.message; }
        report.checks.push(record); await context.close();
      }
    }
    report.status = report.checks.length === 30 && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
  } catch (e) { report.status = 'BLOCKED'; report.reason = e.message; }
  finally {
    try { if (browser) await browser.close(); } catch (e) { report.status = 'FAIL'; report.cleanup_error = e.message; }
    if (server && server.listening) await new Promise(resolve => server.close(resolve));
    report.finished_at = new Date().toISOString();
    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'PASS') process.exitCode = 1;
  }
}
function summarize() {
  const checks = [];
  if (process.env.CI === 'true') {
    const names = ['SOURCE', 'REGRESSION', 'POLICY', 'RESPONSIVE'];
    const outcomes = names.map(name => ({ name, outcome: process.env['QC_' + name + '_OUTCOME'] || 'missing' }));
    checks.push({ check: 'workflow stage outcomes', status: outcomes.every(x => x.outcome === 'success') ? 'PASS' : 'FAIL', outcomes });
  }
  try { const s = JSON.parse(fs.readFileSync(path.join(evidence, 'source.json'), 'utf8')); assert.equal(s.status, 'PASS'); assert.equal(s.source_tree_sha256, expectedTree); if (process.env.GITHUB_SHA) assert.equal(s.commit, process.env.GITHUB_SHA); checks.push({ check: 'source identity', status: 'PASS' }); }
  catch (e) { checks.push({ check: 'source identity', status: 'FAIL', reason: e.message }); }
  try {
    const r = JSON.parse(fs.readFileSync(path.join(evidence, 'regression.json'), 'utf8'));
    assert.equal(r.stats.expected, 38); assert.equal(r.stats.unexpected, 0); assert.equal(r.stats.skipped, 0); assert.equal(r.stats.flaky, 0);
    checks.push({ check: 'existing browser regression', status: 'PASS', passed: 38 });
  } catch (e) { checks.push({ check: 'existing browser regression', status: 'FAIL', reason: e.message }); }
  try { const text = fs.readFileSync(path.join(evidence, 'policy.log'), 'utf8'); assert(text.includes('TOTAL 32 passed; 0 failed (includes JavaScript syntax check)')); checks.push({ check: 'seller policy', status: 'PASS', passed: 32 }); }
  catch (e) { checks.push({ check: 'seller policy', status: 'FAIL', reason: e.message }); }
  try {
    const runs = fs.readdirSync(evidence).filter(f => f.startsWith('browser-run-'));
    assert.equal(runs.length, 1, 'Exactly one browser evidence run required');
    const r = JSON.parse(fs.readFileSync(path.join(evidence, runs[0], 'results.json'), 'utf8'));
    assert.equal(r.status, 'PASS'); assert.equal(r.source_tree_sha256, expectedTree); if (process.env.GITHUB_SHA) assert.equal(r.commit, process.env.GITHUB_SHA); assert.equal(r.checks.length, 30);
    const keys = r.checks.map(c => {
      assert.equal(c.status, 'PASS');
      assert.deepEqual(c.checks.map(x => x.name).sort(), [...requiredChecks].sort(), 'All independent checks required');
      for (const result of c.checks) assert.equal(result.status, 'PASS', result.name);
      assert(c.keyboard?.firstTab?.href === '#main-content' && c.keyboard?.afterActivation?.hash === '#main-content' && c.keyboard?.nextTab?.inMain === true, 'Keyboard-path evidence required');
      assert(c.screenshot && fs.existsSync(path.join(evidence, runs[0], c.screenshot))); return c.file + ':' + c.width;
    }).sort();
    assert.deepEqual(keys, pages.flatMap(f => widths.map(w => f + ':' + w)).sort());
    checks.push({ check: 'affected pages at six widths', status: 'PASS', passed: 30 });
  } catch (e) { checks.push({ check: 'affected pages at six widths', status: 'FAIL', reason: e.message }); }
  const report = { status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL', observed_at: new Date().toISOString(), triggering_sha: process.env.GITHUB_SHA || null, source_tree_sha256: expectedTree, checks, limitations: 'Automated QC only. Screenshot review, physical-device and screen-reader acceptance remain separate. No deployment or affiliate approval.' };
  write('summary.json', report);
  const md = '# NewBatteries readiness QC: ' + report.status + '\n\n' + checks.map(c => '- ' + c.check + ': ' + c.status).join('\n') + '\n\n' + report.limitations + '\n';
  fs.writeFileSync(path.join(evidence, 'SUMMARY.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(JSON.stringify(report, null, 2)); if (report.status !== 'PASS') process.exitCode = 1;
}
(async () => {
  if (process.argv.includes('--verify-only')) console.log(JSON.stringify(verify(), null, 2));
  else if (process.argv.includes('--summarize')) summarize();
  else await browserChecks();
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
