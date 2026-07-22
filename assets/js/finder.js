/* =============================================================
   NewBatteries – finder.js (v2)
   Finder-first battery identification service.
   8-step enquiry flow: no fake results, no fake suppliers.
   ============================================================= */

(function () {
  'use strict';

  var STORAGE_KEY = 'nb_finder_state_v2';

  /* ── Label maps ─────────────────────────────────────────── */
  var CATEGORY_LABELS = {
    tool:        'Power tool',
    car:         'Car or vehicle',
    caravan:     'Caravan or camping equipment',
    moto:        'Motorcycle',
    marine:      'Boat or marine equipment',
    garden:      'Mower or garden equipment',
    home:        'Home or solar system',
    electronics: 'Electronics',
    mobility:    'Mobility equipment',
    security:    'Security or emergency equipment',
    other:       'Something else'
  };

  var INFO_LABELS = {
    equipment: 'Equipment brand and model',
    number:    'Existing battery number',
    specs:     'Battery specifications',
    photo:     'Photographs',
    notsure:   "I'm not sure"
  };

  var HELP_LABELS = {
    supply:         'Supply only',
    install:        'Supply and installation',
    mobile:         'Mobile replacement',
    identification: 'Battery identification help',
    recycle:        'Old battery recycling information'
  };

  var URGENCY_LABELS = {
    urgent:   'Urgent — as soon as possible',
    week:     'Within a week',
    month:    'Within a month',
    flexible: 'No urgency — planning ahead'
  };

  var CHEMISTRY_LABELS = {
    fla:     'Flooded lead-acid (FLA / wet cell)',
    agm:     'AGM — sealed, no-maintenance',
    gel:     'Gel cell',
    lithium: 'Lithium (LiFePO\u2084)',
    notsure: 'Not sure'
  };

  /* Step display info: num=null hides progress bar */
  var STEP_INFO = {
    'step-category':      { num: 1, label: 'What needs a new battery' },
    'step-info-type':     { num: 2, label: 'What information you have' },
    'step-equip-details': { num: 3, label: 'Equipment details' },
    'step-batt-code':     { num: 3, label: 'Battery number' },
    'step-batt-specs':    { num: 3, label: 'Battery specifications' },
    'step-photo':         { num: 3, label: 'Photo guidance' },
    'step-not-sure':      { num: 3, label: 'Your situation' },
    'step-help-type':     { num: 4, label: 'Help required' },
    'step-location':      { num: 5, label: 'Your location' },
    'step-contact':       { num: 6, label: 'Contact details' },
    'step-review':        { num: null, label: 'Review' },
    'step-confirm':       { num: null, label: 'Done' }
  };

  var TOTAL_STEPS = 6;

  /* All step element IDs (used for hide-all) */
  var ALL_STEPS = [
    'step-category', 'step-info-type',
    'step-equip-details', 'step-batt-code', 'step-batt-specs',
    'step-photo', 'step-not-sure',
    'step-help-type', 'step-location', 'step-contact',
    'step-review', 'step-confirm'
  ];

  /* ── State ──────────────────────────────────────────────── */
  /* state: non-sensitive flow data (category, info type, battery details, help type).
     locationState and contactState: kept in-memory only and never persisted. */
  var state = loadState();
  var locationState = {};
  var contactState = {};
  var currentStepId = 'step-category';

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {};
  }

  function saveState() {
    /* Only persist non-location, non-contact flow data */
    try {
      var toSave = {};
      var exclude = {
        suburb: 1, state: 1, postcode: 1, urgency: 1,
        contactName: 1, contactEmail: 1, contactPhone: 1
      };
      Object.keys(state).forEach(function (k) {
        if (!exclude[k]) toSave[k] = state[k];
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) { /* ignore */ }
  }

  function clearState() {
    state = {};
    locationState = {};
    contactState = {};
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /* ── DOM helpers ────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function radioVal(name) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  function getVal(id) {
    var el = $(id);
    return el ? (el.value || '') : '';
  }

  function isChecked(id) {
    var el = $(id);
    return el ? el.checked : false;
  }

  /* ── Error handling ─────────────────────────────────────── */
  function showFieldError(errorId, show) {
    var el = $(errorId);
    if (!el) return;
    el.hidden = !show;
    /* Mark the associated control */
    var inputId = errorId.replace(/^error-/, '');
    var input = $(inputId);
    if (input) {
      if (show) {
        input.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
      }
    }
  }

  function clearFieldErrors(ids) {
    (ids || []).forEach(function (id) { showFieldError('error-' + id, false); });
  }

  function showErrorSummary(errors) {
    var summary = $('errorSummary');
    var list    = $('errorSummaryList');
    if (!summary || !list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    errors.forEach(function (err) {
      var li = document.createElement('li');
      var a  = document.createElement('a');
      a.href = '#' + err.id;
      a.textContent = err.message;
      li.appendChild(a);
      list.appendChild(li);
    });
    summary.hidden = false;
    summary.focus();
  }

  function hideErrorSummary() {
    var s = $('errorSummary');
    if (s) s.hidden = true;
  }

  /* ── Progress bar ───────────────────────────────────────── */
  function updateProgress() {
    var info  = STEP_INFO[currentStepId];
    var wrap  = $('progressWrap');
    var text  = $('progressText');
    var name  = $('progressStepName');
    var fill  = $('progressFill');
    var track = fill ? fill.parentElement : null;

    if (!wrap) return;

    if (info && info.num) {
      wrap.hidden = false;
      if (text)  text.textContent  = 'Step ' + info.num + ' of ' + TOTAL_STEPS;
      if (name)  name.textContent  = info.label;
      if (fill)  fill.style.width  = Math.round((info.num / TOTAL_STEPS) * 100) + '%';
      if (track) {
        track.setAttribute('aria-valuenow', String(info.num));
        track.setAttribute('aria-valuemax', String(TOTAL_STEPS));
      }
    } else {
      wrap.hidden = true;
    }
  }

  /* ── Step navigation ────────────────────────────────────── */
  function showStep(stepId) {
    hideErrorSummary();

    /* Hide every step panel */
    ALL_STEPS.forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = true;
    });

    var card = $(stepId);
    if (!card) return;
    card.hidden = false;
    currentStepId = stepId;
    state.currentStep = stepId;
    saveState();
    updateProgress();

    /* Move focus to the step heading */
    var heading = card.querySelector('[tabindex="-1"]') || card.querySelector('legend');
    if (heading) {
      setTimeout(function () { heading.focus(); }, 60);
    }

    if (stepId === 'step-review')  populateReview();
    if (stepId === 'step-confirm') populateConfirmation();

    /* Scroll to top of page content on step change */
    var main = $('main-content');
    if (main) main.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ── Back-step routing ──────────────────────────────────── */
  function getStep3Id() {
    var map = {
      equipment: 'step-equip-details',
      number:    'step-batt-code',
      specs:     'step-batt-specs',
      photo:     'step-photo',
      notsure:   'step-not-sure'
    };
    return map[state.infoType] || 'step-equip-details';
  }

  /* ── Field restore ──────────────────────────────────────── */
  function restoreField(id, value) {
    var el = $(id);
    if (!el || value === undefined || value === null) return;
    el.value = value;
  }

  function restoreRadio(name, value) {
    if (!value) return;
    var input = document.querySelector(
      'input[name="' + name + '"][value="' + CSS.escape(value) + '"]'
    );
    if (input) input.checked = true;
  }

  function restoreCheckbox(id, value) {
    var el = $(id);
    if (el) el.checked = !!value;
  }

  function restoreFields() {
    restoreRadio('category', state.category);
    restoreRadio('infoType', state.infoType);

    restoreField('equipType',  state.equipType);
    restoreField('equipBrand', state.equipBrand);
    restoreField('equipModel', state.equipModel);
    restoreField('equipYear',  state.equipYear);
    restoreField('equipNotes', state.equipNotes);
    restoreCheckbox('equipNotSure', state.equipNotSure);

    restoreField('battBrand',     state.battBrand);
    restoreField('battCode',      state.battCode);
    restoreField('battCodeNotes', state.battCodeNotes);
    restoreCheckbox('battCodeNotSure', state.battCodeNotSure);

    restoreField('specVoltage', state.specVoltage);
    restoreField('specAh',      state.specAh);
    restoreRadio('specChemistry', state.specChemistry);
    restoreField('specLength',  state.specLength);
    restoreField('specWidth',   state.specWidth);
    restoreField('specHeight',  state.specHeight);
    restoreField('specTerminal',state.specTerminal);
    restoreField('specsNotes',  state.specsNotes);
    restoreCheckbox('specsNotSure', state.specsNotSure);

    restoreField('photoNotes',   state.photoNotes);
    restoreField('notSureNotes', state.notSureNotes);

    restoreRadio('helpType', state.helpType);

    restoreField('suburb',  locationState.suburb);
    restoreField('state',   locationState.state);
    restoreField('postcode',locationState.postcode);
    restoreField('urgency', locationState.urgency);
  }

  /* ── URL params ─────────────────────────────────────────── */
  function applyUrlParams() {
    try {
      var params   = new URLSearchParams(window.location.search);
      var category = params.get('category');
      var path     = params.get('path');

      if (category && CATEGORY_LABELS[category] && !state.category) {
        state.category = category;
        restoreRadio('category', category);
      }
      if (path === 'photo' && !state.infoType) {
        state.infoType = 'photo';
        restoreRadio('infoType', 'photo');
      }
    } catch (e) { /* ignore */ }
  }

  /* ── Email validation ───────────────────────────────────── */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ── Review page ────────────────────────────────────────── */
  function setReviewField(id, text) {
    var el = $(id);
    if (el) el.textContent = text || '\u2014';
  }

  function populateReview() {
    setReviewField('rv-category',    CATEGORY_LABELS[state.category]  || state.category);
    setReviewField('rv-identMethod', INFO_LABELS[state.infoType]      || state.infoType);

    var details = [];
    if (state.infoType === 'equipment') {
      if (state.equipNotSure) {
        details.push('Details not available');
      } else {
        if (state.equipType)  details.push('Type: '  + state.equipType);
        if (state.equipBrand) details.push('Brand: ' + state.equipBrand);
        if (state.equipModel) details.push('Model: ' + state.equipModel);
        if (state.equipYear)  details.push('Year: '  + state.equipYear);
      }
      if (state.equipNotes)  details.push('Notes: ' + state.equipNotes);
    } else if (state.infoType === 'number') {
      if (state.battBrand)       details.push('Brand: ' + state.battBrand);
      if (state.battCodeNotSure) {
        details.push('Number not available');
      } else if (state.battCode) {
        details.push('Code: ' + state.battCode);
      }
      if (state.battCodeNotes)   details.push('Notes: ' + state.battCodeNotes);
    } else if (state.infoType === 'specs') {
      if (state.specVoltage && state.specVoltage !== 'other') details.push('Voltage: ' + state.specVoltage);
      if (state.specAh)      details.push('Capacity: ' + state.specAh + ' Ah');
      if (state.specChemistry && state.specChemistry !== 'notsure') {
        details.push('Type: ' + (CHEMISTRY_LABELS[state.specChemistry] || state.specChemistry));
      }
      var dims = [state.specLength, state.specWidth, state.specHeight].filter(Boolean);
      if (dims.length === 3) details.push('Size: ' + dims.join(' \u00d7 ') + ' mm');
      else if (dims.length)  details.push('Dimensions (partial): ' + dims.join(', ') + ' mm');
      if (state.specTerminal && state.specTerminal !== 'notsure') {
        details.push('Terminal: ' + state.specTerminal);
      }
      if (state.specsNotes) details.push('Notes: ' + state.specsNotes);
      if (state.specsNotSure && !details.length) details.push('Specifications not available');
    } else if (state.infoType === 'photo') {
      details.push('Photos to be provided after submission');
      if (state.photoNotes) details.push('Notes: ' + state.photoNotes);
    } else if (state.infoType === 'notsure') {
      if (state.notSureNotes) details.push(state.notSureNotes);
    }

    setReviewField('rv-identDetail', details.length ? details.join(' \u00b7 ') : 'No additional details provided');

    setReviewField('rv-helpType', HELP_LABELS[state.helpType] || state.helpType);
    setReviewField('rv-suburb',   locationState.suburb);
    setReviewField('rv-state',    locationState.state);
    setReviewField('rv-postcode', locationState.postcode);
    setReviewField('rv-urgency',  URGENCY_LABELS[locationState.urgency] || locationState.urgency || 'Not specified');
    setReviewField('rv-name',     contactState.contactName  || '');
    setReviewField('rv-email',    contactState.contactEmail || '');
    setReviewField('rv-phone',    contactState.contactPhone || 'Not provided');
  }

  /* ── Confirmation summary ───────────────────────────────── */
  function populateConfirmation() {
    var el = $('confirmSummary');
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);

    var dl = document.createElement('dl');
    dl.className = 'review-dl';
    dl.style.cssText = 'border:1px solid var(--color-border);border-radius:var(--radius);padding:var(--sp-5) var(--sp-6)';

    var location = [locationState.suburb, locationState.state, locationState.postcode].filter(Boolean).join(', ');
    var rows = [
      ['Equipment',            CATEGORY_LABELS[state.category] || state.category || '\u2014'],
      ['Identification method',INFO_LABELS[state.infoType]     || '\u2014'],
      ['Help required',        HELP_LABELS[state.helpType]     || '\u2014'],
      ['Location',             location || '\u2014'],
      ['Name',                 contactState.contactName  || '\u2014'],
      ['Email',                contactState.contactEmail || '\u2014']
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

  /* ── Help panel toggle ──────────────────────────────────── */
  function bindHelpToggles() {
    qsa('.help-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panelId = btn.getAttribute('aria-controls');
        var panel   = $(panelId);
        if (!panel) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.classList.toggle('is-open', !open);
      });
    });
  }

  /* ── Change links on review ─────────────────────────────── */
  function bindChangeLinks() {
    qsa('.change-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = link.getAttribute('data-goto');
        if (target) showStep(target);
      });
    });
  }

  /* ── Step event bindings ────────────────────────────────── */
  function bindStepEvents() {

    /* Step 1: Category ──────────────────────────────────── */
    var btn1 = $('btn-continue-1');
    if (btn1) {
      btn1.addEventListener('click', function () {
        var val = radioVal('category');
        clearFieldErrors(['category']);
        if (!val) {
          showErrorSummary([{ id: 'categoryGrid', message: 'Please select what needs a new battery' }]);
          showFieldError('error-category', true);
          return;
        }
        state.category = val;
        saveState();
        showStep('step-info-type');
      });
    }

    /* Step 2: Information type ──────────────────────────── */
    var btn2 = $('btn-continue-2');
    if (btn2) {
      btn2.addEventListener('click', function () {
        var val = radioVal('infoType');
        clearFieldErrors(['infoType']);
        if (!val) {
          showErrorSummary([{ id: 'step-info-type', message: 'Please choose what information you have available' }]);
          showFieldError('error-infoType', true);
          return;
        }
        state.infoType = val;
        saveState();
        showStep(getStep3Id());
      });
    }
    var back2 = $('btn-back-2');
    if (back2) back2.addEventListener('click', function () { showStep('step-category'); });

    /* Step 3a: Equipment details ────────────────────────── */
    var btnEquip = $('btn-continue-equip');
    if (btnEquip) {
      btnEquip.addEventListener('click', function () {
        var type    = getVal('equipType').trim();
        var brand   = getVal('equipBrand').trim();
        var model   = getVal('equipModel').trim();
        var year    = getVal('equipYear').trim();
        var notes   = getVal('equipNotes').trim();
        var notSure = isChecked('equipNotSure');

        clearFieldErrors(['equip']);
        if (!notSure && !type && !brand && !model) {
          showErrorSummary([{ id: 'equipType', message: 'Please provide at least one equipment detail, or tick \u201cI\u2019m not sure\u201d' }]);
          showFieldError('error-equip', true);
          return;
        }
        state.equipType    = type;
        state.equipBrand   = brand;
        state.equipModel   = model;
        state.equipYear    = year;
        state.equipNotes   = notes;
        state.equipNotSure = notSure;
        saveState();
        showStep('step-help-type');
      });
    }
    var backEquip = $('btn-back-equip');
    if (backEquip) backEquip.addEventListener('click', function () { showStep('step-info-type'); });

    /* Step 3b: Battery code ─────────────────────────────── */
    var btnCode = $('btn-continue-batt-code');
    if (btnCode) {
      btnCode.addEventListener('click', function () {
        var brand   = getVal('battBrand').trim();
        var code    = getVal('battCode').trim();
        var notes   = getVal('battCodeNotes').trim();
        var notSure = isChecked('battCodeNotSure');

        clearFieldErrors(['battCode']);
        if (!notSure && !code) {
          showErrorSummary([{ id: 'battCode', message: 'Please enter the battery model or part number, or tick to skip this field' }]);
          showFieldError('error-battCode', true);
          return;
        }
        state.battBrand       = brand;
        state.battCode        = code;
        state.battCodeNotes   = notes;
        state.battCodeNotSure = notSure;
        saveState();
        showStep('step-help-type');
      });
    }
    var backCode = $('btn-back-batt-code');
    if (backCode) backCode.addEventListener('click', function () { showStep('step-info-type'); });

    /* Step 3c: Specifications ───────────────────────────── */
    var btnSpecs = $('btn-continue-specs');
    if (btnSpecs) {
      btnSpecs.addEventListener('click', function () {
        state.specVoltage   = getVal('specVoltage');
        state.specAh        = getVal('specAh').trim();
        state.specChemistry = radioVal('specChemistry');
        state.specLength    = getVal('specLength').trim();
        state.specWidth     = getVal('specWidth').trim();
        state.specHeight    = getVal('specHeight').trim();
        state.specTerminal  = getVal('specTerminal');
        state.specsNotes    = getVal('specsNotes').trim();
        state.specsNotSure  = isChecked('specsNotSure');
        saveState();
        showStep('step-help-type');
      });
    }
    var backSpecs = $('btn-back-specs');
    if (backSpecs) backSpecs.addEventListener('click', function () { showStep('step-info-type'); });

    /* Step 3d: Photo ────────────────────────────────────── */
    var btnPhoto = $('btn-continue-photo');
    if (btnPhoto) {
      btnPhoto.addEventListener('click', function () {
        state.photoNotes = getVal('photoNotes').trim();
        saveState();
        showStep('step-help-type');
      });
    }
    var backPhoto = $('btn-back-photo');
    if (backPhoto) backPhoto.addEventListener('click', function () { showStep('step-info-type'); });

    /* Step 3e: Not sure ─────────────────────────────────── */
    var btnNotSure = $('btn-continue-not-sure');
    if (btnNotSure) {
      btnNotSure.addEventListener('click', function () {
        var notes = getVal('notSureNotes').trim();
        clearFieldErrors(['notSureNotes']);
        if (!notes) {
          showErrorSummary([{ id: 'notSureNotes', message: 'Please describe what you know so we can help find the right battery' }]);
          showFieldError('error-notSureNotes', true);
          return;
        }
        state.notSureNotes = notes;
        saveState();
        showStep('step-help-type');
      });
    }
    var backNotSure = $('btn-back-not-sure');
    if (backNotSure) backNotSure.addEventListener('click', function () { showStep('step-info-type'); });

    /* Step 4: Help type ─────────────────────────────────── */
    var btnHelp = $('btn-continue-help');
    if (btnHelp) {
      btnHelp.addEventListener('click', function () {
        var val = radioVal('helpType');
        clearFieldErrors(['helpType']);
        if (!val) {
          showErrorSummary([{ id: 'step-help-type', message: 'Please select the type of help you need' }]);
          showFieldError('error-helpType', true);
          return;
        }
        state.helpType = val;
        saveState();
        showStep('step-location');
      });
    }
    var backHelp = $('btn-back-help');
    if (backHelp) backHelp.addEventListener('click', function () { showStep(getStep3Id()); });

    /* Step 5: Location ──────────────────────────────────── */
    var btnLocation = $('btn-continue-location');
    if (btnLocation) {
      btnLocation.addEventListener('click', function () {
        var suburb   = getVal('suburb').trim();
        var stateVal = getVal('state');
        var postcode = getVal('postcode').trim();
        var urgency  = getVal('urgency');

        clearFieldErrors(['suburb', 'state', 'postcode']);
        var errors = [];
        if (!suburb) {
          showFieldError('error-suburb', true);
          errors.push({ id: 'suburb', message: 'Please enter your suburb or town' });
        }
        if (!stateVal) {
          showFieldError('error-state', true);
          errors.push({ id: 'state', message: 'Please select your state or territory' });
        }
        if (!postcode || !/^\d{4}$/.test(postcode)) {
          showFieldError('error-postcode', true);
          errors.push({ id: 'postcode', message: 'Please enter a valid 4-digit Australian postcode' });
        }
        if (errors.length) { showErrorSummary(errors); return; }

        /* Store location in memory only — not persisted to sessionStorage */
        locationState.suburb   = suburb;
        locationState.state    = stateVal;
        locationState.postcode = postcode;
        locationState.urgency  = urgency;
        showStep('step-contact');
      });
    }
    var backLocation = $('btn-back-location');
    if (backLocation) backLocation.addEventListener('click', function () { showStep('step-help-type'); });

    /* Step 6: Contact ───────────────────────────────────── */
    var btnContact = $('btn-continue-contact');
    if (btnContact) {
      btnContact.addEventListener('click', function () {
        var name  = getVal('contactName').trim();
        var email = getVal('contactEmail').trim();
        var phone = getVal('contactPhone').trim();

        clearFieldErrors(['contactName', 'contactEmail']);
        var errors = [];
        if (!name) {
          showFieldError('error-contactName', true);
          errors.push({ id: 'contactName', message: 'Please enter your name' });
        }
        if (!email || !isValidEmail(email)) {
          showFieldError('error-contactEmail', true);
          errors.push({ id: 'contactEmail', message: 'Please enter a valid email address' });
        }
        if (errors.length) { showErrorSummary(errors); return; }

        /* Store contact data separately — never persisted to sessionStorage */
        contactState.contactName  = name;
        contactState.contactEmail = email;
        contactState.contactPhone = phone;
        showStep('step-review');
      });
    }
    var backContact = $('btn-back-contact');
    if (backContact) backContact.addEventListener('click', function () { showStep('step-location'); });

    /* Review: Submit ────────────────────────────────────── */
    var btnSubmit = $('btn-submit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', function () { showStep('step-confirm'); });
    }

    /* Review: Back ──────────────────────────────────────── */
    var backReview = $('btn-back-review');
    if (backReview) backReview.addEventListener('click', function () { showStep('step-contact'); });

    /* Confirmation: Start over ──────────────────────────── */
    var btnOver = $('btn-start-over');
    if (btnOver) {
      btnOver.addEventListener('click', function () {
        clearState();
        /* Reset all form controls */
        qsa('input[type="radio"]').forEach(function (r)    { r.checked = false; });
        qsa('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
        qsa('input[type="text"], input[type="email"], input[type="tel"], textarea')
          .forEach(function (f) { f.value = ''; });
        qsa('select').forEach(function (s) { s.selectedIndex = 0; });
        showStep('step-category');
      });
    }
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    bindStepEvents();
    bindHelpToggles();
    bindChangeLinks();
    restoreFields();
    applyUrlParams();

    /* Determine starting step */
    var stepToShow = state.currentStep || 'step-category';
    if (!$(stepToShow) || stepToShow === 'step-confirm') {
      stepToShow = 'step-category';
    }

    /* Hide all, show target */
    ALL_STEPS.forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = true;
    });

    var card = $(stepToShow);
    if (card) card.hidden = false;
    currentStepId = stepToShow;
    updateProgress();

    if (stepToShow === 'step-review') populateReview();
  }

  init();

})();
