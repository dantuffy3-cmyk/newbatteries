/* =============================================================
   NewBatteries – physical-fit-engine.js
   Physical Fit Model V1 for coin-cell and automotive profiles.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./rule-engine'));
  } else {
    root.NBPhysicalFitEngine = factory(root.NBRuleEngine);
  }
}(typeof self !== 'undefined' ? self : this, function (RuleEngine) {
  'use strict';

  var CONFIDENCE_RANK = {
    high: 4,
    medium: 3,
    low: 2,
    unverified: 1
  };

  var FIELD_LABELS = {
    'candidate.lengthMm': 'Candidate length',
    'candidate.widthMm': 'Candidate width',
    'candidate.heightMm': 'Candidate height',
    'candidate.diameterMm': 'Candidate diameter',
    'candidate.thicknessMm': 'Candidate thickness',
    'candidate.terminalType': 'Candidate terminal type',
    'candidate.terminalLayout': 'Candidate terminal layout',
    'candidate.connectorKeying': 'Candidate connector keying',
    'candidate.polarityOrientation': 'Candidate polarity orientation',
    'candidate.terminalPosition': 'Terminal orientation',
    'candidate.holdDownType': 'Candidate hold-down type',
    'candidate.contactArrangement': 'Coin-cell contact arrangement',
    'candidate.sameFamilyMatch': 'Battery family recognition',
    'candidate.variantResolved': 'Battery family variant',
    'candidate.weightDifferenceKnown': 'Weight difference evidence',
    'candidate.caseStyleDiffers': 'Case style difference',
    'candidate.caseStyleAffectsFit': 'Case style fit impact',
    'candidate.lessUnusedClearanceConfirmed': 'Unused clearance note',
    'compartment.maxLengthMm': 'Compartment length',
    'compartment.maxWidthMm': 'Compartment width',
    'compartment.maxHeightMm': 'Compartment height',
    'compartment.maxDiameterMm': 'Compartment diameter',
    'compartment.maxThicknessMm': 'Compartment thickness',
    'compartment.requiredTerminalType': 'Required terminal type',
    'compartment.requiredTerminalLayout': 'Required terminal layout',
    'compartment.requiredConnectorKeying': 'Connector keying',
    'compartment.requiredPolarityOrientation': 'Polarity orientation',
    'compartment.requiredTerminalPosition': 'Terminal position',
    'compartment.requiredContactArrangement': 'Coin-cell contact arrangement',
    'compartment.holdDownType': 'Hold-down type',
    'compartment.coverClearanceMm': 'Cover clearance',
    'compartment.coverClearanceNearLimit': 'Cover clearance near limit',
    'compartment.cableReachConfirmed': 'Cable reach',
    'compartment.shapeConfirmed': 'Compartment shape',
    'compartment.referenceThicknessMm': 'Reference coin-cell thickness',
    'compartment.contactClearanceConfirmed': 'Coin-cell contact clearance',
    'compartment.contactPressureConfirmed': 'Coin-cell contact pressure',
    'evidenceFlags.approximateMeasurement': 'Measurement precision',
    'evidenceFlags.terminalViewPhotoProvided': 'Terminal-view photo'
  };

  var PASS_LABELS = {
    'PHYS-COIN-DIAMETER-001': 'Confirmed coin-cell diameter fits within the supplied compartment diameter.',
    'PHYS-COIN-THICKNESS-001': 'Confirmed coin-cell thickness fits within the supplied compartment thickness.',
    'PHYS-COIN-CONTACT-001': 'Confirmed contact arrangement matches the supplied compartment requirement.',
    'PHYS-COIN-CLEARANCE-001': 'No unresolved coin-cell clearance condition is active from the supplied evidence.',
    'PHYS-AUTO-LENGTH-001': 'Confirmed battery length fits within the supplied compartment length.',
    'PHYS-AUTO-WIDTH-001': 'Confirmed battery width fits within the supplied compartment width.',
    'PHYS-AUTO-HEIGHT-001': 'Confirmed battery height fits within the supplied compartment height.',
    'PHYS-AUTO-TERMINAL-TYPE-001': 'Confirmed terminal type matches the supplied connection requirement.',
    'PHYS-AUTO-LAYOUT-001': 'Confirmed terminal layout matches the supplied connector geometry.',
    'PHYS-AUTO-KEYING-001': 'Confirmed connector keying matches the supplied connection hardware.',
    'PHYS-AUTO-POLARITY-001': 'Confirmed polarity orientation matches the supplied cable arrangement.',
    'PHYS-AUTO-TERMINAL-POSITION-001': 'Confirmed terminal orientation matches the supplied cable routing.',
    'PHYS-AUTO-HOLD-DOWN-001': 'Confirmed hold-down type matches the supplied securing method.',
    'PHYS-AUTO-COVER-CLOSE-001': 'Confirmed top cover clearance is sufficient for the supplied battery height.',
    'PHYS-AUTO-CABLE-UNSAFE-001': 'Confirmed cable reach does not require unsafe stretching or modification.',
    'PHYS-AUTO-CABLE-UNKNOWN-001': 'Cable reach has been confirmed.',
    'PHYS-AUTO-TERMINAL-ORIENTATION-UNKNOWN-001': 'Terminal orientation has been confirmed.',
    'PHYS-AUTO-HOLD-DOWN-UNKNOWN-001': 'Hold-down type has been confirmed.',
    'PHYS-AUTO-COVER-CLOSE-LIMIT-001': 'Cover clearance is not flagged as near the known limit.',
    'PHYS-AUTO-COVER-CLEARANCE-UNKNOWN-001': 'Cover clearance has been confirmed.',
    'PHYS-AUTO-SHAPE-UNKNOWN-001': 'Compartment shape and access constraints have been confirmed.',
    'PHYS-AUTO-FAMILY-VARIANT-001': 'The exact battery family variant has been confirmed.',
    'PHYS-AUTO-APPROX-MEASUREMENT-001': 'Measurements are not marked as approximate.',
    'PHYS-AUTO-TERMINAL-PHOTO-001': 'Terminal-view evidence has been supplied.'
  };

  var AREAS_NOT_ASSESSED = [
    'Electrical compatibility',
    'Battery chemistry or technology suitability',
    'Charging compatibility',
    'Overall replacement safety'
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function unique(items) {
    var out = [];
    (items || []).forEach(function (item) {
      if (!item || out.indexOf(item) !== -1) return;
      out.push(item);
    });
    return out;
  }

  function hasKnownValue(value) {
    return RuleEngine.hasKnownValue(value);
  }

  function getValueByPath(obj, path) {
    return RuleEngine.getValueByPath(obj, path);
  }

  function labelForField(path) {
    return FIELD_LABELS[path] || path;
  }

  function minKnown(values) {
    var known = values.filter(function (value) {
      return hasKnownValue(value);
    });
    if (!known.length) return null;
    return Math.min.apply(Math, known.map(Number));
  }

  function enrichInput(input) {
    var enriched = clone(input);
    var candidate = enriched.candidate || {};
    var compartment = enriched.compartment || {};
    enriched.candidate = candidate;
    enriched.compartment = compartment;
    enriched.evidenceFlags = enriched.evidenceFlags || {};
    enriched.derived = enriched.derived || {};

    if (enriched.categoryProfile === 'automotive') {
      if (hasKnownValue(candidate.heightMm) && hasKnownValue(compartment.coverClearanceMm)) {
        enriched.derived.heightClearanceRemainingMm = Number(compartment.coverClearanceMm) - Number(candidate.heightMm);
      }
      if (hasKnownValue(candidate.lengthMm) && hasKnownValue(compartment.maxLengthMm)) {
        enriched.derived.lengthClearanceRemainingMm = Number(compartment.maxLengthMm) - Number(candidate.lengthMm);
      }
      if (hasKnownValue(candidate.widthMm) && hasKnownValue(compartment.maxWidthMm)) {
        enriched.derived.widthClearanceRemainingMm = Number(compartment.maxWidthMm) - Number(candidate.widthMm);
      }
      if (hasKnownValue(candidate.heightMm) && hasKnownValue(compartment.maxHeightMm)) {
        enriched.derived.heightCompartmentRemainingMm = Number(compartment.maxHeightMm) - Number(candidate.heightMm);
      }
      enriched.derived.minRemainingClearanceMm = minKnown([
        enriched.derived.lengthClearanceRemainingMm,
        enriched.derived.widthClearanceRemainingMm,
        enriched.derived.heightCompartmentRemainingMm
      ]);
      enriched.derived.caseStyleDiffersWithoutImpact = candidate.caseStyleDiffers === true && candidate.caseStyleAffectsFit === false;
    }

    if (enriched.categoryProfile === 'coin_cell') {
      enriched.derived.thickerWithUnresolvedClearance = false;
      if (hasKnownValue(candidate.thicknessMm) && hasKnownValue(compartment.referenceThicknessMm)) {
        enriched.derived.thickerWithUnresolvedClearance = Number(candidate.thicknessMm) > Number(compartment.referenceThicknessMm) &&
          (compartment.contactClearanceConfirmed !== true || compartment.contactPressureConfirmed !== true);
      }
    }

    return enriched;
  }

  function selectRules(ruleDefinitions, categoryProfile) {
    var rules = [];
    if (Array.isArray(ruleDefinitions)) {
      rules = ruleDefinitions;
    } else if (ruleDefinitions && Array.isArray(ruleDefinitions.rules)) {
      rules = ruleDefinitions.rules;
    }
    return rules.filter(function (rule) {
      return rule.layer === 'physical_fit' && rule.categoryProfile === categoryProfile;
    });
  }

  function relevantEvidence(ruleResults, evidenceRecords) {
    var fields = [];
    ruleResults.forEach(function (result) {
      if (result.status === 'not_applicable') return;
      fields = fields.concat(result.missingRequiredFields || []);
      Object.keys(result.inputValues || {}).forEach(function (field) {
        fields.push(field);
      });
    });
    return (evidenceRecords || []).filter(function (record) {
      return fields.indexOf(record.field) !== -1;
    });
  }

  function overallConfidenceFor(ruleResults, evidenceRecords) {
    var criticalFields = [];
    var pool;
    var minRank = Infinity;
    var confidence = null;

    ruleResults.forEach(function (result) {
      if (result.critical) {
        criticalFields = criticalFields.concat(result.missingRequiredFields || []);
        Object.keys(result.inputValues || {}).forEach(function (field) {
          criticalFields.push(field);
        });
      }
    });

    pool = (evidenceRecords || []).filter(function (record) {
      return criticalFields.indexOf(record.field) !== -1;
    });
    if (!pool.length) pool = relevantEvidence(ruleResults, evidenceRecords);
    if (!pool.length) return 'unverified';

    pool.forEach(function (record) {
      var rank = CONFIDENCE_RANK[record.confidence] || 1;
      if (rank < minRank) {
        minRank = rank;
        confidence = record.confidence || 'unverified';
      }
    });

    return confidence || 'unverified';
  }

  function buildUnknowns(ruleResults, outcome) {
    var unknowns = [];
    ruleResults.forEach(function (result) {
      if (result.status === 'not_applicable' || result.ruleType === 'informational') return;
      if (outcome === 'insufficient_evidence' && !result.criticalEvidenceMissing) return;
      (result.missingRequiredFields || []).forEach(function (field) {
        unknowns.push(labelForField(field));
      });
      if (result.status === 'unknown' && result.unknownLabel) {
        unknowns.push(result.unknownLabel);
      }
    });
    return unique(unknowns);
  }

  function buildIssues(ruleResults, type, statuses) {
    return ruleResults.filter(function (result) {
      return result.ruleType === type && statuses.indexOf(result.status) !== -1;
    }).map(function (result) {
      return {
        ruleId: result.ruleId,
        message: result.message,
        technicalReason: result.technicalReason,
        evidenceRefs: result.evidenceRefs || [],
        resolutionActions: result.resolutionActions || []
      };
    });
  }

  function buildRequiredNextActions(ruleResults, outcome) {
    var actions = [];
    if (outcome === 'blocked') {
      buildIssues(ruleResults, 'blocking', ['fail']).forEach(function (issue) {
        actions = actions.concat(issue.resolutionActions || []);
      });
    } else if (outcome === 'insufficient_evidence') {
      ruleResults.forEach(function (result) {
        if (result.criticalEvidenceMissing) actions = actions.concat(result.resolutionActions || []);
      });
    } else if (outcome === 'compatible_with_conditions') {
      buildIssues(ruleResults, 'conditional', ['conditional', 'unknown']).forEach(function (issue) {
        actions = actions.concat(issue.resolutionActions || []);
      });
    }
    return unique(actions);
  }

  function buildConfirmedChecks(ruleResults) {
    return ruleResults.filter(function (result) {
      return result.ruleType !== 'informational' && result.status === 'pass';
    }).map(function (result) {
      return PASS_LABELS[result.ruleId] || (result.name ? result.name + ' has been confirmed by the supplied evidence.' : 'A physical-fit check has passed with the supplied evidence.');
    });
  }

  function buildEvidenceStillRequired(ruleResults, outcome) {
    var evidence = [];
    ruleResults.forEach(function (result) {
      if (result.status === 'not_applicable' || result.ruleType === 'informational') return;
      if (outcome === 'insufficient_evidence') {
        if (!result.criticalEvidenceMissing) return;
      } else if (result.status !== 'unknown') {
        return;
      }
      (result.missingRequiredFields || []).forEach(function (field) {
        evidence.push(labelForField(field));
      });
      if (result.status === 'unknown' && result.unknownLabel) evidence.push(result.unknownLabel);
    });
    return unique(evidence);
  }

  function buildRecommendation(key, request, reason, fields, ruleId) {
    return {
      key: key,
      request: request,
      reason: reason,
      fields: fields || [],
      ruleId: ruleId || null
    };
  }

  function recommendNextEvidence(ruleResults, outcome, categoryProfile) {
    var criticalMissing = ruleResults.filter(function (result) {
      return result.criticalEvidenceMissing;
    });
    var unresolvedUnknowns = ruleResults.filter(function (result) {
      return result.ruleType !== 'informational' && result.status === 'unknown';
    });
    var missingFields = unique([].concat.apply([], criticalMissing.map(function (result) {
      return result.missingRequiredFields || [];
    })));
    var unresolvedByRuleId = {};
    var i;

    for (i = 0; i < unresolvedUnknowns.length; i += 1) {
      unresolvedByRuleId[unresolvedUnknowns[i].ruleId] = unresolvedUnknowns[i];
    }

    if (outcome === 'blocked') return null;

    if (categoryProfile === 'automotive') {
      var missingCompartments = ['compartment.maxLengthMm', 'compartment.maxWidthMm', 'compartment.maxHeightMm'].filter(function (field) {
        return missingFields.indexOf(field) !== -1;
      });
      if (missingCompartments.length > 1) {
        return buildRecommendation(
          'automotive-compartment-dimensions',
          'Request confirmed compartment length, width and height measurements in millimetres.',
          'The highest-value next evidence is the missing compartment size because physical fit cannot be confirmed without the available space.',
          missingCompartments
        );
      }
      if (missingFields.indexOf('compartment.maxHeightMm') !== -1) {
        return buildRecommendation(
          'automotive-compartment-height',
          'Request the available compartment height measurement or clear compartment height evidence.',
          'Compartment height is the missing critical evidence for this physical-fit decision.',
          ['compartment.maxHeightMm']
        );
      }
      if (missingFields.indexOf('compartment.maxLengthMm') !== -1) {
        return buildRecommendation(
          'automotive-compartment-length',
          'Request the available compartment length measurement or clear compartment evidence.',
          'Compartment length is the missing critical evidence for this physical-fit decision.',
          ['compartment.maxLengthMm']
        );
      }
      if (missingFields.indexOf('compartment.maxWidthMm') !== -1) {
        return buildRecommendation(
          'automotive-compartment-width',
          'Request the available compartment width measurement or clear compartment evidence.',
          'Compartment width is the missing critical evidence for this physical-fit decision.',
          ['compartment.maxWidthMm']
        );
      }
      if (unresolvedByRuleId['PHYS-AUTO-CABLE-UNKNOWN-001']) {
        return buildRecommendation(
          'automotive-cable-reach',
          'Request a clear terminal-and-cable photo to confirm cable reach.',
          'Cable reach is the next unresolved condition and can change installation feasibility even when dimensions pass.',
          ['compartment.cableReachConfirmed'],
          'PHYS-AUTO-CABLE-UNKNOWN-001'
        );
      }
      if (unresolvedByRuleId['PHYS-AUTO-COVER-CLEARANCE-UNKNOWN-001']) {
        return buildRecommendation(
          'automotive-cover-clearance',
          'Request a closed-cover clearance measurement or a clear compartment photo.',
          'Cover clearance remains unresolved, so top interference has not yet been ruled out.',
          ['compartment.coverClearanceMm'],
          'PHYS-AUTO-COVER-CLEARANCE-UNKNOWN-001'
        );
      }
      if (unresolvedByRuleId['PHYS-AUTO-HOLD-DOWN-UNKNOWN-001']) {
        return buildRecommendation(
          'automotive-hold-down',
          'Request a photo of the battery base and mounting system to confirm the hold-down type.',
          'Secure mounting still needs confirmation before this physical-fit result can be relied on.',
          ['compartment.holdDownType'],
          'PHYS-AUTO-HOLD-DOWN-UNKNOWN-001'
        );
      }
      if (unresolvedByRuleId['PHYS-AUTO-TERMINAL-ORIENTATION-UNKNOWN-001']) {
        return buildRecommendation(
          'automotive-terminal-orientation',
          'Request a top-down terminal photo or terminal diagram to confirm orientation.',
          'Terminal orientation is still unresolved and can affect real-world cable routing.',
          ['candidate.terminalPosition'],
          'PHYS-AUTO-TERMINAL-ORIENTATION-UNKNOWN-001'
        );
      }
    }

    if (categoryProfile === 'coin_cell') {
      var missingCoinDimensions = ['compartment.maxDiameterMm', 'compartment.maxThicknessMm'].filter(function (field) {
        return missingFields.indexOf(field) !== -1;
      });
      if (missingCoinDimensions.length > 1) {
        return buildRecommendation(
          'coin-cell-compartment-dimensions',
          'Request confirmed compartment diameter and thickness measurements in millimetres.',
          'Coin-cell physical fit cannot be resolved without the available compartment dimensions.',
          missingCoinDimensions
        );
      }
      if (missingFields.indexOf('compartment.maxThicknessMm') !== -1 || missingFields.indexOf('compartment.referenceThicknessMm') !== -1) {
        return buildRecommendation(
          'coin-cell-thickness',
          'Request compartment depth or original battery-code evidence to confirm coin-cell thickness.',
          'Thickness remains the most valuable unresolved evidence for the current coin-cell fit decision.',
          ['compartment.maxThicknessMm', 'compartment.referenceThicknessMm']
        );
      }
      if (missingFields.indexOf('compartment.maxDiameterMm') !== -1) {
        return buildRecommendation(
          'coin-cell-diameter',
          'Request the available compartment diameter measurement or a clear compartment photo.',
          'Diameter is the missing critical evidence for this coin-cell physical-fit decision.',
          ['compartment.maxDiameterMm']
        );
      }
      if (unresolvedByRuleId['PHYS-COIN-CLEARANCE-001']) {
        return buildRecommendation(
          'coin-cell-clearance',
          'Request compartment depth or original battery-code evidence to confirm coin-cell thickness clearance.',
          'The coin cell may be thicker than the reference fit and clearance still needs to be confirmed.',
          ['compartment.referenceThicknessMm', 'compartment.contactClearanceConfirmed', 'compartment.contactPressureConfirmed'],
          'PHYS-COIN-CLEARANCE-001'
        );
      }
    }

    if (criticalMissing.length && missingFields.length) {
      return buildRecommendation(
        'critical-missing-evidence',
        'Request the next missing critical physical-fit evidence before relying on this result.',
        'One or more critical rule checks still lack required evidence.',
        missingFields
      );
    }

    if (unresolvedUnknowns.length && unresolvedUnknowns[0].resolutionActions && unresolvedUnknowns[0].resolutionActions.length) {
      return buildRecommendation(
        'unresolved-condition',
        unresolvedUnknowns[0].resolutionActions[0],
        unresolvedUnknowns[0].technicalReason || 'An unresolved physical-fit condition still needs evidence.',
        unresolvedUnknowns[0].missingRequiredFields || [],
        unresolvedUnknowns[0].ruleId
      );
    }

    return null;
  }

  function buildEvidenceSummary(ruleResults, evidenceRecords) {
    var criticalEvidenceComplete = !ruleResults.some(function (result) {
      return result.criticalEvidenceMissing;
    });
    return {
      overallConfidence: overallConfidenceFor(ruleResults, evidenceRecords),
      criticalEvidenceComplete: criticalEvidenceComplete,
      completenessLabel: criticalEvidenceComplete ? 'Critical evidence complete' : 'Critical evidence missing'
    };
  }

  function buildSummary(outcome, blockingIssues, conditions, unknowns) {
    if (outcome === 'blocked') {
      return blockingIssues.length ? blockingIssues[0].message : 'A confirmed physical conflict prevents the replacement.';
    }
    if (outcome === 'insufficient_evidence') {
      return unknowns.length ? 'Additional evidence is required before physical fit can be confirmed: ' + unknowns.join(', ') + '.' : 'Additional critical evidence is required before physical fit can be assessed.';
    }
    if (outcome === 'compatible_with_conditions') {
      return conditions.length ? 'The battery may fit physically, but confirmation is still required: ' + conditions[0].message : 'The battery may fit physically, but one or more checks still need confirmation.';
    }
    if (outcome === 'compatible') {
      return 'All required physical-fit checks pass with the supplied evidence.';
    }
    return 'The supplied information is not yet sufficient to place this result confidently into a more precise outcome.';
  }

  function evaluatePhysicalFit(input, ruleDefinitions) {
    var categoryProfile = input && input.categoryProfile;
    var evidenceRecords = (input && input.evidence) || [];
    var enrichedInput;
    var rules;
    var ruleResults;
    var aggregate;
    var blockingIssues;
    var conditions;
    var informationalNotes;
    var unknowns;
    var confirmedChecks;
    var evidenceStillRequired;
    var requiredNextActions;
    var evidenceSummary;
    var nextEvidenceRecommendation;

    if (!categoryProfile || ['coin_cell', 'automotive'].indexOf(categoryProfile) === -1) {
      return {
        layer: 'physical_fit',
        categoryProfile: categoryProfile || null,
        outcome: 'uncertain',
        summary: 'This physical-fit layer currently supports coin-cell and automotive profiles only.',
        ruleResults: [],
        blockingIssues: [],
        conditions: [],
        informationalNotes: [],
        unknowns: [],
        requiredNextActions: ['Use a supported category profile: coin_cell or automotive.'],
        evidenceSummary: {
          overallConfidence: 'unverified',
          criticalEvidenceComplete: false,
          completenessLabel: 'Unsupported category profile'
        },
        supplierConfirmationRequired: true
      };
    }

    enrichedInput = enrichInput(input || {});
    rules = selectRules(ruleDefinitions, categoryProfile);
    ruleResults = RuleEngine.evaluateRules(rules, enrichedInput, evidenceRecords);
    aggregate = RuleEngine.aggregateLayerOutcome(ruleResults);

    blockingIssues = buildIssues(ruleResults, 'blocking', ['fail']);
    conditions = buildIssues(ruleResults, 'conditional', ['conditional', 'unknown']);
    informationalNotes = buildIssues(ruleResults, 'informational', ['pass']);
    unknowns = buildUnknowns(ruleResults, aggregate.outcome);
    confirmedChecks = buildConfirmedChecks(ruleResults);
    evidenceStillRequired = buildEvidenceStillRequired(ruleResults, aggregate.outcome);
    requiredNextActions = buildRequiredNextActions(ruleResults, aggregate.outcome);
    evidenceSummary = buildEvidenceSummary(ruleResults, evidenceRecords);
    nextEvidenceRecommendation = recommendNextEvidence(ruleResults, aggregate.outcome, categoryProfile);

    return {
      layer: 'physical_fit',
      categoryProfile: categoryProfile,
      outcome: aggregate.outcome,
      summary: buildSummary(aggregate.outcome, blockingIssues, conditions, unknowns),
      ruleResults: ruleResults,
      confirmedChecks: confirmedChecks,
      blockingIssues: blockingIssues,
      conditions: conditions,
      informationalNotes: informationalNotes,
      unknowns: unknowns,
      evidenceStillRequired: evidenceStillRequired,
      nextEvidenceRecommendation: nextEvidenceRecommendation,
      requiredNextActions: requiredNextActions,
      evidenceSummary: evidenceSummary,
      areasNotAssessed: AREAS_NOT_ASSESSED.slice(),
      supplierConfirmationRequired: aggregate.outcome !== 'compatible' || evidenceSummary.overallConfidence === 'low' || evidenceSummary.overallConfidence === 'unverified'
    };
  }

  return {
    evaluatePhysicalFit: evaluatePhysicalFit,
    selectRules: selectRules,
    enrichInput: enrichInput,
    labelForField: labelForField,
    recommendNextEvidence: recommendNextEvidence
  };
}));
