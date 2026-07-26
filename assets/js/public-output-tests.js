(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./public-record-sanitizer.js'),
      require('../../data/source-register.json'),
      require('../../data/battery-record-schema.json'),
      require('../../data/record-review-statuses.json'),
      require('../../data/public-output-rules.json'),
      require('../../data/public-relationship-rules.json'),
      require('../../data/public-fallback-states.json'),
      require('../../data/public-output-test-cases.json'),
      require('../../data/governed-records/lr44.json')
    );
  } else {
    root.NBPublicOutputTests = factory(root.NBPublicRecordSanitizer, root.NBSourceRegister, root.NBBatteryRecordSchema, root.NBReviewStatuses, root.NBPublicOutputRules, root.NBPublicRelationshipRules, root.NBPublicFallbackStates, root.NBPublicOutputTestCases, root.NBGovernedRecords.lr44);
  }
}(typeof self !== 'undefined' ? self : this, function (sanitizerModule, sourceRegister, schema, reviewStatuses, outputRules, relationshipRules, fallbackStates, testCases, lr44Record) {
  'use strict';

  var sanitizeGovernedRecordForPublic = sanitizerModule.sanitizeGovernedRecordForPublic;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function governanceData(extra) {
    var data = {
      sourceRegister: sourceRegister,
      schema: schema,
      recordReviewStatuses: reviewStatuses,
      publicOutputRules: outputRules,
      relationshipRules: relationshipRules,
      fallbackStates: fallbackStates
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { data[k] = extra[k]; });
    }
    return data;
  }

  function setClearedRights(record, paths) {
    paths.forEach(function (path) {
      var field = path.split('.').reduce(function (acc, part) {
        return acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : null;
      }, record);
      if (field && typeof field === 'object') {
        field.publicDisplayRights = 'cleared';
      }
    });
  }

  function approvedRecord() {
    var rec = clone(lr44Record);
    rec.recordGovernance.previousStatus = 'reviewed';
    rec.recordGovernance.recordStatus = 'approved';
    rec.recordGovernance.publicEligibility = true;
    rec.recordGovernance.approvedAt = '2026-07-26';
    rec.recordGovernance.approvedBy = 'reviewer@example.com';
    rec.recordType = 'standard_size';
    setClearedRights(rec, outputRules.publicFactFields.concat(schema.categoryProfiles.button_cell.requiredFields));
    return rec;
  }

  function assertCase(rows, name, expected, condition, actual) {
    rows.push({
      Test: name,
      Expected: expected,
      Actual: actual,
      'PASS/FAIL': condition ? 'PASS' : 'FAIL'
    });
  }

  function hasProhibitedCompatibilityWording(value) {
    var haystack = JSON.stringify(value).toLowerCase();
    return (outputRules.prohibitedCompatibilityWording || []).some(function (term) {
      var pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      return new RegExp('\\b' + pattern + '\\b', 'i').test(haystack);
    });
  }

  function runPublicOutputTests() {
    var rows = [];
    var cases = (testCases && testCases.cases) || [];

    var c1 = approvedRecord();
    var r1 = sanitizeGovernedRecordForPublic(c1, governanceData());
    assertCase(rows, cases[0].name, cases[0].expected, r1.eligibility.eligible === true && r1.eligibility.reasonCode === 'eligible' && r1.verifiedFacts.length > 0, r1.eligibility.reasonCode);

    var c2 = clone(lr44Record);
    var r2 = sanitizeGovernedRecordForPublic(c2, governanceData());
    assertCase(rows, cases[1].name, cases[1].expected, r2.fallback && r2.fallback.message === outputRules.underReviewMessage && r2.verifiedFacts.length === 0 && r2.relationships.length === 0, (r2.fallback && r2.fallback.code) || 'none');

    var c3 = approvedRecord();
    c3.recordGovernance.publicEligibility = false;
    var r3 = sanitizeGovernedRecordForPublic(c3, governanceData());
    assertCase(rows, cases[2].name, cases[2].expected, r3.eligibility.reasonCode === 'public_flag_false', r3.eligibility.reasonCode);

    var c4 = approvedRecord();
    c4.physical.thicknessMm.value = null;
    var r4 = sanitizeGovernedRecordForPublic(c4, governanceData());
    assertCase(rows, cases[3].name, cases[3].expected, r4.eligibility.reasonCode === 'critical_field_missing', r4.eligibility.reasonCode);

    var c5 = approvedRecord();
    c5.electrical.nominalVoltage.publicDisplayRights = 'unknown';
    var r5 = sanitizeGovernedRecordForPublic(c5, governanceData());
    assertCase(rows, cases[4].name, cases[4].expected, r5.eligibility.reasonCode === 'critical_rights_not_cleared', r5.eligibility.reasonCode);

    var c6 = approvedRecord();
    c6.physical.lengthMm.value = 1;
    c6.physical.lengthMm.unit = 'mm';
    c6.physical.lengthMm.evidenceConfidence = 'high';
    c6.physical.lengthMm.sourceIds = ['SRC-ANSMANN-LR44-2026-001'];
    c6.physical.lengthMm.verifiedAt = '2026-07-26';
    c6.physical.lengthMm.publicDisplayRights = 'unknown';
    var r6 = sanitizeGovernedRecordForPublic(c6, governanceData());
    assertCase(rows, cases[5].name, cases[5].expected, r6.eligibility.eligible === true && r6.withheldFields.some(function (f) { return f.field === 'physical.lengthMm' && f.status === 'withheld_rights'; }), JSON.stringify(r6.withheldFields));

    var c7 = approvedRecord();
    c7.electrical.nominalVoltage.conflict.status = 'unresolved';
    var r7 = sanitizeGovernedRecordForPublic(c7, governanceData());
    assertCase(rows, cases[6].name, cases[6].expected, r7.eligibility.reasonCode === 'critical_conflict', r7.eligibility.reasonCode);

    var c8 = approvedRecord();
    c8.physical.lengthMm.value = 1;
    c8.physical.lengthMm.unit = 'mm';
    c8.physical.lengthMm.evidenceConfidence = 'high';
    c8.physical.lengthMm.sourceIds = ['SRC-ANSMANN-LR44-2026-001'];
    c8.physical.lengthMm.verifiedAt = '2026-07-26';
    c8.physical.lengthMm.publicDisplayRights = 'cleared';
    c8.physical.lengthMm.conflict.status = 'unresolved';
    var r8 = sanitizeGovernedRecordForPublic(c8, governanceData());
    assertCase(rows, cases[7].name, cases[7].expected, r8.eligibility.eligible === true && r8.conflicts.length > 0 && r8.conflicts[0].message === outputRules.conflictNotice, JSON.stringify(r8.conflicts));

    var c9 = approvedRecord();
    c9.recordType = 'unsupported_scope';
    var r9 = sanitizeGovernedRecordForPublic(c9, governanceData());
    assertCase(rows, cases[8].name, cases[8].expected, r9.eligibility.reasonCode === 'scope_missing', r9.eligibility.reasonCode);

    var c10 = approvedRecord();
    c10.relationships = [{ type: 'manufacturer_alias', targetCode: 'LR1154', status: 'approved', publicDisplayRights: 'cleared' }];
    var r10 = sanitizeGovernedRecordForPublic(c10, governanceData());
    assertCase(rows, cases[9].name, cases[9].expected, r10.relationships.length === 1 && r10.relationships[0].label === 'Manufacturer naming', JSON.stringify(r10.relationships));

    var c11 = approvedRecord();
    c11.relationships = [{ type: 'same_standard_family', targetCode: 'AG13', status: 'approved', publicDisplayRights: 'cleared' }];
    var r11 = sanitizeGovernedRecordForPublic(c11, governanceData());
    assertCase(rows, cases[10].name, cases[10].expected, r11.relationships.length === 1 && r11.relationships[0].label === 'Same standard family — this does not confirm compatibility', JSON.stringify(r11.relationships));

    var c12 = approvedRecord();
    c12.relationships = [{ type: 'conditional_substitute', targetCode: 'A76', status: 'approved', publicDisplayRights: 'cleared' }];
    var r12 = sanitizeGovernedRecordForPublic(c12, governanceData());
    assertCase(rows, cases[11].name, cases[11].expected, r12.relationships.length === 0, JSON.stringify(r12.relationships));

    var c13 = approvedRecord();
    c13.relationships = [{ type: 'insufficient_evidence', targetCode: 'A76', status: 'approved', publicDisplayRights: 'cleared' }];
    var r13 = sanitizeGovernedRecordForPublic(c13, governanceData());
    assertCase(rows, cases[12].name, cases[12].expected, r13.relationships.length === 0, JSON.stringify(r13.relationships));

    var c14 = approvedRecord();
    c14.relationships = [{ type: 'verified_direct_equivalent', targetCode: 'AG13', status: 'approved', publicDisplayRights: 'cleared' }];
    var r14 = sanitizeGovernedRecordForPublic(c14, governanceData());
    assertCase(rows, cases[13].name, cases[13].expected, r14.relationships.length === 0, JSON.stringify(r14.relationships));

    var c15 = approvedRecord();
    c15.relationships = [{ type: 'incompatible', targetCode: 'SR44', status: 'approved', publicDisplayRights: 'cleared' }];
    var r15 = sanitizeGovernedRecordForPublic(c15, governanceData());
    assertCase(rows, cases[14].name, cases[14].expected, r15.relationships.length === 1 && r15.relationships[0].label === 'Known incompatibility', JSON.stringify(r15.relationships));

    var r16 = sanitizeGovernedRecordForPublic(null, governanceData({ requestState: 'unknown_code' }));
    assertCase(rows, cases[15].name, cases[15].expected, r16.fallback && r16.fallback.code === 'unknown_code', (r16.fallback && r16.fallback.code) || 'none');

    var r17 = sanitizeGovernedRecordForPublic([approvedRecord(), approvedRecord()], governanceData());
    assertCase(rows, cases[16].name, cases[16].expected, r17.fallback && r17.fallback.code === 'multiple_possible_records', (r17.fallback && r17.fallback.code) || 'none');

    var c18 = approvedRecord();
    c18.recordGovernance.recordStatus = 'retired';
    var r18 = sanitizeGovernedRecordForPublic(c18, governanceData());
    assertCase(rows, cases[17].name, cases[17].expected, r18.eligibility.reasonCode === 'record_retired', r18.eligibility.reasonCode);

    var c19 = approvedRecord();
    c19.recordGovernance.recordStatus = 'deprecated';
    var r19 = sanitizeGovernedRecordForPublic(c19, governanceData());
    assertCase(rows, cases[18].name, cases[18].expected, r19.eligibility.reasonCode === 'record_deprecated', r19.eligibility.reasonCode);

    var r20 = sanitizeGovernedRecordForPublic('broken-record', governanceData());
    assertCase(rows, cases[19].name, cases[19].expected, r20.eligibility.reasonCode === 'malformed_record', r20.eligibility.reasonCode);

    var r21 = sanitizeGovernedRecordForPublic(null, governanceData({ requestState: 'technical_failure' }));
    assertCase(rows, cases[20].name, cases[20].expected, r21.fallback && r21.fallback.code === 'technical_failure', (r21.fallback && r21.fallback.code) || 'none');

    var c22 = approvedRecord();
    c22.safetyFlags = [{ key: 'coin-safety', text: 'Keep out of reach of children.', sourceIds: ['SRC-US-CPSC-BUTTON-BATTERY-2026-001'], verifiedAt: '2026-07-26', publicDisplayRights: 'cleared', categories: ['button_cell'] }];
    var r22 = sanitizeGovernedRecordForPublic(c22, governanceData());
    assertCase(rows, cases[21].name, cases[21].expected, r22.safetyFlags.length === 1, JSON.stringify(r22.safetyFlags));

    var c23 = approvedRecord();
    c23.safetyFlags = [{ key: 'coin-safety', text: 'Keep out of reach of children.', sourceIds: ['SRC-US-CPSC-BUTTON-BATTERY-2026-001'], verifiedAt: null, publicDisplayRights: 'cleared', categories: ['button_cell'] }];
    var r23 = sanitizeGovernedRecordForPublic(c23, governanceData());
    assertCase(rows, cases[22].name, cases[22].expected, r23.safetyFlags.length === 0, JSON.stringify(r23.safetyFlags));

    var r24 = sanitizeGovernedRecordForPublic(approvedRecord(), governanceData());
    var s24 = JSON.stringify(r24);
    assertCase(rows, cases[23].name, cases[23].expected, s24.indexOf('sourceIds') === -1 && s24.indexOf('evidenceConfidence') === -1 && s24.indexOf('verifiedBy') === -1 && s24.indexOf('notes') === -1, s24.slice(0, 120));

    var r25 = sanitizeGovernedRecordForPublic(approvedRecord(), governanceData());
    assertCase(rows, cases[24].name, cases[24].expected, r25.compatibilityStatus === 'not_assessed' && r25.notAssessed[0] === outputRules.requiredNotAssessedWording, r25.compatibilityStatus + ' | ' + r25.notAssessed[0]);

    var c26 = approvedRecord();
    c26.physical.thicknessMm.value = null;
    var r26 = sanitizeGovernedRecordForPublic(c26, governanceData());
    var order = Object.keys(r26);
    assertCase(rows, cases[25].name, cases[25].expected, order.indexOf('criticalUnknowns') !== -1 && order.indexOf('nextAction') !== -1 && order.indexOf('criticalUnknowns') < order.indexOf('nextAction'), JSON.stringify(order));

    var c27 = approvedRecord();
    var before27 = JSON.stringify(c27);
    sanitizeGovernedRecordForPublic(c27, governanceData());
    var after27 = JSON.stringify(c27);
    assertCase(rows, cases[26].name, cases[26].expected, before27 === after27, before27 === after27 ? 'unchanged' : 'changed');

    var c28 = approvedRecord();
    c28.physical.lengthMm.value = 1;
    c28.physical.lengthMm.unit = 'mm';
    c28.physical.lengthMm.evidenceConfidence = 'high';
    c28.physical.lengthMm.sourceIds = ['SRC-ANSMANN-LR44-2026-001'];
    c28.physical.lengthMm.verifiedAt = '2026-07-26';
    c28.physical.lengthMm.publicDisplayRights = 'unknown';
    var r28 = sanitizeGovernedRecordForPublic(c28, governanceData());
    var withheldLengthOnly = r28.withheldFields.filter(function (f) { return f.status === 'withheld_rights'; });
    assertCase(rows, cases[27].name, cases[27].expected, r28.eligibility.eligible === true && withheldLengthOnly.length === 1 && withheldLengthOnly[0].field === 'physical.lengthMm', JSON.stringify(withheldLengthOnly));

    var c29 = approvedRecord();
    c29.chemistry.chemistryFamily.publicDisplayRights = 'restricted';
    var r29 = sanitizeGovernedRecordForPublic(c29, governanceData());
    assertCase(rows, cases[28].name, cases[28].expected, r29.eligibility.reasonCode === 'critical_rights_not_cleared', r29.eligibility.reasonCode);

    var r30 = sanitizeGovernedRecordForPublic(approvedRecord(), governanceData());
    assertCase(rows, cases[29].name, cases[29].expected, hasProhibitedCompatibilityWording(r30) === false, JSON.stringify(r30.notAssessed));

    if (typeof console !== 'undefined' && console.table) {
      console.table(rows);
    }

    return rows;
  }

  return {
    runPublicOutputTests: runPublicOutputTests
  };
}));

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  var results = module.exports.runPublicOutputTests();
  var failed = results.filter(function (row) { return row['PASS/FAIL'] !== 'PASS'; }).length;
  if (failed > 0) process.exit(1);
}
