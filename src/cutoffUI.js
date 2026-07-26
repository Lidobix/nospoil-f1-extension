// Rendu partagé du sélecteur de coupure (réglage actuel + choix du week-end de
// référence + liste de ses séances + "Tout afficher"/"Appliquer le filtre").
// Utilisé à l'identique par l'écran de choix plein page sur le site
// (overlay.js) et par la popup, pour garantir les mêmes éléments et le même
// fonctionnement aux deux endroits.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const STYLE_ID = "nga-guard-cutoffui-style";

  NGA.CUTOFF_UI_CSS = `
    .nga-cutoffui h1 {
      font-size: 15px;
      margin: 0 0 2px;
    }
    .nga-cutoffui .nga-current {
      font-size: 13px;
      background: #1c222b;
      border: 1px solid #3a4250;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 12px 0 14px;
      text-align: left;
    }
    .nga-cutoffui .nga-current strong {
      display: block;
      margin-bottom: 2px;
    }
    .nga-cutoffui .nga-select-label {
      display: block;
      font-size: 12px;
      color: #8b93a1;
      margin-bottom: 4px;
      text-align: left;
    }
    .nga-cutoffui select.nga-select {
      display: block;
      width: 100%;
      margin-bottom: 12px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #3a4250;
      background: #1c222b;
      color: #f2f2f2;
      font-size: 13px;
    }
    .nga-cutoffui button.nga-choice {
      display: block;
      width: 100%;
      margin-bottom: 8px;
      padding: 9px 12px;
      border-radius: 8px;
      border: 1px solid #3a4250;
      background: #1c222b;
      color: #f2f2f2;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .nga-cutoffui button.nga-choice:hover {
      border-color: #e10600;
    }
    .nga-cutoffui .nga-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .nga-cutoffui .nga-row button {
      flex: 1;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #3a4250;
      background: none;
      color: #b7bec9;
      font-size: 12px;
      cursor: pointer;
    }
    .nga-cutoffui .nga-row button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  NGA.ensureCutoffUIStyle = function () {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = NGA.CUTOFF_UI_CSS;
    document.head.appendChild(style);
  };

  function currentLabel(cutoff) {
    if (!cutoff) return "Non défini";
    if (cutoff.mode === "all") return "Tout afficher";
    return "Masqué à partir de : " + cutoff.label;
  }

  // container : élément DOM entièrement repeuplé à chaque appel.
  // params = {
  //   calendar, currentWeekend, cutoff, selectedWeekendId, title,
  //   onSelectWeekend(weekendId),
  //   onPickSession(weekend, session),
  //   onShowAll(),
  //   onClear(),
  // }
  NGA.renderCutoffUI = function (container, params) {
    NGA.ensureCutoffUIStyle();
    container.classList.add("nga-cutoffui");
    container.innerHTML = "";

    const { calendar, currentWeekend, cutoff, selectedWeekendId, title } = params;
    const selectedWeekend = calendar.find((w) => w.id === selectedWeekendId) || currentWeekend;

    if (title) {
      const h1 = document.createElement("h1");
      h1.textContent = title;
      container.appendChild(h1);
    }

    const current = document.createElement("div");
    current.className = "nga-current";
    const currentStrong = document.createElement("strong");
    currentStrong.textContent = "Réglage actuel";
    current.appendChild(currentStrong);
    const currentText = document.createElement("span");
    currentText.textContent = currentLabel(cutoff);
    current.appendChild(currentText);
    container.appendChild(current);

    const selectLabel = document.createElement("label");
    selectLabel.className = "nga-select-label";
    selectLabel.textContent = "Week-end de référence";
    container.appendChild(selectLabel);

    const select = document.createElement("select");
    select.className = "nga-select";
    calendar.slice().reverse().forEach((weekend) => {
      const opt = document.createElement("option");
      opt.value = weekend.id;
      opt.textContent = weekend.name + (weekend.id === currentWeekend.id ? " (en cours)" : "");
      if (weekend.id === selectedWeekend.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => params.onSelectWeekend(select.value));
    container.appendChild(select);

    const sessionsContainer = document.createElement("div");
    sessionsContainer.className = "nga-sessions";
    selectedWeekend.sessions.forEach((session) => {
      const btn = document.createElement("button");
      btn.className = "nga-choice";
      btn.type = "button";
      btn.textContent = "Je n'ai pas encore vu : " + session.label;
      btn.addEventListener("click", () => params.onPickSession(selectedWeekend, session));
      sessionsContainer.appendChild(btn);
    });
    container.appendChild(sessionsContainer);

    const row = document.createElement("div");
    row.className = "nga-row";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "Tout afficher";
    allBtn.addEventListener("click", () => params.onShowAll());
    row.appendChild(allBtn);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Appliquer le filtre";
    clearBtn.disabled = !cutoff;
    clearBtn.addEventListener("click", () => params.onClear());
    row.appendChild(clearBtn);

    container.appendChild(row);
  };
})(window.NGAGuard);
