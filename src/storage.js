// Persistance de la coupure globale choisie par l'utilisateur.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  NGA.CUTOFF_KEY = "nga_cutoff";

  // cutoff = { mode: "session" | "all", weekendId: string, label: string, cutoffUtcMillis: number|null, savedAt: number }
  // cutoffUtcMillis === null signifie "tout afficher" (filtre désactivé).
  // Coupure unique et globale : un seul réglage actif à la fois, quel que soit
  // le week-end auquel il fait référence (pas de scope par week-end, sans quoi
  // choisir un week-end passé comme référence n'aurait pas de sens).
  NGA.getCutoff = function () {
    return new Promise((resolve) => {
      chrome.storage.local.get([NGA.CUTOFF_KEY], (res) => resolve(res[NGA.CUTOFF_KEY] || null));
    });
  };

  NGA.setCutoff = function (cutoff) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [NGA.CUTOFF_KEY]: cutoff }, resolve);
    });
  };

  NGA.clearCutoff = function () {
    return new Promise((resolve) => {
      chrome.storage.local.remove([NGA.CUTOFF_KEY], resolve);
    });
  };

  // Mémoire globale des vraies dates de publication apprises, indexées par
  // identifiant d'article (ex: "210213" pour ".../xxx,210213.html"). Un
  // identifiant est unique sur tout le site, donc pas besoin de la cloisonner
  // par week-end. Permet de masquer correctement un lien sans date visible
  // (ex: "à lire aussi" dans un article) dès lors que sa date a été vue
  // ailleurs (grille datée, ou visite directe de sa page).
  NGA.SPOILER_CACHE_KEY = "nga_spoiler_cache";

  NGA.getSpoilerCache = function () {
    return new Promise((resolve) => {
      chrome.storage.local.get([NGA.SPOILER_CACHE_KEY], (res) => resolve(res[NGA.SPOILER_CACHE_KEY] || {}));
    });
  };

  // entries: { [articleId]: publishedUtcMillis }
  NGA.mergeSpoilerCache = function (entries) {
    return NGA.getSpoilerCache().then((cache) => {
      const merged = Object.assign({}, cache, entries);
      return new Promise((resolve) => {
        chrome.storage.local.set({ [NGA.SPOILER_CACHE_KEY]: merged }, resolve);
      });
    });
  };
})(window.NGAGuard);
