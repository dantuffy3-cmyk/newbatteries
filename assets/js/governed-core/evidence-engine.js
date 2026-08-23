/*
 * evidence-engine.js
 *
 * BER-0 Governed Evidence Engine
 *
 * Evaluates referral disposition using explicit vocabulary.
 *
 * Referral disposition is separate from evidence status.
 * See controlled-vocabulary.js for vocabulary definitions.
 *
 * Key invariant:
 *   "Nothing triggered" must NOT be represented as referral_optional
 *   or referral_required. Use no_referral_required instead.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./controlled-vocabulary.js')
    );
  } else {
    root.NBEvidenceEngine = factory(root.NBControlledVocabulary);
  }
}(typeof self !== 'undefined' ? self : this, function (vocab) {
  'use strict';

  var REFERRAL = vocab.REFERRAL_DISPOSITION;
  var EVIDENCE = vocab.EVIDENCE_STATUS;

  /*
   * assessReferralDisposition
   *
   * Given a governed evidence bundle, returns the referral disposition.
   *
   * Parameters:
   *   bundle.escalationRules   — array of triggered escalation rules (may be empty)
   *   bundle.conflictsPresent  — boolean: unresolved conflicts exist
   *   bundle.referralOptionalHints — array of optional-referral hint strings
   *
   * Returns:
   *   {
   *     disposition: REFERRAL_DISPOSITION value,
   *     reason: string,
   *     triggeredRules: []
   *   }
   *
   * Decision logic:
   *   1. If any escalation rule has fired → REFERRAL_REQUIRED
   *   2. If optional referral hints are present but no rule fired → REFERRAL_OPTIONAL
   *   3. Otherwise → NO_REFERRAL_REQUIRED
   *
   * "No rule fired" must never produce REFERRAL_REQUIRED or REFERRAL_OPTIONAL
   * without an explicit reason.
   */
  function assessReferralDisposition(bundle) {
    var escalationRules = (bundle && Array.isArray(bundle.escalationRules))
      ? bundle.escalationRules : [];
    var conflictsPresent = !!(bundle && bundle.conflictsPresent);
    var optionalHints = (bundle && Array.isArray(bundle.referralOptionalHints))
      ? bundle.referralOptionalHints : [];

    var triggeredRules = escalationRules.filter(function (r) {
      return r && r.triggered === true;
    });

    if (triggeredRules.length > 0) {
      return {
        disposition: REFERRAL.REFERRAL_REQUIRED,
        reason: 'escalation_rule_triggered',
        triggeredRules: triggeredRules.map(function (r) { return r.ruleId || 'unknown'; })
      };
    }

    if (conflictsPresent) {
      return {
        disposition: REFERRAL.REFERRAL_REQUIRED,
        reason: 'unresolved_conflict_requires_referral',
        triggeredRules: []
      };
    }

    if (optionalHints.length > 0) {
      return {
        disposition: REFERRAL.REFERRAL_OPTIONAL,
        reason: 'optional_referral_hints_present',
        triggeredRules: [],
        hints: optionalHints
      };
    }

    return {
      disposition: REFERRAL.NO_REFERRAL_REQUIRED,
      reason: 'no_escalation_rule_triggered',
      triggeredRules: []
    };
  }

  /*
   * isReferralRequired
   *
   * Convenience predicate. Returns true only if a rule actually fired.
   */
  function isReferralRequired(dispositionResult) {
    return !!(dispositionResult &&
      dispositionResult.disposition === REFERRAL.REFERRAL_REQUIRED);
  }

  /*
   * isNoReferralRequired
   *
   * Returns true when no escalation rule fired and no conflict exists.
   */
  function isNoReferralRequired(dispositionResult) {
    return !!(dispositionResult &&
      dispositionResult.disposition === REFERRAL.NO_REFERRAL_REQUIRED);
  }

  return {
    assessReferralDisposition: assessReferralDisposition,
    isReferralRequired: isReferralRequired,
    isNoReferralRequired: isNoReferralRequired
  };
}));
