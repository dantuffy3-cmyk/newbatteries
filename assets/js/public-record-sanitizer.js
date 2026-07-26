(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./public-record-eligibility.js'));
  } else {
    root.NBPublicRecordSanitizer = factory(root.NBPublicRecordEligibility);
  }
}(typeof self !== 'undefined' ? self : this, function (eligibilityModule) {
  'use strict';

  var evaluatePublicRecordEligibility = eligibilityModule.evaluatePublicRecordEligibility;
  var evaluatePublicField = eligibilityModule.evaluatePublicField;
  var getByPath = eligibilityModule.getByPath;
  var resolveScope = eligibilityModule.resolveScope;
  var isObject = eligibilityModule.isObject;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emptyPublicResult() {
    return {
      recordId: null,
      eligibility: {
        eligible: false,
        reasonCode: 'malformed_record',
        blockingIssues: [],
        withheldFieldCount: 0
      },
      identification: {
        canonicalCode: null,
        displayName: null,
        scope: null,
        scopeLabel: null
      },
      verifiedFacts: [],
      criticalUnknowns: [],
      withheldFields: [],
      conflicts: [],
      limitations: [],
      relationships: [],
      safetyFlags: [],
      compatibilityStatus: 'not_assessed',
      notAssessed: [],
      nextAction: null,
      lastReviewed: null,
      fallback: null
    };
  }

  function mapFallbackStateKey(result, record, governanceData) {
    var requested = governanceData && governanceData.requestState;
    if (requested) return requested;
    if (Array.isArray(record)) return 'multiple_possible_records';

    var status = getByPath(record, 'recordGovernance.recordStatus');
    if (result.reasonCode === 'eligible') return 'approved_public_record';
    if (status === 'under_review' || status === 'draft' || status === 'reviewed') return 'record_under_review';
    if (result.reasonCode === 'critical_rights_not_cleared') return 'record_rights_restricted';
    if (result.reasonCode === 'record_disputed') return 'record_disputed';
    if (result.reasonCode === 'record_deprecated') return 'record_deprecated';
    if (result.reasonCode === 'record_retired') return 'record_retired';
    if (result.reasonCode === 'malformed_record') return 'malformed_record';
    return 'record_incomplete';
  }

  function getFallbackState(key, governanceData) {
    var states = getByPath(governanceData, 'fallbackStates.states') || {};
    return states[key] || states.unknown_code || null;
  }

  function getRules(governanceData) {
    return (governanceData && governanceData.publicOutputRules) || {};
  }

  function getSourceMap(governanceData) {
    var sourceRegister = governanceData && governanceData.sourceRegister;
    var sources = Array.isArray(sourceRegister)
      ? sourceRegister
      : (sourceRegister && Array.isArray(sourceRegister.sources) ? sourceRegister.sources : []);
    var map = {};
    sources.forEach(function (src) {
      if (src && src.sourceId) map[src.sourceId] = src;
    });
    return map;
  }

  function getCategoryProfiles(governanceData) {
    return (governanceData && (governanceData.categoryProfiles || (governanceData.schema && governanceData.schema.categoryProfiles))) || {};
  }

  function relationshipList(record, governanceData) {
    if (!record || !isObject(record)) return [];
    if (Array.isArray(record.relationships)) return record.relationships;
    var byRecord = governanceData && governanceData.relationshipsByRecord;
    var recordId = getByPath(record, 'identification.recordId');
    return (byRecord && recordId && Array.isArray(byRecord[recordId])) ? byRecord[recordId] : [];
  }

  function sanitizeRelationships(record, governanceData) {
    var rules = (governanceData && governanceData.relationshipRules) || {};
    var publicTypes = rules.publicTypes || [];
    var suppressedTypes = rules.suppressedTypes || [];
    var labels = rules.labels || {};

    return relationshipList(record, governanceData).filter(function (relationship) {
      if (!isObject(relationship)) return false;
      if (suppressedTypes.indexOf(relationship.type) !== -1) return false;
      if (rules.suppressVerifiedDirectEquivalent && relationship.type === 'verified_direct_equivalent') return false;
      if (publicTypes.indexOf(relationship.type) === -1) return false;
      if (rules.requiresApprovedStatus && relationship.status && relationship.status !== 'approved') return false;
      if (rules.requiresRightsCleared && relationship.publicDisplayRights && relationship.publicDisplayRights !== 'cleared' && relationship.publicDisplayRights !== 'not_applicable') return false;
      if (relationship.conflictStatus === 'unresolved') return false;
      return true;
    }).map(function (relationship) {
      return {
        type: relationship.type,
        label: labels[relationship.type] || relationship.type,
        targetCode: relationship.targetCode || relationship.alias || null
      };
    });
  }

  function sanitizeSafetyFlags(record, governanceData) {
    var flags = [];
    if (!record || !isObject(record)) return flags;

    if (Array.isArray(record.safetyFlags)) {
      flags = record.safetyFlags.slice(0);
    } else if (isObject(record.safetyContext)) {
      Object.keys(record.safetyContext).forEach(function (key) {
        var raw = record.safetyContext[key];
        if (isObject(raw)) {
          flags.push({
            key: key,
            text: raw.summary,
            sourceIds: raw.sourceIds,
            verifiedAt: raw.verifiedAt,
            publicDisplayRights: raw.publicDisplayRights || 'unknown',
            categories: raw.categories || null
          });
        }
      });
    }

    var category = getByPath(record, 'identification.category');
    var sourceMap = getSourceMap(governanceData);

    return flags.filter(function (flag) {
      if (!isObject(flag) || !flag.text) return false;
      if (flag.publicDisplayRights !== 'cleared' && flag.publicDisplayRights !== 'not_applicable') return false;
      if (!flag.verifiedAt || !Array.isArray(flag.sourceIds) || flag.sourceIds.length === 0) return false;
      if (!flag.sourceIds.every(function (sourceId) { return !!sourceMap[sourceId]; })) return false;
      if (Array.isArray(flag.categories) && flag.categories.indexOf(category) === -1) return false;
      return true;
    }).map(function (flag) {
      return { key: flag.key || null, text: flag.text };
    });
  }

  function sanitizeGovernedRecordForPublic(record, governanceData) {
    var rules = getRules(governanceData || {});
    var result = emptyPublicResult();
    result.notAssessed = [rules.requiredNotAssessedWording || 'Device-specific compatibility has not been assessed.'];

    if (!record && !(governanceData && governanceData.requestState)) {
      governanceData = governanceData || {};
      governanceData.requestState = 'technical_failure';
    }

    if (Array.isArray(record)) {
      governanceData = governanceData || {};
      governanceData.requestState = governanceData.requestState || 'multiple_possible_records';
      record = null;
    }

    var snapshot = null;
    if (record && isObject(record)) snapshot = JSON.stringify(record);

    var eligibility = evaluatePublicRecordEligibility(record, governanceData || {});
    result.eligibility = {
      eligible: eligibility.eligible,
      reasonCode: eligibility.reasonCode,
      blockingIssues: eligibility.blockingIssues || [],
      withheldFieldCount: (eligibility.withheldFields || []).length
    };

    var fallbackKey = mapFallbackStateKey(eligibility, record, governanceData || {});
    var fallbackState = getFallbackState(fallbackKey, governanceData || {});

    result.fallback = fallbackState ? {
      code: fallbackKey,
      title: fallbackState.title,
      message: fallbackState.message,
      internalReasonCode: fallbackState.reasonCode
    } : null;

    if (record && isObject(record)) {
      result.recordId = getByPath(record, 'identification.recordId') || null;
      var scope = resolveScope(record);
      var scopeLabel = (rules.scopeLabels && rules.scopeLabels[scope]) || null;
      result.identification.scope = scope || null;
      result.identification.scopeLabel = scopeLabel;
      result.lastReviewed = getByPath(record, 'recordGovernance.updatedAt') || getByPath(record, 'recordGovernance.reviewedAt') || null;

      if (eligibility.eligible) {
        result.identification.canonicalCode = getByPath(record, 'identification.canonicalCode') || null;
        result.identification.displayName = record.canonicalName || getByPath(record, 'identification.canonicalCode') || null;
      }

      var category = getByPath(record, 'identification.category');
      var categoryProfiles = getCategoryProfiles(governanceData || {});
      var criticalFields = (categoryProfiles[category] && categoryProfiles[category].requiredFields) || [];
      var sourceMap = getSourceMap(governanceData || {});
      var scopeForFields = resolveScope(record);
      var conflictNoticeAdded = false;

      (rules.publicFactFields || []).forEach(function (path) {
        var evaluation = evaluatePublicField(path, getByPath(record, path), {
          rules: rules,
          sourceMap: sourceMap,
          scope: scopeForFields,
          category: category,
          record: record,
          governanceData: governanceData || {}
        });
        var isCritical = criticalFields.indexOf(path) !== -1;

        if (eligibility.eligible && evaluation.status === 'public') {
          result.verifiedFacts.push({
            field: path,
            value: evaluation.value,
            unit: evaluation.unit
          });
          return;
        }

        if (evaluation.status !== 'public') {
          result.withheldFields.push({ field: path, status: evaluation.status, critical: isCritical });

          if (evaluation.status === 'withheld_conflict' && !conflictNoticeAdded) {
            result.conflicts.push({ message: rules.conflictNotice || 'Some information is withheld while conflicting evidence is reviewed.' });
            conflictNoticeAdded = true;
          }

          if (isCritical && (evaluation.status === 'withheld_unverified' || evaluation.status === 'withheld_scope_unknown' || evaluation.status === 'withheld_malformed')) {
            result.criticalUnknowns.push({ field: path, status: evaluation.status });
          }
        }
      });

      result.relationships = eligibility.eligible ? sanitizeRelationships(record, governanceData || {}) : [];
      result.safetyFlags = eligibility.eligible ? sanitizeSafetyFlags(record, governanceData || {}) : [];
    }

    result.limitations.push(rules.requiredScopeNotice || 'This record identifies a battery scope. It does not by itself confirm compatibility with a particular device or vehicle.');
    if (!eligibility.eligible && result.fallback && result.fallback.message) {
      result.limitations.push(result.fallback.message);
    }
    if (result.conflicts.length > 0) {
      result.limitations.push(rules.conflictNotice || 'Some information is withheld while conflicting evidence is reviewed.');
    }

    result.nextAction = (fallbackState && fallbackState.nextAction) || 'Device-specific compatibility has not been assessed.';

    if (record && isObject(record) && snapshot !== JSON.stringify(record)) {
      throw new Error('sanitizeGovernedRecordForPublic must not mutate source record');
    }

    return result;
  }

  return {
    sanitizeGovernedRecordForPublic: sanitizeGovernedRecordForPublic
  };
}));
