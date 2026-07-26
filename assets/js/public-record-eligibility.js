(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBPublicRecordEligibility = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce(function (acc, part) {
      return acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined;
    }, obj);
  }

  function normalizeSourceRegister(governanceData) {
    var sourceRegister = governanceData && governanceData.sourceRegister;
    var sources = Array.isArray(sourceRegister)
      ? sourceRegister
      : (sourceRegister && Array.isArray(sourceRegister.sources) ? sourceRegister.sources : []);
    var map = {};
    sources.forEach(function (source) {
      if (source && source.sourceId) map[source.sourceId] = source;
    });
    return map;
  }

  function getCategoryProfiles(governanceData) {
    if (!governanceData) return {};
    return governanceData.categoryProfiles || (governanceData.schema && governanceData.schema.categoryProfiles) || {};
  }

  function resolveScope(record) {
    return getByPath(record, 'identification.scope') || record.recordType || null;
  }

  function resolveFieldRights(path, field, record, governanceData) {
    if (isObject(field) && typeof field.publicDisplayRights === 'string') return field.publicDisplayRights;
    var recordRights = getByPath(record, 'recordGovernance.publicDisplayRightsByField.' + path);
    if (typeof recordRights === 'string') return recordRights;
    var governanceRights = getByPath(governanceData, 'publicOutputRules.fieldRightsByPath.' + path);
    if (typeof governanceRights === 'string') return governanceRights;
    if (isObject(field) && Array.isArray(field.sourceIds) && field.sourceIds.length > 0) return 'unknown';
    return 'not_applicable';
  }

  function resolveAuthorityRequirement(category, rules) {
    var categoryRules = rules && rules.categoryAuthorityRequirements;
    if (!isObject(categoryRules)) return 10;
    if (categoryRules[category] && typeof categoryRules[category].maxAuthorityLevel === 'number') {
      return categoryRules[category].maxAuthorityLevel;
    }
    if (categoryRules.default && typeof categoryRules.default.maxAuthorityLevel === 'number') {
      return categoryRules.default.maxAuthorityLevel;
    }
    return 10;
  }

  function evaluatePublicField(path, field, options) {
    var unitRequiredPaths = (options.rules && options.rules.unitRequiredPaths) || [];
    var sourceMap = options.sourceMap || {};
    var validScopes = (options.rules && options.rules.scopeValues) || [];
    var rights = resolveFieldRights(path, field, options.record, options.governanceData);

    if (!isObject(field)) {
      if (field === null || field === undefined || field === '') {
        return { status: 'withheld_unverified', issue: 'value_missing', rights: rights };
      }
      return { status: 'public', value: field, unit: null, rights: rights };
    }

    if (rights === 'restricted' || rights === 'unknown') {
      return { status: 'withheld_rights', issue: 'rights_not_cleared', rights: rights };
    }

    if (!Object.prototype.hasOwnProperty.call(field, 'value')) {
      return { status: 'withheld_malformed', issue: 'value_missing', rights: rights };
    }

    if (field.value === null || field.value === '' || field.value === undefined) {
      return { status: 'withheld_unverified', issue: 'value_missing', rights: rights };
    }

    if (unitRequiredPaths.indexOf(path) !== -1 && !field.unit) {
      return { status: 'withheld_malformed', issue: 'unit_missing', rights: rights };
    }

    if (!Array.isArray(field.sourceIds) || field.sourceIds.length === 0) {
      return { status: 'withheld_unverified', issue: 'source_missing', rights: rights };
    }

    for (var i = 0; i < field.sourceIds.length; i += 1) {
      if (!sourceMap[field.sourceIds[i]]) {
        return { status: 'withheld_malformed', issue: 'source_unknown', rights: rights };
      }
    }

    if (!field.verifiedAt || !field.evidenceConfidence || field.evidenceConfidence === 'unknown') {
      return { status: 'withheld_unverified', issue: 'evidence_unverified', rights: rights };
    }

    var maxAuthority = resolveAuthorityRequirement(options.category, options.rules);
    var authorityOk = field.sourceIds.some(function (sourceId) {
      var src = sourceMap[sourceId];
      return src && typeof src.authorityLevel === 'number' && src.authorityLevel <= maxAuthority;
    });
    if (!authorityOk) {
      return { status: 'withheld_unverified', issue: 'authority_requirement_failed', rights: rights };
    }

    var fieldScope = field.scope || options.scope;
    if (!fieldScope || validScopes.indexOf(fieldScope) === -1) {
      return { status: 'withheld_scope_unknown', issue: 'scope_unknown', rights: rights };
    }

    if (isObject(field.conflict) && field.conflict.status === 'unresolved') {
      return { status: 'withheld_conflict', issue: 'unresolved_conflict', rights: rights };
    }

    return {
      status: 'public',
      value: field.value,
      unit: field.unit || null,
      rights: rights,
      sourceIds: field.sourceIds.slice(0)
    };
  }

  function determineFailureReason(issues) {
    if (issues.some(function (item) { return item.issue === 'rights_not_cleared'; })) return 'critical_rights_not_cleared';
    if (issues.some(function (item) { return item.issue === 'unresolved_conflict'; })) return 'critical_conflict';
    if (issues.some(function (item) { return item.issue === 'value_missing'; })) return 'critical_field_missing';
    return 'critical_provenance_invalid';
  }

  function evaluatePublicRecordEligibility(record, governanceData) {
    var malformed = {
      eligible: false,
      reasonCode: 'malformed_record',
      blockingIssues: [{ issue: 'record_not_object' }],
      withheldFields: [],
      warnings: []
    };

    if (!isObject(record)) return malformed;

    var rules = (governanceData && governanceData.publicOutputRules) || {};
    var sourceMap = normalizeSourceRegister(governanceData || {});
    var categoryProfiles = getCategoryProfiles(governanceData || {});

    var status = getByPath(record, 'recordGovernance.recordStatus');
    var publicEligibility = getByPath(record, 'recordGovernance.publicEligibility');
    var category = getByPath(record, 'identification.category');
    var scope = resolveScope(record);
    var profile = categoryProfiles[category] || {};
    var criticalFields = Array.isArray(profile.requiredFields) ? profile.requiredFields : [];

    if (status === 'disputed' || getByPath(record, 'recordGovernance.disputeNotes')) {
      return { eligible: false, reasonCode: 'record_disputed', blockingIssues: [{ issue: 'record_disputed' }], withheldFields: [], warnings: [] };
    }
    if (status === 'deprecated') {
      return { eligible: false, reasonCode: 'record_deprecated', blockingIssues: [{ issue: 'record_deprecated' }], withheldFields: [], warnings: [] };
    }
    if (status === 'retired') {
      return { eligible: false, reasonCode: 'record_retired', blockingIssues: [{ issue: 'record_retired' }], withheldFields: [], warnings: [] };
    }

    if (!scope || ((rules.scopeValues || []).indexOf(scope) === -1)) {
      return { eligible: false, reasonCode: 'scope_missing', blockingIssues: [{ issue: 'scope_missing' }], withheldFields: [], warnings: [] };
    }

    if (status !== 'approved') {
      return { eligible: false, reasonCode: 'record_not_approved', blockingIssues: [{ issue: 'status_not_approved', status: status || null }], withheldFields: [], warnings: [] };
    }

    if (publicEligibility !== true) {
      return { eligible: false, reasonCode: 'public_flag_false', blockingIssues: [{ issue: 'public_eligibility_false' }], withheldFields: [], warnings: [] };
    }

    var suppressedCodes = rules.criticalCodeSuppression || [];
    var canonicalCode = getByPath(record, 'identification.canonicalCode');
    if (suppressedCodes.indexOf(canonicalCode) !== -1) {
      return {
        eligible: false,
        reasonCode: 'public_flag_false',
        blockingIssues: [{ issue: 'code_suppressed_this_sprint', field: 'identification.canonicalCode' }],
        withheldFields: [{ field: 'identification.canonicalCode', status: 'withheld_unverified' }],
        warnings: []
      };
    }

    var criticalIssues = [];
    var withheld = [];

    criticalFields.forEach(function (path) {
      var field = getByPath(record, path);
      var result = evaluatePublicField(path, field, {
        rules: rules,
        sourceMap: sourceMap,
        scope: scope,
        category: category,
        record: record,
        governanceData: governanceData || {}
      });
      if (result.status !== 'public') {
        withheld.push({ field: path, status: result.status, issue: result.issue, critical: true });
        criticalIssues.push({ field: path, status: result.status, issue: result.issue });
      }
    });

    if (criticalIssues.length > 0) {
      return {
        eligible: false,
        reasonCode: determineFailureReason(criticalIssues),
        blockingIssues: criticalIssues,
        withheldFields: withheld,
        warnings: []
      };
    }

    return {
      eligible: true,
      reasonCode: 'eligible',
      blockingIssues: [],
      withheldFields: [],
      warnings: []
    };
  }

  return {
    evaluatePublicField: evaluatePublicField,
    evaluatePublicRecordEligibility: evaluatePublicRecordEligibility,
    getByPath: getByPath,
    isObject: isObject,
    resolveScope: resolveScope
  };
}));
