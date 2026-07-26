(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data-governance-validator.js'));
  } else {
    root.NBGovernanceTests = factory(root.NBGovernanceValidator);
  }
}(typeof self !== 'undefined' ? self : this, function (validatorModule) {
  'use strict';

  var validateBatteryRecord = validatorModule.validateBatteryRecord;

  var governanceData = {
    sourceRegister: {
      sources: [
        {
          sourceId: 'SRC-CLASS-MFG-CATALOGUE-001',
          authorityLevel: 1,
          publiclyViewable: true,
          usageRights: ['publicly_viewable', 'unknown'],
          commercialReuseEvidence: null
        },
        {
          sourceId: 'SRC-AU-ACCC-001',
          authorityLevel: 2,
          publiclyViewable: true,
          usageRights: ['publicly_viewable', 'unknown'],
          commercialReuseEvidence: null
        }
      ]
    },
    recordReviewStatuses: {
      statuses: {
        draft: { permittedTransitions: ['under_review', 'retired'] },
        under_review: { permittedTransitions: ['reviewed', 'disputed', 'deprecated', 'retired'] },
        reviewed: { permittedTransitions: ['approved', 'disputed', 'deprecated', 'under_review', 'retired'] },
        approved: { permittedTransitions: ['disputed', 'deprecated', 'retired'] },
        disputed: { permittedTransitions: ['under_review', 'reviewed', 'deprecated', 'retired'] },
        deprecated: { permittedTransitions: ['retired'] },
        retired: { permittedTransitions: [] }
      }
    },
    categoryProfiles: {
      coin_cell: {
        requiredFields: [
          'identification.canonicalCode',
          'identification.category',
          'physical.diameterMm',
          'physical.thicknessMm',
          'electrical.nominalVoltage',
          'chemistry.chemistryFamily'
        ]
      }
    }
  };

  function tf(value, unit, sourceIds, confidence, conflictStatus) {
    return {
      value: value,
      unit: unit,
      evidenceConfidence: confidence || 'unknown',
      sourceIds: sourceIds || [],
      verifiedAt: null,
      verifiedBy: null,
      notes: '',
      conflict: {
        status: conflictStatus || 'none',
        acceptedValue: value,
        competingValues: [],
        resolutionNotes: null,
        reviewer: null,
        resolvedAt: null
      }
    };
  }

  function baseRecord() {
    return {
      identification: {
        recordId: 'rec-coin-cr2032-draft',
        canonicalCode: 'CR2032',
        category: 'coin_cell',
        aliases: []
      },
      physical: {
        diameterMm: tf(20, 'mm', ['SRC-CLASS-MFG-CATALOGUE-001'], 'high'),
        thicknessMm: tf(3.2, 'mm', ['SRC-CLASS-MFG-CATALOGUE-001'], 'high'),
        lengthMm: tf(null, 'mm', [], 'unknown'),
        widthMm: tf(null, 'mm', [], 'unknown'),
        heightMm: tf(null, 'mm', [], 'unknown')
      },
      electrical: {
        nominalVoltage: tf(3, 'V', ['SRC-CLASS-MFG-CATALOGUE-001'], 'high')
      },
      chemistry: {
        chemistryFamily: tf('lithium_primary', null, ['SRC-CLASS-MFG-CATALOGUE-001'], 'medium')
      },
      australianContext: {},
      replacementPathway: {},
      recordGovernance: {
        recordStatus: 'draft',
        previousStatus: null,
        createdAt: '2026-07-26',
        updatedAt: '2026-07-26',
        version: '0.1.0',
        approvedAt: null,
        approvedBy: null
      }
    };
  }

  function run() {
    var tests = [];

    tests.push({
      name: 'valid draft with unknown fields',
      expected: 'valid=true',
      actual: (function () {
        var r = validateBatteryRecord(baseRecord(), governanceData);
        return 'valid=' + r.valid;
      }())
    });

    tests.push({
      name: 'invalid approved without evidence',
      expected: 'valid=false',
      actual: (function () {
        var rec = baseRecord();
        rec.recordGovernance.recordStatus = 'approved';
        rec.recordGovernance.previousStatus = 'reviewed';
        rec.recordGovernance.approvedAt = null;
        rec.recordGovernance.approvedBy = null;
        rec.physical.diameterMm.sourceIds = [];
        rec.physical.diameterMm.evidenceConfidence = 'unknown';
        rec.physical.thicknessMm.sourceIds = [];
        rec.physical.thicknessMm.evidenceConfidence = 'unknown';
        rec.electrical.nominalVoltage.sourceIds = [];
        rec.electrical.nominalVoltage.evidenceConfidence = 'unknown';
        rec.chemistry.chemistryFamily.sourceIds = [];
        rec.chemistry.chemistryFamily.evidenceConfidence = 'unknown';
        var r = validateBatteryRecord(rec, governanceData);
        return 'valid=' + r.valid;
      }())
    });

    tests.push({
      name: 'nonexistent source reference',
      expected: 'contains unknown source error',
      actual: (function () {
        var rec = baseRecord();
        rec.electrical.nominalVoltage.sourceIds = ['SRC-NOT-REAL-001'];
        var r = validateBatteryRecord(rec, governanceData);
        return r.errors.join(' | ');
      }())
    });

    tests.push({
      name: 'unsupported evidence-confidence',
      expected: 'contains unsupported confidence error',
      actual: (function () {
        var rec = baseRecord();
        rec.electrical.nominalVoltage.evidenceConfidence = 'certain';
        var r = validateBatteryRecord(rec, governanceData);
        return r.errors.join(' | ');
      }())
    });

    tests.push({
      name: 'placeholder technical data',
      expected: 'contains placeholder/zero-dimension error',
      actual: (function () {
        var rec = baseRecord();
        rec.physical.diameterMm.value = 0;
        rec.chemistry.chemistryFamily.value = 'TBD';
        var r = validateBatteryRecord(rec, governanceData);
        return r.errors.join(' | ');
      }())
    });

    tests.push({
      name: 'source conflict',
      expected: 'warning includes unresolved source conflict',
      actual: (function () {
        var rec = baseRecord();
        rec.physical.diameterMm.conflict.status = 'unresolved';
        var r = validateBatteryRecord(rec, governanceData);
        return r.warnings.join(' | ');
      }())
    });

    tests.push({
      name: 'approved with valid evidence',
      expected: 'valid=true',
      actual: (function () {
        var rec = baseRecord();
        rec.recordGovernance.previousStatus = 'reviewed';
        rec.recordGovernance.recordStatus = 'approved';
        rec.recordGovernance.approvedAt = '2026-07-26';
        rec.recordGovernance.approvedBy = 'reviewer@example.com';
        var r = validateBatteryRecord(rec, governanceData);
        return 'valid=' + r.valid;
      }())
    });

    tests.push({
      name: 'prohibited status transition',
      expected: 'contains transition error',
      actual: (function () {
        var rec = baseRecord();
        rec.recordGovernance.previousStatus = 'retired';
        rec.recordGovernance.recordStatus = 'approved';
        var r = validateBatteryRecord(rec, governanceData);
        return r.errors.join(' | ');
      }())
    });

    tests.push({
      name: 'missing category-required fields',
      expected: 'contains missing category-required field error',
      actual: (function () {
        var rec = baseRecord();
        rec.physical.diameterMm.value = null;
        var r = validateBatteryRecord(rec, governanceData);
        return r.errors.join(' | ');
      }())
    });

    tests.push({
      name: 'publicly viewable source incorrectly marked commercially reusable without evidence',
      expected: 'contains rights/evidence error',
      actual: (function () {
        var rec = baseRecord();
        var badGovernance = JSON.parse(JSON.stringify(governanceData));
        badGovernance.sourceRegister.sources[0].usageRights = ['publicly_viewable', 'commercial_reuse_permitted'];
        badGovernance.sourceRegister.sources[0].commercialReuseEvidence = null;
        var r = validateBatteryRecord(rec, badGovernance);
        return r.errors.join(' | ');
      }())
    });

    var withStatus = tests.map(function (t) {
      var pass = false;
      if (t.expected === 'valid=true') pass = t.actual === 'valid=true';
      else if (t.expected === 'valid=false') pass = t.actual === 'valid=false';
      else if (t.expected.indexOf('unknown source error') !== -1) pass = /Unknown sourceId/.test(t.actual);
      else if (t.expected.indexOf('unsupported confidence') !== -1) pass = /Unsupported evidence confidence/.test(t.actual);
      else if (t.expected.indexOf('placeholder/zero-dimension') !== -1) pass = /Placeholder value disallowed|Zero dimension placeholder/.test(t.actual);
      else if (t.expected.indexOf('unresolved source conflict') !== -1) pass = /Unresolved source conflict/.test(t.actual);
      else if (t.expected.indexOf('transition error') !== -1) pass = /Prohibited status transition/.test(t.actual);
      else if (t.expected.indexOf('missing category-required field') !== -1) pass = /Category-required field cannot be unknown|Missing category-required field/.test(t.actual);
      else if (t.expected.indexOf('rights/evidence error') !== -1) pass = /commercially reusable without explicit evidence/.test(t.actual);

      return {
        Test: t.name,
        Expected: t.expected,
        Actual: t.actual,
        Result: pass ? 'PASS' : 'FAIL'
      };
    });

    if (typeof document !== 'undefined' && document.body) {
      var table = document.createElement('table');
      table.border = '1';
      var header = document.createElement('tr');
      ['Test', 'Expected', 'Actual', 'PASS/FAIL'].forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        header.appendChild(th);
      });
      table.appendChild(header);

      withStatus.forEach(function (row) {
        var tr = document.createElement('tr');
        [row.Test, row.Expected, row.Actual, row.Result].forEach(function (cell) {
          var td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });

      document.body.appendChild(table);
    }

    if (typeof console !== 'undefined' && console.table) {
      console.table(withStatus);
    }

    return withStatus;
  }

  return {
    runGovernanceTests: run,
    governanceData: governanceData,
    baseRecord: baseRecord
  };
}));

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  var results = module.exports.runGovernanceTests();
  var failed = results.filter(function (r) { return r.Result !== 'PASS'; }).length;
  if (failed > 0) process.exit(1);
}
