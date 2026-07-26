/**
 * Persistance de la coupure globale (`nga_cutoff`) choisie par l'utilisateur,
 * et de la mémoire des dates de publication apprises (`nga_spoiler_cache`).
 * Les deux clés sont globales (pas de scope par week-end) : un seul réglage
 * actif à la fois, et un identifiant d'article est unique sur tout le site.
 *
 * @namespace NGA
 * @desc Espace de noms partagé (`window.NGAGuard`), peuplé par chacun des
 *   fichiers `src/*.js` chargés par le manifest de l'extension.
 */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  /**
   * Clé de stockage (`chrome.storage.local`) de la coupure active.
   * @memberof NGA
   * @constant {string}
   */
  NGA.CUTOFF_KEY = "nga_cutoff";

  /**
   * @typedef {Object} Cutoff
   * @property {"session"|"all"} mode - "session" = coupure sur une séance précise, "all" = filtre désactivé.
   * @property {string} weekendId - identifiant du week-end de référence (ex: "2026-hungary").
   * @property {string} label - libellé lisible affiché dans l'UI (ex: "Grand Prix de Hongrie 2026 – Qualifications").
   * @property {number|null} cutoffUtcMillis - instant UTC (ms) à partir duquel le contenu est masqué ; null quand mode === "all".
   * @property {number} savedAt - horodatage UTC (ms) de l'enregistrement du réglage.
   * @memberof NGA
   */

  /**
   * Lit la coupure actuellement enregistrée.
   * @memberof NGA
   * @function getCutoff
   * @returns {Promise<NGA.Cutoff|null>} la coupure active, ou null si aucune n'a encore été choisie.
   */
  NGA.getCutoff = function () {
    return new Promise((resolve) => {
      chrome.storage.local.get([NGA.CUTOFF_KEY], (res) => resolve(res[NGA.CUTOFF_KEY] || null));
    });
  };

  /**
   * Enregistre la coupure active.
   * @memberof NGA
   * @function setCutoff
   * @param {NGA.Cutoff} cutoff - la coupure à enregistrer.
   * @returns {Promise<void>} résolue une fois l'écriture terminée.
   */
  NGA.setCutoff = function (cutoff) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [NGA.CUTOFF_KEY]: cutoff }, resolve);
    });
  };

  /**
   * Efface la coupure active (usage dev, bouton popup) : force la
   * réouverture de l'écran de choix au prochain chargement du site.
   * @memberof NGA
   * @function clearCutoff
   * @returns {Promise<void>} résolue une fois la suppression terminée.
   */
  NGA.clearCutoff = function () {
    return new Promise((resolve) => {
      chrome.storage.local.remove([NGA.CUTOFF_KEY], resolve);
    });
  };

  /**
   * Clé de stockage (`chrome.storage.local`) de la mémoire des dates apprises.
   * @memberof NGA
   * @constant {string}
   */
  NGA.SPOILER_CACHE_KEY = "nga_spoiler_cache";

  /**
   * Lit la mémoire globale des dates de publication apprises.
   * @memberof NGA
   * @function getSpoilerCache
   * @returns {Promise<Object<string, number>>} table identifiant d'article -> date de publication UTC (ms).
   */
  NGA.getSpoilerCache = function () {
    return new Promise((resolve) => {
      chrome.storage.local.get([NGA.SPOILER_CACHE_KEY], (res) => resolve(res[NGA.SPOILER_CACHE_KEY] || {}));
    });
  };

  /**
   * Fusionne de nouvelles entrées dans la mémoire des dates apprises (sans
   * écraser les entrées existantes non concernées).
   * @memberof NGA
   * @function mergeSpoilerCache
   * @param {Object<string, number>} entries - table identifiant d'article -> date de publication UTC (ms) à ajouter/mettre à jour.
   * @returns {Promise<void>} résolue une fois l'écriture terminée.
   */
  NGA.mergeSpoilerCache = function (entries) {
    return NGA.getSpoilerCache().then((cache) => {
      const merged = Object.assign({}, cache, entries);
      return new Promise((resolve) => {
        chrome.storage.local.set({ [NGA.SPOILER_CACHE_KEY]: merged }, resolve);
      });
    });
  };
})(window.NGAGuard);
