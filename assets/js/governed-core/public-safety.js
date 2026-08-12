(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBGovernedPublicSafety = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getByPath(obj, path) {
    return String(path || '').split('.').reduce(function (acc, key) {
      return acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined;
    }, obj);
  }

  function getFixtureMeta(record) {
    return record && record.developmentFixture ? record.developmentFixture : null;
  }

  function isEngineeringFixture(record) {
    var meta = getFixtureMeta(record);
    return !!(meta && meta.fixtureStatus === 'engineering_fixture');
  }

  function canRenderPublicRecord(record) {
    var blockingReasons = [];
    var meta = getFixtureMeta(record);
    var status = getByPath(record, 'recordGovernance.recordStatus');
    var publicEligibility = getByPath(record, 'recordGovernance.publicEligibility');

    if (meta && meta.fixtureStatus === 'engineering_fixture') blockingReasons.push('engineering_fixture');
    if (meta && meta.access === 'development_only') blockingReasons.push('development_only');
    if (meta && meta.publicRecommendationStatus === 'not_for_public_recommendation') blockingReasons.push('not_for_public_recommendation');
    if (status === 'draft') blockingReasons.push('draft_record');
    if (status !== 'approved') blockingReasons.push('unapproved_record');
    if (publicEligibility !== true) blockingReasons.push('public_output_not_approved');

    return {
      allowed: blockingReasons.length === 0,
      blockingReasons: blockingReasons
    };
  }

  return {
    canRenderPublicRecord: canRenderPublicRecord,
    isEngineeringFixture: isEngineeringFixture,
    getFixtureMeta: getFixtureMeta
  };
}));
