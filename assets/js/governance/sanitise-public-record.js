(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBSanitisePublicRecord = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROHIBITED_PATTERNS = [
    /\bcompatib/i,
    /\bequivalen/i,
    /\breplace[s]?\b/i,
    /\bsubstitut/i,
    /\binterchangeab/i,
    /\bworks\s+with\b/i,
    /\bsame\s+as\b/i,
    /\bdirect\s+replacement\b/i,
    /\brecycl/i,
    /\bdispos/i,
    /\blegal\s+advice\b/i,
    /\blegal\s+obligation\b/i
  ];

  var PROHIBITED_FIELD_TYPES = [
    'manufacturer_specific_internal_only',
    'withheld_manufacturer_specific',
    'candidate_manufacturer_specific'
  ];

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function containsProhibitedWording(value) {
    if (typeof value !== 'string') return false;
    return PROHIBITED_PATTERNS.some(function (pattern) {
      return pattern.test(value);
    });
  }

  function isFieldWithheld(field) {
    if (!isObject(field)) return false;
    if (field.publicDisplayStatus === 'withheld' || field.publicDisplayStatus === 'internal_only') return true;
    if (field.apiStatus === 'withheld' || field.apiStatus === 'internal_only') return true;
    if (PROHIBITED_FIELD_TYPES.indexOf(field.valueStatus) !== -1) return true;
    if (field.rightsStatus === 'unknown' || field.rightsStatus === 'restricted') return true;
    if (field.manufacturerSpecific === true || field.manufacturerSpecificStatus === true) return true;
    return false;
  }

  function safeFallbackForCR2032() {
    return {
      recordId: 'CR2032-internal-v2',
      publicEligibility: false,
      identification: {
        possibleCode: 'CR2032',
        status: 'under_review',
        note: 'This battery record is under internal review and has not been cleared for public display.'
      },
      compatibilityStatus: 'not_assessed',
      compatibilityNote: 'Device-specific compatibility has not been assessed.',
      evidencePending: true,
      safetyStatus: 'under_review',
      stewardshipStatus: 'no_evidence'
    };
  }

  function checkEligibility(record) {
    if (!isObject(record)) return false;
    var eligibility = record.eligibility;
    if (!isObject(eligibility)) return false;
    return eligibility.publicEligibility === true;
  }

  function sanitisePublicRecord(record, sourceMap) {
    if (!isObject(record)) {
      return {
        error: 'malformed_record',
        fallback: safeFallbackForCR2032()
      };
    }

    var eligible = checkEligibility(record);
    if (!eligible) {
      return {
        publicEligibility: false,
        fallback: safeFallbackForCR2032()
      };
    }

    var output = {};

    if (record.batteryCode && !containsProhibitedWording(record.batteryCode)) {
      output.batteryCode = record.batteryCode;
    }

    if (record.technicalIdentity && isObject(record.technicalIdentity)) {
      output.technicalIdentity = {};
      Object.keys(record.technicalIdentity).forEach(function (fieldName) {
        var field = record.technicalIdentity[fieldName];
        if (isFieldWithheld(field)) return;
        if (field.value !== null && field.value !== undefined) {
          if (containsProhibitedWording(String(field.value))) return;
          output.technicalIdentity[fieldName] = {
            value: field.value,
            unit: field.unit || null
          };
        }
      });
    }

    output.compatibilityStatus = 'not_assessed';
    output.compatibilityNote = 'Device-specific compatibility has not been assessed.';
    output.publicEligibility = true;

    return output;
  }

  function sanitisePublicRecordSafe(record, sourceMap) {
    try {
      return sanitisePublicRecord(record, sourceMap);
    } catch (e) {
      return {
        error: 'sanitiser_failure',
        fallback: safeFallbackForCR2032()
      };
    }
  }

  return {
    sanitisePublicRecord: sanitisePublicRecord,
    sanitisePublicRecordSafe: sanitisePublicRecordSafe,
    safeFallbackForCR2032: safeFallbackForCR2032,
    containsProhibitedWording: containsProhibitedWording,
    isFieldWithheld: isFieldWithheld,
    checkEligibility: checkEligibility
  };
}));
