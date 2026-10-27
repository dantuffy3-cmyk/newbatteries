(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var form = $('compatForm');
  var inputA = $('inputA');
  var inputB = $('inputB');
  var errorA = $('error-inputA');
  var errorB = $('error-inputB');
  var resultEl = $('compatResult');
  var loadingEl = $('compatLoading');
  var submitBtn = $('btn-check');

  if (!form || !inputA || !inputB || !resultEl || !loadingEl || !submitBtn) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function asListSection(items, sectionClass, listClass, title) {
    if (!Array.isArray(items) || !items.length) return '';
    var listItems = items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
    return '<section class="compat-section ' + sectionClass + '">' +
      '<h3 class="compat-section-title">' + escapeHtml(title) + '</h3>' +
      '<ul class="compat-list ' + listClass + '">' + listItems + '</ul>' +
      '</section>';
  }

  function clearResult() {
    resultEl.innerHTML = '';
    resultEl.hidden = true;
  }

  function setLoading(isLoading) {
    loadingEl.hidden = !isLoading;
    submitBtn.disabled = isLoading;
    submitBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  function showFieldError(input, errorEl, show) {
    if (!input || !errorEl) return;
    errorEl.hidden = !show;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
  }

  function validateInputs() {
    var codeA = inputA.value.trim();
    var codeB = inputB.value.trim();
    var validA = !!codeA;
    var validB = !!codeB;

    showFieldError(inputA, errorA, !validA);
    showFieldError(inputB, errorB, !validB);

    if (!validA) {
      inputA.focus();
      return null;
    }
    if (!validB) {
      inputB.focus();
      return null;
    }
    return { codeA: codeA, codeB: codeB };
  }

  function classificationLabel(value) {
    if (!value) return 'Unspecified';
    return String(value).replace(/_/g, ' ');
  }

  function confidenceBadgeClass(confidence) {
    if (confidence === 'high') return 'compat-badge--high';
    if (confidence === 'medium') return 'compat-badge--medium';
    return 'compat-badge--low';
  }

  function hasBlockingWarning(result) {
    if (result.classification === 'not_recommended') return true;
    return Array.isArray(result.warnings) && result.warnings.some(function (w) {
      return /BLOCKING:/i.test(String(w));
    });
  }

  function renderTechnicalFailure() {
    clearResult();
    resultEl.innerHTML =
      '<div class="compat-result-inner">' +
      '<div class="compat-result-header">' +
      '<div class="notice notice--warn" role="alert">' +
      '<strong>Technical failure</strong>' +
      '<p style="margin:var(--sp-2) 0 0">Compatibility could not be checked because reference data or engine execution is currently unavailable. No compatibility conclusion has been made.</p>' +
      '</div>' +
      '</div>' +
      '</div>';
    resultEl.hidden = false;
    resultEl.focus();
  }

  function renderResult(result) {
    var blocking = hasBlockingWarning(result);
    var warnings = Array.isArray(result.warnings) ? result.warnings : [];
    var matches = Array.isArray(result.matches) ? result.matches : [];
    var differences = Array.isArray(result.differences) ? result.differences : [];
    var unknowns = Array.isArray(result.unknowns) ? result.unknowns : [];
    var informational = Array.isArray(result.informational) ? result.informational : [];
    var evidenceSummary = Array.isArray(result.evidenceSummary) ? result.evidenceSummary : [];

    var blockingBanner = '';
    if (blocking) {
      blockingBanner =
        '<div class="notice notice--warn" role="alert" style="margin:0 var(--sp-6) var(--sp-4)">' +
        '<strong>Blocking incompatibility warning</strong>' +
        '<p style="margin:var(--sp-2) 0 0">Physical or apparent similarity does not establish compatibility. Do not treat this pairing as compatible without required verification.</p>' +
        '</div>';
    }

    var verification = '';
    if (result.deviceVerificationRequired || result.supplierVerificationRequired) {
      verification = '<section class="compat-verification">' +
        '<h3 class="compat-section-title">Required verification</h3>' +
        (result.deviceVerificationRequired
          ? '<p class="compat-verif-item compat-verif-item--device">Device verification is required before use.</p>'
          : '') +
        (result.supplierVerificationRequired
          ? '<p class="compat-verif-item compat-verif-item--supplier">Supplier or manufacturer verification is required before use.</p>'
          : '') +
        '</section>';
    }

    var detailsOpen = (result.classification === 'insufficient_evidence' || unknowns.length > 0) ? ' open' : '';

    var html =
      '<div class="compat-result-inner">' +
      '<header class="compat-result-header">' +
      '<div class="compat-codes">' +
      '<span class="compat-code-chip">' + escapeHtml(result.sourceBattery || '') + '</span>' +
      '<span class="compat-vs-label">vs</span>' +
      '<span class="compat-code-chip">' + escapeHtml(result.targetBattery || '') + '</span>' +
      '</div>' +
      '<h2>' + escapeHtml(result.headline || 'Assessment complete') + '</h2>' +
      '<div class="compat-badges">' +
      '<span class="compat-badge compat-badge--unknown">Classification: ' + escapeHtml(classificationLabel(result.classification)) + '</span>' +
      '<span class="compat-badge ' + confidenceBadgeClass(result.confidence) + '">Confidence: ' + escapeHtml(result.confidence || 'low') + '</span>' +
      '</div>' +
      '</header>' +
      blockingBanner +
      asListSection(matches, 'compat-section--matches', 'compat-list--matches', 'Matches') +
      asListSection(differences, 'compat-section--diffs', 'compat-list--diffs', 'Differences') +
      asListSection(warnings, 'compat-section--warnings', 'compat-list--warnings', 'Warnings and conflicts') +
      asListSection(unknowns, 'compat-section--unknowns', 'compat-list--unknowns', 'Unknowns and limitations') +
      asListSection(informational, '', 'compat-list--evidence', 'Informational checks') +
      (evidenceSummary.length
        ? '<details class="compat-evidence-details"' + detailsOpen + '>' +
          '<summary class="compat-evidence-summary">Evidence summary</summary>' +
          '<ul class="compat-list compat-list--evidence">' +
          evidenceSummary.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') +
          '</ul>' +
          '</details>'
        : '') +
      verification +
      '</div>';

    clearResult();
    resultEl.innerHTML = html;
    resultEl.hidden = false;
    resultEl.focus();
  }

  function parsePrefillCode() {
    var raw = '';
    try {
      var search = new URLSearchParams(window.location.search);
      raw = search.get('code') || '';
    } catch (e) {
      return '';
    }

    var trimmed = String(raw).trim();
    if (!trimmed || trimmed.length > 60) return '';
    if (!/^[A-Za-z0-9.\-\s]+$/.test(trimmed)) return '';
    return trimmed;
  }

  function prefillCurrentBatteryFromQuery() {
    var code = parsePrefillCode();
    if (!code) return false;
    inputA.value = code;
    return true;
  }

  function runAssessment(codeA, codeB) {
    clearResult();
    setLoading(true);

    if (!window.NBCompatEngine || typeof window.NBCompatEngine.assess !== 'function') {
      setLoading(false);
      renderTechnicalFailure();
      return;
    }

    try {
      window.NBCompatEngine.assess(codeA, codeB, function (error, assessment) {
        setLoading(false);
        if (error || !assessment) {
          renderTechnicalFailure();
          return;
        }
        renderResult(assessment);
      });
    } catch (error) {
      setLoading(false);
      renderTechnicalFailure();
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var valid = validateInputs();
    if (!valid) return;
    runAssessment(valid.codeA, valid.codeB);
  });

  inputA.addEventListener('input', function () { showFieldError(inputA, errorA, false); });
  inputB.addEventListener('input', function () { showFieldError(inputB, errorB, false); });

  resultEl.setAttribute('tabindex', '-1');

  if (prefillCurrentBatteryFromQuery()) inputB.focus();
})();
