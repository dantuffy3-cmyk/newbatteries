(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBBatteryRecordStore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'nb_saved_identity_record_v1';
  var SCHEMA_VERSION = 1;
  var TOP_LEVEL_KEYS = [
    'schemaVersion',
    'savedAt',
    'enteredCode',
    'canonicalCode',
    'category',
    'identificationConfidence',
    'evidenceSummary',
    'unknowns',
    'warnings',
    'verificationRequired',
    'nextEvidence'
  ];
  var NEXT_EVIDENCE_KEYS = ['title', 'instruction', 'whyItMatters'];
  var ALLOWED_IDENTIFICATION_CONFIDENCE = ['exact', 'family', 'unknown'];

  function hasOnlyAllowedKeys(obj, allowedKeys) {
    var keys = Object.keys(obj || {});
    var i;
    for (i = 0; i < keys.length; i++) {
      if (allowedKeys.indexOf(keys[i]) === -1) return false;
    }
    return true;
  }

  function asArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function stringArrayOnly(value) {
    return asArray(value).filter(function (item) { return typeof item === 'string'; });
  }

  function asNullableString(value) {
    return typeof value === 'string' ? value : null;
  }

  function asRequiredString(value) {
    return typeof value === 'string' ? value : '';
  }

  function isAllowedConfidence(value) {
    return ALLOWED_IDENTIFICATION_CONFIDENCE.indexOf(value) !== -1;
  }

  function isStringArray(value) {
    var i;
    if (!Array.isArray(value)) return false;
    for (i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') return false;
    }
    return true;
  }

  function isValidTimestamp(value) {
    if (typeof value !== 'string' || !value) return false;
    return !isNaN(new Date(value).getTime());
  }

  /*
   * Battery Record identity fields must never be reconstructed or enriched from Compatibility, relationship, Charger Check or Physical Fit results.
   */
  function buildSavedIdentityRecord(identificationResult) {
    if (!identificationResult || typeof identificationResult !== 'object') {
      throw new Error('invalid_identification_result');
    }
    if (identificationResult.confidence === 'technical_failure') {
      throw new Error('technical_failure_not_saveable');
    }
    if (!isAllowedConfidence(identificationResult.confidence)) {
      throw new Error('unsupported_confidence_not_saveable');
    }

    var nextEvidence = null;
    var request = identificationResult.nextEvidenceRequest;
    if (request && typeof request === 'object') {
      nextEvidence = {
        title: asRequiredString(request.title),
        instruction: asRequiredString(request.instruction),
        whyItMatters: asRequiredString(request.whyItMatters)
      };
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      enteredCode: asRequiredString(identificationResult.enteredCode),
      canonicalCode: asNullableString(identificationResult.canonical),
      category: asNullableString(identificationResult.category),
      identificationConfidence: asRequiredString(identificationResult.confidence),
      evidenceSummary: asRequiredString(identificationResult.evidence),
      unknowns: stringArrayOnly(identificationResult.unknowns),
      warnings: stringArrayOnly(identificationResult.warnings),
      verificationRequired: stringArrayOnly(identificationResult.verificationRequired),
      nextEvidence: nextEvidence
    };
  }

  function validateSavedRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return false;
    }
    if (record.schemaVersion !== SCHEMA_VERSION) {
      return false;
    }
    if (!hasOnlyAllowedKeys(record, TOP_LEVEL_KEYS)) {
      return false;
    }
    if (!isValidTimestamp(record.savedAt)) return false;
    if (typeof record.enteredCode !== 'string') return false;
    if (record.canonicalCode !== null && typeof record.canonicalCode !== 'string') return false;
    if (record.category !== null && typeof record.category !== 'string') return false;
    if (!isAllowedConfidence(record.identificationConfidence)) return false;
    if (typeof record.evidenceSummary !== 'string') return false;
    if (!isStringArray(record.unknowns)) return false;
    if (!isStringArray(record.warnings)) return false;
    if (!isStringArray(record.verificationRequired)) return false;

    if (record.nextEvidence !== null && typeof record.nextEvidence !== 'undefined') {
      if (typeof record.nextEvidence !== 'object' || Array.isArray(record.nextEvidence)) return false;
      if (!hasOnlyAllowedKeys(record.nextEvidence, NEXT_EVIDENCE_KEYS)) return false;
      if (typeof record.nextEvidence.title !== 'string') return false;
      if (typeof record.nextEvidence.instruction !== 'string') return false;
      if (typeof record.nextEvidence.whyItMatters !== 'string') return false;
    }

    return true;
  }

  function saveFromIdentification(identificationResult) {
    var savedRecord = buildSavedIdentityRecord(identificationResult);
    var raw = JSON.stringify(savedRecord);
    localStorage.setItem(STORAGE_KEY, raw);
    return savedRecord;
  }

  function loadRecordState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { status: 'missing', record: null, raw: null };
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { status: 'invalid', record: null, raw: raw };
    }

    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      return { status: 'unsupported_schema', record: null, raw: raw };
    }

    if (!validateSavedRecord(parsed)) {
      return { status: 'invalid', record: null, raw: raw };
    }

    return { status: 'valid', record: parsed, raw: raw };
  }

  function deleteRecord() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isSaveEligible(identificationResult) {
    return !!(identificationResult
      && identificationResult.enteredCode
      && identificationResult.confidence
      && isAllowedConfidence(identificationResult.confidence)
      && identificationResult.confidence !== 'technical_failure');
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    buildSavedIdentityRecord: buildSavedIdentityRecord,
    saveFromIdentification: saveFromIdentification,
    loadRecordState: loadRecordState,
    deleteRecord: deleteRecord,
    isSaveEligible: isSaveEligible
  };
}));
