/* =============================================================
   NewBatteries – finder.js
   Multi-step battery finder: state, routing, validation, focus
   ============================================================= */

(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────────────── */
  var STORAGE_KEY = 'nb_finder_state';

  /* Ordered visible step IDs (excluding conditional ones
     which are inserted dynamically based on state) */
  var BASE_STEPS = [
    'step-category',
    'step-equipment',
    'step-ident-method',
    /* conditional: step-batt-number, step-batt-specs, step-photo */
    'step-help-type',
    'step-location',
    'step-contact',
    'step-review',
    'step-confirm'
  ];

  var STEP_LABELS = {
    'step-category':     'What needs power',
    'step-equipment':    'Equipment details',
    'step-ident-method': 'Battery identification',
    'step-batt-number':  'Battery number',
    'step-batt-specs':   'Battery specifications',
    'step-photo':        'Battery photos',
    'step-help-type':    'Help required',
    'step-location':     'Location',
    'step-contact':      'Contact details',
    'step-review':       'Review',
    'step-confirm':      'Confirmation'
  };

  /* Human-readable labels for review page */
  var CATEGORY_LABELS = {
    car:      'Cars & vehicles',
    moto:     'Motorcycles',
    caravan:  'Caravans & RVs',
    marine:   'Marine / boats',
    tools:    'Power tools',
    garden:   'Garden equipment',
    mobility: 'Mobility aids',
    home:     'Home & solar',
    other:    'Other / not sure'
  };

  var IDENT_LABELS = {
    number:  'I have a battery number or part number',
    specs:   'I know the battery specifications',
    photo:   'I have the old battery and can take a photo',
    notsure: 'I\'m not sure — I need identification help'
  };

  var HELP_LABELS = {
    supply:         'Supply only — I will install it myself',
    install:        'Supply and installation',
    mobile:         'Mobile replacement service',
    identification: 'Identification help only',
    notsure:        'Not sure yet'
  };

  var CHEMISTRY_LABELS = {
    fla:     'Flooded lead-acid (FLA / wet cell)',
    agm:     'AGM — sealed, no-maintenance',
    gel:     'Gel cell',
    lithium: 'Lithium (LiFePO₄)',
    notsure: 'Not sure'
  };

  /* ── State ──────────────────────────────────────────────── */
  var state = loadState();

  /*
   * Contact details (name, email, phone, notes) are intentionally kept in
   * memory only and NOT persisted to sessionStorage, to avoid storing PII
   * as clear text in browser storage. If the user navigates away and
   * returns, they will need to re-enter contact details — this is
   * acceptable given this is a prototype.
   */
  var contactState = {};

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {};
  }

  function saveState() {
    try {
      /* Strip any contact fields that may have been accidentally added */
      var toSave = {};
      var contactKeys = { contactName: 1, contactEmail: 1, contactPhone: 1, additionalNotes: 1 };
      Object.keys(state).forEach(function (k) {
        if (!contactKeys[k]) toSave[k] = state[k];
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) { /* ignore */ }
  }

  function clearState() {
    state = {};
    contactState = {};
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /* ── Determine active step sequence ────────────────────── */
  function buildStepSequence() {
    var seq = ['step-category', 'step-equipment', 'step-ident-method'];

    if (state.identMethod === 'number') {
      seq.push('step-batt-number');
    } else if (state.identMethod === 'specs') {
      seq.push('step-batt-specs');
    } else if (state.identMethod === 'photo') {
      seq.push('step-photo');
    }

    seq.push('step-help-type', 'step-location', 'step-contact', 'step-review', 'step-confirm');
    return seq;
  }

  /* ── Current step tracking ──────────────────────────────── */
  var currentStepId = state.currentStep || 'step-category';

  /* ── DOM helpers ────────────────────────────────────────── */
  function $(id)   { return document.getElementById(id); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function showStep(id) {
    /* Hide all steps */
    qsa('[data-step]').forEach(function (el) { el.hidden = true; });
    var el = $(id);
    if (!el) return;
    el.hidden = false;
    currentStepId = id;
    state.currentStep = id;
    saveState();
    updateProgress();
    hideErrorSummary();

    /* Focus the heading / legend of the revealed step */
    var heading = el.querySelector('[tabindex="-1"]');
    if (heading) {
      heading.focus();
    } else {
      el.focus();
    }

    /* Scroll to top of card */
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ── Progress bar ───────────────────────────────────────── */
  function updateProgress() {
    var seq = buildStepSequence();
    var confirmStep = seq.indexOf('step-confirm');
    var visibleSteps = seq.slice(0, confirmStep); /* exclude confirmation */
    var idx = visibleSteps.indexOf(currentStepId);
    if (idx === -1) { /* on confirm or review */
      idx = visibleSteps.length;
    }

    var total = visibleSteps.length;
    var current = Math.min(idx + 1, total);
    var pct = Math.round((current / total) * 100);

    var progressWrap = $('progressWrap');
    if (!progressWrap) return;

    if (currentStepId === 'step-confirm') {
      progressWrap.hidden = true;
      return;
    }

    progressWrap.hidden = false;

    var progressText = $('progressText');
    var progressStepName = $('progressStepName');
    var progressFill = $('progressFill');
    var track = progressWrap.querySelector('.progress-track');

    if (progressText)    progressText.textContent = 'Step ' + current + ' of ' + total;
    if (progressStepName) progressStepName.textContent = STEP_LABELS[currentStepId] || '';
    if (progressFill)    progressFill.style.width = pct + '%';
    if (track) {
      track.setAttribute('aria-valuenow', String(current));
      track.setAttribute('aria-valuemax', String(total));
    }
  }

  /* ── Validation helpers ─────────────────────────────────── */
  function showFieldError(id, show) {
    var el = $(id);
    if (!el) return;
    el.hidden = !show;
    var field = el.previousElementSibling;
    if (field && field.classList) {
      if (show) field.classList.add('has-error');
      else field.classList.remove('has-error');
    }
  }

  function showErrorSummary(errors) {
    /* errors: array of { id, message } */
    var summary  = $('errorSummary');
    var list     = $('errorSummaryList');
    if (!summary || !list) return;

    list.innerHTML = '';
    errors.forEach(function (e) {
      var li = document.createElement('li');
      var a  = document.createElement('a');
      a.href = '#' + e.id;
      a.textContent = e.message;
      li.appendChild(a);
      list.appendChild(li);
    });

    summary.hidden = false;
    summary.focus();
  }

  function hideErrorSummary() {
    var summary = $('errorSummary');
    if (summary) summary.hidden = true;
  }

  function clearFieldErrors(ids) {
    ids.forEach(function (id) { showFieldError('error-' + id, false); });
  }

  /* ── Restore saved values into form fields ──────────────── */
  function restoreFields() {
    /* Restore non-sensitive state to form fields */
    Object.keys(state).forEach(function (key) {
      var val = state[key];
      var el  = document.getElementById(key);
      if (!el) {
        /* try radio with that name */
        var radio = document.querySelector('input[type="radio"][name="' + key + '"][value="' + val + '"]');
        if (radio) radio.checked = true;
        return;
      }
      if (el.type === 'checkbox') {
        el.checked = !!val;
      } else if (el.type === 'radio') {
        el.checked = (el.value === val);
      } else {
        el.value = val || '';
      }
    });

    /* Restore contact fields from in-memory contactState (not sessionStorage) */
    ['contactName', 'contactEmail', 'contactPhone', 'additionalNotes'].forEach(function (key) {
      var el = document.getElementById(key);
      if (el && contactState[key]) el.value = contactState[key];
    });
  }

  /* ── Read a named-radio value ───────────────────────────── */
  function radioVal(name) {
    var checked = document.querySelector('input[type="radio"][name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  /* ── STEP 1 – Category ──────────────────────────────────── */
  var btnContinue1 = $('btn-continue-1');
  if (btnContinue1) {
    btnContinue1.addEventListener('click', function () {
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

  /* ── STEP 2 – Equipment details ─────────────────────────── */
  var btnContinue2 = $('btn-continue-2');
  if (btnContinue2) {
    btnContinue2.addEventListener('click', function () {
      var make    = ($('equipMake')     || {}).value || '';
      var model   = ($('equipModel')    || {}).value || '';
      var notSure = ($('equipNotSure')  || {}).checked;

      clearFieldErrors(['equipModel']);

      if (!notSure && !make.trim() && !model.trim()) {
        showErrorSummary([{ id: 'equipModel', message: 'Please describe the equipment, or tick "I\'m not sure"' }]);
        showFieldError('error-equipModel', true);
        return;
      }

      state.equipMake    = make.trim();
      state.equipModel   = model.trim();
      state.equipNotSure = notSure;
      saveState();
      showStep('step-ident-method');
    });

    $('btn-back-2').addEventListener('click', function () { showStep('step-category'); });
  }

  /* ── STEP 3 – Identification method ─────────────────────── */
  var btnContinue3 = $('btn-continue-3');
  if (btnContinue3) {
    btnContinue3.addEventListener('click', function () {
      var val = radioVal('identMethod');
      if (!val) {
        showErrorSummary([{ id: 'step-ident-method', message: 'Please choose how you would like to identify the battery' }]);
        showFieldError('error-identMethod', true);
        return;
      }
      state.identMethod = val;
      saveState();

      if (val === 'number') {
        showStep('step-batt-number');
      } else if (val === 'specs') {
        showStep('step-batt-specs');
      } else if (val === 'photo') {
        showStep('step-photo');
      } else {
        showStep('step-help-type');
      }
    });

    $('btn-back-3').addEventListener('click', function () { showStep('step-equipment'); });
  }

  /* ── STEP 4 – Battery number (conditional) ──────────────── */
  var btnContinue4 = $('btn-continue-4');
  if (btnContinue4) {
    btnContinue4.addEventListener('click', function () {
      var num     = ($('battNumber')        || {}).value || '';
      var notSure = ($('battNumberNotSure') || {}).checked;

      clearFieldErrors(['battNumber']);

      if (!notSure && !num.trim()) {
        showErrorSummary([{ id: 'battNumber', message: 'Please enter the battery number, or tick to skip this step' }]);
        showFieldError('error-battNumber', true);
        return;
      }

      state.battNumber        = num.trim();
      state.battNumberNotSure = notSure;
      saveState();
      showStep('step-help-type');
    });

    $('btn-back-4').addEventListener('click', function () { showStep('step-ident-method'); });
  }

  /* ── STEP 5 – Battery specs (conditional) ───────────────── */
  var btnContinue5 = $('btn-continue-5');
  if (btnContinue5) {
    btnContinue5.addEventListener('click', function () {
      state.specVoltage    = ($('specVoltage')    || {}).value || '';
      state.specCca        = ($('specCca')        || {}).value || '';
      state.specChemistry  = radioVal('specChemistry') || '';
      state.specDimensions = ($('specDimensions') || {}).value || '';
      saveState();
      showStep('step-help-type');
    });

    $('btn-back-5').addEventListener('click', function () { showStep('step-ident-method'); });
  }

  /* ── STEP 6 – Photo guidance (conditional) ──────────────── */
  var btnContinue6 = $('btn-continue-6');
  if (btnContinue6) {
    btnContinue6.addEventListener('click', function () {
      var confirmed = ($('photoConfirm') || {}).checked;
      clearFieldErrors(['photoConfirm']);

      if (!confirmed) {
        showErrorSummary([{ id: 'photoConfirm', message: 'Please confirm you understand photos are sent via email' }]);
        showFieldError('error-photoConfirm', true);
        return;
      }

      state.photoNotes   = ($('photoNotes')   || {}).value || '';
      state.photoConfirm = confirmed;
      saveState();
      showStep('step-help-type');
    });

    $('btn-back-6').addEventListener('click', function () { showStep('step-ident-method'); });
  }

  /* ── STEP 7 – Help type ──────────────────────────────────── */
  var btnContinue7 = $('btn-continue-7');
  if (btnContinue7) {
    btnContinue7.addEventListener('click', function () {
      var val = radioVal('helpType');
      clearFieldErrors(['helpType']);

      if (!val) {
        showErrorSummary([{ id: 'step-help-type', message: 'Please select the type of help you are looking for' }]);
        showFieldError('error-helpType', true);
        return;
      }

      state.helpType   = val;
      state.recycleOld = ($('recycleOld') || {}).checked;
      saveState();
      showStep('step-location');
    });

    $('btn-back-7').addEventListener('click', function () {
      /* Go back to the conditional ident step */
      var method = state.identMethod;
      if (method === 'number') { showStep('step-batt-number'); }
      else if (method === 'specs') { showStep('step-batt-specs'); }
      else if (method === 'photo') { showStep('step-photo'); }
      else { showStep('step-ident-method'); }
    });
  }

  /* ── STEP 8 – Location ───────────────────────────────────── */
  var btnContinue8 = $('btn-continue-8');
  if (btnContinue8) {
    btnContinue8.addEventListener('click', function () {
      var suburb   = ($('suburb')   || {}).value || '';
      var postcode = ($('postcode') || {}).value || '';
      var stateVal = ($('state')    || {}).value || '';

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

      if (errors.length) { showErrorSummary(errors); return; }

      state.suburb   = suburb.trim();
      state.postcode = postcode.trim();
      state.state    = stateVal;
      saveState();
      showStep('step-contact');
    });

    $('btn-back-8').addEventListener('click', function () { showStep('step-help-type'); });
  }

  /* ── STEP 9 – Contact ────────────────────────────────────── */
  var btnContinue9 = $('btn-continue-9');
  if (btnContinue9) {
    btnContinue9.addEventListener('click', function () {
      var name  = ($('contactName')  || {}).value || '';
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

      if (errors.length) { showErrorSummary(errors); return; }

      contactState.contactName     = name.trim();
      contactState.contactEmail    = email.trim();
      contactState.contactPhone    = phone.trim();
      contactState.additionalNotes = notes.trim();
      /* contactState is intentionally NOT persisted to sessionStorage */

      populateReview();
      showStep('step-review');
    });

    $('btn-back-9').addEventListener('click', function () { showStep('step-location'); });
  }

  /* ── Review page population ─────────────────────────────── */
  function populateReview() {
    function set(id, val) {
      var el = $(id);
      if (el) el.textContent = val || '—';
    }

    set('rv-category', CATEGORY_LABELS[state.category] || state.category);
    set('rv-make',  state.equipNotSure ? 'Not sure / not applicable' : (state.equipMake  || 'Not provided'));
    set('rv-model', state.equipNotSure ? 'Not sure / not applicable' : (state.equipModel || 'Not provided'));

    set('rv-identMethod', IDENT_LABELS[state.identMethod] || state.identMethod);

    /* Build identification detail string */
    var detail = '';
    if (state.identMethod === 'number') {
      detail = state.battNumberNotSure
        ? 'Could not read number — skipped'
        : (state.battNumber || 'Not entered');
    } else if (state.identMethod === 'specs') {
      var parts = [];
      if (state.specVoltage)    parts.push('Voltage: ' + state.specVoltage);
      if (state.specCca)        parts.push('CCA: ' + state.specCca);
      if (state.specChemistry && state.specChemistry !== 'notsure')
        parts.push('Type: ' + (CHEMISTRY_LABELS[state.specChemistry] || state.specChemistry));
      if (state.specDimensions) parts.push('Size: ' + state.specDimensions);
      detail = parts.length ? parts.join(', ') : 'No specifications entered';
    } else if (state.identMethod === 'photo') {
      detail = 'Photos to be emailed' + (state.photoNotes ? ' — Notes: ' + state.photoNotes : '');
    } else {
      detail = 'Identification help requested';
    }
    set('rv-identDetail', detail);

    set('rv-helpType', HELP_LABELS[state.helpType] || state.helpType);
    set('rv-recycle', state.recycleOld ? 'Yes — recycling information requested' : 'No');

    set('rv-suburb',   state.suburb);
    set('rv-postcode', state.postcode);
    set('rv-state',    state.state);

    set('rv-name',  contactState.contactName  || '');
    set('rv-email', contactState.contactEmail || '');
    set('rv-phone', contactState.contactPhone || 'Not provided');
    set('rv-notes', contactState.additionalNotes || 'None');
  }

  /* ── Review Change links ─────────────────────────────────── */
  qsa('.change-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var target = link.getAttribute('data-goto');
      if (target) showStep(target);
    });
  });

  /* ── STEP 10 – Review / Submit ───────────────────────────── */
  var btnSubmit = $('btn-submit');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
      populateConfirmation();
      showStep('step-confirm');
    });

    $('btn-back-10').addEventListener('click', function () { showStep('step-contact'); });
  }

  /* ── Confirmation page population ──────────────────────── */
  function populateConfirmation() {
    var el = $('confirmSummary');
    if (!el) return;

    /* Clear existing content safely */
    while (el.firstChild) el.removeChild(el.firstChild);

    var dl = document.createElement('dl');
    dl.style.cssText = 'display:flex;flex-direction:column;gap:var(--sp-3)';

    var rows = [
      ['Equipment',       CATEGORY_LABELS[state.category] || state.category || '—'],
      ['Identification',  IDENT_LABELS[state.identMethod]  || '—'],
      ['Help required',   HELP_LABELS[state.helpType]       || '—'],
      ['Location',        [state.suburb, state.postcode, state.state].filter(Boolean).join(', ') || '—'],
      ['Name',            contactState.contactName  || '—'],
      ['Email',           contactState.contactEmail || '—']
    ];

    rows.forEach(function (r) {
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:var(--sp-4);flex-wrap:wrap';

      var dt = document.createElement('dt');
      dt.style.cssText = 'font-weight:600;min-width:140px;color:var(--color-text-muted)';
      dt.textContent = r[0];

      var dd = document.createElement('dd');
      dd.style.margin = '0';
      dd.textContent = r[1];  /* textContent — no HTML injection risk */

      div.appendChild(dt);
      div.appendChild(dd);
      dl.appendChild(div);
    });

    el.appendChild(dl);
  }

  /* ── Start over ──────────────────────────────────────────── */
  var btnStartOver = $('btn-start-over');
  if (btnStartOver) {
    btnStartOver.addEventListener('click', function () {
      clearState();
      /* Reset all form fields */
      qsa('input[type="radio"]').forEach(function (r) { r.checked = false; });
      qsa('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
      qsa('input[type="text"], input[type="email"], input[type="tel"], textarea, select').forEach(function (i) { i.value = ''; });
      showStep('step-category');
    });
  }

  /* ── Help toggles ────────────────────────────────────────── */
  qsa('.help-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panelId = btn.getAttribute('aria-controls');
      var panel   = $(panelId);
      if (!panel) return;
      var open = panel.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ── Handle URL param (e.g. ?path=photo, ?category=car) ─── */
  function applyUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var path   = params.get('path');
    var cat    = params.get('category');

    if (cat && !state.category) {
      state.category = cat;
      saveState();
      /* Pre-check the radio */
      var radio = document.querySelector('input[type="radio"][name="category"][value="' + cat + '"]');
      if (radio) radio.checked = true;
    }

    if (path === 'photo' && !state.currentStep) {
      /* Jump directly to photo identification step if we have a category */
      if (state.category) {
        state.identMethod = 'photo';
        saveState();
        showStep('step-photo');
        return;
      }
    }
  }

  /* ── Initialise ──────────────────────────────────────────── */
  function init() {
    /* Restore any previously entered values */
    restoreFields();
    applyUrlParams();

    /* Show the current step (restoring from session or starting fresh) */
    var stepToShow = state.currentStep || 'step-category';
    /* Validate the step actually exists */
    if (!$(stepToShow)) stepToShow = 'step-category';

    /* Show step without triggering focus animation on initial load */
    qsa('[data-step]').forEach(function (el) { el.hidden = true; });
    var el = $(stepToShow);
    if (el) el.hidden = false;
    currentStepId = stepToShow;
    updateProgress();

    /* If on review page, repopulate */
    if (stepToShow === 'step-review') populateReview();
    if (stepToShow === 'step-confirm') populateConfirmation();
  }

  init();

})();
