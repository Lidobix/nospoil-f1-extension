// Persistance de la date limite choisie par l'utilisateur, par week-end.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  NGA.storageKey = function (weekendId) {
    return "nga_cutoff_" + weekendId;
  };

  // cutoff = { mode: "session" | "custom" | "all", label: string, cutoffUtcMillis: number|null, savedAt: number }
  // cutoffUtcMillis === null signifie "tout afficher" (filtre désactivé pour ce week-end).
  NGA.getCutoff = function (weekendId) {
    return new Promise((resolve) => {
      const key = NGA.storageKey(weekendId);
      chrome.storage.local.get([key], (res) => resolve(res[key] || null));
    });
  };

  NGA.setCutoff = function (weekendId, cutoff) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [NGA.storageKey(weekendId)]: cutoff }, resolve);
    });
  };

  NGA.clearCutoff = function (weekendId) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([NGA.storageKey(weekendId)], resolve);
    });
  };
})(window.NGAGuard);
