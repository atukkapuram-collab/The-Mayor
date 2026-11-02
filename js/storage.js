// storage.js — the game's memory. Saves to the browser's localStorage,
// so progress survives closing the tab or restarting the computer.
window.Mayor = window.Mayor || {};

(function () {
  const SAVE_KEY = 'theMayor.save.v1';
  const PREFS_KEY = 'theMayor.prefs';

  // Returns true if saved. Fails quietly (e.g. private mode or a full disk).
  function save(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn('Could not save game:', err);
      return false;
    }
  }

  // Returns { state } | { error: 'incompatible' | 'corrupt' } | null if there is no save
  function load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;
    try {
      const state = JSON.parse(raw);
      if (state.version !== Mayor.config.SAVE_VERSION) return { error: 'incompatible' };
      return { state };
    } catch (err) {
      return { error: 'corrupt' };
    }
  }

  function clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* nothing to clear */ }
  }

  // Small preferences like the theme and whether the tutorial was seen
  function getPref(key, fallback) {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return key in prefs ? prefs[key] : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function setPref(key, value) {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      prefs[key] = value;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (err) { /* preferences are optional */ }
  }

  Mayor.storage = { SAVE_KEY, save, load, clear, getPref, setPref };
})();
