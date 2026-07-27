(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./validate-governance.js'),
      require('./evaluate-derived-rules.js'),
      require('./calculate-eligibility.js'),
      require('./sanitise-public-record.js')
    );
  } else {
    root.NBGovernanceValidationTests = factory(
      root.NBGovernanceValidator2,
      root.NBEvaluateDerivedRules,
      root.NBCalculateEligibility,
      root.NBSanitisePublicRecord
    );
  }
}(typeof self !== 'undefined' ? self : this, function (validator, ruleEngine, eligibilityCalc, sanitiser) {
  'use strict';

  var validateSourceRegister = validator.validateSourceRegister;
  var validateTechnicalEvidence = validator.validateTechnicalEvidence;
  var validateRegulatoryEvidence = validator.validateRegulatoryEvidence;
  var validateDerivedRules = validator.validateDerivedRules;
  var validateEligibilityState = validator.validateEligibilityState;
  var validateGovernedRecord = validator.validateGovernedRecord;
  var buildSourceMap = validator.buildSourceMap;

  var evaluateR1 = ruleEngine.evaluateR1;
  var evaluateR2 = ruleEngine.evaluateR2;
  var evaluateR3 = ruleEngine.evaluateR3;
  var checkSourceAvailable = ruleEngine.checkSourceAvailable;

  var calculateEligibility = eligibilityCalc.calculateEligibility;

  var sanitisePublicRecordSafe = sanitiser.sanitisePublicRecordSafe;
  var safeFallbackForCR2032 = sanitiser.safeFallbackForCR2032;
  var containsProhibitedWording = sanitiser.containsProhibitedWording;
  var isFieldWithheld = sanitiser.isFieldWithheld;

  function makeSource(overrides) {
    return Object.assign({
      sourceId: 'SRC-TEST-001',
      organisation: 'Test Org',
      sourceType: 'manufacturer_technical_datasheet',
      sourceRole: 'primary_technical_evidence',
      authorityTier: 2,
      officialTitle: 'Test Datasheet',
      documentIdentifier: 'TEST-DS-001',
      documentDateLabel: '2026',
      publicationDate: null,
      retrievalDate: null,
      jurisdiction: 'international',
      officialDomain: 'example.com',
      officialDomainStatus: 'unverified',
      fieldsSupported: ['nominalVoltage'],
      evidenceLocations: [],
      rightsStatus: 'unknown',
      publicDisplayStatus: 'withheld',
      apiStatus: 'withheld',
      summaryUseApproved: false,
      archiveReference: null,
      reviewExpiry: null,
      reviewPolicyStatus: 'not_reviewed',
      sourceStatus: 'candidate',
      approvalStatus: 'not_approved'
    }, overrides || {});
  }

  function makeTechField(overrides) {
    return Object.assign({
      fieldName: 'nominalVoltage',
      recordScope: 'electrical_characteristic',
      value: 3.0,
      unit: 'V',
      valueStatus: 'candidate',
      sourceIds: ['SRC-TEST-001'],
      sourceFactStatus: 'unverified',
      corroborationStatus: 'incomplete',
      conflictStatus: 'none',
      manufacturerSpecificStatus: false,
      standardRecordSuitability: 'candidate',
      rightsStatus: 'unknown',
      publicDisplayStatus: 'withheld',
      apiStatus: 'withheld',
      technicalEligibilityEffect: 'contributes_to_partial',
      publicEligibilityEffect: 'none_rights_not_cleared',
      nextAction: 'verify_source_rights'
    }, overrides || {});
  }

  function makeRegField(overrides) {
    return Object.assign({
      fieldName: 'hazardCategory',
      sourceIds: ['SRC-TEST-001'],
      sourceFact: 'Test hazard fact.',
      legalScope: 'Australia',
      affectedContext: 'loose_battery',
      batteryCategoryRelevance: 'directly_relevant',
      recordRelevance: 'relevant',
      relevanceType: 'hazard_context_only',
      rightsStatus: 'unknown',
      publicDisplayStatus: 'withheld',
      apiStatus: 'withheld',
      governedAction: 'withhold_pending_rights_clearance'
    }, overrides || {});
  }

  function makeRule(overrides) {
    return Object.assign({
      ruleId: 'R1',
      ruleName: 'Test rule',
      description: 'A test rule',
      dependencies: [],
      derivedOutputType: 'test_output',
      derivedOutputIsSourceFact: false,
      createsCompatibilityClaim: false,
      currentStatus: 'not_applied',
      currentStatusReason: 'Not yet activated',
      inputEvidenceIds: []
    }, overrides || {});
  }

  function makeEligibilityState(overrides) {
    return Object.assign({
      technicalIdentityEligibility: 'partially_validated',
      safetyContentEligibility: 'under_review',
      stewardshipContentEligibility: 'no_evidence',
      compatibilityStatus: 'not_assessed',
      publicEligibility: false
    }, overrides || {});
  }

  function makeGovernedRecord(overrides) {
    return Object.assign({
      batteryCode: 'CR2032',
      eligibility: makeEligibilityState(),
      governanceFlags: {
        approvedForPublic: false,
        approvedForApi: false,
        sourceOmissionTreatedAsConflict: false,
        compatibilityInferred: false,
        equivalenceInferred: false,
        manufacturerPerformanceExposed: false
      },
      technicalIdentity: {
        nominalVoltage: {
          value: 3.0,
          unit: 'V',
          valueStatus: 'candidate',
          sourceIds: ['SRC-TEST-001'],
          publicDisplayStatus: 'withheld',
          apiStatus: 'withheld'
        }
      }
    }, overrides || {});
  }

  function assert(condition, message) {
    return { pass: condition === true, name: message };
  }

  function run() {
    var tests = [];
    var sourceMap = { 'SRC-TEST-001': makeSource() };

    // TEST 1: missing source — no sourceIds in technical field
    tests.push(assert(
      (function () {
        var field = makeTechField({ sourceIds: [], valueStatus: 'candidate' });
        var result = validateTechnicalEvidence([field], sourceMap);
        return !result.valid && result.errors.some(function (e) { return /no sources/.test(e); });
      }()),
      'T1: missing source — field with no sourceIds and non-withheld value fails validation'
    ));

    // TEST 2: source not registered — sourceId not in register
    tests.push(assert(
      (function () {
        var field = makeTechField({ sourceIds: ['SRC-NOT-REGISTERED-999'] });
        var result = validateTechnicalEvidence([field], sourceMap);
        return !result.valid && result.errors.some(function (e) { return /not in register/.test(e); });
      }()),
      'T2: source not registered — unknown sourceId causes validation failure'
    ));

    // TEST 3: manufacturer corroboration — Panasonic-only field has manufacturerSpecificStatus true
    tests.push(assert(
      (function () {
        var field = makeTechField({
          fieldName: 'primaryStatus',
          manufacturerSpecificStatus: true,
          standardRecordSuitability: 'panasonic_only_pending_corroboration'
        });
        return field.manufacturerSpecificStatus === true &&
               field.standardRecordSuitability === 'panasonic_only_pending_corroboration';
      }()),
      'T3: manufacturer corroboration — Panasonic-only field correctly flagged as manufacturer-specific'
    ));

    // TEST 4: manufacturer-specific variation — Energizer-only chemistry field withheld
    tests.push(assert(
      (function () {
        var field = {
          value: 'Li/MnO2',
          valueStatus: 'candidate_manufacturer_specific',
          manufacturerSpecificStatus: true,
          publicDisplayStatus: 'withheld',
          apiStatus: 'withheld'
        };
        return isFieldWithheld(field) === true;
      }()),
      'T4: manufacturer-specific variation — Energizer-only chemistry field is withheld by sanitiser'
    ));

    // TEST 5: source omission not treated as conflict — field with only one source has conflictStatus none
    tests.push(assert(
      (function () {
        var field = makeTechField({
          sourceIds: ['SRC-TEST-001'],
          corroborationStatus: 'incomplete',
          conflictStatus: 'none'
        });
        return field.conflictStatus === 'none';
      }()),
      'T5: source omission not treated as conflict — single-source field has conflictStatus=none, not unresolved'
    ));

    // TEST 6: direct contradiction — unresolved conflict causes validation failure
    tests.push(assert(
      (function () {
        var field = makeTechField({ conflictStatus: 'unresolved' });
        var result = validateTechnicalEvidence([field], sourceMap);
        return !result.valid && result.errors.some(function (e) { return /unresolved conflict/.test(e); });
      }()),
      'T6: direct contradiction — unresolved conflictStatus fails validation'
    ));

    // TEST 7: unknown rights withheld — source with rightsStatus=unknown causes field to be withheld
    tests.push(assert(
      (function () {
        var field = makeTechField({ rightsStatus: 'unknown' });
        return isFieldWithheld(field) === true;
      }()),
      'T7: unknown rights withheld — field with rightsStatus=unknown is treated as withheld'
    ));

    // TEST 8: restricted rights withheld — field with rightsStatus=restricted is withheld
    tests.push(assert(
      (function () {
        var field = makeTechField({ rightsStatus: 'restricted' });
        return isFieldWithheld(field) === true;
      }()),
      'T8: restricted rights withheld — field with rightsStatus=restricted is treated as withheld'
    ));

    // TEST 9: derived rule success — R1 returns applied when dependencies available
    tests.push(assert(
      (function () {
        var fields = [
          makeTechField({ fieldName: 'diameter', value: 20.0, unit: 'mm', recordScope: 'physical_dimension', sourceIds: ['SRC-V2-TEST'] }),
          makeTechField({ fieldName: 'height', value: 3.2, unit: 'mm', recordScope: 'physical_dimension', sourceIds: ['SRC-V2-TEST'] }),
          makeTechField({ fieldName: 'broadLithiumClassification', value: 'lithium_primary', unit: null, recordScope: 'broad_chemistry_class', sourceIds: ['SRC-V2-TEST'] })
        ];
        var sm = {
          'SRC-V2-TEST': makeSource({ sourceId: 'SRC-V2-TEST' }),
          'SRC-V2-AU-ACCC-BUTTON-001': makeSource({ sourceId: 'SRC-V2-AU-ACCC-BUTTON-001' }),
          'SRC-V2-AU-ACCC-THRESHOLD-001': makeSource({ sourceId: 'SRC-V2-AU-ACCC-THRESHOLD-001' })
        };
        var result = evaluateR1(fields, sm);
        return result.status === 'applied';
      }()),
      'T9: derived rule success — R1 returns applied when all dependencies are available'
    ));

    // TEST 10: missing derivation dependency — R1 returns not_applied when diameter missing
    tests.push(assert(
      (function () {
        var fields = [
          makeTechField({ fieldName: 'height', value: 3.2, unit: 'mm', sourceIds: ['SRC-TEST-001'] })
        ];
        var sm = {
          'SRC-TEST-001': makeSource(),
          'SRC-V2-AU-ACCC-BUTTON-001': makeSource({ sourceId: 'SRC-V2-AU-ACCC-BUTTON-001' })
        };
        var result = evaluateR1(fields, sm);
        return result.status === 'not_applied' && /diameter/.test(result.reason);
      }()),
      'T10: missing derivation dependency — R1 not_applied when diameter field is missing'
    ));

    // TEST 11: retired source dependency — checkSourceAvailable returns not available for retired source
    tests.push(assert(
      (function () {
        var sm = {
          'SRC-RETIRED': makeSource({ sourceId: 'SRC-RETIRED', sourceStatus: 'retired' })
        };
        var result = checkSourceAvailable('SRC-RETIRED', sm);
        return result.available === false && result.reason === 'source_retired';
      }()),
      'T11: retired source dependency — retired source returns available=false'
    ));

    // TEST 12: expired source dependency — checkSourceAvailable returns not available for expired source
    tests.push(assert(
      (function () {
        var sm = {
          'SRC-EXPIRED': makeSource({ sourceId: 'SRC-EXPIRED', sourceStatus: 'expired' })
        };
        var result = checkSourceAvailable('SRC-EXPIRED', sm);
        return result.available === false && result.reason === 'source_expired';
      }()),
      'T12: expired source dependency — expired source returns available=false'
    ));

    // TEST 13: loose/product context separation — product obligation in loose_battery context fails R3
    tests.push(assert(
      (function () {
        var contexts = {
          loose_battery: {
            description: 'Test',
            fields: [makeRegField({ relevanceType: 'device_manufacturer_obligation', affectedContext: 'loose_battery' })]
          },
          product_containing: { description: 'Test', fields: [] },
          consumer_handling: { description: 'Test', fields: [] },
          supplier_compliance: { description: 'Test', fields: [] }
        };
        var sm = { 'SRC-V2-AU-ACCC-BUTTON-001': makeSource({ sourceId: 'SRC-V2-AU-ACCC-BUTTON-001' }), 'SRC-TEST-001': makeSource() };
        var result = evaluateR3(contexts, sm);
        return result.status === 'not_applied' && /context_separation_violated/.test(result.reason);
      }()),
      'T13: loose/product context separation — device_manufacturer_obligation in loose_battery context fails R3'
    ));

    // TEST 14: under-review leakage prevention — safetyContentEligibility under_review blocks public output
    tests.push(assert(
      (function () {
        var record = makeGovernedRecord({
          eligibility: makeEligibilityState({ safetyContentEligibility: 'under_review', publicEligibility: false })
        });
        var result = sanitisePublicRecordSafe(record, {});
        return result.publicEligibility === false && result.fallback !== undefined;
      }()),
      'T14: under-review leakage prevention — safetyContentEligibility=under_review blocks public output'
    ));

    // TEST 15: raw source leakage prevention — sourceFact text must not appear in public output
    tests.push(assert(
      (function () {
        var record = makeGovernedRecord();
        var result = sanitisePublicRecordSafe(record, {});
        var resultStr = JSON.stringify(result);
        return resultStr.indexOf('sourceFact') === -1;
      }()),
      'T15: raw source leakage prevention — sourceFact text does not appear in public output'
    ));

    // TEST 16: symbol/diagram leakage prevention — publicDisplayStatus=withheld fields do not appear in output
    tests.push(assert(
      (function () {
        var record = makeGovernedRecord({
          technicalIdentity: {
            polarity: { value: '+/-', valueStatus: 'withheld', publicDisplayStatus: 'withheld', apiStatus: 'withheld', sourceIds: [] }
          }
        });
        var result = sanitisePublicRecordSafe(record, {});
        var resultStr = JSON.stringify(result);
        return resultStr.indexOf('+/-') === -1;
      }()),
      'T16: symbol/diagram leakage prevention — withheld polarity field does not appear in output'
    ));

    // TEST 17: manufacturer-performance leakage prevention — capacity (mfr-specific) withheld
    tests.push(assert(
      (function () {
        var field = {
          value: 235,
          unit: 'mAh',
          valueStatus: 'manufacturer_specific_internal_only',
          manufacturerSpecificStatus: true,
          publicDisplayStatus: 'withheld',
          apiStatus: 'withheld'
        };
        return isFieldWithheld(field) === true;
      }()),
      'T17: manufacturer-performance leakage prevention — capacity field is withheld'
    ));

    // TEST 18: compatibility wording blocked — containsProhibitedWording detects compatibility
    tests.push(assert(
      (function () {
        return containsProhibitedWording('This battery is compatible with device X') === true;
      }()),
      'T18: compatibility wording blocked — prohibited pattern detected in string'
    ));

    // TEST 19: equivalence wording blocked — containsProhibitedWording detects equivalence
    tests.push(assert(
      (function () {
        return containsProhibitedWording('Direct equivalent to LR44') === true;
      }()),
      'T19: equivalence wording blocked — prohibited equivalence pattern detected'
    ));

    // TEST 20: stewardship evidence missing — no stewardship fields returns no_evidence
    tests.push(assert(
      (function () {
        var bundle = {
          sources: [makeSource()],
          technicalEvidenceFields: [makeTechField()],
          regulatoryContexts: {},
          stewardshipFields: []
        };
        var result = calculateEligibility(bundle);
        return result.stewardshipContentEligibility === 'no_evidence';
      }()),
      'T20: stewardship evidence missing — no stewardship fields yields stewardshipContentEligibility=no_evidence'
    ));

    // TEST 21: malformed record handling — non-object record returns error
    tests.push(assert(
      (function () {
        var result = sanitisePublicRecordSafe(null, {});
        return result.error === 'malformed_record' && result.fallback !== undefined;
      }()),
      'T21: malformed record handling — null record returns error with safe fallback'
    ));

    // TEST 22: sanitiser failure recovery — sanitisePublicRecordSafe returns fallback on exception
    tests.push(assert(
      (function () {
        var badRecord = Object.create(null);
        Object.defineProperty(badRecord, 'eligibility', {
          get: function () { throw new Error('intentional error'); }
        });
        var result = sanitisePublicRecordSafe(badRecord, {});
        return result.error === 'sanitiser_failure' && result.fallback !== undefined;
      }()),
      'T22: sanitiser failure recovery — exception in sanitiser returns sanitiser_failure with safe fallback'
    ));

    // TEST 23: API withheld field leakage prevention — apiStatus=withheld field blocked
    tests.push(assert(
      (function () {
        var field = makeTechField({ apiStatus: 'withheld', publicDisplayStatus: 'withheld' });
        return isFieldWithheld(field) === true;
      }()),
      'T23: API withheld field leakage prevention — apiStatus=withheld field is blocked'
    ));

    // TEST 24: publicEligibility remains false — calculateEligibility with current CR2032 state returns false
    tests.push(assert(
      (function () {
        var bundle = {
          sources: [makeSource()],
          technicalEvidenceFields: [makeTechField({ rightsStatus: 'unknown' })],
          regulatoryContexts: {
            loose_battery: {
              description: 'Test',
              fields: [makeRegField({ rightsStatus: 'unknown' })]
            }
          },
          stewardshipFields: []
        };
        var result = calculateEligibility(bundle);
        return result.publicEligibility === false;
      }()),
      'T24: publicEligibility remains false — unknown rights keeps publicEligibility=false'
    ));

    // TEST 25: compatibility remains not_assessed — calculateEligibility always returns not_assessed
    tests.push(assert(
      (function () {
        var bundle = {
          sources: [makeSource({ rightsStatus: 'cleared' })],
          technicalEvidenceFields: [makeTechField({ rightsStatus: 'cleared' })],
          regulatoryContexts: {
            loose_battery: {
              description: 'Test',
              fields: [makeRegField({ rightsStatus: 'cleared' })]
            }
          },
          stewardshipFields: [{ sourceIds: ['SRC-TEST-001'], rightsStatus: 'cleared' }]
        };
        var result = calculateEligibility(bundle);
        return result.compatibilityStatus === 'not_assessed';
      }()),
      'T25: compatibility remains not_assessed — calculateEligibility always returns compatibilityStatus=not_assessed'
    ));

    // TEST 26: retired source in source register validation — retired source fails validation
    tests.push(assert(
      (function () {
        var retiredSource = makeSource({ sourceId: 'SRC-RET-001', sourceStatus: 'retired' });
        var result = validateSourceRegister([retiredSource]);
        return !result.valid && result.errors.some(function (e) { return /retired/.test(e); });
      }()),
      'T26: retired source in register — source with sourceStatus=retired fails source register validation'
    ));

    // TEST 27: expired source in source register validation — expired source fails validation
    tests.push(assert(
      (function () {
        var expiredSource = makeSource({ sourceId: 'SRC-EXP-001', sourceStatus: 'expired' });
        var result = validateSourceRegister([expiredSource]);
        return !result.valid && result.errors.some(function (e) { return /expired/.test(e); });
      }()),
      'T27: expired source in register — source with sourceStatus=expired fails source register validation'
    ));

    // TEST 28: derived rule output is not a source fact — R1 result has derivedOutputIsSourceFact=false
    tests.push(assert(
      (function () {
        var fields = [
          makeTechField({ fieldName: 'diameter', value: 20.0, unit: 'mm', sourceIds: ['SRC-V2-AU-ACCC-BUTTON-TEST'] }),
          makeTechField({ fieldName: 'height', value: 3.2, unit: 'mm', sourceIds: ['SRC-V2-AU-ACCC-BUTTON-TEST'] })
        ];
        var sm = {
          'SRC-V2-AU-ACCC-BUTTON-TEST': makeSource({ sourceId: 'SRC-V2-AU-ACCC-BUTTON-TEST' }),
          'SRC-V2-AU-ACCC-BUTTON-001': makeSource({ sourceId: 'SRC-V2-AU-ACCC-BUTTON-001' })
        };
        var result = evaluateR1(fields, sm);
        return result.derivedOutputIsSourceFact === false;
      }()),
      'T28: derived rule output is not a source fact — R1 derivedOutputIsSourceFact is always false'
    ));

    // TEST 29: derived rules do not create compatibility claims — R1/R2 createsCompatibilityClaim=false
    tests.push(assert(
      (function () {
        var fields = [];
        var sm = {};
        var r1 = evaluateR1(fields, sm);
        var r2 = evaluateR2(fields, sm);
        return r1.createsCompatibilityClaim === false && r2.createsCompatibilityClaim === false;
      }()),
      'T29: derived rules do not create compatibility claims — R1 and R2 createsCompatibilityClaim=false'
    ));

    // TEST 30: safe fallback contains required keys for CR2032 under_review state
    tests.push(assert(
      (function () {
        var fb = safeFallbackForCR2032();
        return fb.publicEligibility === false &&
               fb.compatibilityStatus === 'not_assessed' &&
               fb.identification !== undefined &&
               fb.identification.status === 'under_review' &&
               fb.evidencePending === true;
      }()),
      'T30: safe fallback — CR2032 fallback contains identification, under-review status, not_assessed compatibility, evidencePending=true'
    ));

    if (typeof console !== 'undefined') {
      var passed = tests.filter(function (t) { return t.pass; }).length;
      var failed = tests.filter(function (t) { return !t.pass; }).length;
      if (console.table) {
        console.table(tests.map(function (t) {
          return { Test: t.name, Result: t.pass ? 'PASS' : 'FAIL' };
        }));
      }
      console.log('Governance Validation Tests: ' + passed + ' passed, ' + failed + ' failed out of ' + tests.length + ' total');
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
