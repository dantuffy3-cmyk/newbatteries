/* =============================================================
   NewBatteries – compatibility-engine.js
   Evidence-led battery compatibility assessment engine.

   Rules:
   - Never generates compatibility from a percentage score
   - Never treats missing information as a match
   - Only outputs 'direct_equivalent' when an approved
     relationship explicitly supports it
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./battery-data'));
  } else {
    root.NBCompatEngine = factory(root.NBBatteryData);
  }
}(typeof self !== 'undefined' ? self : this, function (BatteryData) {
  'use strict';

  /* ── Classification constants ───────────────────────────── */
  var CLASS = {
    DIRECT_EQUIVALENT:      'direct_equivalent',
    SAME_FAMILY:            'same_family',
    CONDITIONAL:            'conditional',
    NOT_RECOMMENDED:        'not_recommended',
    INSUFFICIENT_EVIDENCE:  'insufficient_evidence'
  };

  var CONFIDENCE = {
    HIGH:   'high',
    MEDIUM: 'medium',
    LOW:    'low'
  };

  /* ── Headline map ───────────────────────────────────────── */
  function headlineFor(classification) {
    var map = {
      'direct_equivalent':     'Verified direct equivalent',
      'same_family':           'Same family — variant confirmation required',
      'conditional':           'Possible conditional substitute',
      'not_recommended':       'Not recommended — blocking incompatibility found',
      'insufficient_evidence': 'Insufficient evidence to assess'
    };
    return map[classification] || 'Unable to assess';
  }

  /* ── Check: do two normalised values match? ─────────────── */
  function valuesMatch(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).toUpperCase() === String(b).toUpperCase();
  }

  /* ── Check: are voltages compatible? ────────────────────── */
  function voltageCompatible(src, tgt) {
    var sv = src.nominalVoltageNum;
    var tv = tgt.nominalVoltageNum;
    if (sv === null || tv === null) return null; /* unknown */
    return Math.abs(sv - tv) < 0.01; /* within 10mV tolerance */
  }

  /* ── Check: are categories compatible? ─────────────────── */
  function categoryCompatible(src, tgt) {
    return src.category === tgt.category;
  }

  /* ── Run blocking checks for a category profile ─────────── */
  function runBlockingChecks(src, tgt, profile, matches, differences, warnings, unknowns) {
    var blocked = false;
    var checks  = (profile && profile.blockingChecks) || [];

    checks.forEach(function (check) {
      switch (check) {
        case 'nominal_voltage': {
          var vc = voltageCompatible(src, tgt);
          if (vc === null) {
            unknowns.push('Nominal voltage could not be compared — one or both records missing voltage data.');
          } else if (!vc) {
            differences.push('Nominal voltage differs: ' + src.nominalVoltage + ' vs ' + tgt.nominalVoltage);
            warnings.push('BLOCKING: Voltage mismatch. These batteries are not compatible.');
            blocked = true;
          } else {
            matches.push('Nominal voltage (' + src.nominalVoltage + ')');
          }
          break;
        }
        case 'rechargeable_status': {
          if (src.rechargeable === null || tgt.rechargeable === null) {
            unknowns.push('Rechargeable status could not be confirmed for one or both records.');
          } else if (src.rechargeable !== tgt.rechargeable) {
            differences.push('Rechargeable status differs: one is rechargeable, one is not');
            warnings.push('BLOCKING: Mixing rechargeable and non-rechargeable chemistries in the same device can cause damage or safety hazard.');
            blocked = true;
          } else {
            matches.push('Rechargeable status (' + (src.rechargeable ? 'rechargeable' : 'single-use') + ')');
          }
          break;
        }
        case 'physical_diameter': {
          var sd = src.dimensionsMm && src.dimensionsMm.diameter;
          var td = tgt.dimensionsMm && tgt.dimensionsMm.diameter;
          if (!sd || !td) {
            unknowns.push('Physical diameter could not be compared — dimension data missing from one or both records.');
          } else if (Math.abs(Number(sd) - Number(td)) > 0.5) {
            differences.push('Diameter differs: ' + sd + 'mm vs ' + td + 'mm');
            warnings.push('BLOCKING: Physical diameter mismatch. Battery will not fit.');
            blocked = true;
          } else {
            matches.push('Diameter (' + sd + 'mm)');
          }
          break;
        }
        case 'physical_size_designation': {
          /* For household batteries: match by canonicalCode (LR6, LR03, etc.) */
          if (valuesMatch(src.canonicalCode, tgt.canonicalCode)) {
            matches.push('Size designation (' + src.canonicalCode + ')');
          } else {
            differences.push('Size designation differs: ' + src.canonicalCode + ' vs ' + tgt.canonicalCode);
            warnings.push('BLOCKING: Battery size designations differ. Physical fit not confirmed.');
            blocked = true;
          }
          break;
        }
        case 'brand_platform': {
          if (src.batteryId === tgt.batteryId) {
            matches.push('Same platform');
          } else {
            differences.push('Different brand platforms: ' + src.canonicalCode + ' vs ' + tgt.canonicalCode);
            warnings.push('BLOCKING: Power tool batteries are platform-specific. Cross-brand compatibility is not supported.');
            blocked = true;
          }
          break;
        }
        case 'voltage_class': {
          var vv = voltageCompatible(src, tgt);
          if (vv === null) {
            unknowns.push('Voltage class could not be compared.');
          } else if (!vv) {
            differences.push('Voltage class differs');
            warnings.push('BLOCKING: Voltage class mismatch. Not compatible.');
            blocked = true;
          } else {
            matches.push('Voltage class (' + src.nominalVoltage + ')');
          }
          break;
        }
        case 'battery_family_or_group':
        case 'battery_family_code': {
          if (src.family && tgt.family && src.family === tgt.family) {
            matches.push('Battery family (' + src.family + ')');
          } else if (!src.family || !tgt.family) {
            unknowns.push('Battery family group could not be determined for one or both records.');
          } else {
            differences.push('Battery family differs: ' + src.family + ' vs ' + tgt.family);
          }
          break;
        }
        case 'terminal_polarity':
        case 'agm_efb_flooded_requirement':
        case 'connector_geometry': {
          /* These require human/supplier verification — flag as unknowns */
          unknowns.push(check.replace(/_/g, ' ').replace(/\b\w/g, function(l){return l.toUpperCase();}) + ' must be confirmed by supplier or vehicle/equipment documentation.');
          break;
        }
        default:
          break;
      }
    });

    return blocked;
  }

  /* ── Run conditional checks ─────────────────────────────── */
  function runConditionalChecks(src, tgt, profile, matches, differences, warnings, unknowns) {
    var checks = (profile && profile.conditionalChecks) || [];

    checks.forEach(function (check) {
      switch (check) {
        case 'chemistry':
        case 'discharge_profile': {
          var sc = src.chemistry || (src.chemistryOptions && src.chemistryOptions[0]);
          var tc = tgt.chemistry || (tgt.chemistryOptions && tgt.chemistryOptions[0]);
          if (!sc || !tc) {
            unknowns.push('Chemistry of one or both batteries is not confirmed in current records.');
          } else if (sc.toLowerCase() !== tc.toLowerCase()) {
            differences.push('Chemistry differs: ' + sc + ' vs ' + tc);
            warnings.push('Chemistry difference may affect device performance or safety. Verify with device documentation.');
          } else {
            matches.push('Chemistry (' + sc + ')');
          }
          break;
        }
        case 'physical_height': {
          var sh = src.dimensionsMm && src.dimensionsMm.height;
          var th = tgt.dimensionsMm && tgt.dimensionsMm.height;
          if (!sh || !th) {
            unknowns.push('Physical height could not be compared — dimension data not available for one or both records.');
          } else if (Math.abs(Number(sh) - Number(th)) > 0.3) {
            differences.push('Height differs: ' + sh + 'mm vs ' + th + 'mm');
            warnings.push('Height difference may affect physical fit. Compartment clearance must be confirmed.');
          } else {
            matches.push('Height (' + sh + 'mm)');
          }
          break;
        }
        case 'device_clearance':
        case 'contact_pressure':
        case 'manufacturer_approval':
        case 'charger_compatibility':
        case 'device_voltage_tolerance':
        case 'manufacturer_supported_compatibility':
        case 'generation_or_platform_restrictions':
        case 'vehicle_specific_fitment':
        case 'vehicle_battery_management_system':
        case 'battery_management_electronics': {
          unknowns.push(check.replace(/_/g, ' ').replace(/\b\w/g, function(l){return l.toUpperCase();}) + ' must be confirmed before use.');
          break;
        }
        case 'nominal_voltage': {
          /* In conditional (used for household_rechargeable) */
          var vvc = voltageCompatible(src, tgt);
          if (vvc === null) {
            unknowns.push('Voltage comparison not possible — data missing.');
          } else if (!vvc) {
            differences.push('Voltage differs: ' + src.nominalVoltage + ' vs ' + tgt.nominalVoltage);
            warnings.push('Voltage difference — verify device tolerance before use.');
          } else {
            matches.push('Voltage (' + src.nominalVoltage + ')');
          }
          break;
        }
        case 'dimensions': {
          unknowns.push('Detailed dimensions must be compared — verify physical fit with battery in hand or supplier data.');
          break;
        }
        case 'terminal_position':
        case 'hold_down_style':
        case 'venting_requirement':
        case 'cca_rating':
        case 'chemistry_agm_gel_flooded':
        case 'cranking_performance':
        case 'reserve_capacity':
        case 'physical_dimensions': {
          unknowns.push(check.replace(/_/g, ' ').replace(/\b\w/g, function(l){return l.toUpperCase();}) + ' must be confirmed with supplier or vehicle documentation.');
          break;
        }
        default:
          break;
      }
    });
  }

  /* ── Run informational checks ───────────────────────────── */
  function runInformationalChecks(src, tgt, profile, informational) {
    var checks = (profile && profile.informationalChecks) || [];
    checks.forEach(function (check) {
      switch (check) {
        case 'typical_capacity':
          informational.push('Typical capacity may differ between brands and models. Verify with supplier if capacity is critical to your application.');
          break;
        case 'start_stop_compatibility':
          if (src.startStopCompatibility || tgt.startStopCompatibility) {
            informational.push('Start-stop compatibility: ' + (src.startStopCompatibility || 'not specified') + ' — confirm for this vehicle.');
          }
          break;
        case 'typical_cca_range':
          informational.push('CCA rating varies by manufacturer and model. Confirm required CCA with vehicle documentation.');
          break;
        case 'self_discharge_rate':
          informational.push('Self-discharge rate varies by brand. Check brand specifications if storage life is important.');
          break;
        default:
          break;
      }
    });
  }

  /* ── Determine classification ───────────────────────────── */
  function determineClassification(blocked, relationship, srcStatus, tgtStatus, matches, differences, unknowns) {
    /* 1. If either battery is missing: insufficient evidence */
    if (!srcStatus || !tgtStatus) return CLASS.INSUFFICIENT_EVIDENCE;

    /* 2. If either battery is draft and no explicit relationship: insufficient evidence */
    if (
      (srcStatus.reviewStatus === 'draft' || tgtStatus.reviewStatus === 'draft') &&
      !relationship
    ) {
      return CLASS.INSUFFICIENT_EVIDENCE;
    }

    /* 3. Direct equivalent: only with approved explicit relationship */
    if (
      relationship &&
      relationship.reviewStatus === 'approved' &&
      relationship.classification === CLASS.DIRECT_EQUIVALENT
    ) {
      return CLASS.DIRECT_EQUIVALENT;
    }

    /* 3b. Explicit relationship classifications take precedence over generic rule outcomes */
    if (relationship && relationship.classification) {
      return relationship.classification;
    }

    /* 4. Same family: if relationship says same_standard_family or same_family */
    if (
      relationship &&
      (relationship.classification === CLASS.SAME_FAMILY ||
       relationship.relationshipType === 'same_standard_family')
    ) {
      return CLASS.SAME_FAMILY;
    }

    /* 5. Blocking incompatibility */
    if (blocked) return CLASS.NOT_RECOMMENDED;

    /* 6. No relationship: check attribute overlap */
    if (differences.length === 0 && unknowns.length === 0 && matches.length > 0) {
      /* All checked attributes match, but no explicit relationship → still need family check */
      return CLASS.SAME_FAMILY;
    }
    if (differences.length > 0 || unknowns.length > 2) {
      return CLASS.CONDITIONAL;
    }

    /* 7. Default: insufficient evidence */
    return CLASS.INSUFFICIENT_EVIDENCE;
  }

  /* ── Determine result confidence ────────────────────────── */
  function determineConfidence(classification, srcRec, tgtRec, relationship) {
    if (classification === CLASS.INSUFFICIENT_EVIDENCE) return CONFIDENCE.LOW;
    if (classification === CLASS.NOT_RECOMMENDED)       return CONFIDENCE.LOW;
    if (classification === CLASS.DIRECT_EQUIVALENT)     return CONFIDENCE.HIGH;

    if (relationship) return relationship.confidence || CONFIDENCE.LOW;

    var srcConf = srcRec ? srcRec.confidence : 'low';
    var tgtConf = tgtRec ? tgtRec.confidence : 'low';

    /* Take the lesser confidence */
    if (srcConf === 'low' || tgtConf === 'low') return CONFIDENCE.LOW;
    if (srcConf === 'medium' || tgtConf === 'medium') return CONFIDENCE.MEDIUM;
    return CONFIDENCE.MEDIUM; /* Conservative: don't claim high without relationship */
  }

  /* ── Build evidence summary ─────────────────────────────── */
  function buildEvidenceSummary(srcRec, tgtRec, relationship) {
    var summary = [];
    if (srcRec) {
      summary.push('Source record: ' + srcRec.displayName + ' — review status: ' + srcRec.reviewStatus);
    }
    if (tgtRec) {
      summary.push('Target record: ' + tgtRec.displayName + ' — review status: ' + tgtRec.reviewStatus);
    }
    if (relationship) {
      summary.push('Explicit relationship record found — review status: ' + relationship.reviewStatus);
      if (relationship.evidence && relationship.evidence.length) {
        relationship.evidence.forEach(function (e) {
          summary.push('Evidence: ' + (e.claim || '') + ' (status: ' + (e.verificationStatus || 'unverified') + ')');
        });
      } else {
        summary.push('No evidence items linked to this relationship record.');
      }
    } else {
      summary.push('No explicit relationship record found between these two batteries.');
    }
    return summary;
  }

  /* ── Main assess function ───────────────────────────────── */
  function assess(rawCodeA, rawCodeB, cb) {
    var normA = BatteryData.normaliseCode(rawCodeA);
    var normB = BatteryData.normaliseCode(rawCodeB);

    if (!normA || !normB) {
      return cb(null, {
        sourceBattery:             rawCodeA || '',
        targetBattery:             rawCodeB || '',
        classification:            CLASS.INSUFFICIENT_EVIDENCE,
        headline:                  headlineFor(CLASS.INSUFFICIENT_EVIDENCE),
        matches:                   [],
        differences:               [],
        warnings:                  ['One or both battery codes were empty.'],
        unknowns:                  [],
        informational:             [],
        confidence:                CONFIDENCE.LOW,
        evidenceSummary:           ['No codes provided.'],
        deviceVerificationRequired:  true,
        supplierVerificationRequired: true
      });
    }

    BatteryData.loadAll(function (errors, data) {
      var batteries  = (data && data.batteries)  || [];
      var ruleProfiles = (data && data.ruleProfiles) || {};
      function locateMatch(normCode) {
        var i;
        for (i = 0; i < batteries.length; i++) {
          if (batteries[i].canonicalCodeNormalised === normCode) return batteries[i];
        }
        for (i = 0; i < batteries.length; i++) {
          if (batteries[i].aliasesNormalised.indexOf(normCode) !== -1) return batteries[i];
        }
        if (normCode.length >= 3) {
          for (i = 0; i < batteries.length; i++) {
            var canon = batteries[i].canonicalCodeNormalised;
            if (normCode.indexOf(canon) === 0 || canon.indexOf(normCode) === 0) return batteries[i];
          }
        }
        return null;
      }

      /* Find records */
      var matchA = locateMatch(normA);
      var matchB = locateMatch(normB);

      /* Check for explicit relationship */
      var idA = matchA ? matchA.batteryId : null;
      var idB = matchB ? matchB.batteryId : null;
      var rels = (data && data.relationships) || [];
      var relationship = null;
      if (idA && idB) {
        for (var j = 0; j < rels.length; j++) {
          var r = rels[j];
          if (
            (r.sourceBatteryId === idA && r.targetBatteryId === idB) ||
            (r.sourceBatteryId === idB && r.targetBatteryId === idA)
          ) {
            relationship = r;
            break;
          }
        }
      }

      var matches       = [];
      var differences   = [];
      var warnings      = [];
      var unknowns      = [];
      var informational = [];

      /* Collect existing warnings/unknowns from both records */
      if (matchA) {
        matchA.warnings.forEach(function (w) { if (warnings.indexOf(w) === -1) warnings.push(w); });
        matchA.unknowns.forEach(function (u) { if (unknowns.indexOf(u) === -1) unknowns.push(u); });
      }
      if (matchB) {
        matchB.warnings.forEach(function (w) { if (warnings.indexOf(w) === -1) warnings.push(w); });
        matchB.unknowns.forEach(function (u) { if (unknowns.indexOf(u) === -1) unknowns.push(u); });
      }

      /* If relationship exists, use its matches/differences/warnings/unknowns */
      if (relationship) {
        (relationship.matches   || []).forEach(function (m) { if (matches.indexOf(m) === -1) matches.push(m); });
        (relationship.differences || []).forEach(function (d) { if (differences.indexOf(d) === -1) differences.push(d); });
        (relationship.warnings  || []).forEach(function (w) { if (warnings.indexOf(w) === -1) warnings.push(w); });
        (relationship.unknowns  || []).forEach(function (u) { if (unknowns.indexOf(u) === -1) unknowns.push(u); });
      }

      /* If we have both records, run rule-based checks */
      var blocked = false;
      if (matchA && matchB) {
        var category = categoryCompatible(matchA, matchB) ? matchA.category : matchA.category;
        /* Use the source battery's category to select profile */
        var profile = ruleProfiles[category] || null;
        blocked = runBlockingChecks(matchA, matchB, profile, matches, differences, warnings, unknowns);
        if (!blocked) {
          runConditionalChecks(matchA, matchB, profile, matches, differences, warnings, unknowns);
        }
        runInformationalChecks(matchA, matchB, profile, informational);
      } else {
        /* Missing record(s) */
        if (!matchA) unknowns.push('Source battery "' + rawCodeA + '" was not found in the current reference database.');
        if (!matchB) unknowns.push('Target battery "' + rawCodeB + '" was not found in the current reference database.');
      }

      var classification = determineClassification(blocked, relationship, matchA, matchB, matches, differences, unknowns);
      var confidence     = determineConfidence(classification, matchA, matchB, relationship);
      var evidenceSummary = buildEvidenceSummary(matchA, matchB, relationship);

      var devVerif = true;
      var supVerif = true;
      if (relationship) {
        devVerif = relationship.deviceVerificationRequired !== false;
        supVerif = relationship.supplierVerificationRequired !== false;
      }

      cb(null, {
        sourceBattery:             rawCodeA,
        targetBattery:             rawCodeB,
        sourceRecord:              matchA || null,
        targetRecord:              matchB || null,
        classification:            classification,
        headline:                  headlineFor(classification),
        matches:                   matches,
        differences:               differences,
        warnings:                  warnings,
        unknowns:                  unknowns,
        informational:             informational,
        confidence:                confidence,
        evidenceSummary:           evidenceSummary,
        deviceVerificationRequired:  devVerif,
        supplierVerificationRequired: supVerif,
        relationshipFound:         !!relationship
      });
    });
  }

  /* ── Public API ─────────────────────────────────────────── */
  return { assess: assess, CLASS: CLASS };
}));
