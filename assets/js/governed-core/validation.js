(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBGovernedValidation = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function validateObservationRecord(record) {
    var errors = [];
    if (!record || typeof record !== 'object') errors.push('Observation must be an object.');
    if (!record || !record.raw_input || typeof record.raw_input !== 'object') errors.push('raw_input is required.');
    if (!record || !record.normalised_observations || typeof record.normalised_observations !== 'object') errors.push('normalised_observations is required.');
    if (!record || !Array.isArray(record.unknown_fields)) errors.push('unknown_fields must be an array.');
    if (!record || !record.observation_source) errors.push('observation_source is required.');
    if (!record || !record.record_status) errors.push('record_status is required.');
    return { valid: errors.length === 0, errors: errors };
  }

  return {
    validateObservationRecord: validateObservationRecord
  };
}));
