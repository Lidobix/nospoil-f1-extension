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
   * Charge le calendrier complet des week-ends depuis data/calendar.json.
   * @memberof NGA
   * @function loadCalendar
   * @returns {Promise<Array<Object>>} le calendrier, dans l'ordre chronologique.
   */
  NGA.loadCalendar = async function () {
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
