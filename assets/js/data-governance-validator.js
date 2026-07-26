(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBGovernanceValidator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VALID_CONFIDENCE = ['low', 'medium', 'high', 'unknown'];
  var VALID_AUTHORITY_LEVELS = [1,2,3,4,5,6,7,8,9,10];
  var VALID_RIGHTS = [
    'publicly_viewable',
    'downloadable',
    'openly_licensed',
    'commercial_reuse_permitted',
    'commercial_reuse_restricted',
    'agreement_required',
    'automated_access_restricted',
    'unknown'
  ];
  var INVALID_PLACEHOLDERS = ['tbd', 'guess'];
  var VALID_CONFLICT_STATUS = ['none', 'unresolved', 'resolved', 'source_superseded', 'category_variant'];
  var DIMENSION_PATHS = ['physical.lengthMm','physical.widthMm','physical.heightMm','physical.diameterMm','physical.thicknessMm'];
  var UNIT_REQUIRED_PATHS = {
    'physical.lengthMm': 'mm',
    'physical.widthMm': 'mm',
    'physical.heightMm': 'mm',
    'physical.diameterMm': 'mm',
    'physical.thicknessMm': 'mm',
    'physical.weightKg': 'kg',
    'electrical.nominalVoltage': 'V',
    'electrical.capacityAh': 'Ah',
    'electrical.capacityMah': 'mAh',
    'electrical.cca': 'A',
    'electrical.reserveCapacityMinutes': 'minutes',
    'electrical.continuousDischargeA': 'A',
    'electrical.peakDischargeA': 'A'
  };

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce(function (acc, part) {
      return acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined;
    }, obj);
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasMeaningfulEvidence(field) {
    return isObject(field)
      && field.value !== null
      && Array.isArray(field.sourceIds)
      && field.sourceIds.length > 0
      && VALID_CONFIDENCE.indexOf(field.evidenceConfidence) !== -1
      && field.evidenceConfidence !== 'unknown';
  }

  function validateBatteryRecord(record, governanceData) {
    var data = governanceData || {};
    var sourceRegister = Array.isArray(data.sourceRegister)
      ? data.sourceRegister
      : (data.sourceRegister && Array.isArray(data.sourceRegister.sources) ? data.sourceRegister.sources : []);
    var categoryProfiles = data.categoryProfiles || (data.schema && data.schema.categoryProfiles) || {};
    var reviewStatuses = (data.recordReviewStatuses && data.recordReviewStatuses.statuses) || data.recordReviewStatuses || {};

    var sourceMap = {};
    sourceRegister.forEach(function (src) {
      if (src && src.sourceId) sourceMap[src.sourceId] = src;
    });

    var errors = [];
    var warnings = [];
    var unknowns = [];
    var governanceStatus = getByPath(record, 'recordGovernance.recordStatus') || 'draft';

    if (!isObject(record)) {
      return { valid: false, errors: ['Record must be an object'], warnings: [], unknowns: [], governanceStatus: 'draft' };
    }

    [
      'identification.recordId',
      'identification.canonicalCode',
      'identification.category',
      'recordGovernance.recordStatus',
      'recordGovernance.reviewDueAt',
      'recordGovernance.approvedAt',
      'recordGovernance.approvedBy',
      'recordGovernance.reviewNotes',
      'recordGovernance.publicEligibility',
      'recordGovernance.compatibilityEngineEligibility'
    ].forEach(function (path) {
      var v = getByPath(record, path);
      if (v === undefined || v === '') errors.push('Missing required field: ' + path);
    });

    var status = getByPath(record, 'recordGovernance.recordStatus');
    var previousStatus = getByPath(record, 'recordGovernance.previousStatus');
    if (previousStatus && reviewStatuses[previousStatus]) {
      var transitions = reviewStatuses[previousStatus].permittedTransitions || [];
      if (transitions.indexOf(status) === -1) {
        errors.push('Prohibited status transition: ' + previousStatus + ' -> ' + status);
      }
    }

    if ((status === 'draft' || status === 'under_review' || status === 'reviewed') && (record.isVerified === true || record.publicVerificationLabel === 'approved')) {
      errors.push(status + ' record cannot be presented as approved/verified');
    }

    if (status !== 'approved') {
      if (getByPath(record, 'recordGovernance.approvedAt')) errors.push('Non-approved record cannot include recordGovernance.approvedAt');
      if (getByPath(record, 'recordGovernance.approvedBy')) errors.push('Non-approved record cannot include recordGovernance.approvedBy');
    }

    if (status === 'under_review') {
      if (getByPath(record, 'recordGovernance.publicEligibility') !== false) {
        errors.push('Under-review record must keep recordGovernance.publicEligibility=false');
      }
      if (getByPath(record, 'recordGovernance.compatibilityEngineEligibility') !== false) {
        errors.push('Under-review record must keep recordGovernance.compatibilityEngineEligibility=false');
      }
    }

    Object.keys(sourceMap).forEach(function (sourceId) {
      var source = sourceMap[sourceId];
      if (VALID_AUTHORITY_LEVELS.indexOf(source.authorityLevel) === -1) {
        errors.push('Source has invalid authority level: ' + sourceId);
      }
      var rights = Array.isArray(source.usageRights) ? source.usageRights : [];
      rights.forEach(function (right) {
        if (VALID_RIGHTS.indexOf(right) === -1) {
          errors.push('Source has invalid usage right (' + right + '): ' + sourceId);
        }
      });
      if (source.publiclyViewable === true && rights.indexOf('commercial_reuse_permitted') !== -1 && !source.commercialReuseEvidence) {
        errors.push('Publicly viewable source marked commercially reusable without explicit evidence: ' + sourceId);
      }
    });

    var techPaths = [
      'physical.lengthMm','physical.widthMm','physical.heightMm','physical.diameterMm','physical.thicknessMm',
      'physical.terminalType','physical.terminalLayout','physical.polarityOrientation','physical.connectorGeometry','physical.connectorKeying',
      'physical.holdDownType','physical.baseProfile','physical.mountingProfile','physical.weightKg',
      'electrical.nominalVoltage','electrical.capacityAh','electrical.capacityMah','electrical.capacityTestConditions',
      'electrical.cca','electrical.ccaTestStandard','electrical.reserveCapacityMinutes','electrical.continuousDischargeA','electrical.peakDischargeA','electrical.rechargeable',
      'chemistry.chemistryFamily','chemistry.chemistrySubtype','chemistry.chargingProfile','chemistry.bmsRequired','chemistry.batteryCommunicationRequired',
      'australianContext.australianAvailability','australianContext.cecListingRelevant','australianContext.cecListingStatus','australianContext.eessRelevant','australianContext.recallStatus','australianContext.specialistInstallationRequired','australianContext.recyclingPathway','australianContext.stateSpecificRequirementsPossible',
      'replacementPathway.consumerReplaceable','replacementPathway.supplierConfirmationRequired','replacementPathway.manufacturerConfirmationRequired','replacementPathway.qualifiedInstallerRequired','replacementPathway.specialistOnly'
    ];

    var hasApprovedEvidence = false;
    var referencedSourceIds = [];

    techPaths.forEach(function (path) {
      var field = getByPath(record, path);
      if (field === undefined || field === null) {
        unknowns.push(path);
        return;
      }
      if (!isObject(field)) {
        errors.push('Technical field must use provenance envelope: ' + path);
        return;
      }

      var value = field.value;
      var unit = field.unit;
      var confidence = field.evidenceConfidence;
      var sourceIds = Array.isArray(field.sourceIds) ? field.sourceIds : [];

      if (value === null) unknowns.push(path);
      if (typeof value === 'string' && INVALID_PLACEHOLDERS.indexOf(value.trim().toLowerCase()) !== -1) {
        errors.push('Placeholder value disallowed at ' + path + ': ' + value);
      }

      if (DIMENSION_PATHS.indexOf(path) !== -1 && typeof value === 'number' && value <= 0) {
        errors.push('Non-positive dimension disallowed at ' + path);
      }

      if (VALID_CONFIDENCE.indexOf(confidence) === -1) {
        errors.push('Unsupported evidence confidence at ' + path + ': ' + confidence);
      }

      sourceIds.forEach(function (sourceId) {
        if (!sourceMap[sourceId]) {
          errors.push('Unknown sourceId referenced at ' + path + ': ' + sourceId);
        }
        if (/^SRC-FAKE/i.test(sourceId)) {
          errors.push('Fake source ID disallowed at ' + path + ': ' + sourceId);
        }
        if (referencedSourceIds.indexOf(sourceId) === -1) {
          referencedSourceIds.push(sourceId);
        }
      });

      if (value !== null && Object.prototype.hasOwnProperty.call(UNIT_REQUIRED_PATHS, path) && !unit) {
        errors.push('Missing required unit at ' + path);
      }

      if (value !== null && sourceIds.length > 0 && confidence !== 'unknown' && !field.verifiedAt) {
        errors.push('Supported technical field missing verifiedAt at ' + path);
      }

      var conflict = field.conflict;
      if (isObject(conflict)) {
        if (VALID_CONFLICT_STATUS.indexOf(conflict.status) === -1) {
          errors.push('Unsupported conflict status at ' + path + ': ' + conflict.status);
        }
        if (conflict.status === 'unresolved') {
          warnings.push('Unresolved source conflict at ' + path);
        }
      }

      if (hasMeaningfulEvidence(field)) hasApprovedEvidence = true;
    });

    var publicEligibility = getByPath(record, 'recordGovernance.publicEligibility');
    if (publicEligibility === true) {
      referencedSourceIds.forEach(function (sourceId) {
        var source = sourceMap[sourceId];
        if (source && Array.isArray(source.usageRights) && source.usageRights.indexOf('unknown') !== -1) {
          errors.push('Public eligibility cannot be true while source reuse rights are unknown: ' + sourceId);
        }
      });
    }

    var category = getByPath(record, 'identification.category');
    var profile = categoryProfiles[category];
    if (profile && Array.isArray(profile.requiredFields)) {
      profile.requiredFields.forEach(function (requiredPath) {
        var requiredField = getByPath(record, requiredPath);
        if (requiredField === undefined || requiredField === null) {
          errors.push('Missing category-required field: ' + requiredPath);
        } else if (isObject(requiredField) && requiredField.value === null) {
          if (status === 'approved') {
            errors.push('Category-required field cannot be unknown: ' + requiredPath);
          } else {
            warnings.push('Category-required field remains unknown under ' + status + ': ' + requiredPath);
          }
        }
      });
    }

    if (status === 'approved') {
      if (!hasApprovedEvidence) errors.push('Approved record must include supported evidence on technical fields');
      if (!getByPath(record, 'recordGovernance.approvedAt')) errors.push('Approved record missing recordGovernance.approvedAt');
      if (!getByPath(record, 'recordGovernance.approvedBy')) errors.push('Approved record missing recordGovernance.approvedBy');
    }

    if (status === 'under_review') {
      warnings.push('Under-review records cannot produce definitive compatibility claims');
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      unknowns: unknowns,
      governanceStatus: status || 'draft'
    };
  }

  return {
    validateBatteryRecord: validateBatteryRecord,
    constants: {
      VALID_CONFIDENCE: VALID_CONFIDENCE,
      VALID_AUTHORITY_LEVELS: VALID_AUTHORITY_LEVELS,
      VALID_RIGHTS: VALID_RIGHTS
    }
  };
}));
