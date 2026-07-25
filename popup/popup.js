// Logique de la popup : affiche et modifie le réglage de coupure du week-end actif.
(function (NGA) {
  const app = document.getElementById("app");

  function currentLabel(cutoff) {
    if (!cutoff) return "Non défini";
    if (cutoff.mode === "all") return "Tout afficher";
    return "Masqué à partir de : " + cutoff.label;
  }

  async function render() {
    let weekendData;
    try {
      weekendData = await NGA.loadWeekendData();
    } catch (e) {
      app.textContent = "Impossible de charger les données du week-end.";
      return;
    }

    const isActive = NGA.isWeekendActive(weekendData, Date.now());
    const cutoff = await NGA.getCutoff(weekendData.weekend.id);

    app.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = weekendData.weekend.name;
    app.appendChild(title);

    const status = document.createElement("p");
    status.className = "nga-status";
    status.textContent = isActive ? "Week-end actif" : "Week-end inactif (hors fenêtre de filtrage)";
    app.appendChild(status);

    const current = document.createElement("div");
    current.className = "nga-current";
    const currentStrong = document.createElement("strong");
    currentStrong.textContent = "Réglage actuel";
    current.appendChild(currentStrong);
    const currentText = document.createElement("span");
    currentText.textContent = currentLabel(cutoff);
    current.appendChild(currentText);
    app.appendChild(current);

    weekendData.sessions.forEach((session) => {
      const btn = document.createElement("button");
      btn.className = "nga-choice";
      btn.type = "button";
      btn.textContent = "Je n'ai pas encore vu : " + session.label;
      btn.addEventListener("click", async () => {
        await NGA.setCutoff(weekendData.weekend.id, {
          mode: "session",
          label: session.label,
          cutoffUtcMillis: Date.parse(session.start_utc),
          savedAt: Date.now(),
        });
        render();
      });
      app.appendChild(btn);
    });

    const row = document.createElement("div");
    row.className = "nga-row";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "Tout afficher";
    allBtn.addEventListener("click", async () => {
      await NGA.setCutoff(weekendData.weekend.id, {
        mode: "all",
        label: "Tout afficher",
        cutoffUtcMillis: null,
        savedAt: Date.now(),
      });
      render();
    });
    row.appendChild(allBtn);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Réinitialiser";
    resetBtn.addEventListener("click", async () => {
      await NGA.clearCutoff(weekendData.weekend.id);
      render();
    });
    row.appendChild(resetBtn);

    app.appendChild(row);
  }

  render();
})(window.NGAGuard);
