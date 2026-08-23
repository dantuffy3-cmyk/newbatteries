/*
 * controlled-vocabulary.js
 *
 * BER-0 Controlled Vocabulary
 *
 * Defines two distinct concept classes that must not be conflated:
 *
 *   1. Evidence/result status — describes the state of a governed field or claim.
 *   2. Referral disposition   — describes whether professional/manufacturer
 *                               escalation is required.
 *
 * These are separate concerns. Referral disposition is NOT an evidence status.
 * Do not add universal product-decision states (PROCEED, STOP, SAFE, APPROVED).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBControlledVocabulary = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /*
   * EVIDENCE_STATUS
   *
   * Describes how well a governed field or claim is supported by evidence.
   *
   * supported       — field or claim is backed by verified evidence.
   * partial         — some evidence exists but the picture is incomplete.
   * conflict        — competing evidence values exist with no resolved winner.
   * unknown         — the field is unresolved; no evidence has been obtained.
   * withheld        — evidence exists but is not cleared for the current use.
   * not_applicable  — the field is structurally irrelevant for this record type.
   */
  var EVIDENCE_STATUS = Object.freeze({
    SUPPORTED:       'supported',
    PARTIAL:         'partial',
    CONFLICT:        'conflict',
    UNKNOWN:         'unknown',
    WITHHELD:        'withheld',
    NOT_APPLICABLE:  'not_applicable'
  });

  /*
   * REFERRAL_DISPOSITION
   *
   * Describes whether professional or manufacturer escalation is required.
   *
   * REFERRAL_REQUIRED — a governed rule has determined that escalation is
   *                     required. Must not be used unless a rule actually fired.
   * REFERRAL_OPTIONAL — referral could legitimately assist but is not required
   *                     by the current evidence state.
   * NO_REFERRAL_REQUIRED — no referral/escalation rule has been triggered.
   *
   * "Nothing triggered" must NOT be represented as REFERRAL_OPTIONAL or
   * REFERRAL_REQUIRED.
   */
  var REFERRAL_DISPOSITION = Object.freeze({
    REFERRAL_REQUIRED:    'referral_required',
    REFERRAL_OPTIONAL:    'referral_optional',
    NO_REFERRAL_REQUIRED: 'no_referral_required'
  });

  /*
   * EVIDENCE_BASIS
   *
   * Describes HOW a claim was established — not WHO supplied it.
   * Source authority (WHO) is resolved from the canonical source register.
   *
   * OBSERVATION        — direct observation by a qualified person.
   * MEASUREMENT        — physical measurement.
   * PHOTO_SUPPORTED    — supported by photographic evidence (not AI-only).
   * DOCUMENT_SUPPORTED — supported by a document (datasheet, standard, etc.).
   * USER_DECLARED      — declared by the user; not independently verified.
   * SYSTEM_DERIVED     — derived by a governed rule from other evidence.
   * UNKNOWN            — basis not established.
   *
   * Note: Passport interoperability remains future-only (post BER-0).
   */
  var EVIDENCE_BASIS = Object.freeze({
    OBSERVATION:        'OBSERVATION',
    MEASUREMENT:        'MEASUREMENT',
    PHOTO_SUPPORTED:    'PHOTO_SUPPORTED',
    DOCUMENT_SUPPORTED: 'DOCUMENT_SUPPORTED',
    USER_DECLARED:      'USER_DECLARED',
    SYSTEM_DERIVED:     'SYSTEM_DERIVED',
    UNKNOWN:            'UNKNOWN'
  });

  var VALID_EVIDENCE_STATUS_VALUES = Object.values
    ? Object.values(EVIDENCE_STATUS)
    : Object.keys(EVIDENCE_STATUS).map(function (k) { return EVIDENCE_STATUS[k]; });

  var VALID_REFERRAL_DISPOSITION_VALUES = Object.values
    ? Object.values(REFERRAL_DISPOSITION)
    : Object.keys(REFERRAL_DISPOSITION).map(function (k) { return REFERRAL_DISPOSITION[k]; });

  var VALID_EVIDENCE_BASIS_VALUES = Object.values
    ? Object.values(EVIDENCE_BASIS)
    : Object.keys(EVIDENCE_BASIS).map(function (k) { return EVIDENCE_BASIS[k]; });

  function isValidEvidenceStatus(value) {
    return VALID_EVIDENCE_STATUS_VALUES.indexOf(value) !== -1;
  }

  function isValidReferralDisposition(value) {
    return VALID_REFERRAL_DISPOSITION_VALUES.indexOf(value) !== -1;
  }

  function isValidEvidenceBasis(value) {
    return VALID_EVIDENCE_BASIS_VALUES.indexOf(value) !== -1;
  }

  return {
    EVIDENCE_STATUS: EVIDENCE_STATUS,
    REFERRAL_DISPOSITION: REFERRAL_DISPOSITION,
    EVIDENCE_BASIS: EVIDENCE_BASIS,
    isValidEvidenceStatus: isValidEvidenceStatus,
    isValidReferralDisposition: isValidReferralDisposition,
    isValidEvidenceBasis: isValidEvidenceBasis
  };
}));
