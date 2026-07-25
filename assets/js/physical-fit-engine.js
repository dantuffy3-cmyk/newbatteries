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
    'candidate.polarityOrientation': 'Candidate polarity orientation',
    'candidate.terminalPosition': 'Terminal orientation',
    'candidate.holdDownType': 'Candidate hold-down type',
    'candidate.contactArrangement': 'Coin-cell contact arrangement',
    'candidate.lessUnusedClearanceConfirmed': 'Unused clearance note',
    'candidate.variantResolved': 'Battery family variant',
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

  function buildUnknowns(ruleResults) {
    var unknowns = [];
    ruleResults.forEach(function (result) {
      if (result.status === 'not_applicable') return;
      (result.missingRequiredFields || []).forEach(function (field) {
        unknowns.push(labelForField(field));
      });
      if (result.ruleType === 'conditional' && result.status === 'unknown' && result.unknownLabel) {
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
    var requiredNextActions;
    var evidenceSummary;

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
    unknowns = buildUnknowns(ruleResults);
    requiredNextActions = buildRequiredNextActions(ruleResults, aggregate.outcome);
    evidenceSummary = buildEvidenceSummary(ruleResults, evidenceRecords);

    return {
      layer: 'physical_fit',
      categoryProfile: categoryProfile,
      outcome: aggregate.outcome,
      summary: buildSummary(aggregate.outcome, blockingIssues, conditions, unknowns),
      ruleResults: ruleResults,
      blockingIssues: blockingIssues,
      conditions: conditions,
      informationalNotes: informationalNotes,
      unknowns: unknowns,
      requiredNextActions: requiredNextActions,
      evidenceSummary: evidenceSummary,
      supplierConfirmationRequired: aggregate.outcome !== 'compatible' || evidenceSummary.overallConfidence === 'low' || evidenceSummary.overallConfidence === 'unverified'
    };
  }

  return {
    evaluatePhysicalFit: evaluatePhysicalFit,
    selectRules: selectRules,
    enrichInput: enrichInput,
    labelForField: labelForField
  };
}));
