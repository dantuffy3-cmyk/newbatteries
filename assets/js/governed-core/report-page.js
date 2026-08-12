(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./observation-adapter.js'),
      require('./evidence-engine.js')
    );
  } else {
    root.NBGovernedReportPage = factory(
      root.NBGovernedObservationAdapter,
      root.NBGovernedEvidenceEngine
    );
  }
}(typeof self !== 'undefined' ? self : this, function (adapter, engine) {
  'use strict';

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('load_failed');
      return response.json();
    });
  }

  function renderList(items, renderItem) {
    if (!items || !items.length) return '<p class="small">None.</p>';
    return '<ul class="dev-evidence-list">' + items.map(renderItem).join('') + '</ul>';
  }

  function renderAssessment(assessment, sourceLabel) {
    if (!assessment) return '<p>No assessment available.</p>';
    var candidate = assessment.candidateIdentity;
    return [
      '<div class="dev-evidence-banner">',
      '<p class="eyebrow">Development Evidence Report</p>',
      '<h1>Development Evidence Report</h1>',
      '<p class="lead">Synthetic fixture data — not a public compatibility recommendation</p>',
      '<p class="small">Source: ' + escapeHtml(sourceLabel) + '</p>',
      '</div>',
      '<section class="finder-card dev-evidence-section"><h2>1. Overall assessment</h2><p><strong>' + escapeHtml(assessment.overallAssessmentLabel) + '</strong></p></section>',
      '<section class="finder-card dev-evidence-section"><h2>2. Candidate identity</h2>' + (candidate ? (
        '<dl class="review-dl">' +
        '<dt>Canonical designation</dt><dd>' + escapeHtml(candidate.canonicalDesignation) + '</dd>' +
        '<dt>Scope</dt><dd>' + escapeHtml(candidate.scope) + '</dd>' +
        '<dt>Chemistry</dt><dd>' + escapeHtml(candidate.chemistry || 'Unknown') + '</dd>' +
        '<dt>Nominal voltage</dt><dd>' + escapeHtml(candidate.nominalVoltage || 'Unknown') + '</dd>' +
        '<dt>Record status</dt><dd>' + escapeHtml(candidate.recordStatus || 'Unknown') + '</dd>' +
        '<dt>Fixture warning</dt><dd>' + escapeHtml(candidate.fixtureWarning) + '</dd>' +
        '</dl>'
      ) : '<p>No candidate identity available.</p>') + (assessment.candidateAlternatives && assessment.candidateAlternatives.length ? '<p><strong>Other candidates:</strong> ' + assessment.candidateAlternatives.map(function (alt) { return escapeHtml(alt.canonicalDesignation); }).join(', ') + '</p>' : '') + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>3. Observed</h2>' + renderList(assessment.observed, function (item) {
        return '<li><strong>' + escapeHtml(item.field) + ':</strong> raw=' + escapeHtml(item.rawValue) + (item.normalisedValue !== null && item.normalisedValue !== undefined ? ' · normalised=' + escapeHtml(item.normalisedValue) : '') + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>4. Verified</h2>' + renderList(assessment.verified, function (item) {
        return '<li><strong>' + escapeHtml(item.label) + ':</strong> ' + escapeHtml(item.value) + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>5. Derived</h2>' + renderList(assessment.derived, function (item) {
        return '<li><strong>' + escapeHtml(item.ruleId) + '</strong> · ' + escapeHtml(item.result) + '<br><span class="small">Evidence: ' + escapeHtml(item.inputEvidence.join(', ')) + ' · ' + escapeHtml(item.explanation) + '</span></li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>6. Conflicts</h2>' + renderList(assessment.conflicts, function (item) {
        return '<li><strong>' + escapeHtml(item.label) + ':</strong> ' + escapeHtml(item.explanation) + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>7. Unknown</h2>' + renderList(assessment.unknowns, function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>8. Withheld</h2>' + renderList(assessment.withheld, function (item) {
        return '<li><strong>' + escapeHtml(item.label) + ':</strong> ' + escapeHtml(item.reason) + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>9. Next-best evidence</h2><p>' + escapeHtml(assessment.nextBestEvidence) + '</p></section>',
      '<section class="finder-card dev-evidence-section"><h2>10. Compatibility dimensions</h2>' + renderList(assessment.compatibilityDimensions, function (item) {
        return '<li><strong>' + escapeHtml(item.label) + ':</strong> ' + escapeHtml(item.statusLabel) + ' — ' + escapeHtml(item.explanation) + (item.evidenceUsed.length ? '<br><span class="small">Evidence used: ' + escapeHtml(item.evidenceUsed.join(', ')) + '</span>' : '') + (item.missingEvidence.length ? '<br><span class="small">Missing evidence: ' + escapeHtml(item.missingEvidence.join(', ')) + '</span>' : '') + '</li>';
      }) + '</section>',
      '<section class="finder-card dev-evidence-section"><h2>11. Safety and escalation</h2>' + renderList(assessment.safetyAndEscalation, function (item) {
        return '<li><strong>' + escapeHtml(item.reason) + '</strong><br><span class="small">Affected dimension: ' + escapeHtml(item.dimension) + ' · Next step: ' + escapeHtml(item.nextStep) + ' · Status: ' + escapeHtml(item.disposition) + '</span></li>';
      }) + '</section>'
    ].join('');
  }

  function initPage() {
    if (typeof document === 'undefined') return;
    adapter.enableDevelopmentMode();

    var scenarioSelect = document.getElementById('scenarioSelect');
    var loadScenarioButton = document.getElementById('loadScenarioButton');
    var loadSnapshotButton = document.getElementById('loadSnapshotButton');
    var reportRoot = document.getElementById('devEvidenceReportRoot');
    var reportStatus = document.getElementById('reportStatus');

    Promise.all([
      fetchJson('../data/governed-core/identity-fixtures.json'),
      fetchJson('../data/governed-core/scenarios.json')
    ]).then(function (payload) {
      var fixturesData = payload[0];
      var scenariosData = payload[1];
      var fixtures = fixturesData.fixtures || [];
      var scenarios = scenariosData.scenarios || [];

      scenarios.forEach(function (scenario) {
        var option = document.createElement('option');
        option.value = scenario.id;
        option.textContent = scenario.title;
        scenarioSelect.appendChild(option);
      });

      function renderFromObservation(observation, sourceLabel, candidateIds) {
        var assessment = engine.assessObservation(observation, {
          fixtures: fixtures,
          candidateFixtureIds: candidateIds || []
        });
        reportRoot.innerHTML = renderAssessment(assessment, sourceLabel);
        reportStatus.textContent = 'Loaded ' + sourceLabel + '.';
      }

      loadScenarioButton.addEventListener('click', function () {
        var selected = scenarios.filter(function (scenario) { return scenario.id === scenarioSelect.value; })[0];
        if (!selected) return;
        renderFromObservation(selected.observation, selected.title, selected.candidateFixtureIds);
      });

      loadSnapshotButton.addEventListener('click', function () {
        var snapshot = adapter.loadObservationSnapshot();
        if (!snapshot) {
          reportRoot.innerHTML = '<div class="finder-card dev-evidence-section"><p>No finder snapshot is available. Load a synthetic scenario instead.</p></div>';
          reportStatus.textContent = 'No finder snapshot available.';
          return;
        }
        renderFromObservation(snapshot, 'Latest finder snapshot', []);
      });

      if (adapter.loadObservationSnapshot()) {
        loadSnapshotButton.click();
      } else if (scenarios.length) {
        scenarioSelect.value = scenarios[0].id;
        loadScenarioButton.click();
      }
    }).catch(function () {
      reportRoot.innerHTML = '<div class="finder-card dev-evidence-section"><p>The development evidence report could not be initialised.</p></div>';
      reportStatus.textContent = 'Initialisation failed.';
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
  }

  return {
    renderAssessment: renderAssessment
  };
}));
