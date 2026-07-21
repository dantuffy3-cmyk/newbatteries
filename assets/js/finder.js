/* =============================================================
   NewBatteries – finder.js
   Multi-step battery finder with preliminary match result
   ============================================================= */

(function () {
  'use strict';

  var STORAGE_KEY = 'nb_finder_state_v1';
  var RESULT_CHECKLIST = [
    'Confirm length, width and height.',
    'Confirm positive and negative terminal positions.',
    'Confirm terminal type.',
    'Confirm required CCA or capacity.',
    'Confirm mounting and hold-down arrangement.',
    'Confirm start-stop compatibility where relevant.',
    'Check the equipment manufacturer\'s requirements.',
    'Ask a qualified supplier to confirm fitment when uncertain.'
  ];

  var CATEGORY_LABELS = {
    car: 'Cars & vehicles',
    moto: 'Motorcycles',
    caravan: 'Caravans & RVs',
    marine: 'Marine / boats',
    tools: 'Power tools',
    garden: 'Garden equipment',
    mobility: 'Mobility aids',
    home: 'Home & solar',
    other: 'Other / not sure'
  };

  var IDENT_LABELS = {
    number: 'I have a battery number or part number',
    specs: 'I know battery specifications',
    photo: 'I have the old battery and can take a photo',
    notsure: 'I\'m not sure — I need identification help'
  };

  var HELP_LABELS = {
    supply: 'Supply only — I will install it myself',
    install: 'Supply and installation',
    mobile: 'Mobile replacement service',
    identification: 'Identification help only',
    notsure: 'Not sure yet'
  };

  var CHEMISTRY_LABELS = {
    fla: 'Flooded lead-acid (FLA / wet cell)',
    agm: 'AGM — sealed, no-maintenance',
    gel: 'Gel cell',
    lithium: 'Lithium (LiFePO₄)',
    notsure: 'Not sure'
  };

  var INTENDED_USE_LABELS = {
    starting: 'Engine starting',
    deepcycle: 'Deep-cycle / accessory power',
    dualpurpose: 'Dual-purpose',
    other: 'Other / not sure'
  };

  var STEP_LABELS = {
    'step-category': 'What needs power',
    'step-equipment': 'Equipment details',
    'step-ident-method': 'Battery identification method',
    'step-batt-number': 'Battery code entry',
    'step-photo': 'Photo guidance',
    'step-batt-specs': 'Supporting battery details',
    'step-result': 'Preliminary result',
    'step-help-type': 'Supplier assistance',
    'step-location': 'Location',
    'step-contact': 'Contact details',
    'step-review': 'Review supplier request',
    'step-confirm': 'Confirmation'
  };

  var state = loadState();
  var contactState = {};
  var batteryDb = {
    loaded: false,
    loadError: false,
    records: []
  };

  function $(id) { return document.getElementById(id); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {};
  }

  function saveState() {
    try {
      var toSave = {};
      var blocked = { contactName: 1, contactEmail: 1, contactPhone: 1, additionalNotes: 1 };
      Object.keys(state).forEach(function (k) {
        if (!blocked[k]) toSave[k] = state[k];
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) { /* ignore */ }
  }

  function clearState() {
    state = {};
    contactState = {};
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function normalizeCode(input) {
    if (!input) return '';
    return String(input)
      .toUpperCase()
      .trim()
      .replace(/[‐‑–—−_]+/g, '-')
      .replace(/[\s-]+/g, ' ')
      .trim();
  }

  function normalizeCodeKey(input) {
    return normalizeCode(input).replace(/[^A-Z0-9]/g, '');
  }

  function normalizedVoltage(value) {
    if (!value || value === 'other') return null;
    return String(value).replace(/\s+/g, '').toUpperCase();
  }

  function parseDimensions(value) {
    if (!value) return null;
    var nums = String(value).match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 3) return null;
    return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
  }

  function deriveFamilyKey(rawCode, key) {
    if (!rawCode && !key) return '';
    var upperRaw = normalizeCode(rawCode);

    if (/^(?:GROUP\s*)?24/.test(upperRaw) || /^24/.test(key)) return '24-SERIES';
    if (/^(?:GROUP\s*)?27/.test(upperRaw) || /^27/.test(key)) return '27-SERIES';
    if (/^(?:GROUP\s*)?31/.test(upperRaw) || /^31/.test(key)) return '31-SERIES';

    if (/^DIN\d+/.test(key)) return 'DIN';
    if (/^(?:LN\d+|L\d+|H\d+)/.test(key)) return 'LN';
    if (/^NS\d+/.test(key)) return 'NS';
    if (/^N\d+/.test(key)) return 'N';
    if (/MF$/.test(key) || /\d+MF/.test(key)) return 'MF';

    var letterPrefix = key.match(/^[A-Z]+/);
    return letterPrefix ? letterPrefix[0] : '';
  }

  function prepRecord(record) {
    var aliases = Array.isArray(record.aliases) ? record.aliases : [];
    record._canonicalKey = normalizeCodeKey(record.canonicalCode);
    record._aliasKeys = aliases.map(normalizeCodeKey).filter(Boolean);
    record._familyKey = normalizeCodeKey(record.family);
    return record;
  }

  function loadBatteryData() {
    return fetch('data/batteries.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load dataset');
        return res.json();
      })
      .then(function (data) {
        var rows = Array.isArray(data.batteries) ? data.batteries : [];
        batteryDb.records = rows.map(prepRecord);
        batteryDb.loaded = true;
        batteryDb.loadError = false;
      })
      .catch(function () {
        batteryDb.records = [];
        batteryDb.loaded = true;
        batteryDb.loadError = true;
      });
  }

  function getComparisonText(record) {
    return [record.category || '', (record.typicalApplications || []).join(' ')].join(' ').toLowerCase();
  }

  function categoryAlignment(record, category) {
    if (!category) return null;
    var text = getComparisonText(record);
    var map = {
      car: ['automotive', 'vehicle', 'passenger', 'suv', '4wd'],
      moto: ['motorcycle'],
      caravan: ['caravan', 'rv', 'auxiliary', 'deep-cycle', 'deep cycle'],
      marine: ['marine', 'boat'],
      tools: ['tool', 'power tool'],
      garden: ['garden', 'mower'],
      mobility: ['mobility'],
      home: ['home', 'solar', 'storage'],
      other: []
    };

    var wanted = map[category] || [];
    if (!wanted.length) return null;

    var match = wanted.some(function (kw) { return text.indexOf(kw) !== -1; });
    if (match) return true;

    if ((category === 'tools' || category === 'mobility' || category === 'home') && text.indexOf('automotive') !== -1) {
      return false;
    }
    return null;
  }

  function evaluateCandidate(record, matchType, details) {
    var support = [];
    var conflicts = [];
    var score = matchType === 'exact' ? 4 : (matchType === 'alias' ? 3 : (matchType === 'variant' ? 2 : 1));

    if (details.userVoltage) {
      var recVoltage = normalizedVoltage(record.nominalVoltage);
      if (recVoltage && recVoltage !== 'VARIES') {
        if (recVoltage !== details.userVoltage) {
          conflicts.push('Entered voltage (' + details.userVoltage + ') conflicts with typical ' + record.nominalVoltage + ' for ' + record.canonicalCode + '.');
        } else {
          support.push('Entered voltage matches typical ' + record.nominalVoltage + '.');
          score += 1;
        }
      }
    }

    var categoryMatch = categoryAlignment(record, details.category);
    if (categoryMatch === true) {
      support.push('Selected equipment category aligns with typical applications.');
      score += 1;
    } else if (categoryMatch === false) {
      conflicts.push('Selected equipment category appears inconsistent with this battery family.');
    }

    if (details.startStopRequired === 'yes') {
      var startStopText = (record.startStopCompatibility || '').toLowerCase();
      if (details.chemistry && details.chemistry !== 'agm' && details.chemistry !== 'notsure') {
        conflicts.push('Start-stop was selected, but chemistry is not confirmed as AGM/EFB.');
      }
      if (startStopText.indexOf('not') !== -1 && startStopText.indexOf('compatible') !== -1) {
        conflicts.push('Record does not confirm start-stop compatibility.');
      } else if (startStopText.indexOf('agm') !== -1 || startStopText.indexOf('efb') !== -1) {
        support.push('Record notes AGM/EFB options for start-stop systems.');
        score += 1;
      }
    }

    if (details.dimensions && record.approximateDimensions) {
      var dims = record.approximateDimensions;
      if (typeof dims.lengthMm === 'number' && typeof dims.widthMm === 'number' && typeof dims.heightMm === 'number') {
        var tolerance = 25;
        var delta = [Math.abs(details.dimensions[0] - dims.lengthMm), Math.abs(details.dimensions[1] - dims.widthMm), Math.abs(details.dimensions[2] - dims.heightMm)];
        if (delta[0] > tolerance || delta[1] > tolerance || delta[2] > tolerance) {
          conflicts.push('Entered dimensions appear far from this family\'s typical case envelope.');
        } else {
          support.push('Entered dimensions are within a broad tolerance of typical dimensions.');
          score += 1;
        }
      }
    }

    if (details.intendedUse === 'deepcycle') {
      var appText = getComparisonText(record);
      if (appText.indexOf('starting') !== -1 && appText.indexOf('deep') === -1) {
        conflicts.push('Intended deep-cycle use may conflict with a primarily starting-battery family.');
      }
    }

    if (details.intendedUse) score += 0.2;

    score -= conflicts.length * 2;

    return {
      record: record,
      matchType: matchType,
      support: support,
      conflicts: conflicts,
      score: score
    };
  }

  function firstByScore(entries) {
    if (!entries.length) return null;
    return entries.sort(function (a, b) { return b.score - a.score; })[0];
  }

  function createResult() {
    var codeRaw = state.battNumber || '';
    var codeDisplay = normalizeCode(codeRaw);
    var codeKey = normalizeCodeKey(codeRaw);
    var familyKey = deriveFamilyKey(codeRaw, codeKey);
    var details = {
      category: state.category || '',
      userVoltage: normalizedVoltage(state.specVoltage),
      chemistry: state.specChemistry || '',
      dimensions: parseDimensions(state.specDimensions),
      startStopRequired: state.startStopRequired || '',
      intendedUse: state.intendedUse || ''
    };

    var records = batteryDb.records || [];

    var exact = [];
    var alias = [];
    var variant = [];
    var family = [];

    if (codeKey) {
      exact = records.filter(function (r) { return r._canonicalKey === codeKey; });
      alias = records.filter(function (r) { return r._aliasKeys.indexOf(codeKey) !== -1; });
      variant = records.filter(function (r) {
        if (!r._canonicalKey || r._canonicalKey === codeKey) return false;
        if (codeKey.length < 3) return false;
        return codeKey.indexOf(r._canonicalKey) === 0 || r._canonicalKey.indexOf(codeKey) === 0;
      });
    }

    if (!exact.length && !alias.length) {
      family = records.filter(function (r) {
        var recFamily = normalizeCodeKey(r.family);
        if (!recFamily) return false;
        return recFamily === normalizeCodeKey(familyKey) || recFamily === familyKey;
      });
    }

    var evaluated = [];
    exact.forEach(function (r) { evaluated.push(evaluateCandidate(r, 'exact', details)); });
    alias.forEach(function (r) { evaluated.push(evaluateCandidate(r, 'alias', details)); });
    variant.forEach(function (r) { evaluated.push(evaluateCandidate(r, 'variant', details)); });

    var best = firstByScore(evaluated);
    var bestFamily = firstByScore(family.map(function (r) { return evaluateCandidate(r, 'family', details); }));

    var outcome = 'C';
    var confidence = 'LOW CONFIDENCE';
    var confidenceReason = 'The current inputs are not strong enough to identify a likely battery yet.';
    var unknownCode = false;
    var conflicts = [];
    var support = [];
    var selected = null;

    if (best && best.conflicts.length) {
      selected = best;
      conflicts = best.conflicts.slice();
      support = best.support.slice();
      outcome = 'D';
      confidence = 'LOW CONFIDENCE';
      confidenceReason = 'Conflicting information was detected. Please resolve the conflicts before purchasing.';
    } else if (best) {
      selected = best;
      support = best.support.slice();
      outcome = 'A';
      if ((best.matchType === 'exact' || best.matchType === 'alias') && support.length >= 2) {
        confidence = 'HIGH CONFIDENCE';
        confidenceReason = 'Recognised code and supporting details generally agree, but final fitment checks are still required.';
      } else {
        confidence = 'MEDIUM CONFIDENCE';
        confidenceReason = 'A likely code/family was identified, but important checks remain.';
      }
    } else if (bestFamily) {
      selected = bestFamily;
      support = bestFamily.support.slice();
      conflicts = bestFamily.conflicts.slice();
      if (conflicts.length) {
        outcome = 'D';
        confidence = 'LOW CONFIDENCE';
        confidenceReason = 'A possible family was found, but your answers conflict with typical details.';
      } else {
        outcome = 'B';
        confidence = 'MEDIUM CONFIDENCE';
        confidenceReason = 'A battery family was recognised, but a precise match is not yet confirmed.';
      }
    } else {
      var hasCode = !!codeKey;
      var hasSomeDetails = !!(details.userVoltage || details.dimensions || details.category || details.intendedUse || details.startStopRequired);
      if (hasCode) unknownCode = true;
      outcome = hasSomeDetails ? 'C' : 'C';
      confidence = 'LOW CONFIDENCE';
      confidenceReason = hasCode
        ? 'The entered code is not confidently recognised in this preliminary dataset yet.'
        : 'Add a code or more supporting details to improve the result.';
    }

    return {
      generatedAt: new Date(),
      enteredCode: codeDisplay,
      enteredCodeKey: codeKey,
      familyKey: familyKey,
      outcome: outcome,
      confidence: confidence,
      confidenceReason: confidenceReason,
      selected: selected,
      support: support,
      conflicts: conflicts,
      unknownCode: unknownCode,
      loadError: batteryDb.loadError,
      details: details
    };
  }

  function renderList(id, items) {
    var list = $(id);
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var values = items.length ? items : ['—'];
    values.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function renderIdentification(result) {
    var el = $('resultIdentification');
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    var selected = result.selected ? result.selected.record : null;
    if (result.unknownCode) {
      var unknownP = document.createElement('p');
      var strong = document.createElement('strong');
      strong.textContent = 'We could not confidently recognise that battery code yet.';
      unknownP.appendChild(strong);
      el.appendChild(unknownP);

      var unknownHelp = document.createElement('p');
      unknownHelp.className = 'result-muted';
      unknownHelp.textContent = 'Check the code for missed letters/numbers, enter voltage and dimensions, choose the equipment category, prepare a clear label photo, or contact a supplier. Our database is still growing.';
      el.appendChild(unknownHelp);
      return;
    }

    if (!selected) {
      var empty = document.createElement('p');
      empty.textContent = 'Insufficient information to identify a likely code or family.';
      el.appendChild(empty);
      return;
    }

    var app = (selected.typicalApplications || []).join(', ') || 'varies';
    var chem = (selected.chemistryOptions || []).join(', ') || 'varies';
    var dl = document.createElement('dl');
    dl.className = 'result-dl';
    var rows = [
      ['Likely code/family', selected.canonicalCode + ' (' + selected.family + ')'],
      ['Category', selected.category || 'varies'],
      ['Nominal voltage', selected.nominalVoltage || 'varies'],
      ['Common uses', app],
      ['Likely chemistry options', chem]
    ];
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    el.appendChild(dl);
  }

  function buildKnownItems(result) {
    var known = [];
    var selected = result.selected ? result.selected.record : null;

    if (result.enteredCode) known.push('Entered battery code: ' + result.enteredCode + '.');
    if (state.category) known.push('Selected equipment category: ' + (CATEGORY_LABELS[state.category] || state.category) + '.');
    if (state.specVoltage) known.push('Entered voltage: ' + state.specVoltage + '.');
    if (state.specDimensions) known.push('Entered dimensions: ' + state.specDimensions + '.');
    if (state.specCca) known.push('Entered CCA/capacity note: ' + state.specCca + '.');
    if (state.startStopRequired) known.push('Start-stop requirement selected: ' + state.startStopRequired + '.');
    if (state.intendedUse) known.push('Intended use: ' + (INTENDED_USE_LABELS[state.intendedUse] || state.intendedUse) + '.');
    if (state.specChemistry && state.specChemistry !== 'notsure') known.push('Entered chemistry: ' + (CHEMISTRY_LABELS[state.specChemistry] || state.specChemistry) + '.');

    if (selected) {
      known.push('Preliminary dataset suggests family: ' + selected.family + ' (' + selected.canonicalCode + ').');
      if (selected.nominalVoltage) known.push('Typical nominal voltage in dataset: ' + selected.nominalVoltage + '.');
      if (selected.typicalCcaRange) known.push('Typical performance range reference: ' + selected.typicalCcaRange + '.');
    }

    result.support.forEach(function (msg) { known.push(msg); });
    result.conflicts.forEach(function (msg) { known.push('Conflict noted: ' + msg); });

    return known;
  }

  function buildUnknownItems(result) {
    var unknown = [];

    if (!parseDimensions(state.specDimensions)) unknown.push('Exact dimensions (length, width, height).');
    unknown.push('Exact positive terminal position and terminal type.');
    unknown.push('Mounting/hold-down arrangement confirmation.');
    if (!state.specCca) unknown.push('Required CCA or capacity target.');
    if (!state.startStopRequired || state.startStopRequired === 'unsure') unknown.push('Confirmed start-stop requirement and suitable chemistry (AGM/EFB where required).');
    unknown.push('Venting requirements for the installation location.');
    unknown.push('Equipment/vehicle manufacturer-specific fitment requirements.');

    if (result.conflicts.length) {
      unknown.push('Resolution of conflicting answers before purchase.');
    }

    return unknown;
  }

  function recommendationFor(confidence) {
    if (confidence === 'HIGH CONFIDENCE') {
      return 'Confirm the listed physical and performance details before ordering.';
    }
    if (confidence === 'MEDIUM CONFIDENCE') {
      return 'Measure the existing battery and confirm the outstanding details with a supplier.';
    }
    return 'Do not purchase yet. Add a clear battery-label photo or contact a supplier for identification.';
  }

  function renderResult(result) {
    state.latestResult = {
      outcome: result.outcome,
      confidence: result.confidence,
      conflicts: result.conflicts,
      unknownCode: result.unknownCode
    };
    saveState();

    if ($('resultGeneratedAt')) {
      $('resultGeneratedAt').textContent = 'Generated: ' + result.generatedAt.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    }

    if ($('resultLoadError')) $('resultLoadError').hidden = !result.loadError;

    renderIdentification(result);

    var outcomeMap = {
      A: 'A. Likely match identified',
      B: 'B. Possible battery family identified',
      C: 'C. Insufficient information',
      D: 'D. Conflicting information detected'
    };
    if ($('resultOutcome')) $('resultOutcome').textContent = 'Outcome: ' + (outcomeMap[result.outcome] || result.outcome);

    if ($('resultConfidenceLabel')) $('resultConfidenceLabel').textContent = result.confidence;
    if ($('resultConfidenceReason')) $('resultConfidenceReason').textContent = result.confidenceReason;

    var knownItems = buildKnownItems(result);
    var unknownItems = buildUnknownItems(result);

    renderList('resultKnownList', knownItems);
    renderList('resultUnknownList', unknownItems);
    renderList('resultChecklist', RESULT_CHECKLIST);
    if ($('resultRecommendation')) $('resultRecommendation').textContent = recommendationFor(result.confidence);

    var live = $('resultLive');
    if (live) {
      live.textContent = 'Preliminary result generated. Outcome ' + result.outcome + '. ' + result.confidence + '.';
    }
  }

  function getImproveTarget(result) {
    if (result.conflicts.length) return 'step-batt-specs';
    if (result.unknownCode && state.identMethod === 'number') return 'step-batt-number';
    if (!state.identMethod || state.identMethod === 'notsure') return 'step-ident-method';
    if (!state.specVoltage || !parseDimensions(state.specDimensions) || !state.startStopRequired || state.startStopRequired === 'unsure') {
      return 'step-batt-specs';
    }
    if (state.identMethod === 'photo') return 'step-photo';
    return state.identMethod === 'number' ? 'step-batt-number' : 'step-batt-specs';
  }

  function isSupplierFlowStep(id) {
    return ['step-help-type', 'step-location', 'step-contact', 'step-review', 'step-confirm'].indexOf(id) !== -1;
  }

  function buildStepSequence() {
    var seq = ['step-category', 'step-equipment', 'step-ident-method'];
    if (state.identMethod === 'number') seq.push('step-batt-number');
    if (state.identMethod === 'photo') seq.push('step-photo');
    seq.push('step-batt-specs', 'step-result');

    if (state.requestSupplier) {
      seq.push('step-help-type', 'step-location', 'step-contact', 'step-review', 'step-confirm');
    }
    return seq;
  }

  var currentStepId = state.currentStep || 'step-category';

  function updateProgress() {
    var seq = buildStepSequence();
    var progressWrap = $('progressWrap');
    if (!progressWrap) return;

    if (currentStepId === 'step-confirm') {
      progressWrap.hidden = true;
      return;
    }

    var idx = seq.indexOf(currentStepId);
    if (idx < 0) idx = 0;

    var current = idx + 1;
    var total = seq.length;
    var pct = Math.round((current / total) * 100);

    progressWrap.hidden = false;
    if ($('progressText')) $('progressText').textContent = 'Step ' + current + ' of ' + total;
    if ($('progressStepName')) $('progressStepName').textContent = STEP_LABELS[currentStepId] || '';
    if ($('progressFill')) $('progressFill').style.width = pct + '%';

    var track = progressWrap.querySelector('.progress-track');
    if (track) {
      track.setAttribute('aria-valuenow', String(current));
      track.setAttribute('aria-valuemax', String(total));
    }
  }

  function hideErrorSummary() {
    var summary = $('errorSummary');
    if (summary) summary.hidden = true;
  }

  function showStep(id) {
    qsa('[data-step]').forEach(function (el) { el.hidden = true; });
    var el = $(id);
    if (!el) return;
    el.hidden = false;
    currentStepId = id;
    state.currentStep = id;
    saveState();
    updateProgress();
    hideErrorSummary();

    var heading = el.querySelector('[tabindex="-1"]');
    if (heading) heading.focus();
    else el.focus();

    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function showFieldError(id, show) {
    var el = $(id);
    if (!el) return;
    el.hidden = !show;
  }

  function showErrorSummary(errors) {
    var summary = $('errorSummary');
    var list = $('errorSummaryList');
    if (!summary || !list) return;

    list.innerHTML = '';
    errors.forEach(function (e) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + e.id;
      a.textContent = e.message;
      li.appendChild(a);
      list.appendChild(li);
    });
    summary.hidden = false;
    summary.focus();
  }

  function clearFieldErrors(ids) {
    ids.forEach(function (id) { showFieldError('error-' + id, false); });
  }

  function restoreFields() {
    Object.keys(state).forEach(function (key) {
      var val = state[key];
      var el = $(key);
      if (!el) {
        var radio = document.querySelector('input[type="radio"][name="' + key + '"][value="' + val + '"]');
        if (radio) radio.checked = true;
        return;
      }
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val || '';
    });

    ['contactName', 'contactEmail', 'contactPhone', 'additionalNotes'].forEach(function (key) {
      var el = $(key);
      if (el && contactState[key]) el.value = contactState[key];
    });
  }

  function radioVal(name) {
    var checked = document.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  function populateReview() {
    function set(id, val) {
      var el = $(id);
      if (el) el.textContent = val || '—';
    }

    set('rv-category', CATEGORY_LABELS[state.category] || state.category);
    set('rv-make', state.equipNotSure ? 'Not sure / not applicable' : (state.equipMake || 'Not provided'));
    set('rv-model', state.equipNotSure ? 'Not sure / not applicable' : (state.equipModel || 'Not provided'));

    set('rv-identMethod', IDENT_LABELS[state.identMethod] || state.identMethod);

    var detailParts = [];
    if (state.battNumber) detailParts.push('Code: ' + normalizeCode(state.battNumber));
    if (state.specVoltage) detailParts.push('Voltage: ' + state.specVoltage);
    if (state.specCca) detailParts.push('CCA: ' + state.specCca);
    if (state.specChemistry && state.specChemistry !== 'notsure') detailParts.push('Type: ' + (CHEMISTRY_LABELS[state.specChemistry] || state.specChemistry));
    if (state.specDimensions) detailParts.push('Size: ' + state.specDimensions);
    set('rv-identDetail', detailParts.length ? detailParts.join(', ') : 'No additional identification details');

    set('rv-helpType', HELP_LABELS[state.helpType] || state.helpType);
    set('rv-recycle', state.recycleOld ? 'Yes — recycling information requested' : 'No');

    set('rv-suburb', state.suburb);
    set('rv-postcode', state.postcode);
    set('rv-state', state.state);

    set('rv-name', contactState.contactName || '');
    set('rv-email', contactState.contactEmail || '');
    set('rv-phone', contactState.contactPhone || 'Not provided');
    set('rv-notes', contactState.additionalNotes || 'None');
  }

  function populateConfirmation() {
    var el = $('confirmSummary');
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    var dl = document.createElement('dl');
    dl.style.cssText = 'display:flex;flex-direction:column;gap:var(--sp-3)';

    var rows = [
      ['Equipment', CATEGORY_LABELS[state.category] || state.category || '—'],
      ['Preliminary result confidence', (state.latestResult && state.latestResult.confidence) || '—'],
      ['Supplier assistance', HELP_LABELS[state.helpType] || state.helpType || '—'],
      ['Location', [state.suburb, state.postcode, state.state].filter(Boolean).join(', ') || '—'],
      ['Name', contactState.contactName || '—'],
      ['Email', contactState.contactEmail || '—']
    ];

    rows.forEach(function (row) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:var(--sp-4);flex-wrap:wrap';
      var dt = document.createElement('dt');
      dt.style.cssText = 'font-weight:600;min-width:180px;color:var(--color-text-muted)';
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.style.margin = '0';
      dd.textContent = row[1];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });

    el.appendChild(dl);
  }

  function bindStepEvents() {
    var btn1 = $('btn-continue-1');
    if (btn1) {
      btn1.addEventListener('click', function () {
        var val = radioVal('category');
        if (!val) {
          showErrorSummary([{ id: 'categoryGrid', message: 'Please select what needs power' }]);
          showFieldError('error-category', true);
          return;
        }
        state.category = val;
        saveState();
        showStep('step-equipment');
      });
    }

    var btn2 = $('btn-continue-2');
    if (btn2) {
      btn2.addEventListener('click', function () {
        var make = ($('equipMake') || {}).value || '';
        var model = ($('equipModel') || {}).value || '';
        var notSure = ($('equipNotSure') || {}).checked;

        clearFieldErrors(['equipModel']);
        if (!notSure && !make.trim() && !model.trim()) {
          showErrorSummary([{ id: 'equipModel', message: 'Please describe the equipment, or tick "I\'m not sure"' }]);
          showFieldError('error-equipModel', true);
          return;
        }

        state.equipMake = make.trim();
        state.equipModel = model.trim();
        state.equipNotSure = notSure;
        saveState();
        showStep('step-ident-method');
      });
      $('btn-back-2').addEventListener('click', function () { showStep('step-category'); });
    }

    var btn3 = $('btn-continue-3');
    if (btn3) {
      btn3.addEventListener('click', function () {
        var val = radioVal('identMethod');
        if (!val) {
          showErrorSummary([{ id: 'step-ident-method', message: 'Please choose how you would like to identify the battery' }]);
          showFieldError('error-identMethod', true);
          return;
        }
        state.identMethod = val;
        saveState();

        if (val === 'number') showStep('step-batt-number');
        else if (val === 'photo') showStep('step-photo');
        else showStep('step-batt-specs');
      });
      $('btn-back-3').addEventListener('click', function () { showStep('step-equipment'); });
    }

    var btn4 = $('btn-continue-4');
    if (btn4) {
      btn4.addEventListener('click', function () {
        var num = ($('battNumber') || {}).value || '';
        var notSure = ($('battNumberNotSure') || {}).checked;

        clearFieldErrors(['battNumber']);
        if (!notSure && !num.trim()) {
          showErrorSummary([{ id: 'battNumber', message: 'Please enter the battery number, or tick to skip this step' }]);
          showFieldError('error-battNumber', true);
          return;
        }

        state.battNumber = num.trim();
        state.battNumberNotSure = notSure;
        saveState();
        showStep('step-batt-specs');
      });
      $('btn-back-4').addEventListener('click', function () { showStep('step-ident-method'); });
    }

    var btn5 = $('btn-continue-5');
    if (btn5) {
      btn5.addEventListener('click', function () {
        state.specVoltage = ($('specVoltage') || {}).value || '';
        state.specCca = ($('specCca') || {}).value || '';
        state.specChemistry = radioVal('specChemistry') || '';
        state.specDimensions = ($('specDimensions') || {}).value || '';
        state.intendedUse = ($('intendedUse') || {}).value || '';
        state.startStopRequired = ($('startStopRequired') || {}).value || '';
        saveState();

        var result = createResult();
        renderResult(result);
        showStep('step-result');
      });
      $('btn-back-5').addEventListener('click', function () {
        if (state.identMethod === 'number') showStep('step-batt-number');
        else if (state.identMethod === 'photo') showStep('step-photo');
        else showStep('step-ident-method');
      });
    }

    var btn6 = $('btn-continue-6');
    if (btn6) {
      btn6.addEventListener('click', function () {
        var confirmed = ($('photoConfirm') || {}).checked;
        clearFieldErrors(['photoConfirm']);
        if (!confirmed) {
          showErrorSummary([{ id: 'photoConfirm', message: 'Please confirm you understand photos are sent via email' }]);
          showFieldError('error-photoConfirm', true);
          return;
        }

        state.photoNotes = ($('photoNotes') || {}).value || '';
        state.photoConfirm = confirmed;
        saveState();
        showStep('step-batt-specs');
      });
      $('btn-back-6').addEventListener('click', function () { showStep('step-ident-method'); });
    }

    var btnFindSupplier = $('btn-find-supplier');
    if (btnFindSupplier) {
      btnFindSupplier.addEventListener('click', function () {
        state.requestSupplier = true;
        saveState();
        showStep('step-help-type');
      });
    }

    var btnImprove = $('btn-improve-result');
    if (btnImprove) {
      btnImprove.addEventListener('click', function () {
        var result = createResult();
        var target = getImproveTarget(result);
        showStep(target);
      });
    }

    var btnPrint = $('btn-print-result');
    if (btnPrint) {
      btnPrint.addEventListener('click', function () {
        window.print();
      });
    }

    var btnStartAgainResult = $('btn-start-again-result');
    if (btnStartAgainResult) {
      btnStartAgainResult.addEventListener('click', function () {
        clearState();
        qsa('input[type="radio"]').forEach(function (r) { r.checked = false; });
        qsa('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
        qsa('input[type="text"], input[type="email"], input[type="tel"], textarea, select').forEach(function (i) { i.value = ''; });
        showStep('step-category');
      });
    }

    var btn7 = $('btn-continue-7');
    if (btn7) {
      btn7.addEventListener('click', function () {
        var val = radioVal('helpType');
        clearFieldErrors(['helpType']);
        if (!val) {
          showErrorSummary([{ id: 'step-help-type', message: 'Please select the type of help you are looking for' }]);
          showFieldError('error-helpType', true);
          return;
        }
        state.helpType = val;
        state.recycleOld = ($('recycleOld') || {}).checked;
        saveState();
        showStep('step-location');
      });
      $('btn-back-7').addEventListener('click', function () { showStep('step-result'); });
    }

    var btn8 = $('btn-continue-8');
    if (btn8) {
      btn8.addEventListener('click', function () {
        var suburb = ($('suburb') || {}).value || '';
        var postcode = ($('postcode') || {}).value || '';
        var stateVal = ($('state') || {}).value || '';

        clearFieldErrors(['suburb', 'postcode', 'state']);
        var errors = [];

        if (!suburb.trim()) {
          errors.push({ id: 'suburb', message: 'Please enter your suburb or town' });
          showFieldError('error-suburb', true);
        }
        if (!postcode.trim() || !/^\d{4}$/.test(postcode.trim())) {
          errors.push({ id: 'postcode', message: 'Please enter a valid 4-digit Australian postcode' });
          showFieldError('error-postcode', true);
        }
        if (!stateVal) {
          errors.push({ id: 'state', message: 'Please select your state or territory' });
          showFieldError('error-state', true);
        }

        if (errors.length) {
          showErrorSummary(errors);
          return;
        }

        state.suburb = suburb.trim();
        state.postcode = postcode.trim();
        state.state = stateVal;
        saveState();
        showStep('step-contact');
      });
      $('btn-back-8').addEventListener('click', function () { showStep('step-help-type'); });
    }

    var btn9 = $('btn-continue-9');
    if (btn9) {
      btn9.addEventListener('click', function () {
        var name = ($('contactName') || {}).value || '';
        var email = ($('contactEmail') || {}).value || '';
        var phone = ($('contactPhone') || {}).value || '';
        var notes = ($('additionalNotes') || {}).value || '';

        clearFieldErrors(['contactName', 'contactEmail']);

        var errors = [];
        if (!name.trim()) {
          errors.push({ id: 'contactName', message: 'Please enter your name' });
          showFieldError('error-contactName', true);
        }
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          errors.push({ id: 'contactEmail', message: 'Please enter a valid email address' });
          showFieldError('error-contactEmail', true);
        }

        if (errors.length) {
          showErrorSummary(errors);
          return;
        }

        contactState.contactName = name.trim();
        contactState.contactEmail = email.trim();
        contactState.contactPhone = phone.trim();
        contactState.additionalNotes = notes.trim();

        populateReview();
        showStep('step-review');
      });
      $('btn-back-9').addEventListener('click', function () { showStep('step-location'); });
    }

    qsa('.change-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = link.getAttribute('data-goto');
        if (target) showStep(target);
      });
    });

    var btnSubmit = $('btn-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', function () {
        populateConfirmation();
        showStep('step-confirm');
      });
      $('btn-back-10').addEventListener('click', function () { showStep('step-contact'); });
    }

    var btnStartOver = $('btn-start-over');
    if (btnStartOver) {
      btnStartOver.addEventListener('click', function () {
        clearState();
        qsa('input[type="radio"]').forEach(function (r) { r.checked = false; });
        qsa('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
        qsa('input[type="text"], input[type="email"], input[type="tel"], textarea, select').forEach(function (i) { i.value = ''; });
        showStep('step-category');
      });
    }

    qsa('.help-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panelId = btn.getAttribute('aria-controls');
        var panel = $(panelId);
        if (!panel) return;
        var open = panel.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  }

  function applyUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var cat = params.get('category');
    var path = params.get('path');

    if (cat && !state.category) {
      state.category = cat;
      saveState();
      var radio = document.querySelector('input[type="radio"][name="category"][value="' + cat + '"]');
      if (radio) radio.checked = true;
    }

    if (path === 'photo' && !state.currentStep && state.category) {
      state.identMethod = 'photo';
      saveState();
      showStep('step-photo');
      return;
    }
  }

  function init() {
    bindStepEvents();
    restoreFields();
    applyUrlParams();

    if (isSupplierFlowStep(state.currentStep)) state.requestSupplier = true;

    var stepToShow = state.currentStep || 'step-category';
    if (!$(stepToShow)) stepToShow = 'step-category';

    qsa('[data-step]').forEach(function (el) { el.hidden = true; });
    var card = $(stepToShow);
    if (card) card.hidden = false;
    currentStepId = stepToShow;
    updateProgress();

    if (stepToShow === 'step-review') populateReview();
    if (stepToShow === 'step-confirm') populateConfirmation();

    loadBatteryData().then(function () {
      if (stepToShow === 'step-result') {
        var result = createResult();
        renderResult(result);
      }
    });
  }

  init();
})();
