/* =============================================================
   NewBatteries – physical-fit-demo.js
   Homepage demonstration and browser-runnable acceptance harness.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./physical-fit-engine'), require('./physical-fit-result'));
  } else {
    root.NBPhysicalFitDemo = factory(root.NBPhysicalFitEngine, root.NBPhysicalFitResult);
  }
}(typeof self !== 'undefined' ? self : this, function (PhysicalFitEngine, PhysicalFitResult) {
  'use strict';

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' loading ' + url);
      return response.json();
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function textIncludesAny(list, expected) {
    return (expected || []).every(function (fragment) {
      return (list || []).some(function (item) {
        return String(item).toLowerCase().indexOf(String(fragment).toLowerCase()) !== -1;
      });
    });
  }

  function asNumber(value) {
    var trimmed = String(value || '').trim();
    if (!trimmed) return undefined;
    return Number(trimmed);
  }

  function asText(value) {
    var trimmed = String(value || '').trim();
    return trimmed || undefined;
  }

  function asBooleanSelect(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  function runTests(rules, testCases) {
    var rows = [];
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

      rows.push({
        testId: testCase.testId,
        testName: testCase.name,
        expected: expected.outcome || null,
        actual: result.outcome,
        pass: ok,
        issues: issues,
        summary: result.summary
      });
    });

    console.log('[Physical Fit Tests] Completed', passed + '/' + (testCases || []).length, 'passing scenarios.');
    return {
      generatedAt: new Date().toISOString(),
      total: (testCases || []).length,
      passed: passed,
      failed: (testCases || []).length - passed,
      rows: rows
    };
  }

  function renderTestReport(report) {
    var status = byId('compatTestReportStatus');
    var tbody = byId('compatTestReportBody');
    var json = byId('compatTestReportJson');

    if (status) {
      status.textContent = report.passed + ' of ' + report.total + ' live physical-fit tests passed through the site engine.';
    }

    if (tbody) {
      tbody.innerHTML = '';
      report.rows.forEach(function (row) {
        var tr = document.createElement('tr');
        [row.testName, row.expected, row.actual, row.pass ? 'PASS' : 'FAIL'].forEach(function (text) {
          var td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    if (json) json.textContent = JSON.stringify(report, null, 2);
  }

  function renderScenario(testCase, rules) {
    var result = PhysicalFitEngine.evaluatePhysicalFit(testCase.input, rules);
    var container = byId('compatScenarioResult');
    if (container && PhysicalFitResult) {
      PhysicalFitResult.render(container, result, {
        title: 'Physical fit assessment',
        contextTitle: 'Preliminary result',
        subtitle: testCase.name
      });
    }
    return result;
  }

  function setActiveCategory(profile) {
    var automotive = byId('compatControlledAutomotiveFields');
    var coinCell = byId('compatControlledCoinFields');
    var select = byId('compatControlledCategorySelect');

    if (select) select.value = profile;
    if (automotive) automotive.hidden = profile !== 'automotive';
    if (coinCell) coinCell.hidden = profile !== 'coin_cell';
  }

  function buildControlledInput() {
    var profile = (byId('compatControlledCategorySelect') || {}).value || 'automotive';
    var input = {
      categoryProfile: profile,
      candidate: {},
      compartment: {},
      evidenceFlags: {}
    };

    if (profile === 'automotive') {
      input.candidate.lengthMm = asNumber((byId('compatAutoCandidateLength') || {}).value);
      input.candidate.widthMm = asNumber((byId('compatAutoCandidateWidth') || {}).value);
      input.candidate.heightMm = asNumber((byId('compatAutoCandidateHeight') || {}).value);
      input.compartment.maxLengthMm = asNumber((byId('compatAutoCompartmentLength') || {}).value);
      input.compartment.maxWidthMm = asNumber((byId('compatAutoCompartmentWidth') || {}).value);
      input.compartment.maxHeightMm = asNumber((byId('compatAutoCompartmentHeight') || {}).value);
      input.compartment.coverClearanceMm = asNumber((byId('compatAutoCoverClearance') || {}).value);
      input.candidate.terminalType = asText((byId('compatAutoCandidateTerminalType') || {}).value);
      input.compartment.requiredTerminalType = asText((byId('compatAutoRequiredTerminalType') || {}).value);
      input.candidate.terminalLayout = asText((byId('compatAutoCandidateTerminalLayout') || {}).value);
      input.compartment.requiredTerminalLayout = asText((byId('compatAutoRequiredTerminalLayout') || {}).value);
      input.candidate.polarityOrientation = asText((byId('compatAutoCandidatePolarity') || {}).value);
      input.compartment.requiredPolarityOrientation = asText((byId('compatAutoRequiredPolarity') || {}).value);
      input.candidate.terminalPosition = asText((byId('compatAutoCandidateTerminalPosition') || {}).value);
      input.compartment.requiredTerminalPosition = asText((byId('compatAutoRequiredTerminalPosition') || {}).value);
      input.candidate.holdDownType = asText((byId('compatAutoCandidateHoldDown') || {}).value);
      input.compartment.holdDownType = asText((byId('compatAutoCompartmentHoldDown') || {}).value);
      input.compartment.cableReachConfirmed = asBooleanSelect((byId('compatAutoCableReach') || {}).value);
      input.compartment.shapeConfirmed = asBooleanSelect((byId('compatAutoShapeConfirmed') || {}).value);
      input.evidenceFlags.approximateMeasurement = asBooleanSelect((byId('compatAutoApproximateMeasurement') || {}).value);
      input.evidenceFlags.terminalViewPhotoProvided = asBooleanSelect((byId('compatAutoTerminalPhoto') || {}).value);
    } else {
      input.candidate.diameterMm = asNumber((byId('compatCoinCandidateDiameter') || {}).value);
      input.candidate.thicknessMm = asNumber((byId('compatCoinCandidateThickness') || {}).value);
      input.candidate.contactArrangement = asText((byId('compatCoinCandidateContactArrangement') || {}).value);
      input.compartment.maxDiameterMm = asNumber((byId('compatCoinCompartmentDiameter') || {}).value);
      input.compartment.maxThicknessMm = asNumber((byId('compatCoinCompartmentThickness') || {}).value);
      input.compartment.requiredContactArrangement = asText((byId('compatCoinRequiredContactArrangement') || {}).value);
      input.compartment.referenceThicknessMm = asNumber((byId('compatCoinReferenceThickness') || {}).value);
      input.compartment.contactClearanceConfirmed = asBooleanSelect((byId('compatCoinContactClearance') || {}).value);
      input.compartment.contactPressureConfirmed = asBooleanSelect((byId('compatCoinContactPressure') || {}).value);
    }

    return input;
  }

  function renderControlledResult(rules) {
    var result = PhysicalFitEngine.evaluatePhysicalFit(buildControlledInput(), rules);
    var container = byId('compatControlledResult');

    if (container && PhysicalFitResult) {
      PhysicalFitResult.render(container, result, {
        title: 'Physical fit assessment',
        contextTitle: 'Preliminary result',
        subtitle: 'Controlled demo input'
      });
    }
  }

  function assignValue(id, value) {
    var el = byId(id);
    if (!el) return;
    el.value = value === undefined || value === null ? '' : String(value);
  }

  function loadAutomotiveExample(testCase) {
    var input = testCase.input || {};
    var candidate = input.candidate || {};
    var compartment = input.compartment || {};

    setActiveCategory('automotive');
    assignValue('compatAutoCandidateLength', candidate.lengthMm);
    assignValue('compatAutoCandidateWidth', candidate.widthMm);
    assignValue('compatAutoCandidateHeight', candidate.heightMm);
    assignValue('compatAutoCompartmentLength', compartment.maxLengthMm);
    assignValue('compatAutoCompartmentWidth', compartment.maxWidthMm);
    assignValue('compatAutoCompartmentHeight', compartment.maxHeightMm);
    assignValue('compatAutoCoverClearance', compartment.coverClearanceMm);
    assignValue('compatAutoCandidateTerminalType', candidate.terminalType);
    assignValue('compatAutoRequiredTerminalType', compartment.requiredTerminalType);
    assignValue('compatAutoCandidateTerminalLayout', candidate.terminalLayout);
    assignValue('compatAutoRequiredTerminalLayout', compartment.requiredTerminalLayout);
    assignValue('compatAutoCandidatePolarity', candidate.polarityOrientation);
    assignValue('compatAutoRequiredPolarity', compartment.requiredPolarityOrientation);
    assignValue('compatAutoCandidateTerminalPosition', candidate.terminalPosition);
    assignValue('compatAutoRequiredTerminalPosition', compartment.requiredTerminalPosition);
    assignValue('compatAutoCandidateHoldDown', candidate.holdDownType);
    assignValue('compatAutoCompartmentHoldDown', compartment.holdDownType);
    assignValue('compatAutoCableReach', compartment.cableReachConfirmed);
    assignValue('compatAutoShapeConfirmed', compartment.shapeConfirmed);
    assignValue('compatAutoApproximateMeasurement', (input.evidenceFlags || {}).approximateMeasurement);
    assignValue('compatAutoTerminalPhoto', (input.evidenceFlags || {}).terminalViewPhotoProvided);
  }

  function loadCoinExample(testCase) {
    var input = testCase.input || {};
    var candidate = input.candidate || {};
    var compartment = input.compartment || {};

    setActiveCategory('coin_cell');
    assignValue('compatCoinCandidateDiameter', candidate.diameterMm);
    assignValue('compatCoinCandidateThickness', candidate.thicknessMm);
    assignValue('compatCoinCandidateContactArrangement', candidate.contactArrangement);
    assignValue('compatCoinCompartmentDiameter', compartment.maxDiameterMm);
    assignValue('compatCoinCompartmentThickness', compartment.maxThicknessMm);
    assignValue('compatCoinRequiredContactArrangement', compartment.requiredContactArrangement);
    assignValue('compatCoinReferenceThickness', compartment.referenceThicknessMm);
    assignValue('compatCoinContactClearance', compartment.contactClearanceConfirmed);
    assignValue('compatCoinContactPressure', compartment.contactPressureConfirmed);
  }

  function bindControlledDemo(rules, testCases) {
    var form = byId('compatControlledForm');
    var categorySelect = byId('compatControlledCategorySelect');
    var automotiveExample = byId('compatLoadAutomotiveExample');
    var coinExample = byId('compatLoadCoinExample');
    var autoCase = (testCases || []).filter(function (item) { return item.testId === 'AUTO-CANONICAL-4'; })[0];
    var coinCase = (testCases || []).filter(function (item) { return item.testId === 'COIN-EDGE-THICKNESS-001'; })[0];

    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        setActiveCategory(categorySelect.value || 'automotive');
        renderControlledResult(rules);
      });
    }

    if (form) {
      form.addEventListener('input', function () { renderControlledResult(rules); });
      form.addEventListener('change', function () { renderControlledResult(rules); });
    }

    if (automotiveExample && autoCase) {
      automotiveExample.addEventListener('click', function () {
        loadAutomotiveExample(autoCase);
        renderControlledResult(rules);
      });
    }

    if (coinExample && coinCase) {
      coinExample.addEventListener('click', function () {
        loadCoinExample(coinCase);
        renderControlledResult(rules);
      });
    }

    setActiveCategory('automotive');
    renderControlledResult(rules);
  }

  function init() {
    var rootEl = byId('physicalFitDemo');
    var select = byId('compatDemoScenarioSelect');

    if (!rootEl || !select || !PhysicalFitEngine || !PhysicalFitResult) return;

    Promise.all([
      fetchJson('data/physical-fit-rules.json'),
      fetchJson('data/physical-fit-test-cases.json')
    ]).then(function (data) {
      var rules = data[0];
      var testCaseData = data[1];
      var testCases = (testCaseData && testCaseData.testCases) || [];
      var demoCases = testCases.filter(function (item) { return item.demo; });
      var report;

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
      bindControlledDemo(rules, testCases);
      report = runTests(rules, testCases);
      renderTestReport(report);
    }).catch(function (error) {
      console.error('[Physical Fit Demo] Unable to initialise demo.', error);
      var status = byId('compatTestReportStatus');
      var summary = byId('compatScenarioResult');
      if (status) status.textContent = 'The live physical-fit test report could not be loaded in this browser session.';
      if (summary) summary.textContent = 'The physical-fit demonstration could not be loaded in this browser session.';
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
