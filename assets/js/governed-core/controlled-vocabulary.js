(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBGovernedVocabulary = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var overallAssessmentLabels = {
    identity_supported: 'Identity supported',
    likely_identity: 'Likely identity',
    multiple_candidates: 'Multiple candidates',
    conflict_detected: 'Conflict detected',
    insufficient_evidence: 'Insufficient evidence',
    conclusion_withheld: 'Conclusion withheld',
    professional_verification_required: 'Professional verification required',
    unsupported_category: 'Unsupported category'
  };

  var dimensionLabels = {
    identity: 'Identity',
    nominal_voltage: 'Nominal voltage',
    chemistry: 'Chemistry',
    physical_dimensions: 'Physical dimensions',
    polarity: 'Polarity',
    terminal_type: 'Terminal type',
    application: 'Intended application',
    start_stop: 'Start-stop',
    charging_profile: 'Charging profile',
    installation: 'Installation status'
  };

  var statusLabels = {
    supported: 'Supported',
    partial: 'Partially supported',
    conflict: 'Conflict',
    unknown: 'Unknown',
    withheld: 'Withheld',
    escalation: 'Escalation required',
    not_applicable: 'Not applicable'
  };

  var dimensionOrder = [
    'identity',
    'nominal_voltage',
    'chemistry',
    'physical_dimensions',
    'polarity',
    'terminal_type',
    'application',
    'start_stop',
    'charging_profile',
    'installation'
  ];

  return {
    overallAssessmentLabels: overallAssessmentLabels,
    dimensionLabels: dimensionLabels,
    statusLabels: statusLabels,
    dimensionOrder: dimensionOrder
  };
}));
