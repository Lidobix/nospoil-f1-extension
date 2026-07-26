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

  // Mémoire des vraies dates de publication apprises pour ce week-end, indexées
  // par identifiant d'article (ex: "210213" pour ".../xxx,210213.html"). Permet
  // de masquer correctement un lien sans date visible (ex: "à lire aussi" dans
  // le corps d'un article) dès lors que sa date a été vue ailleurs (grille
  // datée, ou visite directe de sa page).
  NGA.spoilerCacheKey = function (weekendId) {
    return "nga_spoiler_cache_" + weekendId;
  };

  NGA.getSpoilerCache = function (weekendId) {
    return new Promise((resolve) => {
      const key = NGA.spoilerCacheKey(weekendId);
      chrome.storage.local.get([key], (res) => resolve(res[key] || {}));
    });
  };

  // entries: { [articleId]: publishedUtcMillis }
  NGA.mergeSpoilerCache = function (weekendId, entries) {
    return NGA.getSpoilerCache(weekendId).then((cache) => {
      const merged = Object.assign({}, cache, entries);
      return new Promise((resolve) => {
        chrome.storage.local.set({ [NGA.spoilerCacheKey(weekendId)]: merged }, resolve);
      });
    });
  };
})(window.NGAGuard);
