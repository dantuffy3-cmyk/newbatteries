(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBCalculateEligibility = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALLOWED_ENUMS = ['no_evidence', 'under_review', 'partially_validated', 'reviewed', 'approved'];

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function countFieldsWithStatus(fields, statusValues) {
    if (!Array.isArray(fields)) return 0;
    var count = 0;
    fields.forEach(function (f) {
      if (f && statusValues.indexOf(f.valueStatus) !== -1) count++;
    });
    return count;
  }

  function countFieldsWithSources(fields) {
    if (!Array.isArray(fields)) return 0;
    var count = 0;
    fields.forEach(function (f) {
      if (f && Array.isArray(f.sourceIds) && f.sourceIds.length > 0 &&
          f.manufacturerSpecificStatus === false) {
        count++;
      }
    });
    return count;
  }

  function hasUnresolvedConflict(fields) {
    if (!Array.isArray(fields)) return false;
    return fields.some(function (f) {
      return f && f.conflictStatus === 'unresolved';
    });
  }

  function allSourceRightsCleared(fields, sourceMap) {
    if (!Array.isArray(fields)) return false;
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!field || !Array.isArray(field.sourceIds)) continue;
      for (var j = 0; j < field.sourceIds.length; j++) {
        var src = sourceMap[field.sourceIds[j]];
        if (!src || src.rightsStatus !== 'cleared') return false;
      }
    }
    return true;
  }

  function calculateTechnicalIdentityEligibility(techFields, sourceMap) {
    if (!Array.isArray(techFields) || techFields.length === 0) return 'no_evidence';

    var nonMfrFields = techFields.filter(function (f) {
      return f && f.manufacturerSpecificStatus === false;
    });

    if (nonMfrFields.length === 0) return 'no_evidence';

    if (hasUnresolvedConflict(nonMfrFields)) return 'under_review';

    var candidateCount = countFieldsWithSources(nonMfrFields);
    if (candidateCount === 0) return 'no_evidence';

    var allCleared = allSourceRightsCleared(nonMfrFields, sourceMap || {});
    if (!allCleared) return 'partially_validated';

    return 'reviewed';
  }

  function calculateSafetyContentEligibility(regulatoryContexts, sourceMap) {
    if (!isObject(regulatoryContexts)) return 'no_evidence';

    var hasAnySafetySource = false;
    var allContexts = Object.keys(regulatoryContexts);

    for (var i = 0; i < allContexts.length; i++) {
      var ctx = regulatoryContexts[allContexts[i]];
      if (!isObject(ctx) || !Array.isArray(ctx.fields)) continue;
      for (var j = 0; j < ctx.fields.length; j++) {
        var field = ctx.fields[j];
        if (field && Array.isArray(field.sourceIds) && field.sourceIds.length > 0) {
          hasAnySafetySource = true;
          if (field.rightsStatus !== 'cleared') return 'under_review';
        }
      }
    }

    if (!hasAnySafetySource) return 'no_evidence';
    return 'reviewed';
  }

  function calculateStewardshipEligibility(stewardshipFields) {
    if (!Array.isArray(stewardshipFields) || stewardshipFields.length === 0) return 'no_evidence';
    var hasSource = stewardshipFields.some(function (f) {
      return f && Array.isArray(f.sourceIds) && f.sourceIds.length > 0;
    });
    if (!hasSource) return 'no_evidence';
    return 'under_review';
  }

  function calculatePublicEligibility(techElig, safetyElig, stewardshipElig, compatStatus) {
    if (compatStatus !== 'not_assessed') return false;
    var allGatesMet = (
      (techElig === 'reviewed' || techElig === 'approved') &&
      (safetyElig === 'reviewed' || safetyElig === 'approved') &&
      (stewardshipElig === 'reviewed' || stewardshipElig === 'approved')
    );
    return allGatesMet;
  }

  function calculateEligibility(bundle) {
    if (!isObject(bundle)) {
      return {
        technicalIdentityEligibility: 'no_evidence',
        safetyContentEligibility: 'no_evidence',
        stewardshipContentEligibility: 'no_evidence',
        compatibilityStatus: 'not_assessed',
        publicEligibility: false,
        calculationError: 'bundle must be an object'
      };
    }

    var sourceMap = {};
    if (Array.isArray(bundle.sources)) {
      bundle.sources.forEach(function (src) {
        if (src && src.sourceId) sourceMap[src.sourceId] = src;
      });
    }

    var techElig = calculateTechnicalIdentityEligibility(
      bundle.technicalEvidenceFields || [],
      sourceMap
    );

    var safetyElig = calculateSafetyContentEligibility(
      bundle.regulatoryContexts || {},
      sourceMap
    );

    var stewardshipElig = calculateStewardshipEligibility(
      bundle.stewardshipFields || []
    );

    var compatStatus = 'not_assessed';

    var publicElig = calculatePublicEligibility(techElig, safetyElig, stewardshipElig, compatStatus);

    return {
      technicalIdentityEligibility: techElig,
      safetyContentEligibility: safetyElig,
      stewardshipContentEligibility: stewardshipElig,
      compatibilityStatus: compatStatus,
      publicEligibility: publicElig
    };
  }

  return {
    calculateEligibility: calculateEligibility,
    calculateTechnicalIdentityEligibility: calculateTechnicalIdentityEligibility,
    calculateSafetyContentEligibility: calculateSafetyContentEligibility,
    calculateStewardshipEligibility: calculateStewardshipEligibility,
    calculatePublicEligibility: calculatePublicEligibility
  };
}));
