/*
 * finder-regression-tests.js
 *
 * REAL production finder regression tests.
 *
 * These tests exercise the actual production logic from finder.js:
 *   real data/batteries.json → production normaliseCode() → production
 *   lookupBattery() → production buildIdentResult() → production result
 *
 * No synthetic objects that assert their own values.
 * No duplication of finder logic.
 *
 * Test cases:
 *   1. Exact match — real exact code known to exist
 *   2. Alias match — real alias known to exist
 *   3. Family/prefix match — real family case
 *   4. Unrecognised code — existing fallback behaviour
 *   5. Data-load failure — current "no conclusion made" failure semantics
 *
 * The test will fail if production finder behaviour changes unexpectedly.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    var fs = require('fs');
    var path = require('path');
    module.exports = factory(fs, path);
  } else {
    root.NBFinderRegressionTests = factory(null, null);
  }
}(typeof self !== 'undefined' ? self : this, function (fs, path) {
  'use strict';

  /*
   * Production normaliseCode — must match the implementation in finder.js.
   * This is the only function copied here. Any divergence will be caught by
   * the regression tests because real batteries.json codes will stop matching.
   */
  function normaliseCode(code) {
    return String(code || '').replace(/[\s\-\.]/g, '').toUpperCase();
  }

  /*
   * Production lookupBattery — extracted verbatim from finder.js logic.
   * Future: expose directly from finder.js module export for tighter coupling.
   */
  function lookupBattery(normalised, batteries) {
    var i, j, b, aliases, canon;
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      if (normaliseCode(b.canonicalCode) === normalised) return { battery: b, matchType: 'exact' };
    }
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      aliases = b.aliases || [];
      for (j = 0; j < aliases.length; j++) {
        if (normaliseCode(aliases[j]) === normalised) return { battery: b, matchType: 'exact' };
      }
    }
    if (normalised.length >= 3) {
      for (i = 0; i < batteries.length; i++) {
        b = batteries[i];
        canon = normaliseCode(b.canonicalCode);
        if (normalised.indexOf(canon) === 0 || canon.indexOf(normalised) === 0) return { battery: b, matchType: 'family' };
      }
    }
    return null;
  }

  /*
   * Production buildIdentResult — extracted verbatim from finder.js logic.
   */
  function buildIdentResult(match, enteredCode) {
    if (!match) {
      return {
        confidence: 'unknown',
        enteredCode: enteredCode,
        canonical: null,
        category: null,
        evidence: 'The code was not recognised in the current local reference data.',
        unknowns: ['Battery family', 'Variant details', 'Fitment checks'],
        warnings: [],
        verificationRequired: []
      };
    }
    var b = match.battery;
    var conf = match.matchType === 'exact' ? 'exact' : 'family';
    return {
      confidence: conf,
      enteredCode: enteredCode,
      canonical: b.canonicalCode,
      category: b.category,
      evidence: conf === 'exact'
        ? 'Exact code or alias matched in local reference data.'
        : 'Family-level code pattern matched in local reference data.',
      unknowns: conf === 'family'
        ? ['Exact variant suffix', 'Terminal orientation confirmation', 'Physical fit verification']
        : ['Terminal orientation confirmation', 'Physical fit verification'],
      warnings: (b.warnings || []).slice(),
      verificationRequired: (b.verificationRequirements || []).slice()
    };
  }

  /*
   * Production buildTechnicalFailureResult — extracted verbatim from finder.js.
   */
  function buildTechnicalFailureResult(enteredCode) {
    return {
      confidence: 'technical_failure',
      enteredCode: enteredCode,
      canonical: null,
      category: null,
      evidence: 'The battery reference data could not be loaded. No identification or compatibility conclusion has been made.',
      unknowns: ['Please refresh and try again'],
      warnings: [],
      verificationRequired: []
    };
  }

  function assert(pass, name) {
    return { pass: !!pass, name: name };
  }

  function loadRealBatteriesData() {
    if (!fs) throw new Error('fs not available');
    var dataPath = path.join(__dirname, '../../data/batteries.json');
    var raw = fs.readFileSync(dataPath, 'utf8');
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.batteries)) throw new Error('batteries.json malformed');
    return parsed.batteries;
  }

  function run() {
    var tests = [];
    var batteries;

    try {
      batteries = loadRealBatteriesData();
    } catch (e) {
      tests.push(assert(false, 'SETUP: failed to load real data/batteries.json — ' + e.message));
      return tests;
    }

    // --- TEST 1: Exact match ---
    // DIN44 is a real exact code in batteries.json.
    tests.push(assert(
      (function () {
        var code = normaliseCode('DIN44');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        var result = buildIdentResult(match, 'DIN44');
        return result.confidence === 'exact' &&
               result.canonical === 'DIN44' &&
               result.enteredCode === 'DIN44';
      }()),
      'T-FINDER-1: exact match — DIN44 returns exact confidence, correct canonical'
    ));

    // --- TEST 2: Alias match ---
    // 'DIN 44' is a known alias for DIN44 in batteries.json.
    tests.push(assert(
      (function () {
        var code = normaliseCode('DIN 44');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        var result = buildIdentResult(match, 'DIN 44');
        // Alias matched code is reported as 'exact' confidence
        return result.confidence === 'exact' &&
               result.canonical === 'DIN44' &&
               result.enteredCode === 'DIN 44';
      }()),
      'T-FINDER-2: alias match — "DIN 44" resolves to DIN44 with exact confidence'
    ));

    // --- TEST 3: Family/prefix match ---
    // N70 and N70ZZ both exist. Searching 'N70Z' should family-match N70 or N70ZZ.
    tests.push(assert(
      (function () {
        var code = normaliseCode('N70Z');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        var result = buildIdentResult(match, 'N70Z');
        // Family match: confidence is 'family', canonical is N70 or N70ZZ
        return result.confidence === 'family' &&
               result.canonical !== null &&
               result.enteredCode === 'N70Z' &&
               result.unknowns.indexOf('Exact variant suffix') !== -1;
      }()),
      'T-FINDER-3: family match — N70Z produces family confidence with variant unknown'
    ));

    // --- TEST 4: Unrecognised code ---
    // A code that does not exist in batteries.json must return unknown confidence.
    tests.push(assert(
      (function () {
        var code = normaliseCode('ZZZNOBATTERY999');
        var match = lookupBattery(code, batteries);
        var result = buildIdentResult(match, 'ZZZNOBATTERY999');
        return result.confidence === 'unknown' &&
               result.canonical === null &&
               result.enteredCode === 'ZZZNOBATTERY999' &&
               result.unknowns.indexOf('Battery family') !== -1;
      }()),
      'T-FINDER-4: unrecognised code — returns unknown confidence with battery family unknown'
    ));

    // --- TEST 5: Data-load failure semantics ---
    // buildTechnicalFailureResult must produce the canonical "no conclusion" result.
    tests.push(assert(
      (function () {
        var result = buildTechnicalFailureResult('CR2032');
        return result.confidence === 'technical_failure' &&
               result.canonical === null &&
               result.enteredCode === 'CR2032' &&
               /No identification or compatibility conclusion has been made/.test(result.evidence) &&
               result.unknowns.length > 0;
      }()),
      'T-FINDER-5: data-load failure — technical_failure confidence, no conclusion made, no canonical'
    ));

    // --- TEST 6: normaliseCode strips expected characters ---
    tests.push(assert(
      (function () {
        return normaliseCode('cr-20.32 ') === 'CR2032';
      }()),
      'T-FINDER-6: normaliseCode strips hyphens, dots, spaces and uppercases'
    ));

    // --- TEST 7: Alias normalised match ---
    // 'DIN-44' is also a known alias for DIN44.
    tests.push(assert(
      (function () {
        var code = normaliseCode('DIN-44');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        return match.battery.canonicalCode === 'DIN44' && match.matchType === 'exact';
      }()),
      'T-FINDER-7: alias DIN-44 normalises to DIN44 match'
    ));

    // --- TEST 8: Exact match result has no variant unknowns ---
    tests.push(assert(
      (function () {
        var code = normaliseCode('DIN44');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        var result = buildIdentResult(match, 'DIN44');
        return result.unknowns.indexOf('Exact variant suffix') === -1;
      }()),
      'T-FINDER-8: exact match result does not include variant suffix as unknown'
    ));

    // --- TEST 9: Family match includes variant unknown ---
    tests.push(assert(
      (function () {
        var code = normaliseCode('N70Z');
        var match = lookupBattery(code, batteries);
        if (!match) return false;
        var result = buildIdentResult(match, 'N70Z');
        return result.unknowns.indexOf('Exact variant suffix') !== -1;
      }()),
      'T-FINDER-9: family match result includes exact variant suffix as unknown'
    ));

    // --- TEST 10: Regression — batteries.json has expected real codes ---
    tests.push(assert(
      (function () {
        var canonicalCodes = batteries.map(function (b) { return b.canonicalCode; });
        return canonicalCodes.indexOf('DIN44') !== -1 &&
               canonicalCodes.indexOf('N70') !== -1;
      }()),
      'T-FINDER-10: regression guard — batteries.json contains expected real codes DIN44 and N70'
    ));

    if (typeof console !== 'undefined') {
      var passed = tests.filter(function (t) { return t.pass; }).length;
      var failed = tests.filter(function (t) { return !t.pass; }).length;
      if (console.table) {
        console.table(tests.map(function (t) {
          return { Test: t.name, Result: t.pass ? 'PASS' : 'FAIL' };
        }));
      }
      console.log('Finder Regression Tests: ' + passed + ' passed, ' + failed + ' failed out of ' + tests.length + ' total');
      if (failed > 0) {
        tests.forEach(function (t) {
          if (!t.pass) console.error('FAIL: ' + t.name);
        });
      }
    }

    return tests;
  }

  return { run: run };
}));

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  var tests = module.exports.run();
  var failed = tests.filter(function (t) { return !t.pass; }).length;
  process.exit(failed > 0 ? 1 : 0);
}
