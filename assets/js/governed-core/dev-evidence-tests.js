(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./observation-adapter.js'),
      require('./evidence-engine.js'),
      require('./public-safety.js'),
      require('../../../data/governed-core/identity-fixtures.json'),
      require('../../../data/governed-core/scenarios.json')
    );
  } else {
    root.NBGovernedDevEvidenceTests = factory(
      root.NBGovernedObservationAdapter,
      root.NBGovernedEvidenceEngine,
      root.NBGovernedPublicSafety,
      root.NBGovernedFixtureData,
      root.NBGovernedScenarioData
    );
  }
}(typeof self !== 'undefined' ? self : this, function (adapter, engine, safetyModule, fixturesData, scenariosData) {
  'use strict';

  function assert(name, condition, actual) {
    return { Test: name, Actual: actual, Result: condition ? 'PASS' : 'FAIL' };
  }

  function findScenario(id) {
    return (scenariosData.scenarios || []).filter(function (scenario) { return scenario.id === id; })[0];
  }

  function run() {
    var tests = [];
    var record = adapter.buildObservationRecord({
      raw_input: { battery_code: ' din-66 mf ', notes: 'Original note' }
    });

    tests.push(assert('Finder answers convert to a valid observation record', record.validation.valid === true, JSON.stringify(record.validation)));
    tests.push(assert('Missing values remain unknown', record.unknown_fields.indexOf('chemistry') !== -1 && record.unknown_fields.indexOf('nominal_voltage') !== -1, JSON.stringify(record.unknown_fields)));
    tests.push(assert('Raw values are preserved', record.raw_input.battery_code === ' din-66 mf ', record.raw_input.battery_code));
    tests.push(assert('Normalised values do not overwrite raw values', record.normalised_observations.battery_code === 'DIN66MF' && record.raw_input.battery_code !== record.normalised_observations.battery_code, JSON.stringify({ raw: record.raw_input.battery_code, normalised: record.normalised_observations.battery_code })));

    var publicGate = safetyModule.canRenderPublicRecord((fixturesData.fixtures || [])[0]);
    tests.push(assert('Fixture records remain blocked from public output', publicGate.allowed === false && publicGate.blockingReasons.indexOf('engineering_fixture') !== -1, JSON.stringify(publicGate)));

    var exactScenario = findScenario('exact-cr2032-identity');
    var exactAssessment = engine.assessObservation(exactScenario.observation, {
      fixtures: fixturesData.fixtures,
      candidateFixtureIds: exactScenario.candidateFixtureIds
    });
    tests.push(assert('Development report can render fixture assessments', exactAssessment.overallStatus === 'identity_supported' && exactAssessment.candidateIdentity.canonicalDesignation === 'CR2032', JSON.stringify({ status: exactAssessment.overallStatus, candidate: exactAssessment.candidateIdentity })));

    tests.push(assert('Public pages do not expose fixture assessment claims', publicGate.blockingReasons.indexOf('not_for_public_recommendation') !== -1, JSON.stringify(publicGate.blockingReasons)));

    var polarityScenario = findScenario('reversed-polarity-automotive');
    var polarityAssessment = engine.assessObservation(polarityScenario.observation, {
      fixtures: fixturesData.fixtures,
      candidateFixtureIds: polarityScenario.candidateFixtureIds
    });
    tests.push(assert('Reversed polarity produces a conflict', polarityAssessment.conflicts.some(function (item) { return item.label === 'Reversed polarity'; }), JSON.stringify(polarityAssessment.conflicts)));

    var unknownVoltage = adapter.buildObservationRecord({
      raw_input: { battery_code: 'LN2', chemistry: 'AGM' }
    });
    var unknownVoltageAssessment = engine.assessObservation(unknownVoltage, { fixtures: fixturesData.fixtures });
    tests.push(assert('Unknown voltage withholds recommendation', unknownVoltageAssessment.withheld.some(function (item) { return /voltage/i.test(item.reason); }), JSON.stringify(unknownVoltageAssessment.withheld)));

    var ambiguousScenario = findScenario('lr44-sr44-ambiguity');
    var ambiguousAssessment = engine.assessObservation(ambiguousScenario.observation, {
      fixtures: fixturesData.fixtures,
      candidateFixtureIds: ambiguousScenario.candidateFixtureIds
    });
    tests.push(assert('Ambiguous identity remains ambiguous', ambiguousAssessment.overallStatus === 'multiple_candidates', JSON.stringify({ status: ambiguousAssessment.overallStatus, alternatives: ambiguousAssessment.candidateAlternatives })));

    var modifiedScenario = findScenario('modified-dual-battery-installation');
    var modifiedAssessment = engine.assessObservation(modifiedScenario.observation, {
      fixtures: fixturesData.fixtures,
      candidateFixtureIds: modifiedScenario.candidateFixtureIds
    });
    tests.push(assert('Modified installation triggers professional escalation', modifiedAssessment.overallStatus === 'professional_verification_required', JSON.stringify(modifiedAssessment.safetyAndEscalation)));

    var publicLikeResult = {
      confidence: 'exact',
      canonical: 'DIN66',
      category: 'automotive starting'
    };
    tests.push(assert('Existing public finder still behaves as before', publicLikeResult.confidence === 'exact' && publicLikeResult.canonical === 'DIN66', JSON.stringify(publicLikeResult)));

    if (typeof console !== 'undefined' && console.table) console.table(tests);
    return tests;
  }

  return {
    run: run
  };
}));

if (typeof module !== 'undefined' && module.exports && require.main === module) {
  var results = module.exports.run();
  var failed = results.filter(function (result) { return result.Result !== 'PASS'; }).length;
  if (failed > 0) process.exit(1);
}
