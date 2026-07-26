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
        position: relative !important;
        pointer-events: none;
      }
      .nga-guard-masked > *:not(.nga-guard-mask-label) {
        visibility: hidden !important;
      }
      .nga-guard-masked .nga-guard-mask-label {
        visibility: visible !important;
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px;
        background: repeating-linear-gradient(
          45deg,
          #1c222b,
          #1c222b 10px,
          #20262f 10px,
          #20262f 20px
        );
        border: 1px dashed #3a4250;
        border-radius: 6px;
        color: #8b93a1;
        font-size: 12px;
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

  // Même écran (mêmes éléments, même fonctionnement) que la popup de
  // l'extension : réglage actuel, choix du week-end de référence, ses
  // séances, "Tout afficher"/"Filtrer" — voir src/cutoffUI.js.
  // Flux en 2 étapes : choisir une séance ne fait que la sélectionner (le site
  // ne se charge pas) ; seul le clic sur "Filtrer" applique le réglage.
  NGA.showChooserOverlay = function (calendar, currentWeekend, cutoff, callbacks) {
    ensureStyle();
    const root = getRoot();
    const box = document.createElement("div");
    box.className = "nga-box";
    root.innerHTML = "";
    root.appendChild(box);

    let selectedWeekendId = (cutoff && cutoff.weekendId) || currentWeekend.id;
    let selectedSessionKey = NGA.sessionKeyForCutoff(
      calendar.find((w) => w.id === selectedWeekendId),
      cutoff
    );

    function renderBox() {
      NGA.renderCutoffUI(box, {
        calendar,
        currentWeekend,
        cutoff,
        selectedWeekendId,
        selectedSessionKey,
        title: "NGA Spoiler Guard",
        onSelectWeekend: (id) => {
          selectedWeekendId = id;
          selectedSessionKey = null;
          renderBox();
        },
        onSelectSession: (session) => {
          selectedSessionKey = session.key;
          renderBox();
        },
        onApplyFilter: (weekend, session) => callbacks.onApplyFilter(weekend, session),
        onShowAll: () => callbacks.onShowAll(),
      });
    }

    renderBox();
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

  // Empêche l'activation d'un lien masqué au clavier (Entrée sur le lien
  // focus) : `pointer-events: none` (CSS) bloque déjà la souris mais pas ça.
  // Référence nommée (et non une fonction anonyme) pour pouvoir la retirer
  // proprement dans unmaskCard.
  function blockClickIfMasked(e) {
    if (e.currentTarget.classList.contains("nga-guard-masked")) e.preventDefault();
  }

  // Un réglage plus permissif (ex: passage à "Tout afficher", ou choix d'une
  // séance plus tardive) doit pouvoir démasquer une carte déjà masquée par un
  // réglage précédent, sans recharger la page : voir NGA.unmaskCard /
  // NGA.unmaskAllCards.
  NGA.maskCard = function (cardEl, label) {
    ensureStyle();
    if (!cardEl.classList.contains("nga-guard-masked")) {
      cardEl.classList.add("nga-guard-masked");
      if (cardEl.hasAttribute("href")) {
        cardEl.dataset.ngaOriginalHref = cardEl.getAttribute("href");
        cardEl.removeAttribute("href");
      }
      cardEl.addEventListener("click", blockClickIfMasked);
      const marker = document.createElement("span");
      marker.className = "nga-guard-mask-label";
      marker.textContent = "Masqué — publié après " + label;
      cardEl.appendChild(marker);
      return;
    }
    // Déjà masquée (ex: par un précédent passage) : juste rafraîchir le libellé.
    const marker = cardEl.querySelector(".nga-guard-mask-label");
    if (marker) marker.textContent = "Masqué — publié après " + label;
  };

  NGA.unmaskCard = function (cardEl) {
    if (!cardEl.classList.contains("nga-guard-masked")) return;
    cardEl.classList.remove("nga-guard-masked");
    if (cardEl.dataset.ngaOriginalHref) {
      cardEl.setAttribute("href", cardEl.dataset.ngaOriginalHref);
      delete cardEl.dataset.ngaOriginalHref;
    }
    cardEl.removeEventListener("click", blockClickIfMasked);
    const marker = cardEl.querySelector(".nga-guard-mask-label");
    if (marker) marker.remove();
  };

  NGA.unmaskAllCards = function () {
    document.querySelectorAll(".nga-guard-masked").forEach((el) => NGA.unmaskCard(el));
  };
})(window.NGAGuard);
