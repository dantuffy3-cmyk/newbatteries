(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./controlled-vocabulary.js'),
      require('./public-safety.js')
    );
  } else {
    root.NBGovernedEvidenceEngine = factory(
      root.NBGovernedVocabulary,
      root.NBGovernedPublicSafety
    );
  }
}(typeof self !== 'undefined' ? self : this, function (vocabulary, safetyModule) {
  'use strict';

  var overallAssessmentLabels = vocabulary.overallAssessmentLabels;
  var dimensionLabels = vocabulary.dimensionLabels;
  var statusLabels = vocabulary.statusLabels;
  var dimensionOrder = vocabulary.dimensionOrder;
  var canRenderPublicRecord = safetyModule.canRenderPublicRecord;

  function getByPath(obj, path) {
    return String(path || '').split('.').reduce(function (acc, key) {
      return acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined;
    }, obj);
  }

  function normaliseCode(value) {
    return String(value || '').replace(/[\s\-\.]/g, '').toUpperCase();
  }

  function lower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function pushDimension(map, id, status, explanation, evidenceUsed, missingEvidence) {
    map[id] = {
      id: id,
      label: dimensionLabels[id] || id,
      status: status,
      statusLabel: statusLabels[status] || status,
      explanation: explanation,
      evidenceUsed: evidenceUsed || [],
      missingEvidence: missingEvidence || []
    };
  }

  function collectObserved(observation) {
    var result = [];
    var raw = observation.raw_input || {};
    var normalised = observation.normalised_observations || {};
    Object.keys(raw).forEach(function (key) {
      if (raw[key] === null || raw[key] === undefined || raw[key] === '') return;
      result.push({
        field: key,
        rawValue: raw[key],
        normalisedValue: Object.prototype.hasOwnProperty.call(normalised, key) ? normalised[key] : null
      });
    });
    return result;
  }

  function collectVerified(record) {
    var verified = [];
    [
      ['identification.canonicalCode', 'Canonical designation'],
      ['identification.standardFamily', 'Standard family'],
      ['chemistry.chemistryFamily.value', 'Chemistry'],
      ['electrical.nominalVoltage.value', 'Nominal voltage'],
      ['physical.diameterMm.value', 'Diameter'],
      ['physical.thicknessMm.value', 'Thickness'],
      ['physical.lengthMm.value', 'Length'],
      ['physical.widthMm.value', 'Width'],
      ['physical.heightMm.value', 'Height'],
      ['physical.polarityOrientation.value', 'Polarity'],
      ['physical.terminalType.value', 'Terminal type']
    ].forEach(function (entry) {
      var value = getByPath(record, entry[0]);
      if (value !== null && value !== undefined && value !== '') {
        verified.push({ field: entry[0], label: entry[1], value: value });
      }
    });
    return verified;
  }

  function buildCandidateIdentity(record) {
    return {
      canonicalDesignation: getByPath(record, 'identification.canonicalCode') || record.canonicalName,
      displayName: record.canonicalName || getByPath(record, 'identification.canonicalCode'),
      scope: getByPath(record, 'identification.scope') || record.recordType || null,
      category: getByPath(record, 'identification.category') || null,
      chemistry: getByPath(record, 'chemistry.chemistryFamily.value') || null,
      nominalVoltage: getByPath(record, 'electrical.nominalVoltage.value') || null,
      recordStatus: getByPath(record, 'recordGovernance.recordStatus') || null,
      fixtureWarning: 'Synthetic fixture data — not a public compatibility recommendation'
    };
  }

  function evaluateCandidate(record, observation, matchContext) {
    var derived = [];
    var conflicts = [];
    var unknowns = [];
    var withheld = [];
    var escalation = [];
    var dimensionMap = {};
    var normalised = observation.normalised_observations || {};
    var safety = canRenderPublicRecord(record);
    var candidateIdentity = buildCandidateIdentity(record);
    var score = 0;

    if (safety.blockingReasons.length) {
      withheld.push({
        label: 'Public rendering blocked',
        reason: 'Fixture output remains development-only: ' + safety.blockingReasons.join(', ')
      });
    }

    if (matchContext.matchType === 'exact') {
      score += 4;
      derived.push({
        ruleId: 'NB-IDENT-001',
        inputEvidence: ['battery_code=' + (normalised.battery_code || '')],
        result: 'Exact code matched fixture identity.',
        explanation: 'The entered code matched a synthetic governed identity fixture exactly.'
      });
      pushDimension(dimensionMap, 'identity', 'supported', 'The entered code matches the candidate identity exactly.', ['battery_code', candidateIdentity.canonicalDesignation], []);
    } else if (matchContext.matchType === 'family') {
      score += 2;
      derived.push({
        ruleId: 'NB-IDENT-002',
        inputEvidence: ['battery_code=' + (normalised.battery_code || normalised.partial_battery_code || '')],
        result: 'Family-level identity supported.',
        explanation: 'The available code supports only a family-level identification.'
      });
      pushDimension(dimensionMap, 'identity', 'partial', 'The evidence supports a family identification only.', ['battery_code'], ['exact variant suffix or direct label photo']);
      withheld.push({
        label: 'Exact identity withheld',
        reason: 'Family-level evidence does not justify an exact-product conclusion.'
      });
    } else {
      pushDimension(dimensionMap, 'identity', 'unknown', 'No exact or family identity evidence was available.', [], ['battery code or direct label evidence']);
    }

    var observedVoltage = normalised.nominal_voltage;
    var candidateVoltage = getByPath(record, 'electrical.nominalVoltage.value');
    if (observedVoltage) {
      if (observedVoltage === candidateVoltage) {
        score += 1;
        pushDimension(dimensionMap, 'nominal_voltage', 'supported', 'Observed voltage aligns with the candidate fixture.', [observedVoltage], []);
        derived.push({
          ruleId: 'NB-VOLT-001',
          inputEvidence: ['nominal_voltage=' + observedVoltage],
          result: 'Observed nominal voltage aligns with the candidate fixture.',
          explanation: 'Voltage evidence supports the current candidate.'
        });
      } else {
        conflicts.push({
          label: 'Voltage mismatch',
          severity: 'safety',
          explanation: 'Observed voltage ' + observedVoltage + ' conflicts with candidate voltage ' + candidateVoltage + '.'
        });
        pushDimension(dimensionMap, 'nominal_voltage', 'conflict', 'Observed voltage conflicts with the candidate fixture.', [observedVoltage, candidateVoltage], []);
      }
    } else {
      unknowns.push('Nominal voltage remains unknown.');
      pushDimension(dimensionMap, 'nominal_voltage', 'unknown', 'No observed nominal voltage was supplied.', [], ['photograph voltage marking']);
      withheld.push({
        label: 'Compatibility recommendation withheld',
        reason: 'Replacement recommendation withheld until voltage is known.'
      });
    }

    var observedChemistry = normalised.chemistry;
    var candidateChemistry = getByPath(record, 'chemistry.chemistryFamily.value');
    if (observedChemistry) {
      if (observedChemistry === candidateChemistry) {
        score += 1;
        pushDimension(dimensionMap, 'chemistry', 'supported', 'Observed chemistry aligns with the candidate fixture.', [observedChemistry], []);
      } else {
        conflicts.push({
          label: 'Chemistry mismatch',
          severity: 'safety',
          explanation: 'Observed chemistry ' + observedChemistry + ' conflicts with candidate chemistry ' + candidateChemistry + '.'
        });
        derived.push({
          ruleId: 'NB-CHEM-001',
          inputEvidence: ['chemistry=' + observedChemistry],
          result: 'Observed chemistry conflicts with the candidate fixture.',
          explanation: 'Chemistry conflicts override cosmetic or size similarities.'
        });
        pushDimension(dimensionMap, 'chemistry', 'conflict', 'Observed chemistry conflicts with the candidate fixture.', [observedChemistry, candidateChemistry], []);
      }
    } else {
      unknowns.push('Chemistry remains unknown.');
      pushDimension(dimensionMap, 'chemistry', 'unknown', 'No observed chemistry evidence was supplied.', [], ['chemistry marking or datasheet evidence']);
      withheld.push({
        label: 'Exact identity withheld',
        reason: 'Exact identity withheld because chemistry is unknown.'
      });
    }

    var dimsEvidence = [];
    var dimsMissing = [];
    var hasAnyDims = false;
    [
      ['dimensions_length_mm', 'physical.lengthMm.value', 5],
      ['dimensions_width_mm', 'physical.widthMm.value', 5],
      ['dimensions_height_mm', 'physical.heightMm.value', 5],
      ['dimensions_diameter_mm', 'physical.diameterMm.value', 0.5],
      ['dimensions_thickness_mm', 'physical.thicknessMm.value', 0.5]
    ].forEach(function (entry) {
      if (normalised[entry[0]] || normalised[entry[0]] === 0) {
        hasAnyDims = true;
        var expected = getByPath(record, entry[1]);
        if (typeof expected === 'number' && Math.abs(normalised[entry[0]] - expected) > entry[2]) {
          conflicts.push({
            label: 'Physical dimensions outside tolerance',
            severity: 'blocking',
            explanation: entry[0] + ' differs from the candidate fixture.'
          });
        }
        dimsEvidence.push(entry[0] + '=' + normalised[entry[0]]);
      } else {
        dimsMissing.push(entry[0]);
      }
    });
    if (hasAnyDims && conflicts.filter(function (item) { return item.label === 'Physical dimensions outside tolerance'; }).length === 0) {
      pushDimension(dimensionMap, 'physical_dimensions', 'supported', 'Observed dimensions do not conflict with the candidate fixture.', dimsEvidence, []);
    } else if (hasAnyDims) {
      pushDimension(dimensionMap, 'physical_dimensions', 'conflict', 'At least one supplied dimension conflicts with the candidate fixture.', dimsEvidence, []);
    } else {
      pushDimension(dimensionMap, 'physical_dimensions', 'unknown', 'No measured dimensions were supplied.', [], dimsMissing);
      unknowns.push('Physical dimensions remain unresolved.');
    }

    var observedPolarity = normalised.polarity;
    var candidatePolarity = getByPath(record, 'physical.polarityOrientation.value') || getByPath(record, 'compatibilityProfile.polarityOrientation');
    if (observedPolarity) {
      if (candidatePolarity && observedPolarity !== candidatePolarity) {
        conflicts.push({
          label: 'Reversed polarity',
          severity: 'safety',
          explanation: 'Observed polarity ' + observedPolarity + ' conflicts with candidate polarity ' + candidatePolarity + '.'
        });
        derived.push({
          ruleId: 'NB-POLARITY-001',
          inputEvidence: ['polarity=' + observedPolarity],
          result: 'Safety conflict detected.',
          explanation: 'A polarity conflict overrides apparent size or family matches.'
        });
        pushDimension(dimensionMap, 'polarity', 'conflict', 'Observed polarity conflicts with the candidate fixture.', [observedPolarity, candidatePolarity], []);
      } else {
        pushDimension(dimensionMap, 'polarity', 'supported', 'Observed polarity aligns with the candidate fixture.', [observedPolarity], []);
      }
    } else {
      pushDimension(dimensionMap, 'polarity', 'unknown', 'Polarity evidence was not supplied.', [], ['confirm terminal orientation']);
      unknowns.push('Polarity remains unknown.');
    }

    var observedTerminal = normalised.terminal_type;
    var candidateTerminal = getByPath(record, 'physical.terminalType.value') || getByPath(record, 'compatibilityProfile.terminalType');
    if (observedTerminal) {
      if (candidateTerminal && observedTerminal !== candidateTerminal) {
        conflicts.push({
          label: 'Terminal type mismatch',
          severity: 'blocking',
          explanation: 'Observed terminal type conflicts with the candidate fixture.'
        });
        pushDimension(dimensionMap, 'terminal_type', 'conflict', 'Observed terminal type conflicts with the candidate fixture.', [observedTerminal, candidateTerminal], []);
      } else {
        pushDimension(dimensionMap, 'terminal_type', 'supported', 'Observed terminal type aligns with the candidate fixture.', [observedTerminal], []);
      }
    } else {
      pushDimension(dimensionMap, 'terminal_type', 'unknown', 'Terminal evidence was not supplied.', [], ['confirm terminal type']);
      unknowns.push('Terminal type remains unknown.');
    }

    var application = normalised.intended_application;
    var expectedApplication = getByPath(record, 'compatibilityProfile.applicationProfile');
    if (application) {
      if (application === 'deep_cycle' && expectedApplication === 'starting_battery') {
        conflicts.push({
          label: 'Starting versus deep-cycle conflict',
          severity: 'blocking',
          explanation: 'A starting-battery family should not be treated as a verified deep-cycle recommendation.'
        });
        derived.push({
          ruleId: 'NB-APP-001',
          inputEvidence: ['intended_application=' + application],
          result: 'Application conflict detected.',
          explanation: 'Use-case evidence conflicts with the candidate family profile.'
        });
        pushDimension(dimensionMap, 'application', 'conflict', 'Observed application conflicts with the candidate family profile.', [application, expectedApplication], []);
      } else {
        pushDimension(dimensionMap, 'application', 'supported', 'Observed application does not conflict with the candidate family profile.', [application], []);
      }
    } else {
      pushDimension(dimensionMap, 'application', 'unknown', 'No intended application evidence was supplied.', [], ['confirm intended application']);
      unknowns.push('Intended application remains unknown.');
    }

    var startStop = normalised.start_stop_status;
    var startStopCompatible = getByPath(record, 'compatibilityProfile.startStopCompatible');
    if (typeof startStop === 'boolean') {
      if (startStop && startStopCompatible === false) {
        conflicts.push({
          label: 'Start-stop compatibility conflict',
          severity: 'blocking',
          explanation: 'Observed start-stop use conflicts with the candidate chemistry profile.'
        });
        pushDimension(dimensionMap, 'start_stop', 'conflict', 'Start-stop use conflicts with the candidate fixture.', [String(startStop), String(startStopCompatible)], []);
      } else {
        pushDimension(dimensionMap, 'start_stop', 'supported', 'Observed start-stop evidence does not conflict with the candidate fixture.', [String(startStop)], []);
      }
    } else {
      pushDimension(dimensionMap, 'start_stop', 'unknown', 'Start-stop evidence was not supplied.', [], ['confirm whether the installation uses stop-start']);
      unknowns.push('Start-stop status remains unknown.');
    }

    var chargerInfo = normalised.charger_information;
    if (getByPath(record, 'compatibilityProfile.requiresChargerConfirmation')) {
      if (chargerInfo) {
        pushDimension(dimensionMap, 'charging_profile', 'supported', 'Observed charger information is available for review.', [chargerInfo], []);
      } else {
        pushDimension(dimensionMap, 'charging_profile', 'withheld', 'Charging compatibility cannot be resolved without charger evidence.', [], ['photograph charger output label']);
        withheld.push({
          label: 'Charging compatibility withheld',
          reason: 'Compatibility withheld because charging evidence is missing for this chemistry profile.'
        });
      }
    } else {
      pushDimension(dimensionMap, 'charging_profile', 'not_applicable', 'No special charger confirmation rule is attached to this fixture.', [], []);
    }

    var modification = normalised.modification_status;
    if (modification) {
      escalation.push({
        reason: 'Installation has been modified.',
        dimension: 'installation',
        nextStep: 'Seek professional inspection before relying on this assessment.',
        disposition: 'referable'
      });
      pushDimension(dimensionMap, 'installation', 'escalation', 'Modified installations require professional verification.', [modification], []);
      withheld.push({
        label: 'Compatibility withheld',
        reason: 'Compatibility withheld because installation has been modified.'
      });
      derived.push({
        ruleId: 'NB-INSTALL-001',
        inputEvidence: ['modification_status=' + modification],
        result: 'Professional escalation triggered.',
        explanation: 'Modified or dual-battery installations require professional verification.'
      });
    } else {
      pushDimension(dimensionMap, 'installation', 'supported', 'No installation modification evidence was supplied.', [], []);
    }

    return {
      record: record,
      candidateIdentity: candidateIdentity,
      verified: collectVerified(record),
      observed: collectObserved(observation),
      derived: derived,
      conflicts: conflicts,
      unknowns: Array.from(new Set(unknowns)),
      withheld: withheld,
      escalation: escalation,
      compatibilityDimensions: dimensionOrder.map(function (id) { return dimensionMap[id]; }).filter(Boolean),
      publicSafety: safety,
      score: score
    };
  }

  function filterCandidates(fixtures, observation, explicitIds) {
    var normalised = observation.normalised_observations || {};
    var exactCode = normalised.battery_code;
    var partialCode = normalised.partial_battery_code;
    if (Array.isArray(explicitIds) && explicitIds.length) {
      return fixtures.filter(function (fixture) {
        return explicitIds.indexOf(getByPath(fixture, 'identification.recordId')) !== -1;
      }).map(function (fixture) {
        var code = normaliseCode(getByPath(fixture, 'identification.canonicalCode'));
        var matchType = exactCode && normaliseCode(exactCode) === code ? 'exact' : 'family';
        return { record: fixture, matchType: matchType };
      });
    }

    var matches = [];
    fixtures.forEach(function (fixture) {
      var code = normaliseCode(getByPath(fixture, 'identification.canonicalCode'));
      var aliases = getByPath(fixture, 'identification.aliases') || [];
      if (exactCode && (code === normaliseCode(exactCode) || aliases.some(function (alias) { return normaliseCode(alias) === normaliseCode(exactCode); }))) {
        matches.push({ record: fixture, matchType: 'exact' });
        return;
      }
      if (exactCode && code.indexOf(normaliseCode(exactCode)) === 0) {
        matches.push({ record: fixture, matchType: 'family' });
        return;
      }
      if (partialCode && code.indexOf(normaliseCode(partialCode)) !== -1) {
        matches.push({ record: fixture, matchType: 'family' });
      }
    });
    return matches;
  }

  function chooseOutcome(evaluations) {
    if (!evaluations.length) return 'conclusion_withheld';
    var hasSafetyConflict = evaluations.some(function (item) { return item.conflicts.some(function (conflict) { return conflict.severity === 'safety' || conflict.severity === 'blocking'; }); });
    var hasEscalation = evaluations.some(function (item) { return item.escalation.length > 0; });
    var viable = evaluations.filter(function (item) { return item.conflicts.length === 0; });

    if (hasSafetyConflict) return 'conflict_detected';
    if (hasEscalation) return 'professional_verification_required';
    if (viable.length > 1) return 'multiple_candidates';
    if (viable[0] && viable[0].withheld.length > 0) return viable[0].candidateIdentity.scope === 'exact_identity' ? 'conclusion_withheld' : 'likely_identity';
    if (viable[0] && viable[0].candidateIdentity.scope === 'exact_identity') return 'identity_supported';
    if (viable[0]) return 'likely_identity';
    return 'insufficient_evidence';
  }

  function recommendNextEvidence(evaluation) {
    var dims = evaluation.compatibilityDimensions || [];
    var firstWithMissing = dims.filter(function (dimension) {
      return Array.isArray(dimension.missingEvidence) && dimension.missingEvidence.length > 0;
    })[0];
    if (evaluation.escalation.length) return evaluation.escalation[0].nextStep;
    if (firstWithMissing) return firstWithMissing.missingEvidence[0];
    if (evaluation.conflicts.length) return 'Seek professional inspection before purchase or installation.';
    return 'Collect a direct label photo to improve the evidence record.';
  }

  function assessObservation(observation, bundle) {
    var fixtures = (bundle && bundle.fixtures) || [];
    var candidates = filterCandidates(fixtures, observation, bundle && bundle.candidateFixtureIds);
    var evaluations = candidates.map(function (candidate) {
      return evaluateCandidate(candidate.record, observation, candidate);
    }).sort(function (a, b) { return b.score - a.score; });

    var overallStatus = chooseOutcome(evaluations);
    var primary = evaluations[0] || null;

    if (!primary) {
      return {
        overallStatus: 'conclusion_withheld',
        overallAssessmentLabel: overallAssessmentLabels.conclusion_withheld,
        candidateIdentity: null,
        candidateAlternatives: [],
        observed: collectObserved(observation),
        verified: [],
        derived: [],
        conflicts: [],
        unknowns: (observation.unknown_fields || []).slice(),
        withheld: [{ label: 'Conclusion withheld', reason: 'No governed identity fixture matched the available evidence.' }],
        nextBestEvidence: 'Photograph the battery label or measure the battery before continuing.',
        compatibilityDimensions: [],
        safetyAndEscalation: [{
          reason: 'No supported governed candidate was identified.',
          dimension: 'identity',
          nextStep: 'Collect direct evidence before relying on any replacement claim.',
          disposition: 'blocked'
        }]
      };
    }

    return {
      overallStatus: overallStatus,
      overallAssessmentLabel: overallAssessmentLabels[overallStatus],
      candidateIdentity: primary.candidateIdentity,
      candidateAlternatives: evaluations.slice(1).map(function (item) { return item.candidateIdentity; }),
      observed: primary.observed,
      verified: primary.verified,
      derived: primary.derived,
      conflicts: primary.conflicts,
      unknowns: primary.unknowns,
      withheld: primary.withheld,
      nextBestEvidence: recommendNextEvidence(primary),
      compatibilityDimensions: primary.compatibilityDimensions,
      safetyAndEscalation: primary.escalation.length ? primary.escalation : [{
        reason: primary.conflicts.length ? primary.conflicts[0].explanation : 'No professional escalation rule was triggered.',
        dimension: primary.conflicts.length ? 'identity' : 'installation',
        nextStep: primary.conflicts.length ? 'Do not rely on this result without stronger evidence.' : 'Collect more evidence if the case remains uncertain.',
        disposition: primary.conflicts.length ? 'restricted' : 'referable'
      }]
    };
  }

  return {
    assessObservation: assessObservation
  };
}));
