/*
 * next-evidence-engine.js
 *
 * BER-1 — Deterministic Next-Best-Evidence Engine
 *
 * Selects the single most useful piece of additional evidence a user can
 * collect when NewBatteries cannot confidently resolve a battery.
 *
 * ARCHITECTURAL RULE:
 *   CURRENT EVIDENCE → IDENTIFIED MISSING/CONFLICTING FIELD
 *   → ACTIVE CATEGORY / RULE PROFILE
 *   → DETERMINISTIC NEXT-EVIDENCE RULE
 *   → NEXT EVIDENCE REQUEST
 *
 * Never: missing evidence → AI guess → positive identification.
 *
 * CONTROLS:
 *   - NOT_APPLICABLE fields never generate requests.
 *   - Unknown cannot improve an identification result.
 *   - Conflicts remain visible after evidence request generation.
 *   - An evidence request never resolves a conflict.
 *   - No score or probability is produced.
 *
 * Public API:
 *   selectNextEvidenceRequest(identResult)
 *     → NextEvidenceRequest | NoEvidenceRequest
 *
 * NextEvidenceRequest shape:
 *   { field, reasonCode, title, instruction, whyItMatters,
 *     evidenceBasisRequested, priority }
 *
 * NoEvidenceRequest shape:
 *   { reasonCode: 'NO_DETERMINISTIC_NEXT_EVIDENCE' }
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBNextEvidenceEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /*
   * REASON CODES — internal governed vocabulary.
   * Never exposed directly in public copy.
   */
  var REASON = {
    UNRECOGNISED_CODE:           'UNRECOGNISED_CODE',
    FAMILY_MATCH_AMBIGUOUS:      'FAMILY_MATCH_AMBIGUOUS',
    MISSING_BLOCKING_EVIDENCE:   'MISSING_BLOCKING_EVIDENCE',
    CONFLICT_UNRESOLVED:         'CONFLICT_UNRESOLVED',
    NO_DETERMINISTIC_NEXT_EVIDENCE: 'NO_DETERMINISTIC_NEXT_EVIDENCE'
  };

  /*
   * EVIDENCE_BASIS — values from controlled vocabulary (BER-0 evidenceBasis).
   */
  var EVIDENCE_BASIS = {
    OBSERVATION:        'OBSERVATION',
    MEASUREMENT:        'MEASUREMENT',
    DOCUMENT_SUPPORTED: 'DOCUMENT_SUPPORTED',
    PHOTO_SUPPORTED:    'PHOTO_SUPPORTED'
  };

  /*
   * PRIORITY levels (internal only — no scores exposed publicly).
   */
  var PRIORITY = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

  /*
   * noRequest
   *
   * The canonical no-evidence state.
   * Returned when no deterministic next-evidence request can be formed.
   */
  var NO_REQUEST = Object.freeze({ reasonCode: REASON.NO_DETERMINISTIC_NEXT_EVIDENCE });

  /*
   * categoryRules
   *
   * Maps battery category patterns to the field most likely to distinguish
   * remaining candidates. Used for family-match and missing-evidence scenarios.
   *
   * 'pattern'  — regex tested against identResult.category (lowercased)
   * 'field'    — governed field name
   * 'title'    — user-facing request title
   * 'instruction' — user-facing action instruction
   * 'whyItMatters' — user-facing rationale
   * 'evidenceBasisRequested' — what kind of evidence is being requested
   * 'priority' — HIGH / MEDIUM / LOW
   */
  /*
   * CATEGORY_RULES
   *
   * Two distinct rule sets:
   *
   *  CATEGORY_FAMILY_RULES  — used by requestForFamilyMatch.
   *    Family match path: always prefers the complete code / suffix
   *    observation unless the category has no code-based distinguisher.
   *    Never makes hard claims about physical dimensions being "required";
   *    uses "may help identify" language throughout.
   *
   *  CATEGORY_MEASUREMENT_RULES — used by requestForMissingPhysicalEvidence.
   *    Only triggered for exact matches where identResult.unknowns explicitly
   *    contains a dimension-related field name.  Uses softer "may help
   *    confirm" language; the claim is always conditional on what was
   *    actually observed, not a hard assertion.
   */
  var CATEGORY_FAMILY_RULES = [
    // Automotive / starting / motorcycle — complete code or suffix first
    {
      pattern: /automotive|starting|motorcycle/,
      field: 'identity.exactVariantSuffix',
      title: 'Check the battery label for the complete code',
      instruction: 'Look for the full code printed or stamped on the battery case, including any trailing letters or digits.',
      whyItMatters: 'The complete code or suffix may help identify the exact variant within this battery family.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.HIGH
    },
    // Coin / button cells — suffix distinguishes chemistry and size
    {
      pattern: /coin|button/,
      field: 'identity.exactVariantSuffix',
      title: 'Check the battery label for the complete code',
      instruction: 'Look for the full code on the battery face or blister pack, including any trailing letters.',
      whyItMatters: 'The complete code may help identify chemistry and size variants within this family.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.HIGH
    },
    // Household primary / rechargeable — chemistry marking
    {
      pattern: /household/,
      field: 'identity.chemistryMarking',
      title: 'Check the chemistry marking on the battery',
      instruction: 'Look for a chemistry label on the battery case such as Alkaline, NiMH, Lithium, or Carbon Zinc.',
      whyItMatters: 'The chemistry marking may help identify the variant within the same size family.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.MEDIUM
    },
    // Power tools — platform label
    {
      pattern: /power.tool/,
      field: 'identity.platformLabel',
      title: 'Check the platform label on the battery or tool',
      instruction: 'Look for the platform or voltage marking printed on the battery pack or tool body.',
      whyItMatters: 'The platform label may help identify the exact battery pack variant required.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.MEDIUM
    }
  ];

  /*
   * CATEGORY_MEASUREMENT_RULES
   *
   * Used only when an exact match has an explicit dimension unknown.
   * Language is conditional — "may help confirm" — never a hard claim.
   */
  var CATEGORY_MEASUREMENT_RULES = [
    // Automotive — height measurement when explicitly unknown
    {
      pattern: /automotive|starting|motorcycle/,
      field: 'physical.heightMm',
      title: 'Measure the battery height',
      instruction: 'Measure from the base of the case to the highest fixed point (excluding cable terminals). Record the value in millimetres.',
      whyItMatters: 'A height measurement may help confirm the exact variant within this size group.',
      evidenceBasisRequested: EVIDENCE_BASIS.MEASUREMENT,
      priority: PRIORITY.HIGH
    }
  ];

  /*
   * getCategoryFamilyRule
   *
   * Returns the first matching CATEGORY_FAMILY_RULES entry for the given
   * category string, or null if no rule applies.
   */
  function getCategoryFamilyRule(category) {
    if (!category) return null;
    var lower = String(category).toLowerCase();
    for (var i = 0; i < CATEGORY_FAMILY_RULES.length; i++) {
      if (CATEGORY_FAMILY_RULES[i].pattern.test(lower)) return CATEGORY_FAMILY_RULES[i];
    }
    return null;
  }

  /*
   * getCategoryMeasurementRule
   *
   * Returns the first matching CATEGORY_MEASUREMENT_RULES entry for the given
   * category string, or null if no rule applies.
   */
  function getCategoryMeasurementRule(category) {
    if (!category) return null;
    var lower = String(category).toLowerCase();
    for (var i = 0; i < CATEGORY_MEASUREMENT_RULES.length; i++) {
      if (CATEGORY_MEASUREMENT_RULES[i].pattern.test(lower)) return CATEGORY_MEASUREMENT_RULES[i];
    }
    return null;
  }

  /*
   * requestForUnrecognisedCode
   *
   * Scenario A — no code match at all.
   *
   * Priority:
   *   1. Verify the exact code entered (may be a transcription error).
   *   2. Check for a second label or marking.
   *   3. Provide equipment make/model.
   *
   * We always start with the highest-value request that can legitimately
   * reduce the uncertainty. For an unrecognised code the most useful
   * first step is to verify the code was transcribed correctly and to
   * look for an alternate label.
   */
  function requestForUnrecognisedCode() {
    return {
      field: 'identity.batteryCode',
      reasonCode: REASON.UNRECOGNISED_CODE,
      title: 'Check the battery label for a second code',
      instruction: 'Verify the code entered matches the label exactly, then look for a second manufacturer or model marking on any other face of the battery case.',
      whyItMatters: 'The code entered did not match any recognised battery in the reference data. A second or alternate marking may help identify the battery.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.HIGH
    };
  }

  /*
   * requestForFamilyMatch
   *
   * Scenario B — family-level match only; exact variant unknown.
   *
   * Uses category rules to select the field most likely to distinguish
   * remaining candidates. Falls back to exact variant suffix observation
   * when no category rule applies.
   */
  function requestForFamilyMatch(identResult) {
    var rule = getCategoryFamilyRule(identResult.category);
    if (rule) {
      return {
        field: rule.field,
        reasonCode: REASON.FAMILY_MATCH_AMBIGUOUS,
        title: rule.title,
        instruction: rule.instruction,
        whyItMatters: rule.whyItMatters,
        evidenceBasisRequested: rule.evidenceBasisRequested,
        priority: rule.priority
      };
    }
    // Generic fallback for family match with no category rule
    return {
      field: 'identity.exactVariantSuffix',
      reasonCode: REASON.FAMILY_MATCH_AMBIGUOUS,
      title: 'Check the battery label for the complete code',
      instruction: 'Look for the complete code on the battery label, including any trailing characters or suffix.',
      whyItMatters: 'The full code may help identify the exact variant from others in the same family.',
      evidenceBasisRequested: EVIDENCE_BASIS.OBSERVATION,
      priority: PRIORITY.HIGH
    };
  }

  /*
   * requestForMissingPhysicalEvidence
   *
   * Scenario C — exact match but required physical evidence is missing.
   *
   * Only triggers when identResult.unknowns contains a dimension-related
   * entry AND a category rule exists for a measurement request.
   *
   * Returns null when no specific measurement can be requested
   * (avoids a generic "provide more information" request).
   */
  function requestForMissingPhysicalEvidence(identResult) {
    var unknowns = identResult.unknowns || [];
    var hasDimensionUnknown = unknowns.some(function (u) {
      var low = String(u).toLowerCase();
      return low.indexOf('dimension') !== -1 ||
             low.indexOf('height') !== -1 ||
             low.indexOf('length') !== -1 ||
             low.indexOf('width') !== -1 ||
             low.indexOf('size') !== -1;
    });
    if (!hasDimensionUnknown) return null;

    var rule = getCategoryMeasurementRule(identResult.category);
    if (!rule) return null;

    return {
      field: rule.field,
      reasonCode: REASON.MISSING_BLOCKING_EVIDENCE,
      title: rule.title,
      instruction: rule.instruction,
      whyItMatters: rule.whyItMatters,
      evidenceBasisRequested: rule.evidenceBasisRequested,
      priority: rule.priority
    };
  }

  /*
   * requestForConflict
   *
   * Scenario D — conflicting evidence present.
   *
   * An evidence request never resolves a conflict — it only asks the user
   * to supply additional evidence that may help disambiguate.
   * The conflict remains visible in the result regardless.
   */
  function requestForConflict(conflict) {
    return {
      field: conflict.field || 'identity.batteryCode',
      reasonCode: REASON.CONFLICT_UNRESOLVED,
      title: 'Check the original source for ' + (conflict.field || 'this field'),
      instruction: 'Locate the original label, documentation or measurement that provided this information and verify it against the conflicting value.',
      whyItMatters: 'Two pieces of information about this battery disagree. The conflict still needs checking — this request does not resolve it.',
      evidenceBasisRequested: EVIDENCE_BASIS.DOCUMENT_SUPPORTED,
      priority: PRIORITY.HIGH
    };
  }

  /*
   * selectNextEvidenceRequest
   *
   * Public API.
   *
   * Takes an identResult (as produced by buildIdentResult / buildTechnicalFailureResult)
   * and an optional conflicts array (from the BER-0 conflict model).
   *
   * Returns a NextEvidenceRequest or the NO_DETERMINISTIC_NEXT_EVIDENCE sentinel.
   *
   * Priority order:
   *   1. Unresolved conflicts (if conflict data supplied)
   *   2. Unrecognised code
   *   3. Family-level match (ambiguous variant)
   *   4. Missing blocking physical evidence (exact match with unknown dimensions)
   *   5. NO_DETERMINISTIC_NEXT_EVIDENCE
   *
   * Controls enforced:
   *   - technical_failure never produces a request.
   *   - NOT_APPLICABLE fields never produce requests.
   *   - Unknown cannot improve an identification result; this function
   *     does not attempt to resolve uncertainty — it only asks for evidence.
   *
   * @param {object} identResult  — identification result from finder-core
   * @param {Array}  [conflicts]  — optional BER-0 conflicts array
   * @returns {object} NextEvidenceRequest or NO_REQUEST sentinel
   */
  function selectNextEvidenceRequest(identResult, conflicts) {
    if (!identResult) return NO_REQUEST;

    // Technical failure — cannot produce a useful evidence request
    if (identResult.confidence === 'technical_failure') return NO_REQUEST;

    // 1. Unresolved conflicts take highest priority
    if (conflicts && conflicts.length > 0) {
      var unresolved = conflicts.filter(function (c) {
        return c.resolutionStatus === 'unresolved';
      });
      if (unresolved.length > 0) {
        return requestForConflict(unresolved[0]);
      }
    }

    // 2. Unrecognised code
    if (identResult.confidence === 'unknown') {
      return requestForUnrecognisedCode();
    }

    // 3. Family-level match — exact variant is ambiguous
    if (identResult.confidence === 'family') {
      return requestForFamilyMatch(identResult);
    }

    // 4. Exact match — check for missing blocking physical evidence
    if (identResult.confidence === 'exact') {
      var physRequest = requestForMissingPhysicalEvidence(identResult);
      if (physRequest) return physRequest;
    }

    // 5. No deterministic next evidence
    return NO_REQUEST;
  }

  return {
    selectNextEvidenceRequest: selectNextEvidenceRequest,
    // Expose constants for test verification
    REASON_CODES: REASON,
    NO_DETERMINISTIC_NEXT_EVIDENCE: REASON.NO_DETERMINISTIC_NEXT_EVIDENCE
  };
}));
