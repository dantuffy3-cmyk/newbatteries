/* =============================================================
   NewBatteries – physical-fit-demo.js
   Homepage demonstration and browser-runnable acceptance harness.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./physical-fit-engine'));
  } else {
    root.NBPhysicalFitDemo = factory(root.NBPhysicalFitEngine);
  }
}(typeof self !== 'undefined' ? self : this, function (PhysicalFitEngine) {
  'use strict';

  var OUTCOME_LABELS = {
    blocked: 'Blocked',
    insufficient_evidence: 'Insufficient evidence',
    compatible_with_conditions: 'Compatible with conditions',
    compatible: 'Compatible',
    uncertain: 'Uncertain'
  };

  var OUTCOME_CLASSES = {
    blocked: 'compat-demo__badge--blocked',
    insufficient_evidence: 'compat-demo__badge--insufficient',
    compatible_with_conditions: 'compat-demo__badge--conditional',
    compatible: 'compat-demo__badge--compatible',
    uncertain: 'compat-demo__badge--uncertain'
  };

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' loading ' + url);
      return response.json();
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function createList(items) {
    var fragment = document.createDocumentFragment();
    (items || []).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      fragment.appendChild(li);
    });
    return fragment;
  }

  function setList(id, items, emptyText) {
    var list = byId(id);
    var empty = byId(id + 'Empty');
    if (!list || !empty) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (items && items.length) {
      list.appendChild(createList(items));
      list.hidden = false;
      empty.hidden = true;
    } else {
      list.hidden = true;
      empty.hidden = false;
      empty.textContent = emptyText;
    }
  }

  function renderScenario(testCase, rules) {
    var result = PhysicalFitEngine.evaluatePhysicalFit(testCase.input, rules);
    var badge = byId('compatDemoOutcomeBadge');
    var title = byId('compatDemoScenarioTitle');
    var summary = byId('compatDemoSummary');
    var confidence = byId('compatDemoConfidence');
    var nextActionsHeading = byId('compatDemoNextActionsHeading');
    var confirmation = byId('compatDemoSupplierConfirmation');

    if (badge) {
      badge.className = 'compat-demo__badge ' + (OUTCOME_CLASSES[result.outcome] || OUTCOME_CLASSES.uncertain);
      badge.textContent = OUTCOME_LABELS[result.outcome] || result.outcome;
    }
    if (title) title.textContent = testCase.name;
    if (summary) summary.textContent = result.summary;
    if (confidence) confidence.textContent = (result.evidenceSummary.overallConfidence || 'unverified') + ' confidence · ' + result.evidenceSummary.completenessLabel;
    if (nextActionsHeading) nextActionsHeading.textContent = result.requiredNextActions.length ? 'Next action' : 'Next action not required for this demo';
    if (confirmation) {
      confirmation.textContent = result.supplierConfirmationRequired
        ? 'Supplier confirmation is still recommended before purchase or installation.'
        : 'No additional supplier confirmation is indicated by this physical-fit-only demo.';
    }

    setList('compatDemoReasons', result.blockingIssues.map(function (issue) { return issue.message; }).concat(result.conditions.map(function (condition) { return condition.message; })).slice(0, 3), 'No additional blocking or conditional reason is active in this scenario.');
    setList('compatDemoUnknowns', result.unknowns, 'No unresolved unknowns are active in this scenario.');
    setList('compatDemoActions', result.requiredNextActions, 'No further physical-fit action is listed for this scenario.');

    return result;
  }

  function textIncludesAny(list, expected) {
    return (expected || []).every(function (fragment) {
      return (list || []).some(function (item) {
        return String(item).toLowerCase().indexOf(String(fragment).toLowerCase()) !== -1;
      });
    });
  }

  function runTests(rules, testCases) {
    var passed = 0;
    (testCases || []).forEach(function (testCase) {
      var expected = testCase.expected || {};
      var result = PhysicalFitEngine.evaluatePhysicalFit(testCase.input, rules);
      var ok = true;
      var issues = [];
      if (expected.outcome && result.outcome !== expected.outcome) {
        ok = false;
        issues.push('expected outcome ' + expected.outcome + ' but got ' + result.outcome);
      }
      if (expected.blockingIssuesInclude && !textIncludesAny(result.blockingIssues.map(function (issue) { return issue.message; }), expected.blockingIssuesInclude)) {
        ok = false;
        issues.push('blocking issue mismatch');
      }
      if (expected.conditionsInclude && !textIncludesAny(result.conditions.map(function (condition) { return condition.message; }), expected.conditionsInclude)) {
        ok = false;
        issues.push('condition mismatch');
      }
      if (expected.unknownsInclude && !textIncludesAny(result.unknowns, expected.unknownsInclude)) {
        ok = false;
        issues.push('unknown mismatch');
      }
      if (expected.requiredNextActionsInclude && !textIncludesAny(result.requiredNextActions, expected.requiredNextActionsInclude)) {
        ok = false;
        issues.push('next-action mismatch');
      }
      if (expected.summaryIncludes && !textIncludesAny([result.summary], expected.summaryIncludes)) {
        ok = false;
        issues.push('summary mismatch');
      }

      if (ok) {
        passed += 1;
        console.log('[Physical Fit Tests] PASS:', testCase.testId, '-', testCase.name, '=>', result.outcome);
      } else {
        console.error('[Physical Fit Tests] FAIL:', testCase.testId, '-', testCase.name, '=>', issues.join('; '), result);
      }
    });
    console.log('[Physical Fit Tests] Completed', passed + '/' + (testCases || []).length, 'passing scenarios.');
  }

  function init() {
    var rootEl = byId('physicalFitDemo');
    var select = byId('compatDemoScenarioSelect');
    if (!rootEl || !select || !PhysicalFitEngine) return;

    Promise.all([
      fetchJson('data/physical-fit-rules.json'),
      fetchJson('data/physical-fit-test-cases.json')
    ]).then(function (data) {
      var rules = data[0];
      var testCaseData = data[1];
      var testCases = (testCaseData && testCaseData.testCases) || [];
      var demoCases = testCases.filter(function (item) { return item.demo; });

      while (select.firstChild) select.removeChild(select.firstChild);
      demoCases.forEach(function (testCase, index) {
        var option = document.createElement('option');
        option.value = String(index);
        option.textContent = testCase.name;
        select.appendChild(option);
      });

      select.addEventListener('change', function () {
        var idx = Number(select.value) || 0;
        renderScenario(demoCases[idx], rules);
      });

      if (demoCases.length) renderScenario(demoCases[0], rules);
      runTests(rules, testCases);
    }).catch(function (error) {
      console.error('[Physical Fit Demo] Unable to initialise demo.', error);
      var status = byId('compatDemoSummary');
      if (status) status.textContent = 'The physical-fit demonstration could not be loaded in this browser session.';
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init: init,
    runTests: runTests,
    renderScenario: renderScenario
  };
}));
