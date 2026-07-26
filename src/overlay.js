/**
 * Écran de blocage plein page (choix de coupure, article masqué) et
 * masquage/démasquage réversible des cartes d'actu.
 * @module overlay
 */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const ROOT_ID = "nga-guard-overlay-root";
  const STYLE_ID = "nga-guard-overlay-style";
  const HOME_URL = "https://motorsport.nextgen-auto.com/fr/";

  /**
   * Injecte le CSS de l'overlay plein page et du masquage de cartes dans le
   * `<head>` du document (une seule fois).
   * @memberof module:overlay
   * @returns {void}
   */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        visibility: visible;
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

  /**
   * Retrouve (ou crée) le conteneur racine de l'overlay plein page, ajouté à
   * `document.body`.
   * @memberof module:overlay
   * @returns {HTMLElement} le conteneur racine de l'overlay.
   */
  function getRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      (document.body || document.documentElement).appendChild(root);
    }
    return root;
  }

  /**
   * Retire l'overlay plein page (choix ou article bloqué) s'il est affiché.
   * @memberof NGA
   * @function hideOverlay
   * @returns {void}
   */
  NGA.hideOverlay = function () {
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  };

  /**
   * Affiche l'écran de choix de coupure plein page (mêmes éléments, même
   * fonctionnement que la popup — voir NGA.renderCutoffUI).
   * @memberof NGA
   * @function showChooserOverlay
   * @param {Array<Object>} calendar - le calendrier complet (voir NGA.loadCalendar).
   * @param {Object} currentWeekend - le week-end en cours (voir NGA.findCurrentWeekend).
   * @param {NGA.Cutoff|null} cutoff - la coupure actuellement enregistrée.
   * @param {Object} callbacks
   * @param {function(Object, Object):(void|Promise<void>)} callbacks.onApplyFilter - appelé avec (week-end, séance) au clic sur "Filtrer".
   * @param {function():(void|Promise<void>)} callbacks.onShowAll - appelé au clic sur "Tout afficher".
   * @returns {void}
   */
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

  /**
   * Affiche l'écran plein page "Article masqué", affiché quand la page
   * ouverte est un article publié après la coupure active.
   * @memberof NGA
   * @function showArticleBlockedOverlay
   * @param {NGA.Cutoff} cutoff - la coupure active (fournit le libellé affiché).
   * @param {Object} weekendData - le week-end en cours, transmis à `onChangeRequested` via la réouverture du chooser.
   * @param {function():void} onChangeRequested - appelé au clic sur "Modifier mon réglage".
   * @returns {void}
   */
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

  /**
   * Empêche l'activation au clavier (Entrée) d'un lien actuellement masqué ;
   * `pointer-events: none` (CSS) bloque déjà la souris mais pas le clavier.
   * @memberof module:overlay
   * @param {MouseEvent} e - événement de clic sur la carte.
   * @returns {void}
   */
  function blockClickIfMasked(e) {
    if (e.currentTarget.classList.contains("nga-guard-masked")) e.preventDefault();
  }

  /**
   * Masque une carte d'article (retire son href, ajoute un libellé visuel) ;
   * réversible via NGA.unmaskCard. Sans effet si déjà masquée (le libellé
   * est alors juste rafraîchi).
   * @memberof NGA
   * @function maskCard
   * @param {HTMLElement} cardEl - l'élément `<a>` de la carte à masquer.
   * @param {string} label - libellé de la coupure, affiché dans le message "Masqué — publié après …".
   * @returns {void}
   */
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
    const marker = cardEl.querySelector(".nga-guard-mask-label");
    if (marker) marker.textContent = "Masqué — publié après " + label;
  };

  /**
   * Annule NGA.maskCard : restaure le href original et retire le libellé.
   * Sans effet si la carte n'est pas masquée.
   * @memberof NGA
   * @function unmaskCard
   * @param {HTMLElement} cardEl - l'élément `<a>` de la carte à démasquer.
   * @returns {void}
   */
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

  /**
   * Démasque toutes les cartes actuellement masquées sur la page (voir NGA.unmaskCard).
   * @memberof NGA
   * @function unmaskAllCards
   * @returns {void}
   */
  NGA.unmaskAllCards = function () {
    document.querySelectorAll(".nga-guard-masked").forEach((el) => NGA.unmaskCard(el));
  };
})(window.NGAGuard);
