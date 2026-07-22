/* =============================================================
   NewBatteries – main.js
   Site-wide utilities: nav toggle, year, category cards
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

    /* Close nav when a link is activated */
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  /* ── Category cards (home page) ─────────────────────── */
  var container = document.getElementById('categoryCards');
  if (container) {
    var categories = [
      { label: 'Power tool',                     icon: '🔧', slug: 'tool'        },
      { label: 'Car or vehicle',                 icon: '🚗', slug: 'car'         },
      { label: 'Caravan or camping equipment',   icon: '🚐', slug: 'caravan'     },
      { label: 'Motorcycle',                     icon: '🏍️', slug: 'moto'        },
      { label: 'Boat or marine equipment',       icon: '⛵', slug: 'marine'      },
      { label: 'Mower or garden equipment',      icon: '🌿', slug: 'garden'      },
      { label: 'Home or solar system',           icon: '🏠', slug: 'home'        },
      { label: 'Electronics',                    icon: '💻', slug: 'electronics' },
      { label: 'Mobility equipment',             icon: '♿', slug: 'mobility'    },
      { label: 'Security or emergency equipment',icon: '🔒', slug: 'security'    },
      { label: 'Something else',                 icon: '❓', slug: 'other'       }
    ];

    var html = '';
    categories.forEach(function (cat) {
      html +=
        '<a href="finder.html?category=' + cat.slug + '" class="panel" ' +
        'style="display:flex;flex-direction:column;gap:var(--sp-2);text-decoration:none;' +
        'align-items:flex-start;cursor:pointer;transition:box-shadow var(--ease),border-color var(--ease)"' +
        ' onmouseover="this.style.borderColor=\'var(--color-accent)\'" ' +
        ' onmouseout="this.style.borderColor=\'\'"' +
        '>' +
        '<span style="font-size:1.75rem;line-height:1">' + cat.icon + '</span>' +
        '<span style="font-weight:700;font-size:var(--text-sm);color:var(--color-text)">' + cat.label + '</span>' +
        '</a>';
    });
    container.innerHTML = html;
  }

})();
