/*
 * finder-core.js
 *
 * Pure finder functions shared by:
 *   - finder.js (production runtime)
 *   - finder-regression-tests.js (regression test suite)
 *
 * These functions contain no DOM or browser dependencies.
 * Extracting them here ensures the regression tests exercise the actual
 * production implementation rather than copied duplicates.
 *
 * Do NOT import this file in any public-facing page directly.
 * Production entry point remains finder.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBFinderCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /*
   * normaliseBattCode
   *
   * Strips whitespace, hyphens and dots; uppercases the result.
   * Used for all battery code comparison.
   */
  function normaliseBattCode(code) {
    return String(code || '').replace(/[\s\-\.]/g, '').toUpperCase();
  }

  /*
   * lookupBattery
   *
   * Searches batteries array for a match against a normalised input code.
   * Match priority:
   *   1. Exact canonical code match
   *   2. Alias match (treated as exact confidence)
   *   3. Family/prefix match (requires >= 3 chars)
   *
   * Returns { battery, matchType } or null.
   */
  function lookupBattery(normalised, batteries) {
    var i, j, b, aliases, canon;
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      if (normaliseBattCode(b.canonicalCode) === normalised) return { battery: b, matchType: 'exact' };
    }
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      aliases = b.aliases || [];
      for (j = 0; j < aliases.length; j++) {
        if (normaliseBattCode(aliases[j]) === normalised) return { battery: b, matchType: 'exact' };
      }
    }
    if (normalised.length >= 3) {
      for (i = 0; i < batteries.length; i++) {
        b = batteries[i];
        canon = normaliseBattCode(b.canonicalCode);
        if (normalised.indexOf(canon) === 0 || canon.indexOf(normalised) === 0) return { battery: b, matchType: 'family' };
      }
    }
    return null;
  }

  /*
   * buildIdentResult
   *
   * Converts a raw lookup match into a structured identification result.
   * Returns an unknown-confidence result when match is null.
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
      evidence: conf === 'exact' ? 'Exact code or alias matched in local reference data.' : 'Family-level code pattern matched in local reference data.',
      unknowns: conf === 'family'
        ? ['Exact variant suffix', 'Terminal orientation confirmation', 'Physical fit verification']
        : ['Terminal orientation confirmation', 'Physical fit verification'],
      warnings: (b.warnings || []).slice(),
      verificationRequired: (b.verificationRequirements || []).slice()
    };
  }

  /*
   * buildTechnicalFailureResult
   *
   * Returns a structured result for data-load failure.
   * Conveys that no identification or compatibility conclusion has been made.
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

  return {
    normaliseBattCode: normaliseBattCode,
    lookupBattery: lookupBattery,
    buildIdentResult: buildIdentResult,
    buildTechnicalFailureResult: buildTechnicalFailureResult
  };
}));
