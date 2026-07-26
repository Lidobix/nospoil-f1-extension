// Logique de la popup : mêmes éléments et même fonctionnement que l'écran de
// choix affiché sur le site (voir src/cutoffUI.js et src/overlay.js).
(function (NGA) {
  const app = document.getElementById("app");
  let calendar = [];
  let selectedWeekendId = null;

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
    if (!selectedWeekendId) selectedWeekendId = currentWeekend.id;
    const cutoff = await NGA.getCutoff();

    NGA.renderCutoffUI(app, {
      calendar,
      currentWeekend,
      cutoff,
      selectedWeekendId,
      title: "NGA Spoiler Guard",
      onSelectWeekend: (id) => {
        selectedWeekendId = id;
        render();
      },
      onPickSession: async (weekend, session) => {
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
        render();
      },
      onClear: async () => {
        await NGA.clearCutoff();
        render();
      },
    });
  }

  render();
})(window.NGAGuard);
