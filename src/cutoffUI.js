/**
 * Rendu partagé du sélecteur de coupure (réglage actuel + choix du week-end
 * de référence + liste de ses séances + "Tout afficher"/"Filtrer"). Utilisé
 * à l'identique par l'écran de choix plein page sur le site (overlay.js) et
 * par la popup.
 * @module cutoffUI
 */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const STYLE_ID = "nga-guard-cutoffui-style";

  /**
   * Feuille de style CSS partagée par l'écran de choix plein page et la popup.
   * @memberof NGA
   * @constant {string}
   */
  NGA.CUTOFF_UI_CSS = `
    .nga-cutoffui h1 {
      font-size: 15px;
      margin: 0 0 2px;
    }
    .nga-cutoffui .nga-current {
      font-size: 13px;
      border: 1px solid #3a4250;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 12px 0 14px;
      text-align: left;
    }
    .nga-cutoffui .nga-current.nga-current-unset {
      background: #4a3414;
      border-color: #c98a1a;
    }
    .nga-cutoffui .nga-current.nga-current-set {
      background: #163420;
      border-color: #2f8a4f;
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
    .nga-cutoffui button.nga-choice.nga-choice-selected {
      border-color: #2f8a4f;
      background: #163420;
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
    .nga-cutoffui .nga-row button.nga-filter-btn:not(:disabled) {
      background: #1f9d4c;
      border-color: #1f9d4c;
      color: #fff;
      font-weight: 600;
    }
  `;

  /**
   * Injecte NGA.CUTOFF_UI_CSS dans le `<head>` du document (une seule fois).
   * @memberof NGA
   * @function ensureCutoffUIStyle
   * @returns {void}
   */
  NGA.ensureCutoffUIStyle = function () {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = NGA.CUTOFF_UI_CSS;
    document.head.appendChild(style);
  };

  /**
   * Texte affiché dans le bandeau "Réglage actuel" selon l'état du cutoff.
   * @memberof module:cutoffUI
   * @param {NGA.Cutoff|null} cutoff - la coupure active, ou null si aucune n'est configurée.
   * @returns {string} le texte à afficher ("Aucun filtre", "Tout afficher", ou le libellé de la coupure).
   */
  function currentLabel(cutoff) {
    if (!cutoff) return "Aucun filtre";
    if (cutoff.mode === "all") return "Tout afficher";
    return "Masqué à partir de : " + cutoff.label;
  }

  /**
   * Retrouve, pour un week-end donné, la clé de séance correspondant à un
   * cutoff déjà enregistré (pré-sélection visuelle en rouvrant l'écran de
   * choix sur ce même week-end).
   * @memberof NGA
   * @function sessionKeyForCutoff
   * @param {Object|undefined} weekend - le week-end dans lequel chercher la séance (un élément du calendrier).
   * @param {NGA.Cutoff|null} cutoff - la coupure active.
   * @returns {string|null} la clé de la séance correspondante, ou null si `cutoff` ne référence pas une séance de ce week-end.
   */
  NGA.sessionKeyForCutoff = function (weekend, cutoff) {
    if (!weekend || !cutoff || cutoff.mode !== "session" || cutoff.weekendId !== weekend.id) {
      return null;
    }
    const session = weekend.sessions.find(
      (s) => Date.parse(s.start_utc) === cutoff.cutoffUtcMillis
    );
    return session ? session.key : null;
  };

  /**
   * Repeuple entièrement `container` avec le sélecteur de coupure (réglage
   * actuel, choix du week-end de référence, ses séances, "Tout
   * afficher"/"Filtrer"). Flux en 2 étapes : choisir un week-end affiche ses
   * séances ; cliquer sur une séance ne fait que la sélectionner (active le
   * bouton "Filtrer") ; seul le clic sur "Filtrer" applique réellement le
   * réglage.
   * @memberof NGA
   * @function renderCutoffUI
   * @param {HTMLElement} container - élément DOM entièrement repeuplé à chaque appel.
   * @param {Object} params
   * @param {Array<Object>} params.calendar - le calendrier complet (voir NGA.loadCalendar).
   * @param {Object} params.currentWeekend - le week-end en cours (voir NGA.findCurrentWeekend).
   * @param {NGA.Cutoff|null} params.cutoff - la coupure actuellement enregistrée.
   * @param {string} params.selectedWeekendId - identifiant du week-end actuellement affiché dans le sélecteur.
   * @param {string|null} params.selectedSessionKey - clé de la séance actuellement sélectionnée (en attente d'application), ou null.
   * @param {string} [params.title] - titre optionnel affiché en haut du bloc.
   * @param {function(string):void} params.onSelectWeekend - appelé avec l'id du week-end choisi dans le sélecteur.
   * @param {function(Object):void} params.onSelectSession - appelé avec la séance cliquée ; sélection en attente, n'applique rien.
   * @param {function(Object, Object):void} params.onApplyFilter - appelé avec (week-end, séance) au clic sur "Filtrer" : applique la sélection en attente.
   * @param {function():void} params.onShowAll - appelé au clic sur "Tout afficher".
   * @returns {void}
   */
  NGA.renderCutoffUI = function (container, params) {
    NGA.ensureCutoffUIStyle();
    container.classList.add("nga-cutoffui");
    container.innerHTML = "";

    const { calendar, currentWeekend, cutoff, selectedWeekendId, selectedSessionKey, title } = params;
    const selectedWeekend = calendar.find((w) => w.id === selectedWeekendId) || currentWeekend;
    const selectedSession = selectedSessionKey
      ? selectedWeekend.sessions.find((s) => s.key === selectedSessionKey) || null
      : null;

    if (title) {
      const h1 = document.createElement("h1");
      h1.textContent = title;
      container.appendChild(h1);
    }

    const current = document.createElement("div");
    current.className = "nga-current " + (cutoff ? "nga-current-set" : "nga-current-unset");
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
      if (selectedSession && session.key === selectedSession.key) {
        btn.classList.add("nga-choice-selected");
      }
      btn.type = "button";
      btn.textContent = "Je n'ai pas encore vu : " + session.label;
      btn.addEventListener("click", () => params.onSelectSession(session));
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

    const filterBtn = document.createElement("button");
    filterBtn.type = "button";
    filterBtn.className = "nga-filter-btn";
    filterBtn.textContent = "Filtrer";
    filterBtn.disabled = !selectedSession;
    filterBtn.addEventListener("click", () => {
      if (selectedSession) params.onApplyFilter(selectedWeekend, selectedSession);
    });
    row.appendChild(filterBtn);

    container.appendChild(row);
  };
})(window.NGAGuard);
