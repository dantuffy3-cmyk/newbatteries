(function () {
  'use strict';

  var STORAGE_KEY = 'nb_finder_state_v2';
  var batteryData = null;
  var batteryDataLoadFailed = false;

  var state = loadState();
  var locationState = {};

  function $(id) { return document.getElementById(id); }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function normaliseBattCode(code) {
    return String(code || '').replace(/[\s\-\.]/g, '').toUpperCase();
  }

  function loadBatteryData(cb) {
    if (batteryData !== null) return cb(null, batteryData);
    if (batteryDataLoadFailed) return cb(new Error('load_failed'), []);
    fetch('data/batteries.json')
      .then(function (r) { if (!r.ok) throw new Error('load_failed'); return r.json(); })
      .then(function (d) {
        if (!d || !Array.isArray(d.batteries)) throw new Error('load_failed');
        batteryData = d.batteries;
        cb(null, batteryData);
      })
      .catch(function () {
        batteryDataLoadFailed = true;
        batteryData = [];
        cb(new Error('load_failed'), []);
      });
  }

  function lookupBattery(normalised, batteries) {
    var i, j, b, aliases, canon;
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      if (normaliseBattCode(b.canonicalCode) === normalised) return { battery: b, matchType: 'exact' };
    }
    for (i = 0; i < batteries.length; i++) {
      b = batteries[i];
      aliases = b.aliases || [];
      for (j = 0; j < aliases.length; j++) {
        if (normaliseBattCode(aliases[j]) === normalised) return { battery: b, matchType: 'exact' };
      }
    }
    if (normalised.length >= 3) {
      for (i = 0; i < batteries.length; i++) {
        b = batteries[i];
        canon = normaliseBattCode(b.canonicalCode);
        if (normalised.indexOf(canon) === 0 || canon.indexOf(normalised) === 0) return { battery: b, matchType: 'family' };
      }
    }
    return null;
  }

  function buildIdentResult(match, enteredCode) {
    if (!match) {
      return {
        confidence: 'unknown',
        enteredCode: enteredCode,
        canonical: null,
        category: null,
        evidence: 'The code was not recognised in the current local reference data.',
        unknowns: ['Battery family', 'Variant details', 'Fitment checks'],
        warnings: [],
        verificationRequired: []
      };
    }

    var b = match.battery;
    var conf = match.matchType === 'exact' ? 'exact' : 'family';
    return {
      confidence: conf,
      enteredCode: enteredCode,
      canonical: b.canonicalCode,
      category: b.category,
      evidence: conf === 'exact' ? 'Exact code or alias matched in local reference data.' : 'Family-level code pattern matched in local reference data.',
      unknowns: conf === 'family'
        ? ['Exact variant suffix', 'Terminal orientation confirmation', 'Physical fit verification']
        : ['Terminal orientation confirmation', 'Physical fit verification'],
      warnings: (b.warnings || []).slice(),
      verificationRequired: (b.verificationRequirements || []).slice()
    };
  }

  function buildTechnicalFailureResult(enteredCode) {
    return {
      confidence: 'technical_failure',
      enteredCode: enteredCode,
      canonical: null,
      category: null,
      evidence: 'The battery reference data could not be loaded. No identification or compatibility conclusion has been made.',
      unknowns: ['Please refresh and try again'],
      warnings: [],
      verificationRequired: []
    };
  }

  /*
   * Future V2 integration seam.
   * All lookup-to-render transitions must pass through this adapter.
   * Future governed-record public output must run eligibility + sanitiser here.
   * Renderers must never consume raw governed records directly.
   */
  function resolveIdentificationResult(rawLookupResult, context) {
    if (context && context.loadFailed) return buildTechnicalFailureResult(context.enteredCode || '');
    return buildIdentResult(rawLookupResult, context && context.enteredCode ? context.enteredCode : '');
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '—';
  }

  function renderIdentResult(result) {
    var wrap = $('battIdResult');
    var recog = $('battIdRecognised');
    var unknown = $('battIdUnknown');
    if (!wrap || !recog || !unknown) return;
    wrap.hidden = false;

    if (result.confidence === 'unknown' || result.confidence === 'technical_failure') {
      recog.hidden = true;
      unknown.hidden = false;
      var unknownCode = $('biv-unknownCode');
      var unknownGuidance = $('battIdUnknownGuidance');
      var technicalGuidance = $('battIdTechnicalGuidance');
      if (result.confidence === 'technical_failure') {
        if (unknownCode) unknownCode.textContent = 'The battery reference data could not be loaded.';
        if (unknownGuidance) unknownGuidance.hidden = true;
        if (technicalGuidance) technicalGuidance.hidden = false;
      } else {
        if (unknownCode) unknownCode.textContent = 'The code was not recognised in the current local reference data.';
        if (unknownGuidance) unknownGuidance.hidden = false;
        if (technicalGuidance) technicalGuidance.hidden = true;
      }
      return;
    }

    unknown.hidden = true;
    recog.hidden = false;
    setText('biv-enteredCode', result.enteredCode);
    setText('biv-canonical', result.canonical + (result.category ? ' — ' + result.category : ''));
    setText('biv-confidence', result.confidence === 'exact' ? 'High — exact local code recognition' : 'Medium — family-level local recognition');
    setText('biv-evidence', result.evidence);

    var listMap = [
      ['biv-unknowns-wrap', 'biv-unknowns', result.unknowns],
      ['biv-warnings-wrap', 'biv-warnings', result.warnings],
      ['biv-verification-wrap', 'biv-verification', result.verificationRequired]
    ];

    listMap.forEach(function (m) {
      var wrapEl = $(m[0]);
      var listEl = $(m[1]);
      var items = m[2] || [];
      if (!wrapEl || !listEl) return;
      while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
      if (!items.length) {
        wrapEl.hidden = true;
        return;
      }
      items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        listEl.appendChild(li);
      });
      wrapEl.hidden = false;
    });

    var compareWrap = $('biv-compare-wrap');
    var compareLink = $('biv-compare-link');
    if (compareWrap && compareLink && result.canonical) {
      compareLink.href = 'compatibility.html?code=' + encodeURIComponent(result.canonical);
      compareWrap.hidden = false;
    }
  }

  function showErrorSummary(errors) {
    var summary = $('errorSummary');
    var list = $('errorSummaryList');
    if (!summary || !list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    errors.forEach(function (err) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + err.id;
      a.textContent = err.message;
      li.appendChild(a);
      list.appendChild(li);
    });
    summary.hidden = false;
    summary.focus();
  }

  function hideErrorSummary() {
    var summary = $('errorSummary');
    var list = $('errorSummaryList');
    if (summary) summary.hidden = true;
    if (list) while (list.firstChild) list.removeChild(list.firstChild);
  }

  function populateReviewLocation() {
    setText('rv-suburb', locationState.suburb || 'Not provided');
    setText('rv-state', locationState.state || 'Not provided');
    setText('rv-postcode', locationState.postcode || 'Not provided');
    setText('rv-urgency', locationState.urgency || 'Not provided');
  }

  function populateSummary() {
    var summary = $('confirmSummary');
    if (!summary) return;
    summary.textContent = [
      'Identify a battery',
      state.battCode ? ('Code: ' + state.battCode) : 'Code: Not provided',
      state.battIdCanonical ? ('Preliminary identification: ' + state.battIdCanonical) : 'Preliminary identification: Not available',
      'Location: ' + ([locationState.suburb, locationState.state, locationState.postcode].filter(Boolean).join(', ') || 'Not provided')
    ].join(' | ');
  }

  function showStep(id) {
    ['step-category', 'step-info-type', 'step-batt-code', 'step-location', 'step-review', 'step-confirm'].forEach(function (sid) {
      var el = $(sid);
      if (el) el.hidden = sid !== id;
    });
    state.currentStep = id;
    saveState();

    var heading = $(id + '-heading') || $('#' + id + ' h1');
    if (heading && heading.focus) setTimeout(function () { heading.focus(); }, 30);

    if (id === 'step-review') populateReviewLocation();
    if (id === 'step-confirm') populateSummary();
  }

  function init() {
    hideErrorSummary();

    var btnCode = $('btn-continue-batt-code');
    if (btnCode) {
      btnCode.addEventListener('click', function () {
        hideErrorSummary();
        var code = normaliseBattCode($('battCode') ? $('battCode').value : '');
        if (!code) {
          showErrorSummary([{ id: 'battCode', message: 'Please enter a battery model or part number.' }]);
          return;
        }
        state.battCode = code;
        saveState();

        loadBatteryData(function (err, batteries) {
          var rawMatch = err ? null : lookupBattery(code, batteries);
          var resolved = resolveIdentificationResult(rawMatch, { enteredCode: code, loadFailed: !!err });
          state.battIdDone = true;
          state.battIdCanonical = resolved.canonical;
          state.battIdConfidence = resolved.confidence;
          saveState();
          renderIdentResult(resolved);
          btnCode.textContent = 'Continue to review summary →';
          if (!err || err) {
            setTimeout(function () { showStep('step-review'); }, 20);
          }
        });
      });
    }

    var btnContinueLocation = $('btn-continue-location');
    if (btnContinueLocation) {
      btnContinueLocation.addEventListener('click', function () {
        hideErrorSummary();
        var postcode = $('postcode') ? $('postcode').value.trim() : '';
        if (postcode && !/^\d{4}$/.test(postcode)) {
          showErrorSummary([{ id: 'postcode', message: 'Postcode must be 4 digits or left blank.' }]);
          return;
        }
        locationState.suburb = $('suburb') ? $('suburb').value.trim() : '';
        locationState.state = $('state') ? $('state').value : '';
        locationState.postcode = postcode;
        locationState.urgency = $('urgency') ? $('urgency').value : '';
        showStep('step-review');
      });
    }

    var btnSubmit = $('btn-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', function () { showStep('step-confirm'); });

    var btnCopy = $('btn-copy-summary');
    if (btnCopy) btnCopy.addEventListener('click', function () {
      var text = $('confirmSummary') ? $('confirmSummary').textContent.trim() : '';
      if (navigator.clipboard && text) navigator.clipboard.writeText(text).catch(function () {});
    });

    var btnPrint = $('btn-print-summary');
    if (btnPrint) btnPrint.addEventListener('click', function () { window.print(); });

    var btnRestart = $('btn-start-over');
    if (btnRestart) btnRestart.addEventListener('click', function () {
      state = {};
      locationState = {};
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
      if ($('battCode')) $('battCode').value = '';
      if ($('postcode')) $('postcode').value = '';
      if ($('suburb')) $('suburb').value = '';
      if ($('state')) $('state').value = '';
      if ($('urgency')) $('urgency').value = '';
      if ($('battIdResult')) $('battIdResult').hidden = true;
      if (btnCode) btnCode.textContent = 'Continue';
      showStep('step-category');
    });

    showStep(state.currentStep || 'step-batt-code');
  }

  try { init(); } catch (e) { showErrorSummary([{ id: 'main-content', message: 'The Battery Finder could not be fully initialised.' }]); }
})();
