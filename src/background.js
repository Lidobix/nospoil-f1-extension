/**
 * Synchronisation périodique du calendrier F1 depuis l'endpoint GET /calendar
 * exposé par le service proxy, en remplacement de data/calendar.json qui ne
 * sert plus que de repli hors-ligne pour le tout premier lancement.
 *
 * Le fetch réseau n'a lieu qu'ici (service worker), jamais à l'ouverture de
 * la popup ni au chargement d'une page : content.js et popup.js lisent
 * uniquement le cache écrit ci-dessous (voir NGA.loadCalendar, src/weekend.js).
 */

// Doit rester synchronisé avec la clé lue dans src/weekend.js.
const CALENDAR_CACHE_KEY = 'nga_calendar_cache';
// TODO(prod): remplacer par l'URL du proxy déployé (voir manifest.json
// host_permissions, à mettre à jour en même temps) — localhost ne fonctionne
// que sur cette machine, le temps du dev.
const CALENDAR_URL = 'http://localhost:8100/calendar';
const ALARM_NAME = 'nga-calendar-sync';
const SYNC_PERIOD_MINUTES = 60;

async function syncCalendar() {
  let calendar;
  try {
    const res = await fetch(CALENDAR_URL, { cache: 'no-store' });
    if (!res.ok) return;
    console.log('fetch calendar');
    calendar = await res.json();
  } catch (e) {
    return; // hors-ligne ou proxy indisponible : on garde le dernier cache connu
  }

  if (!Array.isArray(calendar) || !calendar.length) return;

  await chrome.storage.local.set({
    [CALENDAR_CACHE_KEY]: { calendar, fetchedAt: Date.now() },
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_PERIOD_MINUTES });
  syncCalendar();
});

chrome.runtime.onStartup.addListener(() => {
  syncCalendar();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) syncCalendar();
});
