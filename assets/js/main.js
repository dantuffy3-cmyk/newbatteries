/* =============================================================
   NewBatteries – main.js
   Site-wide utilities: nav toggle, year, homepage routing
   ============================================================= */

(function () {
  'use strict';

  /* ── Copyright year ─────────────────────────────────── */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Mobile nav toggle ──────────────────────────────── */
  var toggle = document.getElementById('navToggle');
  var nav    = document.getElementById('primaryNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('is-open', !expanded);
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  /* ── Homepage identification routing ────────────────── */

  /* Simple transparent keyword router.
     Returns the finder path value: 'number' | 'equipment' | 'notsure' */
  function routeQuery(q) {
    var s = q.trim();
    if (!s) return 'notsure';

    /* Battery code detection: short, no-space alphanumeric matching
       common battery-code patterns (e.g. LN2, DIN66, N70, NS60, 66MF). */
    if (s.indexOf(' ') === -1 && s.length <= 12) {
      if (/^[A-Za-z]{1,4}\d{1,4}[A-Za-z0-9]*$/.test(s)) return 'number';
      if (/^\d{1,4}[A-Za-z]{1,4}$/.test(s))              return 'number';
    }

    /* Battery spec/chemistry terms (e.g. "AGM 600CCA", "100AH gel") */
    if (/\b(CCA|AGM|GEL|AH|LFP|VRLA|FLA|EFB|SLA)\b/i.test(s)) return 'number';

    /* Multi-word queries suggest equipment description / brand + model */
    if (s.indexOf(' ') !== -1) return 'equipment';

    /* Single capitalised word with 4+ chars: likely an equipment brand */
    if (/^[A-Z][a-zA-Z]{3,}$/.test(s)) return 'equipment';

    return 'notsure';
  }

  var form     = document.getElementById('homeIdForm');
  var input    = document.getElementById('homeQuery');
  var photoBtn = document.getElementById('homePhotoBtn');
  var photoPanel = document.getElementById('homePhotoGuidance');
  var photoCloseBtn = document.getElementById('homePhotoGuidanceClose');
  var lastPhotoTrigger = null;

  if (form && input) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q    = input.value.trim();
      var path = q ? routeQuery(q) : 'notsure';

      /* Save only the non-personal starting query to session */
      try { sessionStorage.setItem('nb_home_query', q); } catch (ex) { /* ignore */ }

      var url = 'finder.html?path=' + encodeURIComponent(path);
      if (q) url += '&query=' + encodeURIComponent(q);
      window.location.href = url;
    });
  }

  function openPhotoGuidance() {
    if (!photoBtn || !photoPanel) return;
    lastPhotoTrigger = photoBtn;
    photoPanel.hidden = false;
    photoBtn.setAttribute('aria-expanded', 'true');
    photoPanel.focus();
  }

  function closePhotoGuidance() {
    if (!photoBtn || !photoPanel) return;
    photoPanel.hidden = true;
    photoBtn.setAttribute('aria-expanded', 'false');
    if (lastPhotoTrigger && typeof lastPhotoTrigger.focus === 'function') {
      lastPhotoTrigger.focus();
    }
  }

  if (photoBtn && photoPanel) {
    photoPanel.hidden = true;
    photoBtn.setAttribute('aria-expanded', 'false');

    photoBtn.addEventListener('click', function () {
      var isOpen = photoBtn.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closePhotoGuidance();
      } else {
        openPhotoGuidance();
      }
    });

    photoBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var isOpen = photoBtn.getAttribute('aria-expanded') === 'true';
        if (isOpen) closePhotoGuidance();
        else openPhotoGuidance();
      }
    });

    if (photoCloseBtn) {
      photoCloseBtn.addEventListener('click', function () {
        closePhotoGuidance();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !photoPanel.hidden) {
        e.preventDefault();
        closePhotoGuidance();
      }
    });
  }

  /* ── Category browser toggle ────────────────────────── */
  var catsToggle = document.getElementById('catsToggle');
  var catsPanel  = document.getElementById('catsBrowser');

  if (catsToggle && catsPanel) {
    catsToggle.addEventListener('click', function () {
      var expanded = catsToggle.getAttribute('aria-expanded') === 'true';
      catsToggle.setAttribute('aria-expanded', String(!expanded));
      catsPanel.hidden = expanded;
    });
  }

})();
