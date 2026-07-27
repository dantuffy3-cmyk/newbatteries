(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBEvaluateDerivedRules = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function buildSourceMap(sources) {
    var map = {};
    if (!Array.isArray(sources)) return map;
    sources.forEach(function (src) {
      if (src && src.sourceId) map[src.sourceId] = src;
    });
    return map;
  }

  function checkSourceAvailable(sourceId, sourceMap) {
    if (!sourceId) return { available: false, reason: 'no_source_id' };
    var src = sourceMap[sourceId];
    if (!src) return { available: false, reason: 'source_not_registered' };
    if (src.sourceStatus === 'retired') return { available: false, reason: 'source_retired' };
    if (src.sourceStatus === 'expired') return { available: false, reason: 'source_expired' };
    if (src.approvalStatus === 'not_approved' || src.approvalStatus === undefined) {
      return { available: true, reason: 'source_candidate', warning: 'source_not_yet_approved' };
    }
    return { available: true, reason: 'source_available' };
  }

  function checkFieldAvailable(fieldName, techEvidenceFields) {
    if (!Array.isArray(techEvidenceFields)) return { available: false, reason: 'no_evidence_fields' };
    var field = null;
    for (var i = 0; i < techEvidenceFields.length; i++) {
      if (techEvidenceFields[i] && techEvidenceFields[i].fieldName === fieldName) {
        field = techEvidenceFields[i];
        break;
      }
    }
    if (!field) return { available: false, reason: 'field_missing' };
    if (field.conflictStatus === 'unresolved') return { available: false, reason: 'field_has_conflict' };
    if (field.valueStatus === 'withheld') return { available: false, reason: 'field_withheld' };
    if (field.value === null || field.value === undefined) return { available: false, reason: 'field_value_null' };
    return { available: true, reason: 'field_available', field: field };
  }

  function evaluateR1(techEvidenceFields, sourceMap) {
    var ruleId = 'R1';
    var dependencyResults = [];
    var allAvailable = true;
    var failReasons = [];

    var depDiameter = checkFieldAvailable('diameter', techEvidenceFields);
    dependencyResults.push({ dependencyId: 'R1-DEP-1', fieldName: 'diameter', result: depDiameter });
    if (!depDiameter.available) { allAvailable = false; failReasons.push('diameter: ' + depDiameter.reason); }

    var depHeight = checkFieldAvailable('height', techEvidenceFields);
    dependencyResults.push({ dependencyId: 'R1-DEP-2', fieldName: 'height', result: depHeight });
    if (!depHeight.available) { allAvailable = false; failReasons.push('height: ' + depHeight.reason); }

    var depAcccc = checkSourceAvailable('SRC-V2-AU-ACCC-BUTTON-001', sourceMap);
    dependencyResults.push({ dependencyId: 'R1-DEP-3', sourceId: 'SRC-V2-AU-ACCC-BUTTON-001', result: depAcccc });
    if (!depAcccc.available) { allAvailable = false; failReasons.push('ACCC category source: ' + depAcccc.reason); }

    if (!allAvailable) {
      return {
        ruleId: ruleId,
        status: 'not_applied',
        reason: 'dependency_unavailable: ' + failReasons.join('; '),
        dependencyResults: dependencyResults,
        derivedOutputIsSourceFact: false,
        createsCompatibilityClaim: false
      };
    }

    return {
      ruleId: ruleId,
      status: 'applied',
      reason: 'all_dependencies_available_as_candidates',
      derivedOutput: 'category_applicability_candidate',
      derivedOutputNote: 'CR2032 diameter and height fields present as candidates. ACCC category source present as candidate. Assessment is a derived candidate only — not a regulatory determination.',
      dependencyResults: dependencyResults,
      derivedOutputIsSourceFact: false,
      createsCompatibilityClaim: false
    };
  }

  function evaluateR2(techEvidenceFields, sourceMap) {
    var ruleId = 'R2';
    var dependencyResults = [];
    var allAvailable = true;
    var failReasons = [];

    var depLithium = checkFieldAvailable('broadLithiumClassification', techEvidenceFields);
    dependencyResults.push({ dependencyId: 'R2-DEP-1', fieldName: 'broadLithiumClassification', result: depLithium });
    if (!depLithium.available) { allAvailable = false; failReasons.push('broadLithiumClassification: ' + depLithium.reason); }

    var depDiameter = checkFieldAvailable('diameter', techEvidenceFields);
    dependencyResults.push({ dependencyId: 'R2-DEP-2', fieldName: 'diameter', result: depDiameter });
    if (!depDiameter.available) { allAvailable = false; failReasons.push('diameter: ' + depDiameter.reason); }

    var depThreshold = checkSourceAvailable('SRC-V2-AU-ACCC-THRESHOLD-001', sourceMap);
    dependencyResults.push({ dependencyId: 'R2-DEP-3', sourceId: 'SRC-V2-AU-ACCC-THRESHOLD-001', result: depThreshold });
    if (!depThreshold.available) { allAvailable = false; failReasons.push('ACCC threshold source: ' + depThreshold.reason); }

    if (!allAvailable) {
      return {
        ruleId: ruleId,
        status: 'not_applied',
        reason: 'dependency_unavailable: ' + failReasons.join('; '),
        dependencyResults: dependencyResults,
        derivedOutputIsSourceFact: false,
        createsCompatibilityClaim: false
      };
    }

    return {
      ruleId: ruleId,
      status: 'applied',
      reason: 'all_dependencies_available_as_candidates',
      derivedOutput: 'marking_rule_threshold_candidate',
      derivedOutputNote: 'Broad lithium classification and diameter fields present as candidates. ACCC threshold source present as candidate. Assessment is a derived candidate only — not a regulatory determination.',
      dependencyResults: dependencyResults,
      derivedOutputIsSourceFact: false,
      createsCompatibilityClaim: false
    };
  }

  function evaluateR3(regulatoryContexts, sourceMap) {
    var ruleId = 'R3';
    var dependencyResults = [];
    var allAvailable = true;
    var failReasons = [];
    var contextViolations = [];

    if (!isObject(regulatoryContexts)) {
      return {
        ruleId: ruleId,
        status: 'not_applied',
        reason: 'regulatory_contexts_missing_or_malformed',
        dependencyResults: dependencyResults,
        derivedOutputIsSourceFact: false,
        createsCompatibilityClaim: false
      };
    }

    var depSource = checkSourceAvailable('SRC-V2-AU-ACCC-BUTTON-001', sourceMap);
    dependencyResults.push({ dependencyId: 'R3-DEP-1', sourceId: 'SRC-V2-AU-ACCC-BUTTON-001', result: depSource });
    if (!depSource.available) { allAvailable = false; failReasons.push('ACCC context source: ' + depSource.reason); }

    if (allAvailable && regulatoryContexts.loose_battery && Array.isArray(regulatoryContexts.loose_battery.fields)) {
      regulatoryContexts.loose_battery.fields.forEach(function (field) {
        if (field.relevanceType === 'device_manufacturer_obligation' ||
            field.relevanceType === 'supplier_obligation_reference') {
          contextViolations.push('Product/supplier obligation found in loose_battery context: ' + field.fieldName);
        }
      });
    }

    if (contextViolations.length > 0) {
      return {
        ruleId: ruleId,
        status: 'not_applied',
        reason: 'context_separation_violated: ' + contextViolations.join('; '),
        dependencyResults: dependencyResults,
        contextViolations: contextViolations,
        derivedOutputIsSourceFact: false,
        createsCompatibilityClaim: false
      };
    }

    if (!allAvailable) {
      return {
        ruleId: ruleId,
        status: 'not_applied',
        reason: 'dependency_unavailable: ' + failReasons.join('; '),
        dependencyResults: dependencyResults,
        derivedOutputIsSourceFact: false,
        createsCompatibilityClaim: false
      };
    }

    return {
      ruleId: ruleId,
      status: 'applied',
      reason: 'context_separation_validated',
      derivedOutput: 'loose_product_context_separation_confirmed',
      derivedOutputNote: 'No product-containing obligations found in loose_battery context. Context separation is structurally enforced.',
      dependencyResults: dependencyResults,
      derivedOutputIsSourceFact: false,
      createsCompatibilityClaim: false
    };
  }

  function evaluateAllRules(bundle) {
    if (!isObject(bundle)) {
      return {
        valid: false,
        error: 'bundle must be an object',
        results: []
      };
    }
    var sourceMap = buildSourceMap(bundle.sources || []);
    var techFields = bundle.technicalEvidenceFields || [];
    var regContexts = bundle.regulatoryContexts || {};

    var results = [
      evaluateR1(techFields, sourceMap),
      evaluateR2(techFields, sourceMap),
      evaluateR3(regContexts, sourceMap)
    ];

    return { valid: true, results: results };
  }

  return {
    evaluateR1: evaluateR1,
    evaluateR2: evaluateR2,
    evaluateR3: evaluateR3,
    evaluateAllRules: evaluateAllRules,
    buildSourceMap: buildSourceMap,
    checkSourceAvailable: checkSourceAvailable,
    checkFieldAvailable: checkFieldAvailable
  };
}));
