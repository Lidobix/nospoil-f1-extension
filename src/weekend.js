// Chargement du calendrier (data/calendar.json) et utilitaires liés aux week-ends.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  // Fuseau dans lequel le site affiche ses dates/heures sur les pages de liste (vérifié empiriquement :
  // les timestamps affichés correspondent à l'heure de Paris/Budapest, mêmes règles été/hiver dans l'UE).
  NGA.SITE_TIMEZONE = "Europe/Paris";

  NGA.loadCalendar = async function () {
    const url = chrome.runtime.getURL("data/calendar.json");
    const res = await fetch(url);
    return res.json();
  };

  // Le week-end dont la première séance a démarré le plus récemment (donc en
  // cours ou déjà terminé) : sert de réglage par défaut pour la fenêtre de
  // choix sur le site et pour la popup.
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
