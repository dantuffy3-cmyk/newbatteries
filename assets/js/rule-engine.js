/* =============================================================
   NewBatteries – rule-engine.js
   Reusable deterministic rules engine for evidence-led checks.
   ============================================================= */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBRuleEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OPERATORS = {
    greater_than: true,
    greater_than_or_equal: true,
    less_than: true,
    less_than_or_equal: true,
    equals: true,
    not_equals: true,
    included_in: true,
    not_included_in: true,
    boolean_true: true,
    boolean_false: true,
    known: true,
    unknown: true
  };

  function logError() {
    if (typeof console !== 'undefined' && console.error) {
      console.error.apply(console, arguments);
    }
  }

  function hasKnownValue(value) {
    return !(value === null || value === undefined || (typeof value === 'string' && value.trim() === ''));
  }

  function getValueByPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split('.');
    var current = obj;
    var i;
    for (i = 0; i < parts.length; i += 1) {
      if (current === null || current === undefined) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  function normaliseComparable(value) {
    if (typeof value === 'string') return value.trim().toUpperCase();
    return value;
  }

  function unique(list) {
    var out = [];
    (list || []).forEach(function (item) {
      if (out.indexOf(item) === -1) out.push(item);
    });
    return out;
  }

  function getEvidenceRefs(requiredFields, evidenceRecords) {
    var refs = [];
    (requiredFields || []).forEach(function (field) {
      (evidenceRecords || []).forEach(function (record) {
        if (record && record.field === field && record.evidenceId) refs.push(record.evidenceId);
      });
    });
    return unique(refs);
  }

  function resolveComparison(rule, values) {
    if (rule && Object.prototype.hasOwnProperty.call(rule, 'comparisonValue')) {
      return rule.comparisonValue;
    }
    if (values.length > 1) return values[1];
    return undefined;
  }

  function evaluateOperator(operator, values, comparison) {
    var left = values[0];
    switch (operator) {
      case 'greater_than':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return Number(left) > Number(comparison);
      case 'greater_than_or_equal':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return Number(left) >= Number(comparison);
      case 'less_than':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return Number(left) < Number(comparison);
      case 'less_than_or_equal':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return Number(left) <= Number(comparison);
      case 'equals':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return normaliseComparable(left) === normaliseComparable(comparison);
      case 'not_equals':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        return normaliseComparable(left) !== normaliseComparable(comparison);
      case 'included_in':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        if (Array.isArray(comparison)) return comparison.map(normaliseComparable).indexOf(normaliseComparable(left)) !== -1;
        if (Array.isArray(left)) return left.map(normaliseComparable).indexOf(normaliseComparable(comparison)) !== -1;
        return false;
      case 'not_included_in':
        if (!hasKnownValue(left) || !hasKnownValue(comparison)) return null;
        if (Array.isArray(comparison)) return comparison.map(normaliseComparable).indexOf(normaliseComparable(left)) === -1;
        if (Array.isArray(left)) return left.map(normaliseComparable).indexOf(normaliseComparable(comparison)) === -1;
        return false;
      case 'boolean_true':
        if (!hasKnownValue(left)) return null;
        return left === true;
      case 'boolean_false':
        if (!hasKnownValue(left)) return null;
        return left === false;
      case 'known':
        return hasKnownValue(left);
      case 'unknown':
        return !hasKnownValue(left);
      default:
        return null;
    }
  }

  function validateRule(rule) {
    if (!rule || typeof rule !== 'object') return 'Rule must be an object.';
    if (!rule.ruleId) return 'Rule is missing ruleId.';
    if (!Array.isArray(rule.inputs)) return 'Rule ' + rule.ruleId + ' is missing inputs array.';
    if (!rule.operator || !OPERATORS[rule.operator]) return 'Rule ' + rule.ruleId + ' uses unsupported operator: ' + rule.operator;
    if (!rule.ruleType) return 'Rule ' + rule.ruleId + ' is missing ruleType.';
    return null;
  }

  function evaluateAppliesWhen(appliesWhen, input) {
    var conditions;
    var i;
    if (!appliesWhen) return true;
    conditions = Array.isArray(appliesWhen) ? appliesWhen : [appliesWhen];
    for (i = 0; i < conditions.length; i += 1) {
      var condition = conditions[i];
      if (!condition || !condition.operator || !Array.isArray(condition.inputs)) return false;
      var values = condition.inputs.map(function (path) { return getValueByPath(input, path); });
      var comparison = resolveComparison(condition, values);
      if (evaluateOperator(condition.operator, values, comparison) !== true) return false;
    }
    return true;
  }

  function evaluateRule(rule, input, evidenceRecords) {
    var validationError = validateRule(rule);
    var requiredFields = unique((rule && rule.requiredEvidence) || (rule && rule.inputs) || []);
    var result;
    var values;
    var comparison;
    var matched;
    var missingRequiredFields;

    if (validationError) {
      logError('[NBRuleEngine]', validationError, rule);
      return {
        ruleId: rule && rule.ruleId ? rule.ruleId : 'UNKNOWN_RULE',
        version: rule && rule.version ? rule.version : null,
        layer: rule && rule.layer ? rule.layer : null,
        categoryProfile: rule && rule.categoryProfile ? rule.categoryProfile : null,
        ruleType: rule && rule.ruleType ? rule.ruleType : null,
        status: 'unknown',
        malformed: true,
        message: validationError,
        inputValues: {},
        missingRequiredFields: requiredFields,
        evidenceRefs: getEvidenceRefs(requiredFields, evidenceRecords),
        criticalEvidenceMissing: !!(rule && rule.critical && requiredFields.length),
        supplierReviewAllowed: !!(rule && rule.supplierReviewAllowed),
        manualOverrideAllowed: !!(rule && rule.manualOverrideAllowed),
        resolutionActions: (rule && rule.resolutionActions) || []
      };
    }

    if (!evaluateAppliesWhen(rule.appliesWhen, input)) {
      return {
        ruleId: rule.ruleId,
        version: rule.version || null,
        layer: rule.layer || null,
        categoryProfile: rule.categoryProfile || null,
        ruleType: rule.ruleType,
        status: 'not_applicable',
        malformed: false,
        message: rule.userMessage || '',
        technicalReason: rule.technicalReason || '',
        inputValues: {},
        missingRequiredFields: [],
        evidenceRefs: getEvidenceRefs(requiredFields, evidenceRecords),
        criticalEvidenceMissing: false,
        supplierReviewAllowed: !!rule.supplierReviewAllowed,
        manualOverrideAllowed: !!rule.manualOverrideAllowed,
        resolutionActions: rule.resolutionActions || []
      };
    }

    values = rule.inputs.map(function (path) { return getValueByPath(input, path); });
    comparison = resolveComparison(rule, values);
    missingRequiredFields = requiredFields.filter(function (field) {
      return !hasKnownValue(getValueByPath(input, field));
    });
    matched = evaluateOperator(rule.operator, values, comparison);

    result = {
      ruleId: rule.ruleId,
      version: rule.version || null,
      layer: rule.layer || null,
      categoryProfile: rule.categoryProfile || null,
      ruleType: rule.ruleType,
      operator: rule.operator,
      status: 'unknown',
      matched: matched,
      malformed: false,
      message: rule.userMessage || '',
      technicalReason: rule.technicalReason || '',
      inputValues: {},
      missingRequiredFields: missingRequiredFields,
      evidenceRefs: getEvidenceRefs(requiredFields, evidenceRecords),
      critical: !!rule.critical,
      criticalEvidenceMissing: !!(rule.critical && missingRequiredFields.length),
      supplierReviewAllowed: !!rule.supplierReviewAllowed,
      manualOverrideAllowed: !!rule.manualOverrideAllowed,
      resolutionActions: rule.resolutionActions || [],
      unknownLabel: rule.unknownLabel || null,
      outcomeOnFail: rule.outcomeOnFail || null
    };

    rule.inputs.forEach(function (path, index) {
      result.inputValues[path] = values[index];
    });

    if (matched === null) {
      result.status = 'unknown';
      return result;
    }

    if (rule.ruleType === 'blocking') {
      result.status = matched ? 'fail' : 'pass';
      return result;
    }

    if (rule.ruleType === 'conditional') {
      result.status = matched ? 'conditional' : 'pass';
      return result;
    }

    if (rule.ruleType === 'informational') {
      result.status = matched ? 'pass' : 'not_applicable';
      return result;
    }

    result.status = 'unknown';
    return result;
  }

  function evaluateRules(rules, input, evidenceRecords) {
    if (!Array.isArray(rules)) {
      logError('[NBRuleEngine] Rules must be an array.', rules);
      return [];
    }
    return rules.map(function (rule) {
      return evaluateRule(rule, input, evidenceRecords || []);
    });
  }

  function aggregateLayerOutcome(ruleResults) {
    var blockingFailures = (ruleResults || []).filter(function (result) {
      return result.ruleType === 'blocking' && result.status === 'fail';
    });
    var criticalEvidenceMissing = (ruleResults || []).filter(function (result) {
      return result.criticalEvidenceMissing;
    });
    var unresolvedConditions = (ruleResults || []).filter(function (result) {
      return result.ruleType === 'conditional' && (result.status === 'conditional' || result.status === 'unknown');
    });
    var malformed = (ruleResults || []).filter(function (result) {
      return result.malformed;
    });
    var applicable = (ruleResults || []).filter(function (result) {
      return result.status !== 'not_applicable';
    });
    var allPass = applicable.length > 0 && applicable.every(function (result) {
      if (result.ruleType === 'informational') return true;
      return result.status === 'pass';
    });

    if (blockingFailures.length) {
      return {
        outcome: 'blocked',
        blockingFailures: blockingFailures,
        criticalEvidenceMissing: criticalEvidenceMissing,
        unresolvedConditions: unresolvedConditions,
        malformed: malformed
      };
    }

    if (criticalEvidenceMissing.length) {
      return {
        outcome: 'insufficient_evidence',
        blockingFailures: blockingFailures,
        criticalEvidenceMissing: criticalEvidenceMissing,
        unresolvedConditions: unresolvedConditions,
        malformed: malformed
      };
    }

    if (unresolvedConditions.length) {
      return {
        outcome: 'compatible_with_conditions',
        blockingFailures: blockingFailures,
        criticalEvidenceMissing: criticalEvidenceMissing,
        unresolvedConditions: unresolvedConditions,
        malformed: malformed
      };
    }

    if (allPass) {
      return {
        outcome: 'compatible',
        blockingFailures: blockingFailures,
        criticalEvidenceMissing: criticalEvidenceMissing,
        unresolvedConditions: unresolvedConditions,
        malformed: malformed
      };
    }

    return {
      outcome: malformed.length ? 'uncertain' : 'uncertain',
      blockingFailures: blockingFailures,
      criticalEvidenceMissing: criticalEvidenceMissing,
      unresolvedConditions: unresolvedConditions,
      malformed: malformed
    };
  }

  return {
    OPERATORS: OPERATORS,
    hasKnownValue: hasKnownValue,
    getValueByPath: getValueByPath,
    evaluateOperator: evaluateOperator,
    evaluateRule: evaluateRule,
    evaluateRules: evaluateRules,
    aggregateLayerOutcome: aggregateLayerOutcome
  };
}));
