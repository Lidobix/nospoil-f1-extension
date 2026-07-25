// Écran de blocage plein page et masquage de cartes d'actu.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const ROOT_ID = "nga-guard-overlay-root";
  const STYLE_ID = "nga-guard-overlay-style";
  const HOME_URL = "https://motorsport.nextgen-auto.com/fr/";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        visibility: visible; /* remonte au-dessus du visibility:hidden posé sur <html> par content.js */
        background: #10141a;
        color: #f2f2f2;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 24px;
      }
      #${ROOT_ID} .nga-box {
        max-width: 480px;
        width: 100%;
        text-align: center;
      }
      #${ROOT_ID} h1 {
        font-size: 22px;
        margin: 0 0 8px;
      }
      #${ROOT_ID} p.nga-sub {
        color: #b7bec9;
        margin: 0 0 24px;
        font-size: 14px;
      }
      #${ROOT_ID} .nga-choice {
        display: block;
        width: 100%;
        margin-bottom: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #3a4250;
        background: #1c222b;
        color: #f2f2f2;
        font-size: 15px;
        cursor: pointer;
        text-align: left;
      }
      #${ROOT_ID} .nga-choice:hover {
        border-color: #e10600;
        background: #262d38;
      }
      #${ROOT_ID} .nga-all {
        margin-top: 14px;
        background: none;
        border: none;
        color: #8b93a1;
        font-size: 13px;
        text-decoration: underline;
        cursor: pointer;
      }
      #${ROOT_ID} .nga-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
      }
      #${ROOT_ID} .nga-btn {
        padding: 10px 18px;
        border-radius: 8px;
        border: 1px solid #3a4250;
        background: #1c222b;
        color: #f2f2f2;
        font-size: 14px;
        cursor: pointer;
      }
      #${ROOT_ID} .nga-btn.nga-primary {
        background: #e10600;
        border-color: #e10600;
      }
      .nga-guard-masked {
        pointer-events: none;
        opacity: 0.55;
        filter: grayscale(1);
      }
      .nga-guard-masked .nga-guard-mask-label {
        display: block;
        font-size: 12px;
        color: #8b93a1;
        margin-top: 4px;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }

  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      (document.body || document.documentElement).appendChild(root);
    }
    return root;
  }

  NGA.hideOverlay = function () {
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  };

  NGA.showChooserOverlay = function (weekendData, onChosen) {
    ensureStyle();
    const root = getRoot();
    const box = document.createElement("div");
    box.className = "nga-box";

    const title = document.createElement("h1");
    title.textContent = weekendData.weekend.name;
    box.appendChild(title);

    const sub = document.createElement("p");
    sub.className = "nga-sub";
    sub.textContent = "Jusqu'à quelle séance veux-tu masquer les news ?";
    box.appendChild(sub);

    weekendData.sessions.forEach((session) => {
      const btn = document.createElement("button");
      btn.className = "nga-choice";
      btn.type = "button";
      btn.textContent = "Je n'ai pas encore vu : " + session.label;
      btn.addEventListener("click", () => {
        onChosen({
          mode: "session",
          label: session.label,
          cutoffUtcMillis: Date.parse(session.start_utc),
          savedAt: Date.now(),
        });
      });
      box.appendChild(btn);
    });

    const allBtn = document.createElement("button");
    allBtn.className = "nga-all";
    allBtn.type = "button";
    allBtn.textContent = "Tout afficher (désactiver le filtre pour ce week-end)";
    allBtn.addEventListener("click", () => {
      onChosen({
        mode: "all",
        label: "Tout afficher",
        cutoffUtcMillis: null,
        savedAt: Date.now(),
      });
    });
    box.appendChild(allBtn);

    root.innerHTML = "";
    root.appendChild(box);
  };

  NGA.showArticleBlockedOverlay = function (cutoff, weekendData, onChangeRequested) {
    ensureStyle();
    const root = getRoot();
    const box = document.createElement("div");
    box.className = "nga-box";

    const title = document.createElement("h1");
    title.textContent = "Article masqué";
    box.appendChild(title);

    const sub = document.createElement("p");
    sub.className = "nga-sub";
    sub.textContent =
      "Cet article a été publié après le début de « " + cutoff.label + " ». " +
      "Il est masqué pour éviter de te spoiler.";
    box.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "nga-actions";

    const homeBtn = document.createElement("button");
    homeBtn.className = "nga-btn nga-primary";
    homeBtn.type = "button";
    homeBtn.textContent = "Retour à l'accueil";
    homeBtn.addEventListener("click", () => {
      window.location.href = HOME_URL;
    });
    actions.appendChild(homeBtn);

    const changeBtn = document.createElement("button");
    changeBtn.className = "nga-btn";
    changeBtn.type = "button";
    changeBtn.textContent = "Modifier mon réglage";
    changeBtn.addEventListener("click", () => {
      onChangeRequested();
    });
    actions.appendChild(changeBtn);

    box.appendChild(actions);

    root.innerHTML = "";
    root.appendChild(box);
  };

  NGA.maskCard = function (cardEl, label) {
    ensureStyle();
    if (cardEl.classList.contains("nga-guard-masked")) return;
    cardEl.classList.add("nga-guard-masked");
    cardEl.removeAttribute("href");
    cardEl.addEventListener("click", (e) => e.preventDefault());

    const marker = document.createElement("span");
    marker.className = "nga-guard-mask-label";
    marker.textContent = "Masqué — publié après " + label;
    cardEl.appendChild(marker);
  };
})(window.NGAGuard);
