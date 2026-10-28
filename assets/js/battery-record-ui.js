(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function setText(id, value, fallback) {
    var el = $(id);
    if (!el) return;
    var text = value;
    if (text === null || typeof text === 'undefined' || text === '') {
      text = (typeof fallback !== 'undefined') ? fallback : '—';
    }
    el.textContent = text;
  }

  function setList(id, items, fallbackText) {
    var list = $(id);
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var values = Array.isArray(items) ? items : [];
    if (!values.length) {
      var li = document.createElement('li');
      li.textContent = fallbackText;
      list.appendChild(li);
      return;
    }
    values.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function formatSavedAt(iso) {
    if (!iso) return 'Unknown';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return 'Unknown';
    try {
      return new Intl.DateTimeFormat('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (e) {
      return date.toLocaleString();
    }
  }

  function confidenceLabel(confidence) {
    if (confidence === 'exact') return 'High — exact local code recognition';
    if (confidence === 'family') return 'Medium — family-level local recognition';
    if (confidence === 'unknown') return 'Unknown — unresolved identification';
    return confidence || 'Unknown';
  }

  function showState(state) {
    var noRecord = $('state-no-record');
    var validRecord = $('state-valid-record');
    var invalidRecord = $('state-invalid-record');
    if (noRecord) noRecord.hidden = state !== 'missing';
    if (validRecord) validRecord.hidden = state !== 'valid';
    if (invalidRecord) invalidRecord.hidden = state !== 'invalid';
  }

  function handleDelete(store, confirmMessage) {
    if (!window.confirm(confirmMessage)) return false;
    store.deleteRecord();
    return true;
  }

  function renderValidRecord(record) {
    var unresolved = record.identificationConfidence === 'unknown' || !record.canonicalCode;

    setText('saved-record-timestamp', formatSavedAt(record.savedAt), 'Unknown');
    setText('saved-record-entered-code', record.enteredCode);
    setText('saved-record-canonical', record.canonicalCode, 'Not available — unresolved');
    setText('saved-record-category', record.category, 'Not available');
    setText('saved-record-confidence', confidenceLabel(record.identificationConfidence));
    setText('saved-record-evidence', record.evidenceSummary, 'Not available');

    setList('saved-record-unknowns', record.unknowns, 'None listed');
    setList('saved-record-warnings', record.warnings, 'None listed');
    setList('saved-record-verification', record.verificationRequired, 'None listed');

    var unresolvedNotice = $('saved-record-unresolved');
    if (unresolvedNotice) unresolvedNotice.hidden = !unresolved;

    var nextWrap = $('saved-record-next-evidence');
    if (nextWrap) {
      if (!record.nextEvidence) {
        nextWrap.hidden = true;
      } else {
        setText('saved-record-next-title', record.nextEvidence.title, '');
        setText('saved-record-next-instruction', record.nextEvidence.instruction, '');
        setText('saved-record-next-why', record.nextEvidence.whyItMatters, '');
        nextWrap.hidden = false;
      }
    }

    var compatibilityWrap = $('saved-record-compat-wrap');
    var compatibilityLink = $('saved-record-compat-link');
    if (compatibilityWrap && compatibilityLink) {
      if (record.canonicalCode) {
        compatibilityLink.href = 'compatibility.html?code=' + encodeURIComponent(record.canonicalCode);
        compatibilityWrap.hidden = false;
      } else {
        compatibilityWrap.hidden = true;
      }
    }
  }

  function init() {
    var store = (typeof NBBatteryRecordStore !== 'undefined') ? NBBatteryRecordStore : null;
    if (!store) {
      showState('invalid');
      return;
    }

    var deleteButtons = ['btn-delete-record-invalid', 'btn-delete-record-valid'];
    deleteButtons.forEach(function (id) {
      var btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var deleted = handleDelete(store, 'Delete saved Battery Record from this browser?');
        if (deleted) showState('missing');
      });
    });

    var state = store.loadRecordState();
    if (state.status === 'missing') {
      showState('missing');
      return;
    }

    if (state.status === 'unsupported_schema' || state.status === 'invalid') {
      showState('invalid');
      return;
    }

    if (state.status === 'valid') {
      renderValidRecord(state.record);
      showState('valid');
      return;
    }

    showState('invalid');
  }

  try {
    init();
  } catch (e) {
    showState('invalid');
  }
})();
