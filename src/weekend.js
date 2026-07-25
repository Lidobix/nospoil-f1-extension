// Chargement des données de séances (data/sessions.json) et utilitaires liés au week-end.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  // Fuseau dans lequel le site affiche ses dates/heures sur les pages de liste (vérifié empiriquement :
  // les timestamps affichés correspondent à l'heure de Paris/Budapest, mêmes règles été/hiver dans l'UE).
  NGA.SITE_TIMEZONE = "Europe/Paris";

  NGA.loadWeekendData = async function () {
    const url = chrome.runtime.getURL("data/sessions.json");
    const res = await fetch(url);
    return res.json();
  };

  NGA.isWeekendActive = function (weekendData, nowMillis) {
    const from = new Date(weekendData.active_from_utc).getTime();
    const until = new Date(weekendData.active_until_utc).getTime();
    return nowMillis >= from && nowMillis <= until;
  };
})(window.NGAGuard);
