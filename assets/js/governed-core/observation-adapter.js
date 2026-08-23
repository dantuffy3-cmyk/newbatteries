/*
 * observation-adapter.js
 *
 * Development observation snapshot adapter.
 *
 * INVARIANT: saveObservationSnapshot() must not write any data unless
 * development mode is active (?nb_dev=true in the URL query string).
 *
 * This is a defence-in-depth gate. The caller (finder.js) must also
 * check isDevelopmentMode() before calling saveObservationSnapshot().
 * Both layers are required.
 *
 * Production public finder use must never cause any snapshot write.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.NBObservationAdapter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SNAPSHOT_KEY = 'nb_dev_observation_snapshot_v1';

  /*
   * isDevelopmentMode
   *
   * Returns true only when the URL query string contains nb_dev=true.
   * Requires a browser environment; returns false in all other contexts.
   */
  function isDevelopmentMode() {
    try {
      if (typeof window === 'undefined' || !window.location || !window.location.search) {
        return false;
      }
      return window.location.search.indexOf('nb_dev=true') !== -1;
    } catch (e) {
      return false;
    }
  }

  /*
   * saveObservationSnapshot
   *
   * Storage-layer gate: refuses to write unless development mode is active.
   *
   * Returns { written: true } on success.
   * Returns { written: false, reason: string } if write was refused or failed.
   */
  function saveObservationSnapshot(snapshotData) {
    if (!isDevelopmentMode()) {
      return { written: false, reason: 'development_mode_not_active' };
    }
    try {
      if (typeof sessionStorage === 'undefined') {
        return { written: false, reason: 'storage_unavailable' };
      }
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshotData));
      return { written: true };
    } catch (e) {
      return { written: false, reason: 'storage_write_failed' };
    }
  }

  /*
   * loadObservationSnapshot
   *
   * Reads the development snapshot. Returns null if absent or on error.
   * Does not gate on development mode (reading is harmless; the write gate
   * guarantees no production data was ever written).
   */
  function loadObservationSnapshot() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      var raw = sessionStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /*
   * clearObservationSnapshot
   *
   * Removes the development snapshot key from sessionStorage.
   */
  function clearObservationSnapshot() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SNAPSHOT_KEY);
      }
    } catch (e) {}
  }

  return {
    SNAPSHOT_KEY: SNAPSHOT_KEY,
    isDevelopmentMode: isDevelopmentMode,
    saveObservationSnapshot: saveObservationSnapshot,
    loadObservationSnapshot: loadObservationSnapshot,
    clearObservationSnapshot: clearObservationSnapshot
  };
}));
