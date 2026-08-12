(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./validation.js'));
  } else {
    root.NBGovernedObservationAdapter = factory(root.NBGovernedValidation);
  }
}(typeof self !== 'undefined' ? self : this, function (validationModule) {
  'use strict';

  var validateObservationRecord = validationModule.validateObservationRecord;
  var SNAPSHOT_STORAGE_KEY = 'nb_dev_observation_snapshot_v1';
  var DEV_FLAG_KEY = 'nb_dev_evidence_enabled';

  function normaliseCode(value) {
    return String(value || '').replace(/[\s\-\.]/g, '').toUpperCase();
  }

  function normaliseChemistry(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text || /not sure|unknown|unsure/.test(text)) return null;
    if (/lir|rechargeable|li-ion|lithium ion/.test(text)) return 'lithium_ion';
    if (/cr|lithium/.test(text)) return 'lithium_primary';
    if (/silver/.test(text)) return 'silver_oxide';
    if (/alkaline/.test(text)) return 'alkaline';
    if (/agm/.test(text)) return 'agm';
    if (/efb/.test(text)) return 'efb';
    if (/flooded|lead/.test(text)) return 'flooded_lead_acid';
    return text.replace(/\s+/g, '_');
  }

  function normaliseVoltage(value) {
    var text = String(value || '').trim();
    if (!text || /not sure|unknown|unsure/i.test(text)) return null;
    var match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? match[1] + 'V' : text.toUpperCase();
  }

  function normaliseBooleanish(value) {
    if (value === true || value === false) return value;
    var text = String(value || '').trim().toLowerCase();
    if (!text || /not sure|unknown|unsure/.test(text)) return null;
    if (text === 'yes' || text === 'true') return true;
    if (text === 'no' || text === 'false') return false;
    return null;
  }

  function buildObservationRecord(input) {
    var rawInput = input && input.raw_input ? input.raw_input : input || {};
    var normalised = {};
    var unknown = [];

    function assign(field, rawValue, normalizedValue) {
      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '' || /not sure|unknown|unsure/i.test(String(rawValue))) {
        unknown.push(field);
        return;
      }
      if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') {
        unknown.push(field);
        return;
      }
      normalised[field] = normalizedValue;
    }

    assign('battery_code', rawInput.battery_code, normaliseCode(rawInput.battery_code));
    assign('partial_battery_code', rawInput.partial_battery_code, normaliseCode(rawInput.partial_battery_code));
    assign('equipment_category', rawInput.equipment_category, String(rawInput.equipment_category || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('equipment_make', rawInput.equipment_make, String(rawInput.equipment_make || '').trim());
    assign('equipment_model', rawInput.equipment_model, String(rawInput.equipment_model || '').trim());
    assign('nominal_voltage', rawInput.nominal_voltage, normaliseVoltage(rawInput.nominal_voltage));
    assign('chemistry', rawInput.chemistry, normaliseChemistry(rawInput.chemistry));
    assign('polarity', rawInput.polarity, String(rawInput.polarity || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('terminal_type', rawInput.terminal_type, String(rawInput.terminal_type || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('start_stop_status', rawInput.start_stop_status, normaliseBooleanish(rawInput.start_stop_status));
    assign('intended_application', rawInput.intended_application, String(rawInput.intended_application || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('modification_status', rawInput.modification_status, String(rawInput.modification_status || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('charger_information', rawInput.charger_information, String(rawInput.charger_information || '').trim().toLowerCase().replace(/\s+/g, '_'));
    assign('notes', rawInput.notes, String(rawInput.notes || '').trim());

    ['dimensions_length_mm', 'dimensions_width_mm', 'dimensions_height_mm', 'dimensions_diameter_mm', 'dimensions_thickness_mm'].forEach(function (key) {
      if (rawInput[key] === null || rawInput[key] === undefined || String(rawInput[key]).trim() === '') {
        unknown.push(key);
      } else {
        normalised[key] = Number(rawInput[key]);
      }
    });

    var record = {
      raw_input: rawInput,
      normalised_observations: normalised,
      unknown_fields: Array.from(new Set(unknown)).sort(),
      observation_source: input && input.observation_source ? input.observation_source : 'newbatteries_finder',
      record_status: input && input.record_status ? input.record_status : 'development'
    };

    record.validation = validateObservationRecord(record);
    return record;
  }

  function buildFinderObservationSnapshot(finderState, options) {
    var opts = options || {};
    var rawInput = {
      battery_code: opts.rawBatteryCode || finderState.battCode || '',
      notes: opts.notes || '',
      equipment_category: opts.entryPath || ''
    };
    if (finderState.battIdCanonical && finderState.battIdCanonical !== finderState.battCode) {
      rawInput.partial_battery_code = finderState.battCode || '';
    }
    return buildObservationRecord({
      raw_input: rawInput,
      observation_source: 'newbatteries_finder',
      record_status: 'development'
    });
  }

  function canUseStorage() {
    return typeof sessionStorage !== 'undefined';
  }

  function saveObservationSnapshot(record) {
    if (!canUseStorage()) return false;
    try {
      sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadObservationSnapshot() {
    if (!canUseStorage()) return null;
    try {
      var raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function enableDevelopmentMode() {
    if (!canUseStorage()) return false;
    try {
      sessionStorage.setItem(DEV_FLAG_KEY, 'true');
      return true;
    } catch (err) {
      return false;
    }
  }

  function isDevelopmentMode(search) {
    if (typeof URLSearchParams !== 'undefined' && typeof search === 'string') {
      var params = new URLSearchParams(search);
      if (params.get('nb_dev') === 'true') return true;
    }
    if (!canUseStorage()) return false;
    try {
      return sessionStorage.getItem(DEV_FLAG_KEY) === 'true';
    } catch (err) {
      return false;
    }
  }

  return {
    SNAPSHOT_STORAGE_KEY: SNAPSHOT_STORAGE_KEY,
    DEV_FLAG_KEY: DEV_FLAG_KEY,
    buildObservationRecord: buildObservationRecord,
    buildFinderObservationSnapshot: buildFinderObservationSnapshot,
    saveObservationSnapshot: saveObservationSnapshot,
    loadObservationSnapshot: loadObservationSnapshot,
    enableDevelopmentMode: enableDevelopmentMode,
    isDevelopmentMode: isDevelopmentMode,
    normaliseCode: normaliseCode
  };
}));
