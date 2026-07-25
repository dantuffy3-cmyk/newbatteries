/* =============================================================
   NewBatteries – physical-fit-result.js
   Reusable renderer for structured physical-fit outcomes.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBPhysicalFitResult = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OUTCOME_LABELS = {
    blocked: 'BLOCKED',
    insufficient_evidence: 'INSUFFICIENT EVIDENCE',
    compatible_with_conditions: 'COMPATIBLE WITH CONDITIONS',
    compatible: 'COMPATIBLE',
    uncertain: 'UNCERTAIN'
  };

  var OUTCOME_CLASSES = {
    blocked: 'compat-demo__badge--blocked',
    insufficient_evidence: 'compat-demo__badge--insufficient',
    compatible_with_conditions: 'compat-demo__badge--conditional',
    compatible: 'compat-demo__badge--compatible',
    uncertain: 'compat-demo__badge--uncertain'
  };

  function byClass(className, text, tagName) {
    var el = document.createElement(tagName || 'p');
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function createList(items, className, emptyText) {
    var wrap = document.createElement('div');
    var list = document.createElement('ul');
    var empty = byClass('lp-rule-demo__empty', emptyText || 'No additional detail is listed.');

    list.className = className || 'lp-rule-demo__list';

    if (items && items.length) {
      items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      wrap.appendChild(list);
    } else {
      wrap.appendChild(empty);
    }

    return wrap;
  }

  function createSection(title, items, emptyText, listClass) {
    var card = byClass('lp-rule-demo__detail-card', null, 'section');
    card.appendChild(byClass('lp-rule-demo__detail-heading', title, 'h4'));
    card.appendChild(createList(items, listClass, emptyText));
    return card;
  }

  function createNextEvidence(result) {
    var card = byClass('lp-rule-demo__actions', null, 'section');
    var recommendation = result.nextEvidenceRecommendation;

    card.appendChild(byClass('lp-rule-demo__detail-heading', 'Next evidence required', 'h4'));
    if (recommendation) {
      card.appendChild(createList([recommendation.request], 'lp-rule-demo__list lp-rule-demo__list--actions'));
      card.appendChild(byClass('lp-rule-demo__supplier-note', recommendation.reason));
    } else {
      card.appendChild(byClass('lp-rule-demo__empty', 'No additional evidence recommendation is active for this result.'));
    }
    return card;
  }

  function createResultLead(result) {
    if (result.outcome === 'blocked') return 'Based on the information supplied, a physical conflict identified by the rules prevents this physical fit outcome.';
    if (result.outcome === 'insufficient_evidence') return 'Based on the information supplied, additional evidence required means the current physical fit result remains preliminary.';
    if (result.outcome === 'compatible_with_conditions') return 'Based on the information supplied, this is a possible physical fit, but confirmation is still required before purchase or installation.';
    if (result.outcome === 'compatible') return 'Based on the information supplied, no unresolved physical-fit conflicts remain in this preliminary result.';
    return 'Based on the information supplied, the preliminary result remains uncertain.';
  }

  function createOutcomeMessage(result) {
    if (result.outcome === 'blocked') return 'Physical conflict identified';
    if (result.outcome === 'insufficient_evidence') return 'Additional evidence required';
    if (result.outcome === 'compatible_with_conditions') return 'Possible physical fit';
    if (result.outcome === 'compatible') return 'Possible physical fit';
    return 'Preliminary result';
  }

  function render(rootEl, result, options) {
    var title = (options && options.title) || 'Physical fit assessment';
    var contextTitle = (options && options.contextTitle) || 'Preliminary result';
    var subtitle = (options && options.subtitle) || null;
    var sectionsWrap;
    var head;

    if (!rootEl || !result || typeof document === 'undefined') return;

    rootEl.innerHTML = '';
    rootEl.className = 'lp-rule-demo__result';

    rootEl.appendChild(byClass('lp-rule-demo__result-kicker', title));
    rootEl.appendChild(byClass('lp-rule-demo__result-title', contextTitle, 'h3'));
    if (subtitle) rootEl.appendChild(byClass('lp-rule-demo__context', subtitle));

    head = byClass('lp-rule-demo__result-head', null, 'div');
    head.appendChild(byClass('compat-demo__badge ' + (OUTCOME_CLASSES[result.outcome] || OUTCOME_CLASSES.uncertain), OUTCOME_LABELS[result.outcome] || result.outcome));
    head.appendChild(byClass('lp-rule-demo__confidence', (result.evidenceSummary.overallConfidence || 'unverified') + ' confidence · ' + result.evidenceSummary.completenessLabel));
    rootEl.appendChild(head);

    rootEl.appendChild(byClass('lp-rule-demo__lead-line', 'Preliminary result'));
    rootEl.appendChild(byClass('lp-rule-demo__context', createOutcomeMessage(result)));
    rootEl.appendChild(byClass('lp-rule-demo__summary', createResultLead(result)));
    rootEl.appendChild(byClass('lp-rule-demo__summary', result.summary));
    rootEl.appendChild(byClass('lp-rule-demo__supplier-note', 'Confirm before purchase or installation. Electrical and chemistry compatibility have not been assessed.'));

    sectionsWrap = byClass('lp-rule-demo__details', null, 'div');
    sectionsWrap.appendChild(createSection('Confirmed checks', result.confirmedChecks, 'No confirmed physical-fit checks are listed yet.'));
    sectionsWrap.appendChild(createSection('Blocking issues', result.blockingIssues.map(function (issue) { return issue.message; }), 'No blocking physical conflict is listed.'));
    sectionsWrap.appendChild(createSection('Conditional issues', result.conditions.map(function (issue) { return issue.message; }), 'No conditional issue is active from the supplied evidence.'));
    sectionsWrap.appendChild(createSection('Unknowns', result.unknowns, 'No unresolved unknowns are active for this result.'));
    sectionsWrap.appendChild(createSection('Evidence still required', result.evidenceStillRequired, 'No additional evidence is currently required by the active rules.'));
    sectionsWrap.appendChild(createSection('Areas not assessed', result.areasNotAssessed, 'All currently supported areas have been assessed.'));
    rootEl.appendChild(sectionsWrap);

    rootEl.appendChild(createNextEvidence(result));
    rootEl.appendChild(createSection('Required next actions', result.requiredNextActions, 'No further physical-fit action is listed for this result.', 'lp-rule-demo__list lp-rule-demo__list--actions'));
  }

  return {
    render: render,
    outcomeLabels: OUTCOME_LABELS,
    outcomeClasses: OUTCOME_CLASSES
  };
}));
