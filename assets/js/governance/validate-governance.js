(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBGovernanceValidator2 = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALLOWED_ELIGIBILITY_ENUMS = ['no_evidence', 'under_review', 'partially_validated', 'reviewed', 'approved'];
  var ALLOWED_RIGHTS_STATUS = ['unknown', 'cleared', 'restricted', 'not_applicable'];
  var ALLOWED_PUBLIC_DISPLAY_STATUS = ['withheld', 'public', 'internal_only'];
  var ALLOWED_VALUE_STATUS = [
    'candidate', 'withheld', 'manufacturer_specific_internal_only',
    'candidate_manufacturer_specific', 'withheld_manufacturer_specific'
  ];

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

  var REQUIRED_SOURCE_FIELDS = [
    'sourceId', 'organisation', 'sourceType', 'sourceRole', 'authorityTier',
    'officialTitle', 'documentIdentifier', 'documentDateLabel',
    'publicationDate', 'retrievalDate', 'jurisdiction', 'officialDomain',
    'officialDomainStatus', 'fieldsSupported', 'evidenceLocations',
    'rightsStatus', 'publicDisplayStatus', 'apiStatus',
    'summaryUseApproved', 'archiveReference', 'reviewExpiry',
    'reviewPolicyStatus', 'sourceStatus', 'approvalStatus'
  ];

  function validateSourceRegister(sources) {
    var errors = [];
    if (!Array.isArray(sources)) {
      return { valid: false, errors: ['sources must be an array'] };
    }
    sources.forEach(function (src, i) {
      if (!isObject(src)) {
        errors.push('Source at index ' + i + ' is not an object');
        return;
      }
      REQUIRED_SOURCE_FIELDS.forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(src, field)) {
          errors.push('Source ' + (src.sourceId || i) + ' missing required field: ' + field);
        }
      });
      if (src.rightsStatus === undefined || src.rightsStatus === null) {
        errors.push('Source ' + src.sourceId + ': rightsStatus must be present (default: unknown)');
      }
      if (src.publicDisplayStatus !== undefined && src.publicDisplayStatus !== 'withheld' &&
          src.publicDisplayStatus !== 'public' && src.publicDisplayStatus !== 'internal_only') {
        errors.push('Source ' + src.sourceId + ': invalid publicDisplayStatus: ' + src.publicDisplayStatus);
      }
      if (src.summaryUseApproved !== false && src.summaryUseApproved !== true) {
        errors.push('Source ' + src.sourceId + ': summaryUseApproved must be boolean');
      }
      if (src.sourceStatus === 'retired' || src.sourceStatus === 'expired') {
        errors.push('Source ' + src.sourceId + ': source is ' + src.sourceStatus + ' and must not be used as evidence');
      }
    });
    return { valid: errors.length === 0, errors: errors };
  }

  var REQUIRED_EVIDENCE_FIELDS = [
    'fieldName', 'recordScope', 'value', 'unit', 'valueStatus',
    'sourceIds', 'sourceFactStatus', 'corroborationStatus', 'conflictStatus',
    'manufacturerSpecificStatus', 'standardRecordSuitability',
    'rightsStatus', 'publicDisplayStatus', 'apiStatus',
    'technicalEligibilityEffect', 'publicEligibilityEffect', 'nextAction'
  ];

  function validateTechnicalEvidence(fields, sourceMap) {
    var errors = [];
    if (!Array.isArray(fields)) {
      return { valid: false, errors: ['fields must be an array'] };
    }
    fields.forEach(function (field, i) {
      if (!isObject(field)) {
        errors.push('Technical field at index ' + i + ' is not an object');
        return;
      }
      REQUIRED_EVIDENCE_FIELDS.forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(field, f)) {
          errors.push('Technical field ' + (field.fieldName || i) + ' missing required field: ' + f);
        }
      });
      if (Array.isArray(field.sourceIds)) {
        field.sourceIds.forEach(function (sid) {
          if (sourceMap && !sourceMap[sid]) {
            errors.push('Technical field ' + field.fieldName + ': sourceId not in register: ' + sid);
          }
        });
      }
      if (field.conflictStatus === 'unresolved') {
        errors.push('Technical field ' + field.fieldName + ': unresolved conflict detected — field must be withheld');
      }
      if (field.sourceIds && field.sourceIds.length === 0 &&
          field.valueStatus !== 'withheld' && field.valueStatus !== 'manufacturer_specific_internal_only') {
        errors.push('Technical field ' + field.fieldName + ': no sources but value is not withheld');
      }
    });
    return { valid: errors.length === 0, errors: errors };
  }

  var REQUIRED_REGULATORY_FIELDS = [
    'fieldName', 'sourceIds', 'sourceFact', 'legalScope', 'affectedContext',
    'batteryCategoryRelevance', 'recordRelevance', 'relevanceType',
    'rightsStatus', 'publicDisplayStatus', 'apiStatus', 'governedAction'
  ];

  var VALID_CONTEXTS = ['loose_battery', 'product_containing', 'consumer_handling', 'supplier_compliance'];

  function validateRegulatoryEvidence(contexts, sourceMap) {
    var errors = [];
    if (!isObject(contexts)) {
      return { valid: false, errors: ['regulatoryContexts must be an object'] };
    }
    Object.keys(contexts).forEach(function (contextKey) {
      if (VALID_CONTEXTS.indexOf(contextKey) === -1) {
        errors.push('Unknown regulatory context: ' + contextKey);
        return;
      }
      var ctx = contexts[contextKey];
      if (!isObject(ctx) || !Array.isArray(ctx.fields)) {
        errors.push('Context ' + contextKey + ' must have a fields array');
        return;
      }
      ctx.fields.forEach(function (field, i) {
        if (!isObject(field)) {
          errors.push('Regulatory field at index ' + i + ' in ' + contextKey + ' is not an object');
          return;
        }
        REQUIRED_REGULATORY_FIELDS.forEach(function (f) {
          if (!Object.prototype.hasOwnProperty.call(field, f)) {
            errors.push('Regulatory field ' + (field.fieldName || i) + ' in ' + contextKey + ' missing: ' + f);
          }
        });
        if (Array.isArray(field.sourceIds)) {
          field.sourceIds.forEach(function (sid) {
            if (sourceMap && !sourceMap[sid]) {
              errors.push('Regulatory field ' + field.fieldName + ' in ' + contextKey + ': sourceId not in register: ' + sid);
            }
          });
        }
        if (contextKey !== 'product_containing' && contextKey !== 'supplier_compliance') {
          if (field.relevanceType === 'device_manufacturer_obligation' ||
              field.relevanceType === 'supplier_obligation_reference') {
            errors.push('Regulatory field ' + field.fieldName + ': product/supplier obligation in wrong context: ' + contextKey);
          }
        }
        if (contextKey === 'loose_battery' &&
            (field.relevanceType === 'device_manufacturer_obligation')) {
          errors.push('Regulatory field ' + field.fieldName + ': product-containing obligation must not appear in loose_battery context');
        }
      });
    });
    return { valid: errors.length === 0, errors: errors };
  }

  function validateDerivedRules(rules, sourceMap) {
    var errors = [];
    if (!Array.isArray(rules)) {
      return { valid: false, errors: ['rules must be an array'] };
    }
    rules.forEach(function (rule, i) {
      if (!isObject(rule)) {
        errors.push('Rule at index ' + i + ' is not an object');
        return;
      }
      ['ruleId', 'ruleName', 'dependencies', 'derivedOutputIsSourceFact',
       'createsCompatibilityClaim', 'currentStatus', 'inputEvidenceIds'].forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(rule, f)) {
          errors.push('Rule ' + (rule.ruleId || i) + ' missing required field: ' + f);
        }
      });
      if (rule.derivedOutputIsSourceFact === true) {
        errors.push('Rule ' + rule.ruleId + ': derivedOutputIsSourceFact must be false');
      }
      if (rule.createsCompatibilityClaim === true) {
        errors.push('Rule ' + rule.ruleId + ': derived rules must not create compatibility claims');
      }
      if (Array.isArray(rule.dependencies)) {
        rule.dependencies.forEach(function (dep) {
          if (dep.evidenceSourceId && sourceMap && !sourceMap[dep.evidenceSourceId]) {
            errors.push('Rule ' + rule.ruleId + ': dependency sourceId not in register: ' + dep.evidenceSourceId);
          }
        });
      }
    });
    return { valid: errors.length === 0, errors: errors };
  }

  function validateEligibilityState(state) {
    var errors = [];
    if (!isObject(state)) {
      return { valid: false, errors: ['eligibilityState must be an object'] };
    }
    var techElig = state.technicalIdentityEligibility;
    var safetyElig = state.safetyContentEligibility;
    var stewardshipElig = state.stewardshipContentEligibility;
    var compatStatus = state.compatibilityStatus;
    var publicElig = state.publicEligibility;

    if (ALLOWED_ELIGIBILITY_ENUMS.indexOf(techElig) === -1) {
      errors.push('technicalIdentityEligibility has invalid value: ' + techElig);
    }
    if (ALLOWED_ELIGIBILITY_ENUMS.indexOf(safetyElig) === -1) {
      errors.push('safetyContentEligibility has invalid value: ' + safetyElig);
    }
    if (ALLOWED_ELIGIBILITY_ENUMS.indexOf(stewardshipElig) === -1) {
      errors.push('stewardshipContentEligibility has invalid value: ' + stewardshipElig);
    }
    if (compatStatus !== 'not_assessed') {
      errors.push('compatibilityStatus must be not_assessed, got: ' + compatStatus);
    }
    if (publicElig !== false) {
      errors.push('publicEligibility must be false at this stage, got: ' + publicElig);
    }
    if (techElig === 'approved' || safetyElig === 'approved' || stewardshipElig === 'approved') {
      errors.push('No eligibility gate may be marked approved in Sprint 1 without full evidence clearance');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateGovernedRecord(record, sourceMap) {
    var errors = [];
    if (!isObject(record)) {
      return { valid: false, errors: ['record must be an object — malformed record'] };
    }
    if (!record.batteryCode) {
      errors.push('Governed record missing batteryCode');
    }
    if (!record.eligibility) {
      errors.push('Governed record missing eligibility object');
    } else {
      var eligErrors = validateEligibilityState(record.eligibility).errors;
      errors = errors.concat(eligErrors);
    }
    if (record.governanceFlags) {
      if (record.governanceFlags.approvedForPublic === true) {
        errors.push('approvedForPublic must be false in Sprint 1');
      }
      if (record.governanceFlags.compatibilityInferred === true) {
        errors.push('compatibilityInferred must be false — no compatibility inference permitted');
      }
      if (record.governanceFlags.equivalenceInferred === true) {
        errors.push('equivalenceInferred must be false — no equivalence inference permitted');
      }
      if (record.governanceFlags.manufacturerPerformanceExposed === true) {
        errors.push('manufacturerPerformanceExposed must be false — performance data must remain internal');
      }
    }
    if (record.technicalIdentity) {
      Object.keys(record.technicalIdentity).forEach(function (fieldName) {
        var field = record.technicalIdentity[fieldName];
        if (!isObject(field)) return;
        if (Array.isArray(field.sourceIds)) {
          field.sourceIds.forEach(function (sid) {
            if (sourceMap && !sourceMap[sid]) {
              errors.push('Governed record field ' + fieldName + ': sourceId not in register: ' + sid);
            }
          });
        }
        if (field.publicDisplayStatus !== 'withheld' && field.publicDisplayStatus !== undefined) {
          errors.push('Governed record field ' + fieldName + ': publicDisplayStatus must be withheld at this stage');
        }
      });
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validateAll(governanceBundle) {
    var allErrors = [];
    var sourceMap = {};

    if (!isObject(governanceBundle)) {
      return { valid: false, errors: ['governanceBundle must be an object'] };
    }

    var sourcesResult = validateSourceRegister(governanceBundle.sources || []);
    if (!sourcesResult.valid) allErrors = allErrors.concat(sourcesResult.errors);
    else sourceMap = buildSourceMap(governanceBundle.sources);

    if (governanceBundle.technicalEvidenceFields) {
      var techResult = validateTechnicalEvidence(governanceBundle.technicalEvidenceFields, sourceMap);
      if (!techResult.valid) allErrors = allErrors.concat(techResult.errors);
    }

    if (governanceBundle.regulatoryContexts) {
      var regResult = validateRegulatoryEvidence(governanceBundle.regulatoryContexts, sourceMap);
      if (!regResult.valid) allErrors = allErrors.concat(regResult.errors);
    }

    if (governanceBundle.derivedRules) {
      var rulesResult = validateDerivedRules(governanceBundle.derivedRules, sourceMap);
      if (!rulesResult.valid) allErrors = allErrors.concat(rulesResult.errors);
    }

    if (governanceBundle.eligibilityState) {
      var eligResult = validateEligibilityState(governanceBundle.eligibilityState);
      if (!eligResult.valid) allErrors = allErrors.concat(eligResult.errors);
    }

    if (governanceBundle.governedRecord) {
      var recResult = validateGovernedRecord(governanceBundle.governedRecord, sourceMap);
      if (!recResult.valid) allErrors = allErrors.concat(recResult.errors);
    }

    return { valid: allErrors.length === 0, errors: allErrors };
  }

  return {
    validateSourceRegister: validateSourceRegister,
    validateTechnicalEvidence: validateTechnicalEvidence,
    validateRegulatoryEvidence: validateRegulatoryEvidence,
    validateDerivedRules: validateDerivedRules,
    validateEligibilityState: validateEligibilityState,
    validateGovernedRecord: validateGovernedRecord,
    validateAll: validateAll,
    buildSourceMap: buildSourceMap
  };
}));
