/* =============================================================
   NewBatteries – battery-data.js
   Data loader and normalisation module.
   Loads and normalises battery master records, relationships,
   rule profiles and sources. Exposes safe search utilities.
   No fake results, no unsupported compatibility claims.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBBatteryData = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── Cache ─────────────────────────────────────────────── */
  var _batteries     = null;
  var _relationships = null;
  var _ruleProfiles  = null;
  var _sources       = null;

  /* ── Path helper ────────────────────────────────────────── */
  /* Works with GitHub Pages where pages can be in root or subfolders */
  function dataPath(filename) {
    /* Determine base from script location or default to relative path */
    return 'data/' + filename;
  }

  /* ── Fetch helper ───────────────────────────────────────── */
  function loadJson(url, cb) {
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + url);
        return r.json();
      })
      .then(function (data) { cb(null, data); })
      .catch(function (err) { cb(err, null); });
  }

  /* ── Code normalisation ─────────────────────────────────── */
  /* Normalises a user-entered battery code for matching.
     - Trims whitespace
     - Converts to uppercase
     - Removes hyphens, spaces, dots (non-meaningful separators)
     - Preserves original for display
     Does NOT collapse codes that could be genuinely different
     (e.g., polarity suffixes L/R are preserved within the code). */
  function normaliseCode(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.replace(/[\s\-\.]/g, '').toUpperCase();
  }

  /* ── Record normalisation ───────────────────────────────── */
  /* Normalises a battery record from batteries.json to a
     consistent internal format regardless of whether it was
     written in old or new schema format. */
  function normaliseRecord(b) {
    if (!b) return null;

    /* Resolve batteryId: prefer batteryId, fall back to id */
    var batteryId = b.batteryId || b.id || null;

    /* Resolve canonical code */
    var canonicalCode = (b.canonicalCode || '').toUpperCase();

    /* Resolve aliases: from `aliases` array (old) or `codes` array (new) */
    var aliases = [];
    if (Array.isArray(b.aliases)) {
      aliases = b.aliases.slice();
    }
    if (Array.isArray(b.codes)) {
      b.codes.forEach(function (c) {
        if (c.codeType !== 'canonical' && aliases.indexOf(c.code) === -1) {
          aliases.push(c.code);
        }
      });
    }

    /* Resolve voltage: accept string "12V"/"3V"/"1.5V" or number */
    var voltageRaw = b.nominalVoltage;
    var voltageNum = null;
    if (typeof voltageRaw === 'number') {
      voltageNum = voltageRaw;
    } else if (typeof voltageRaw === 'string') {
      var parsed = parseFloat(voltageRaw);
      if (!isNaN(parsed)) voltageNum = parsed;
    }

    /* Resolve applications */
    var applications = b.commonApplications || b.typicalApplications || [];

    /* Resolve chemistry options */
    var chemistryOptions = b.chemistryOptions || [];
    if (b.chemistry && chemistryOptions.length === 0) {
      chemistryOptions = [b.chemistry.replace(/_/g, ' ')];
    }

    /* Resolve warnings/unknowns */
    var warnings = Array.isArray(b.warnings) ? b.warnings.slice() : [];
    var unknowns = Array.isArray(b.unknowns) ? b.unknowns.slice() : [];

    /* Resolve category — map old display strings to new enum keys where possible */
    var categoryRaw = b.category || '';
    var categoryKey = categoryRaw;
    if (!b.batteryId) {
      /* Old-format record: map display category to internal key */
      var catMap = {
        'coin_cell': 'coin_cell',
        'button_cell': 'button_cell',
        'household_primary': 'household_primary',
        'household_rechargeable': 'household_rechargeable',
        'automotive starting': 'automotive',
        'european automotive starting': 'automotive',
        'japanese automotive starting': 'automotive',
        'automotive/commercial starting': 'automotive',
        'maintenance-free automotive starting': 'automotive',
        'group-size family': 'automotive',
        'power_tool_platform': 'power_tool_platform',
        'motorcycle': 'motorcycle'
      };
      categoryKey = catMap[categoryRaw] || 'other';
    }

    /* Confidence / reviewStatus */
    var confidence    = b.confidence    || 'low';
    var reviewStatus  = b.reviewStatus  || 'draft';

    return {
      /* Core identity */
      batteryId:      batteryId,
      canonicalCode:  canonicalCode,
      displayName:    b.displayName || b.canonicalCode || canonicalCode,
      category:       categoryKey,
      categoryDisplay: categoryRaw,
      subCategory:    b.subCategory   || null,
      chemistry:      b.chemistry     || null,

      /* Electrical */
      nominalVoltage:    voltageRaw,
      nominalVoltageNum: voltageNum,
      rechargeable:      typeof b.rechargeable === 'boolean' ? b.rechargeable : null,

      /* Physical */
      dimensionsMm: b.dimensionsMm || b.approximateDimensions || null,

      /* Codes */
      canonicalCodeNormalised: normaliseCode(canonicalCode),
      aliases:                 aliases,
      aliasesNormalised:       aliases.map(normaliseCode),
      codes:                   b.codes || [],

      /* Applications & chemistry */
      commonApplications: applications,
      chemistryOptions:   chemistryOptions,
      family:             b.family || null,

      /* Status & evidence */
      confidence:   confidence,
      reviewStatus: reviewStatus,
      sourceIds:    Array.isArray(b.sourceIds) ? b.sourceIds : [],
      lastVerified: b.lastVerified || null,

      /* Warnings & unknowns */
      warnings:               warnings,
      unknowns:               unknowns,
      verificationRequirements: b.verificationRequirements || [],

      /* Automotive-specific (old-compat) */
      startStopCompatibility: b.startStopCompatibility || null,
      manufacturerSpecifications: b.manufacturerSpecifications || [],

      /* Raw original for debugging */
      _raw: b
    };
  }

  /* ── Load batteries ─────────────────────────────────────── */
  function loadBatteries(cb) {
    if (_batteries !== null) { cb(null, _batteries); return; }
    loadJson(dataPath('batteries.json'), function (err, data) {
      if (err || !data) {
        _batteries = [];
        cb(err, []);
        return;
      }
      var raw = Array.isArray(data.batteries) ? data.batteries : [];
      _batteries = raw.map(normaliseRecord).filter(Boolean);
      cb(null, _batteries);
    });
  }

  /* ── Load relationships ─────────────────────────────────── */
  function loadRelationships(cb) {
    if (_relationships !== null) { cb(null, _relationships); return; }
    loadJson(dataPath('relationships.json'), function (err, data) {
      if (err || !data) {
        _relationships = [];
        cb(err, []);
        return;
      }
      _relationships = Array.isArray(data.relationships) ? data.relationships : [];
      cb(null, _relationships);
    });
  }

  /* ── Load rule profiles ─────────────────────────────────── */
  function loadRuleProfiles(cb) {
    if (_ruleProfiles !== null) { cb(null, _ruleProfiles); return; }
    loadJson(dataPath('rule-profiles.json'), function (err, data) {
      if (err || !data) {
        _ruleProfiles = {};
        cb(err, {});
        return;
      }
      _ruleProfiles = data.profiles || {};
      cb(null, _ruleProfiles);
    });
  }

  /* ── Load sources ───────────────────────────────────────── */
  function loadSources(cb) {
    if (_sources !== null) { cb(null, _sources); return; }
    loadJson(dataPath('sources.json'), function (err, data) {
      if (err || !data) {
        _sources = [];
        cb(err, []);
        return;
      }
      _sources = Array.isArray(data.sources) ? data.sources : [];
      cb(null, _sources);
    });
  }

  /* ── Lookup by normalised code ──────────────────────────── */
  function findByCode(normCode, batteries) {
    var i, b;
    /* 1. Exact canonical match */
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      if (b.canonicalCodeNormalised === normCode) return { battery: b, matchType: 'exact' };
    }
    /* 2. Exact alias match */
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      if (b.aliasesNormalised.indexOf(normCode) !== -1) return { battery: b, matchType: 'alias' };
    }
    /* 3. Family prefix match (≥ 3 chars) */
    if (normCode.length >= 3) {
      for (i = 0; i < batteries.length; i++) {
        b = batteries[i];
        var canon = b.canonicalCodeNormalised;
        if (normCode.indexOf(canon) === 0 || canon.indexOf(normCode) === 0) {
          return { battery: b, matchType: 'family' };
        }
      }
    }
    return null;
  }

  /* ── Public: lookup single code ─────────────────────────── */
  function lookupCode(rawCode, cb) {
    var normCode = normaliseCode(rawCode);
    loadBatteries(function (err, batteries) {
      if (err || !normCode) { cb(null, null); return; }
      var match = findByCode(normCode, batteries);
      cb(null, match || null);
    });
  }

  /* ── Public: lookup by batteryId ────────────────────────── */
  function lookupById(batteryId, cb) {
    loadBatteries(function (err, batteries) {
      if (err) { cb(null, null); return; }
      var found = null;
      for (var i = 0; i < batteries.length; i++) {
        if (batteries[i].batteryId === batteryId) { found = batteries[i]; break; }
      }
      cb(null, found);
    });
  }

  /* ── Public: find relationships for a battery ───────────── */
  function findRelationships(batteryId, cb) {
    loadRelationships(function (err, rels) {
      if (err) { cb(null, []); return; }
      var found = rels.filter(function (r) {
        return r.sourceBatteryId === batteryId || r.targetBatteryId === batteryId;
      });
      cb(null, found);
    });
  }

  /* ── Public: find explicit relationship between two batteries */
  function findRelationshipBetween(idA, idB, cb) {
    loadRelationships(function (err, rels) {
      if (err) { cb(null, null); return; }
      var found = null;
      for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        if (
          (r.sourceBatteryId === idA && r.targetBatteryId === idB) ||
          (r.sourceBatteryId === idB && r.targetBatteryId === idA)
        ) {
          found = r;
          break;
        }
      }
      cb(null, found);
    });
  }

  /* ── Public: load all data ──────────────────────────────── */
  function loadAll(cb) {
    var results = { batteries: null, relationships: null, ruleProfiles: null, sources: null };
    var pending = 4;
    var errors = [];

    function done(key, err, data) {
      results[key] = data;
      if (err) errors.push(err);
      pending--;
      if (pending === 0) cb(errors.length ? errors : null, results);
    }

    loadBatteries(function (e, d) { done('batteries', e, d); });
    loadRelationships(function (e, d) { done('relationships', e, d); });
    loadRuleProfiles(function (e, d) { done('ruleProfiles', e, d); });
    loadSources(function (e, d) { done('sources', e, d); });
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    normaliseCode:           normaliseCode,
    loadBatteries:           loadBatteries,
    loadRelationships:       loadRelationships,
    loadRuleProfiles:        loadRuleProfiles,
    loadSources:             loadSources,
    loadAll:                 loadAll,
    lookupCode:              lookupCode,
    lookupById:              lookupById,
    findRelationships:       findRelationships,
    findRelationshipBetween: findRelationshipBetween
  };
}));
