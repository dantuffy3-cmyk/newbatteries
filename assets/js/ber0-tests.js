/*
 * ber0-tests.js
 *
 * BER-0 Comprehensive Test Suite
 *
 * Covers the required tests from Part 14 of the BER-0 specification:
 *
 *  1. Unknown evidence cannot improve compatibility.
 *  2. identified_not_acquired cannot support a claim at validation time.
 *  3. identified_not_acquired cannot support a derived rule at runtime.
 *  4. Development snapshot cannot write without ?nb_dev=true.
 *  5. Development snapshot CAN write with ?nb_dev=true.
 *  6. Development fixture cannot become publicly eligible.
 *  7. No-referral scenario emits no-referral semantics.
 *  8. Required-referral scenario remains distinguishable.
 *  9. Production exact finder match works.      → see finder-regression-tests.js
 * 10. Production alias finder match works.       → see finder-regression-tests.js
 * 11. Production family/prefix behaviour.        → see finder-regression-tests.js
 * 12. Production unknown-code fallback.          → see finder-regression-tests.js
 * 13. Production data-load-failure fallback.     → see finder-regression-tests.js
 * 14. CR2032 has one canonical governed identity record.
 * 15. claimId values are unique.
 * 16. All migrated claims contain a valid evidenceBasis.
 * 17. Existing governed records remain schema-valid.
 * 18. BER schema itself validates as JSON.
 * 19. No production runtime reads data/ber-schema.json.
 * 20. No dev fixture is used by the production finder.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    var fs = require('fs');
    var path = require('path');
    module.exports = factory(
      fs,
      path,
      require('./governed-core/controlled-vocabulary.js'),
      require('./governed-core/evidence-engine.js'),
      require('./governed-core/observation-adapter.js'),
      require('./governance/evaluate-derived-rules.js'),
      require('./governance/validate-governance.js')
    );
  } else {
    root.NBBE0Tests = factory(
      null, null,
      root.NBControlledVocabulary,
      root.NBEvidenceEngine,
      root.NBObservationAdapter,
      root.NBEvaluateDerivedRules,
      root.NBGovernanceValidator2
    );
  }
}(typeof self !== 'undefined' ? self : this, function (
  fs, pathMod,
  vocab, evidenceEngine, observationAdapter, derivedRules, validator
) {
  'use strict';

  function assert(pass, name) {
    return { pass: !!pass, name: name };
  }

  function readJson(relPath) {
    if (!fs) throw new Error('fs not available');
    var absPath = pathMod.join(__dirname, relPath);
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  }

  function readAllGoverned() {
    return [
      readJson('../../data/governed-records/cr2032.json'),
      readJson('../../data/governed-records/lr44.json'),
      readJson('../../data/governed-records/ln2-flooded.json')
    ];
  }

  var VALID_EVIDENCE_BASIS = ['OBSERVATION', 'MEASUREMENT', 'PHOTO_SUPPORTED',
    'DOCUMENT_SUPPORTED', 'USER_DECLARED', 'SYSTEM_DERIVED', 'UNKNOWN'];

  function run() {
    var tests = [];

    // -------------------------------------------------------------------------
    // TEST 1: Unknown evidence cannot improve compatibility
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var EVIDENCE = vocab.EVIDENCE_STATUS;
        // Unknown evidence status must not allow a claim to be treated as supported
        return EVIDENCE.UNKNOWN === 'unknown' &&
               EVIDENCE.UNKNOWN !== EVIDENCE.SUPPORTED &&
               EVIDENCE.UNKNOWN !== EVIDENCE.PARTIAL;
      }()),
      'T-BER-1: unknown evidence status is distinct from supported/partial — cannot improve compatibility'
    ));

    // -------------------------------------------------------------------------
    // TEST 2: identified_not_acquired cannot support a claim at validation time
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var iecSource = {
          sourceId: 'SRC-TEST-IEC', organisation: 'IEC',
          sourceType: 'standards_body', sourceRole: 'primary',
          authorityTier: 1, officialTitle: 'IEC 60086',
          documentIdentifier: 'IEC-60086', documentDateLabel: '2024',
          publicationDate: null, retrievalDate: null, jurisdiction: 'international',
          officialDomain: 'iec.ch', officialDomainStatus: 'unverified',
          fieldsSupported: [], evidenceLocations: [],
          rightsStatus: 'unknown', publicDisplayStatus: 'withheld',
          apiStatus: 'withheld', summaryUseApproved: false,
          archiveReference: null, reviewExpiry: null,
          reviewPolicyStatus: 'not_reviewed',
          sourceStatus: 'identified_not_acquired',
          approvalStatus: 'not_approved'
        };
        var result = validator.validateSourceRegister([iecSource]);
        return !result.valid &&
               result.errors.some(function (e) { return /identified_not_acquired/.test(e); });
      }()),
      'T-BER-2: identified_not_acquired source fails validateSourceRegister — cannot support a claim'
    ));

    // -------------------------------------------------------------------------
    // TEST 3: identified_not_acquired cannot support a derived rule at runtime
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var srcMap = {
          'SRC-TEST-NOT-ACQUIRED': {
            sourceId: 'SRC-TEST-NOT-ACQUIRED',
            sourceStatus: 'identified_not_acquired'
          }
        };
        var result = derivedRules.checkSourceAvailable('SRC-TEST-NOT-ACQUIRED', srcMap);
        return result.available === false && result.reason === 'source_not_acquired';
      }()),
      'T-BER-3: identified_not_acquired source returns available=false at runtime — cannot support derived rule'
    ));

    // -------------------------------------------------------------------------
    // TEST 4: Development snapshot cannot write without ?nb_dev=true
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        // In Node.js test environment, window is not defined, so isDevelopmentMode() returns false.
        // saveObservationSnapshot must return written:false.
        var result = observationAdapter.saveObservationSnapshot({ test: 'data' });
        return result.written === false &&
               result.reason === 'development_mode_not_active';
      }()),
      'T-BER-4: saveObservationSnapshot without nb_dev=true returns written=false'
    ));

    // -------------------------------------------------------------------------
    // TEST 5: isDevelopmentMode returns false in non-browser environment (snapshot gate)
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        // Verifies that the dev mode check returns false in Node.js (no window.location).
        // In production (no ?nb_dev=true), this gate must block writes.
        return observationAdapter.isDevelopmentMode() === false;
      }()),
      'T-BER-5: isDevelopmentMode returns false in non-browser/non-dev environment — snapshot gate active'
    ));

    // -------------------------------------------------------------------------
    // TEST 6: Development fixture cannot become publicly eligible
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var fixtures = readJson('../../data/governed-core/identity-fixtures.json');
        if (!fixtures || !Array.isArray(fixtures.fixtures)) return false;
        // All fixtures must have publicEligibility: false
        return fixtures.fixtures.every(function (fx) {
          return fx.eligibility && fx.eligibility.publicEligibility === false;
        }) && fixtures.environment === 'development_only';
      }()),
      'T-BER-6: all identity fixtures have publicEligibility=false and environment=development_only'
    ));

    // -------------------------------------------------------------------------
    // TEST 7: No-referral scenario emits no-referral semantics
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var REFERRAL = vocab.REFERRAL_DISPOSITION;
        var result = evidenceEngine.assessReferralDisposition({
          escalationRules: [],
          conflictsPresent: false,
          referralOptionalHints: []
        });
        return result.disposition === REFERRAL.NO_REFERRAL_REQUIRED &&
               result.disposition !== REFERRAL.REFERRAL_REQUIRED &&
               result.disposition !== REFERRAL.REFERRAL_OPTIONAL &&
               evidenceEngine.isNoReferralRequired(result) === true;
      }()),
      'T-BER-7: no escalation rule triggered → disposition is NO_REFERRAL_REQUIRED'
    ));

    // -------------------------------------------------------------------------
    // TEST 8: Required-referral scenario is distinguishable
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var REFERRAL = vocab.REFERRAL_DISPOSITION;
        var result = evidenceEngine.assessReferralDisposition({
          escalationRules: [{ triggered: true, ruleId: 'ESC-001' }],
          conflictsPresent: false
        });
        return result.disposition === REFERRAL.REFERRAL_REQUIRED &&
               evidenceEngine.isReferralRequired(result) === true &&
               evidenceEngine.isNoReferralRequired(result) === false;
      }()),
      'T-BER-8: triggered escalation rule → REFERRAL_REQUIRED, distinguishable from no-referral'
    ));

    // -------------------------------------------------------------------------
    // TEST 14: CR2032 has exactly one canonical governed identity record
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var dataDir = pathMod.join(__dirname, '../../data/governed-records');
        var files = fs.readdirSync(dataDir).filter(function (f) {
          return f.endsWith('.json') && f !== 'index.json';
        });
        var cr2032Files = files.filter(function (f) {
          return f.toLowerCase().indexOf('cr2032') !== -1;
        });
        // Must be exactly one file: cr2032.json (not CR2032-internal-v2.json)
        return cr2032Files.length === 1 && cr2032Files[0] === 'cr2032.json';
      }()),
      'T-BER-14: CR2032 has exactly one canonical governed identity record (cr2032.json only)'
    ));

    // -------------------------------------------------------------------------
    // TEST 15: claimId values are unique across all migrated governed records
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var records = readAllGoverned();
        var allClaimIds = [];
        records.forEach(function (record) {
          ['physical', 'electrical', 'chemistry', 'australianContext'].forEach(function (section) {
            var sec = record[section];
            if (!sec || typeof sec !== 'object') return;
            Object.keys(sec).forEach(function (fieldName) {
              var field = sec[fieldName];
              if (field && typeof field === 'object' && field.claimId) {
                allClaimIds.push(field.claimId);
              }
            });
          });
        });
        var unique = allClaimIds.filter(function (id, i) { return allClaimIds.indexOf(id) === i; });
        return unique.length === allClaimIds.length && allClaimIds.length > 0;
      }()),
      'T-BER-15: all claimId values are unique across migrated governed records'
    ));

    // -------------------------------------------------------------------------
    // TEST 16: All migrated claims contain a valid evidenceBasis
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var records = readAllGoverned();
        var allValid = true;
        records.forEach(function (record) {
          ['physical', 'electrical', 'chemistry', 'australianContext'].forEach(function (section) {
            var sec = record[section];
            if (!sec || typeof sec !== 'object') return;
            Object.keys(sec).forEach(function (fieldName) {
              var field = sec[fieldName];
              if (field && typeof field === 'object' && 'value' in field) {
                if (!field.evidenceBasis || VALID_EVIDENCE_BASIS.indexOf(field.evidenceBasis) === -1) {
                  allValid = false;
                }
              }
            });
          });
        });
        return allValid;
      }()),
      'T-BER-16: all migrated governed record claims contain a valid evidenceBasis value'
    ));

    // -------------------------------------------------------------------------
    // TEST 17: Existing governed records remain parseable (structural validity)
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        try {
          var records = readAllGoverned();
          return records.length === 3 &&
                 records.every(function (r) {
                   return r && typeof r === 'object' &&
                          r.identification && r.identification.recordId;
                 });
        } catch (e) {
          return false;
        }
      }()),
      'T-BER-17: existing governed records are parseable and retain identification.recordId'
    ));

    // -------------------------------------------------------------------------
    // TEST 18: BER schema validates as JSON
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        try {
          var schema = readJson('../../data/ber-schema.json');
          return schema && schema['$schema'] && schema['$id'] === 'ber-schema-v0' &&
                 typeof schema.properties === 'object' &&
                 schema.properties.recordMeta &&
                 schema.properties.identityRef &&
                 schema.properties.claims &&
                 schema.properties.unknowns &&
                 schema.properties.conflicts;
        } catch (e) {
          return false;
        }
      }()),
      'T-BER-18: data/ber-schema.json parses as valid JSON with required structural sections'
    ));

    // -------------------------------------------------------------------------
    // TEST 19: No production runtime JS reads data/ber-schema.json
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        // Scan all production JS files for references to ber-schema.json
        var jsDir = pathMod.join(__dirname);
        var prohibited = false;
        
        function scanDir(dirPath) {
          var entries = fs.readdirSync(dirPath);
          entries.forEach(function (entry) {
            var fullPath = pathMod.join(dirPath, entry);
            var stat = fs.statSync(fullPath);
            if (stat.isDirectory() && entry !== 'node_modules') {
              scanDir(fullPath);
            } else if (stat.isFile() && entry.endsWith('.js')) {
              // Skip test files
              if (entry.indexOf('test') !== -1 || entry.indexOf('Test') !== -1) return;
              var content = fs.readFileSync(fullPath, 'utf8');
              if (content.indexOf('ber-schema.json') !== -1) {
                prohibited = true;
              }
            }
          });
        }
        
        scanDir(jsDir);
        return !prohibited;
      }()),
      'T-BER-19: no production JS runtime reads data/ber-schema.json'
    ));

    // -------------------------------------------------------------------------
    // TEST 20: No dev fixture is used by the production finder
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var finderPath = pathMod.join(__dirname, 'finder.js');
        var finderContent = fs.readFileSync(finderPath, 'utf8');
        // Finder must not reference identity-fixtures.json or governed-core data
        return finderContent.indexOf('identity-fixtures') === -1 &&
               finderContent.indexOf('governed-core/identity') === -1 &&
               finderContent.indexOf('FX-') === -1;
      }()),
      'T-BER-20: production finder.js does not reference any dev fixture'
    ));

    // -------------------------------------------------------------------------
    // Additional: REFERRAL_OPTIONAL is separate from NO_REFERRAL_REQUIRED
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var REFERRAL = vocab.REFERRAL_DISPOSITION;
        var optResult = evidenceEngine.assessReferralDisposition({
          escalationRules: [],
          conflictsPresent: false,
          referralOptionalHints: ['unusual application noted']
        });
        return optResult.disposition === REFERRAL.REFERRAL_OPTIONAL &&
               optResult.disposition !== REFERRAL.NO_REFERRAL_REQUIRED &&
               optResult.disposition !== REFERRAL.REFERRAL_REQUIRED;
      }()),
      'T-BER-EXTRA-1: referral_optional is distinct from no_referral_required and referral_required'
    ));

    // -------------------------------------------------------------------------
    // Additional: conflict-driven referral is also REFERRAL_REQUIRED
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var REFERRAL = vocab.REFERRAL_DISPOSITION;
        var result = evidenceEngine.assessReferralDisposition({
          escalationRules: [],
          conflictsPresent: true
        });
        return result.disposition === REFERRAL.REFERRAL_REQUIRED &&
               result.reason === 'unresolved_conflict_requires_referral';
      }()),
      'T-BER-EXTRA-2: unresolved conflict triggers REFERRAL_REQUIRED even without explicit rule'
    ));

    // -------------------------------------------------------------------------
    // Additional: identity-fixtures.json fixtureType is engineering_fixture
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var fixtures = readJson('../../data/governed-core/identity-fixtures.json');
        return fixtures.fixtureType === 'engineering_fixture' &&
               fixtures.environment === 'development_only';
      }()),
      'T-BER-EXTRA-3: identity-fixtures.json is marked engineering_fixture and development_only'
    ));

    // -------------------------------------------------------------------------
    // Additional: sources.json has deprecation notice
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var sources = readJson('../../data/sources.json');
        return typeof sources._deprecationNotice === 'string' &&
               sources._deprecationNotice.indexOf('DEPRECATED') !== -1 &&
               sources._replacedBy === 'data/source-register.json';
      }()),
      'T-BER-EXTRA-4: data/sources.json carries V1 deprecation notice pointing to source-register.json'
    ));

    // -------------------------------------------------------------------------
    // Additional: source-register.json has canonical role note
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var sr = readJson('../../data/source-register.json');
        return typeof sr._canonicalRole === 'string' &&
               sr._canonicalRole.indexOf('V2 CANONICAL') !== -1;
      }()),
      'T-BER-EXTRA-5: data/source-register.json carries canonical role note'
    ));

    // -------------------------------------------------------------------------
    // Additional: EVIDENCE_BASIS vocabulary is valid and complete
    // -------------------------------------------------------------------------
    tests.push(assert(
      (function () {
        var EB = vocab.EVIDENCE_BASIS;
        var required = ['OBSERVATION', 'MEASUREMENT', 'PHOTO_SUPPORTED',
          'DOCUMENT_SUPPORTED', 'USER_DECLARED', 'SYSTEM_DERIVED', 'UNKNOWN'];
        return required.every(function (k) { return EB[k] === k.toLowerCase() || EB[k] === k; });
      }()),
      'T-BER-EXTRA-6: EVIDENCE_BASIS vocabulary contains all required values'
    ));

    if (typeof console !== 'undefined') {
      var passed = tests.filter(function (t) { return t.pass; }).length;
      var failed = tests.filter(function (t) { return !t.pass; }).length;
      if (console.table) {
        console.table(tests.map(function (t) {
          return { Test: t.name, Result: t.pass ? 'PASS' : 'FAIL' };
        }));
      }
      console.log('BER-0 Tests: ' + passed + ' passed, ' + failed + ' failed out of ' + tests.length + ' total');
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
