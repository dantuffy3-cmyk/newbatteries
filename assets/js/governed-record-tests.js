(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./data-governance-validator.js'),
      require('../../data/source-register.json'),
      require('../../data/record-review-statuses.json'),
      require('../../data/battery-record-schema.json'),
      require('../../data/governed-record-tests.json'),
      {
        cr2032: require('../../data/governed-records/cr2032.json'),
        lr44: require('../../data/governed-records/lr44.json'),
        ln2Flooded: require('../../data/governed-records/ln2-flooded.json'),
        index: require('../../data/governed-records/index.json')
      }
    );
  } else {
    root.NBGovernedRecordTests = factory(root.NBGovernanceValidator, root.NBSourceRegister, root.NBReviewStatuses, root.NBBatteryRecordSchema, root.NBGovernedRecordTestsManifest, root.NBGovernedRecords);
  }
}(typeof self !== 'undefined' ? self : this, function (validatorModule, sourceRegister, reviewStatuses, schema, manifest, recordBundle) {
  'use strict';

  var validateBatteryRecord = validatorModule.validateBatteryRecord;

  function getByPath(obj, path) {
    return path.split('.').reduce(function (acc, part) {
      return acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined;
    }, obj);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadRecords() {
    return [
      recordBundle.cr2032,
      recordBundle.lr44,
      recordBundle.ln2Flooded
    ];
  }

  function governanceData() {
    return {
      sourceRegister: sourceRegister,
      recordReviewStatuses: reviewStatuses,
      categoryProfiles: schema.categoryProfiles
    };
  }

  function assert(testName, condition, actual) {
    return {
      Test: testName,
      Actual: actual,
      Result: condition ? 'PASS' : 'FAIL'
    };
  }

  function hasAnyDirectEquivalent(record, code) {
    var claims = (record.relationshipGovernance && record.relationshipGovernance.directEquivalentClaims) || [];
    return claims.indexOf(code) !== -1;
  }

  function run() {
    var tests = [];
    var records = loadRecords();
    var govData = governanceData();
    var sourceIds = {};
    (sourceRegister.sources || []).forEach(function (src) { sourceIds[src.sourceId] = true; });

    tests.push(assert(
      'governed index contains only expected summary fields',
      Array.isArray(recordBundle.index.records) && recordBundle.index.records.every(function (row) {
        var keys = Object.keys(row).sort();
        return JSON.stringify(keys) === JSON.stringify([
          'canonicalName',
          'category',
          'compatibilityEngineEligibility',
          'lastReviewedDate',
          'outstandingEvidenceCount',
          'publicEligibility',
          'recordId',
          'recordType',
          'status'
        ]);
      }),
      JSON.stringify(recordBundle.index.records.map(function (row) { return Object.keys(row).sort(); }))
    ));

    manifest.recordFiles.forEach(function (entry) {
      var record = records.filter(function (candidate) {
        return candidate.identification && candidate.identification.recordId === entry.recordId;
      })[0];
      var result = validateBatteryRecord(record, govData);

      tests.push(assert(entry.canonicalName + ' validates as under-review governed record', result.valid === true, JSON.stringify(result)));
      tests.push(assert(entry.canonicalName + ' status is under_review', record.recordGovernance.recordStatus === 'under_review', record.recordGovernance.recordStatus));
      tests.push(assert(entry.canonicalName + ' public eligibility false', record.recordGovernance.publicEligibility === false, String(record.recordGovernance.publicEligibility)));
      tests.push(assert(entry.canonicalName + ' compatibility eligibility false', record.recordGovernance.compatibilityEngineEligibility === false, String(record.recordGovernance.compatibilityEngineEligibility)));
      tests.push(assert(entry.canonicalName + ' record type matches manifest', record.recordType === entry.recordType, record.recordType));
      tests.push(assert(entry.canonicalName + ' category matches manifest', record.identification.category === entry.category, record.identification.category));
      tests.push(assert(entry.canonicalName + ' is not approved', record.recordGovernance.approvedAt === null && record.recordGovernance.approvedBy === null, JSON.stringify({ approvedAt: record.recordGovernance.approvedAt, approvedBy: record.recordGovernance.approvedBy })));
      tests.push(assert(entry.canonicalName + ' relationship classification remains insufficient evidence', record.relationshipGovernance.classification === entry.requiredRelationshipClassification, record.relationshipGovernance.classification));

      Object.keys(record).forEach(function () {});

      [
        'physical.lengthMm','physical.widthMm','physical.heightMm','physical.diameterMm','physical.thicknessMm',
        'physical.terminalType','physical.terminalLayout','physical.polarityOrientation','physical.connectorGeometry','physical.connectorKeying',
        'physical.holdDownType','physical.baseProfile','physical.mountingProfile','physical.weightKg',
        'electrical.nominalVoltage','electrical.capacityAh','electrical.capacityMah','electrical.capacityTestConditions',
        'electrical.cca','electrical.ccaTestStandard','electrical.reserveCapacityMinutes','electrical.continuousDischargeA','electrical.peakDischargeA','electrical.rechargeable',
        'chemistry.chemistryFamily','chemistry.chemistrySubtype','chemistry.chargingProfile','chemistry.bmsRequired','chemistry.batteryCommunicationRequired',
        'australianContext.australianAvailability','australianContext.cecListingRelevant','australianContext.cecListingStatus','australianContext.eessRelevant','australianContext.recallStatus','australianContext.specialistInstallationRequired','australianContext.recyclingPathway','australianContext.stateSpecificRequirementsPossible',
        'replacementPathway.consumerReplaceable','replacementPathway.supplierConfirmationRequired','replacementPathway.manufacturerConfirmationRequired','replacementPathway.qualifiedInstallerRequired','replacementPathway.specialistOnly'
      ].forEach(function (path) {
        var field = getByPath(record, path);
        var name = entry.canonicalName + ' provenance envelope at ' + path;
        tests.push(assert(name, !!field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value') && Object.prototype.hasOwnProperty.call(field, 'sourceIds') && Object.prototype.hasOwnProperty.call(field, 'verifiedAt'), JSON.stringify(field)));

        if (field && field.value !== null) {
          tests.push(assert(
            entry.canonicalName + ' populated sources exist at ' + path,
            Array.isArray(field.sourceIds) && field.sourceIds.every(function (sourceId) { return sourceIds[sourceId] === true; }),
            JSON.stringify(field.sourceIds)
          ));
          tests.push(assert(
            entry.canonicalName + ' populated fields have verifiedAt at ' + path,
            field.verifiedAt !== null,
            String(field.verifiedAt)
          ));
          if (/Mm$/.test(path) && typeof field.value === 'number') {
            tests.push(assert(entry.canonicalName + ' positive dimension at ' + path, field.value > 0, String(field.value)));
          }
          if (typeof field.value === 'string') {
            tests.push(assert(entry.canonicalName + ' no placeholder at ' + path, !/^(tbd|guess)$/i.test(field.value), field.value));
          }
        } else {
          tests.push(assert(entry.canonicalName + ' unknown fields use null at ' + path, field && field.value === null, JSON.stringify(field)));
        }
      });

      entry.requiredNullFields.forEach(function (path) {
        var field = getByPath(record, path);
        tests.push(assert(entry.canonicalName + ' required null field ' + path, field && field.value === null, JSON.stringify(field)));
      });

      entry.requiredRiskPhrases.forEach(function (phrase) {
        var haystack = JSON.stringify(record.relationshipGovernance) + ' ' + JSON.stringify(record.limitations) + ' ' + JSON.stringify(record.safetyContext || {}) + ' ' + JSON.stringify(record.familyScope || {});
        tests.push(assert(entry.canonicalName + ' documents risk phrase ' + phrase, haystack.toLowerCase().indexOf(String(phrase).toLowerCase()) !== -1, haystack));
      });

      entry.prohibitedDirectEquivalentClaims.forEach(function (code) {
        tests.push(assert(entry.canonicalName + ' does not claim direct equivalence to ' + code, !hasAnyDirectEquivalent(record, code), JSON.stringify((record.relationshipGovernance && record.relationshipGovernance.directEquivalentClaims) || [])));
      });

      entry.criticalFields.forEach(function (path) {
        var mutated = clone(record);
        var field = getByPath(mutated, path);
        mutated.recordGovernance.recordStatus = 'approved';
        mutated.recordGovernance.previousStatus = 'reviewed';
        mutated.recordGovernance.approvedAt = '2026-07-26';
        mutated.recordGovernance.approvedBy = 'reviewer@example.com';
        if (field && typeof field === 'object') {
          field.value = null;
          field.sourceIds = [];
          field.evidenceConfidence = 'unknown';
          field.verifiedAt = null;
          field.conflict.acceptedValue = null;
        }
        var mutatedResult = validateBatteryRecord(mutated, govData);
        tests.push(assert(entry.canonicalName + ' missing critical field blocks approval at ' + path, mutatedResult.valid === false, JSON.stringify(mutatedResult.errors)));
      });
    });

    var cr2032 = recordBundle.cr2032;
    tests.push(assert('CR2032 standard-size classification valid', cr2032.recordType === 'standard_size' && cr2032.identification.category === 'coin_cell', JSON.stringify({ recordType: cr2032.recordType, category: cr2032.identification.category })));
    tests.push(assert('CR2032 thickness risk documented', JSON.stringify(cr2032.relationshipGovernance).toLowerCase().indexOf('thickness') !== -1, JSON.stringify(cr2032.relationshipGovernance)));

    var lr44 = recordBundle.lr44;
    tests.push(assert('LR44 standard-size classification valid', lr44.recordType === 'standard_size' && lr44.identification.category === 'button_cell', JSON.stringify({ recordType: lr44.recordType, category: lr44.identification.category })));
    tests.push(assert('LR44 chemistry governed distinct from SR44', (lr44.relationshipGovernance.separateRecords || []).indexOf('SR44') !== -1, JSON.stringify(lr44.relationshipGovernance.separateRecords)));
    tests.push(assert('LR44 AG13 not stored as direct equivalent or live alias', ((lr44.identification.aliases || []).indexOf('AG13') === -1) && !hasAnyDirectEquivalent(lr44, 'AG13'), JSON.stringify({ aliases: lr44.identification.aliases, directEquivalentClaims: lr44.relationshipGovernance.directEquivalentClaims })));

    var ln2 = recordBundle.ln2Flooded;
    tests.push(assert('LN2 flooded family classification valid', ln2.recordType === 'chemistry_specific_family' && ln2.identification.category === 'automotive_12v', JSON.stringify({ recordType: ln2.recordType, category: ln2.identification.category })));
    tests.push(assert('LN2 flooded documents AGM and EFB distinction', JSON.stringify(ln2.relationshipGovernance).indexOf('AGM') !== -1 && JSON.stringify(ln2.relationshipGovernance).indexOf('EFB') !== -1, JSON.stringify(ln2.relationshipGovernance)));
    tests.push(assert('LN2 flooded has no vehicle fitment mappings', Array.isArray(ln2.vehicleFitmentMappings) && ln2.vehicleFitmentMappings.length === 0, JSON.stringify(ln2.vehicleFitmentMappings)));
    tests.push(assert('LN2 flooded has no universal capacity or CCA', ln2.electrical.capacityAh.value === null && ln2.electrical.cca.value === null && ln2.electrical.reserveCapacityMinutes.value === null, JSON.stringify({ capacityAh: ln2.electrical.capacityAh.value, cca: ln2.electrical.cca.value, reserveCapacityMinutes: ln2.electrical.reserveCapacityMinutes.value })));
    tests.push(assert('LN2 flooded has no direct DIN equivalence claim', !hasAnyDirectEquivalent(ln2, 'DIN'), JSON.stringify(ln2.relationshipGovernance.directEquivalentClaims)));

    tests.push(assert(
      '357 is not a universal LR44 alias',
      (lr44.identification.aliases || []).indexOf('357') === -1 &&
      !hasAnyDirectEquivalent(lr44, '357') &&
      (function () {
        var notes = lr44.relationshipGovernance.candidateAliasNotes || [];
        var entry = notes.filter(function (n) { return n.code === '357'; })[0];
        return !entry || entry.status === 'not_a_universal_lr44_alias';
      }()),
      JSON.stringify({
        inAliases: (lr44.identification.aliases || []).indexOf('357') !== -1,
        inDirectEquivalents: hasAnyDirectEquivalent(lr44, '357'),
        candidateStatus: (function () {
          var notes = lr44.relationshipGovernance.candidateAliasNotes || [];
          var e = notes.filter(function (n) { return n.code === '357'; })[0];
          return e ? e.status : 'not_present';
        }())
      })
    ));

    tests.push(assert(
      'SR44 is not a direct LR44 equivalent',
      !hasAnyDirectEquivalent(lr44, 'SR44') && (lr44.relationshipGovernance.separateRecords || []).indexOf('SR44') !== -1,
      JSON.stringify({ directEquivalents: lr44.relationshipGovernance.directEquivalentClaims, separateRecords: lr44.relationshipGovernance.separateRecords })
    ));

    tests.push(assert(
      'LN2 secondary-source-only fields cannot pass approval when publicEligibility is true',
      (function () {
        var mutated = clone(ln2);
        mutated.recordGovernance.recordStatus = 'approved';
        mutated.recordGovernance.previousStatus = 'reviewed';
        mutated.recordGovernance.approvedAt = '2026-07-26';
        mutated.recordGovernance.approvedBy = 'reviewer@example.com';
        mutated.recordGovernance.publicEligibility = true;
        var result = validateBatteryRecord(mutated, govData);
        return result.valid === false && result.errors.some(function (e) { return /Public eligibility cannot be true while source reuse rights are unknown/.test(e); });
      }()),
      'Validator must reject publicEligibility=true when LN2 sources have unknown reuse rights'
    ));

    tests.push(assert(
      'unknown public-display rights block public eligibility',
      (function () {
        var records = loadRecords();
        return records.every(function (record) {
          var mutated = clone(record);
          mutated.recordGovernance.previousStatus = 'reviewed';
          mutated.recordGovernance.recordStatus = 'approved';
          mutated.recordGovernance.approvedAt = '2026-07-26';
          mutated.recordGovernance.approvedBy = 'reviewer@example.com';
          mutated.recordGovernance.publicEligibility = true;
          var result = validateBatteryRecord(mutated, govData);
          return result.valid === false && result.errors.some(function (e) { return /Public eligibility cannot be true while source reuse rights are unknown/.test(e); });
        });
      }()),
      'All governed records must fail validation when publicEligibility=true because sources have unknown reuse rights'
    ));

    if (typeof console !== 'undefined' && console.table) {
      console.table(tests);
    }

    return tests;
  }

  return {
    runGovernedRecordTests: run
  };
}));

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  var results = module.exports.runGovernedRecordTests();
  var failed = results.filter(function (r) { return r.Result !== 'PASS'; }).length;
  if (failed > 0) process.exit(1);
}
