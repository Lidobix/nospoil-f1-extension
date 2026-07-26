// Logique de la popup : mêmes éléments et même fonctionnement que l'écran de
// choix affiché sur le site (voir src/cutoffUI.js et src/overlay.js).
(function (NGA) {
  const app = document.getElementById("app");
  let calendar = [];
  let selectedWeekendId = null;
  let selectedSessionKey = null;

  async function render() {
    if (!calendar.length) {
      try {
        calendar = await NGA.loadCalendar();
      } catch (e) {
        app.textContent = "Impossible de charger le calendrier.";
        return;
      }
    }

    const currentWeekend = NGA.findCurrentWeekend(calendar, Date.now());
    const cutoff = await NGA.getCutoff();
    if (!selectedWeekendId) {
      selectedWeekendId = (cutoff && cutoff.weekendId) || currentWeekend.id;
      selectedSessionKey = NGA.sessionKeyForCutoff(
        calendar.find((w) => w.id === selectedWeekendId),
        cutoff
      );
    }

    NGA.renderCutoffUI(app, {
      calendar,
      currentWeekend,
      cutoff,
      selectedWeekendId,
      selectedSessionKey,
      title: "NGA Spoiler Guard",
      onSelectWeekend: (id) => {
        selectedWeekendId = id;
        selectedSessionKey = null;
        render();
      },
      onSelectSession: (session) => {
        selectedSessionKey = session.key;
        render();
      },
      onApplyFilter: async (weekend, session) => {
        await NGA.setCutoff({
          mode: "session",
          weekendId: weekend.id,
          label: weekend.name + " – " + session.label,
          cutoffUtcMillis: Date.parse(session.start_utc),
          savedAt: Date.now(),
        });
        render();
      },
      onShowAll: async () => {
        await NGA.setCutoff({
          mode: "all",
          label: "Tout afficher",
          cutoffUtcMillis: null,
          savedAt: Date.now(),
        });
        selectedSessionKey = null;
        render();
      },
    });
  }

  document.getElementById("dev-clear-cutoff").addEventListener("click", async () => {
    await NGA.clearCutoff();
    selectedWeekendId = null;
    selectedSessionKey = null;
    render();
  });

  render();
})(window.NGAGuard);
