/** Chargement du calendrier (data/calendar.json) et utilitaires liés aux week-ends. */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  /**
   * Fuseau dans lequel le site affiche ses dates/heures sur les pages de liste.
   * @memberof NGA
   * @constant {string}
   */
  NGA.SITE_TIMEZONE = "Europe/Paris";

  /**
   * Clé de cache (`chrome.storage.local`) écrite par le service worker
   * (src/background.js) lors de la synchronisation périodique du calendrier
   * publié. Doit rester synchronisée avec CALENDAR_CACHE_KEY côté background.
   * @memberof NGA
   * @constant {string}
   */
  NGA.CALENDAR_CACHE_KEY = "nga_calendar_cache";

  /**
   * Charge le calendrier complet des week-ends : le cache synchronisé par le
   * service worker en priorité, ou data/calendar.json embarqué en repli
   * (premier lancement avant toute synchro, ou synchro jamais aboutie).
   * @memberof NGA
   * @function loadCalendar
   * @returns {Promise<Array<Object>>} le calendrier, dans l'ordre chronologique.
   */
  NGA.loadCalendar = async function () {
    const cached = await new Promise((resolve) => {
      chrome.storage.local.get([NGA.CALENDAR_CACHE_KEY], (res) => resolve(res[NGA.CALENDAR_CACHE_KEY]));
    });
    if (cached && Array.isArray(cached.calendar) && cached.calendar.length) {
      return cached.calendar;
    }

    const url = chrome.runtime.getURL("data/calendar.json");
    const res = await fetch(url);
    return res.json();
  };

  /**
   * Détermine le week-end en cours : celui dont la première séance a démarré
   * le plus récemment (en cours ou déjà terminé). Sert de réglage par défaut
   * pour l'écran de choix et la popup.
   * @memberof NGA
   * @function findCurrentWeekend
   * @param {Array<Object>} calendar - le calendrier complet (voir NGA.loadCalendar).
   * @param {number} nowMillis - instant UTC courant (ms depuis epoch).
   * @returns {Object} le week-end en cours (ou le premier du calendrier si aucun n'a encore démarré).
   */
  NGA.findCurrentWeekend = function (calendar, nowMillis) {
    let current = null;
    calendar.forEach((weekend) => {
      const firstStart = Date.parse(weekend.sessions[0].start_utc);
      if (firstStart <= nowMillis) {
        if (!current || firstStart > Date.parse(current.sessions[0].start_utc)) {
          current = weekend;
        }
      }
    });
    return current || calendar[0];
  };
})(window.NGAGuard);
