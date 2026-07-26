/**
 * Orchestrateur : anti-flash, décision de blocage/masquage, écoute des changements de réglage.
 * @module content
 */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const root = document.documentElement;
  root.style.visibility = "hidden";

  let revealed = false;
  let safetyTimer = setTimeout(reveal, 3000);

  /**
   * Révèle la page (annule le `visibility: hidden` posé au chargement) et
   * retire l'overlay éventuellement affiché. Sans effet si déjà révélée.
   * @memberof module:content
   * @returns {void}
   */
  function reveal() {
    if (revealed) return;
    revealed = true;
    clearTimeout(safetyTimer);
    NGA.hideOverlay();
    root.style.visibility = "";
  }

  /**
   * Arrête le garde-fou anti-blocage (qui révélerait la page après 3s) : à
   * appeler dès qu'un écran d'attente légitime (chooser, article bloqué) s'affiche.
   * @memberof module:content
   * @returns {void}
   */
  function stopSafetyTimer() {
    clearTimeout(safetyTimer);
  }

  /**
   * Réinitialise l'état anti-flash (masque à nouveau la page, retire
   * l'overlay, relance le garde-fou de 3s) : utilisé quand un changement de
   * réglage nécessite de rejouer toute la décision de blocage/masquage.
   * @memberof module:content
   * @returns {void}
   */
  function rearm() {
    revealed = false;
    root.style.visibility = "hidden";
    NGA.hideOverlay();
    safetyTimer = setTimeout(reveal, 3000);
  }

  /**
   * Exécute `cb` immédiatement si le DOM est déjà prêt, sinon au prochain
   * évènement DOMContentLoaded.
   * @memberof module:content
   * @param {function():void} cb - fonction à exécuter une fois le DOM prêt.
   * @returns {void}
   */
  function whenDomReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  /** Motif d'URL identifiant un lien d'article (ex: "...,210213.html"). @memberof module:content @constant {RegExp} */
  const ARTICLE_ID_RE = /,(\d+)\.html(?:[?#].*)?$/;

  /**
   * Extrait l'identifiant numérique d'un lien d'article depuis son href.
   * @memberof module:content
   * @param {string} href - l'URL (absolue ou relative) du lien.
   * @returns {string|null} l'identifiant d'article (ex: "210213"), ou null si `href` ne correspond pas au motif attendu.
   */
  function articleIdFromHref(href) {
    const m = ARTICLE_ID_RE.exec(href || "");
    return m ? m[1] : null;
  }

  /** Pages de listing dédiées utilisées pour apprendre les dates des liens sans date inline (galeries photos/vidéos). @memberof module:content @constant {Array<{match: RegExp, url: string}>} */
  const LISTING_SOURCES = [
    { match: /\/formule-1\/photos\//, url: "https://motorsport.nextgen-auto.com/fr/formule-1/photos/" },
    { match: /\/formule-1\/videos\//, url: "https://motorsport.nextgen-auto.com/fr/formule-1/videos/" },
  ];

  /**
   * Retrouve la page de listing dédiée (voir LISTING_SOURCES) susceptible de
   * documenter la date d'un lien donné.
   * @memberof module:content
   * @param {string} href - l'URL du lien à résoudre.
   * @returns {string|null} l'URL de la page de listing correspondante, ou null si aucune ne correspond.
   */
  function listingSourceForHref(href) {
    const source = LISTING_SOURCES.find((s) => s.match.test(href || ""));
    return source ? source.url : null;
  }

  /**
   * Récupère et analyse une page de listing dédiée (galerie photos/vidéos)
   * pour en apprendre les dates de publication, pour les liens sans date inline.
   * @memberof module:content
   * @param {string} url - l'URL de la page de listing à récupérer.
   * @returns {Promise<Object<string, number>>} table identifiant d'article -> date de publication UTC (ms) ; vide en cas d'échec réseau.
   */
  async function fetchListingDates(url) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const dates = {};
      Array.from(doc.querySelectorAll("a[href]"))
        .filter((a) => ARTICLE_ID_RE.test(a.getAttribute("href") || ""))
        .forEach((a) => {
          const id = articleIdFromHref(a.getAttribute("href"));
          const millis = cardPublishedMillis(a);
          if (id && millis !== null) dates[id] = millis;
        });
      console.log("[NGA] fetchListingDates(", url, ") ->", Object.keys(dates).length, "date(s) apprise(s)");
      return dates;
    } catch (e) {
      console.log("[NGA] fetchListingDates a échoué pour", url, e);
      return {};
    }
  }

  /** Sélecteur du tableau "programme du week-end" (horaires), exclu du masquage. @memberof module:content @constant {string} */
  const SCHEDULE_WIDGET_SELECTOR = ".container.grid.grid-cols-1.divide-y";
  /** Motif des chemins de page hors scope du contrôle de spoil (classements/résultats/calendriers bruts). @memberof module:content @constant {RegExp} */
  const OUT_OF_SCOPE_PATH_RE = /\/formule-1\/(classements|resultats|calendriers)\//;

  /**
   * Recherche tous les liens d'article de la page courante, hors tableau
   * "programme du week-end".
   * @memberof module:content
   * @returns {Array<HTMLElement>} les éléments `<a>` trouvés.
   */
  function findCards() {
    const cards = Array.from(document.querySelectorAll("a[href]")).filter((a) => {
      if (!ARTICLE_ID_RE.test(a.getAttribute("href") || "")) return false;
      if (a.closest(SCHEDULE_WIDGET_SELECTOR)) return false;
      return true;
    });
    console.log("[NGA] findCards ->", cards.length, "lien(s) d'article trouvé(s)");
    return cards;
  }

  /**
   * Déduit la date de publication affichée à côté d'une carte de liste.
   * @memberof module:content
   * @param {HTMLElement} cardEl - l'élément `<a>` de la carte.
   * @returns {number|null} date de publication UTC (ms), ou null si illisible/absente.
   */
  function cardPublishedMillis(cardEl) {
    const paragraphs = cardEl.querySelectorAll("p");
    if (!paragraphs.length) return null;
    const infoP = paragraphs[paragraphs.length - 1];
    const spans = infoP.querySelectorAll("span");
    if (spans.length < 2) return null;
    const parsed = NGA.parseFrenchListingDate(
      spans[0].textContent.trim(),
      spans[1].textContent.trim()
    );
    if (!parsed) return null;
    return NGA.zonedTimeToUtc(parsed.y, parsed.m, parsed.d, parsed.h, parsed.mi, NGA.SITE_TIMEZONE);
  }

  /**
   * Masque (ou démasque) tous les liens d'article de la page courante selon
   * `cutoff`, en résolvant les dates manquantes via la mémoire apprise puis
   * via les pages de listing dédiées, avec masquage par précaution en
   * dernier recours. Les dates nouvellement lues sont ajoutées à la mémoire.
   * @memberof module:content
   * @param {NGA.Cutoff} cutoff - la coupure active (mode "session" attendu).
   * @returns {Promise<void>} résolue une fois toutes les cartes traitées et la mémoire mise à jour.
   */
  async function maskArticleLinks(cutoff) {
    let cache = await NGA.getSpoilerCache();
    const learned = {};
    const cards = findCards();

    const neededSourceUrls = new Set();
    cards.forEach((cardEl) => {
      const href = cardEl.getAttribute("href") || "";
      const id = articleIdFromHref(href);
      if (!id || cache[id] !== undefined || cardPublishedMillis(cardEl) !== null) return;
      const sourceUrl = listingSourceForHref(href);
      if (sourceUrl) neededSourceUrls.add(sourceUrl);
    });

    if (neededSourceUrls.size) {
      const results = await Promise.all(Array.from(neededSourceUrls).map(fetchListingDates));
      const merged = Object.assign({}, ...results);
      if (Object.keys(merged).length) {
        await NGA.mergeSpoilerCache(merged);
        cache = Object.assign({}, cache, merged);
      }
    }

    cards.forEach((cardEl, i) => {
      const id = articleIdFromHref(cardEl.getAttribute("href"));
      let publishedMillis = cardPublishedMillis(cardEl);

      if (publishedMillis !== null && id) {
        learned[id] = publishedMillis;
      } else if (publishedMillis === null && id && cache[id] !== undefined) {
        publishedMillis = cache[id];
      }

      const shouldMask = publishedMillis === null || publishedMillis >= cutoff.cutoffUtcMillis;
      console.log(
        "[NGA] lien", i, "id =", id,
        "publishedMillis =", publishedMillis,
        publishedMillis ? new Date(publishedMillis).toISOString() : "(inconnu)",
        "-> masqué =", shouldMask
      );
      if (shouldMask) {
        NGA.maskCard(cardEl, cutoff.label);
      } else {
        NGA.unmaskCard(cardEl);
      }
    });

    if (Object.keys(learned).length) {
      await NGA.mergeSpoilerCache(learned);
    }
  }

  /**
   * Détermine la date de publication de la page courante si c'est un
   * article (via ses balises `og:type`/`og:article:published_time`).
   * @memberof module:content
   * @returns {number|null} date de publication UTC (ms), ou null si la page n'est pas un article ou que la date est illisible.
   */
  function articlePublishedMillis() {
    const typeMeta = document.querySelector('meta[property="og:type"]');
    if (!typeMeta || typeMeta.getAttribute("content") !== "article") return null;
    const publishedMeta = document.querySelector('meta[property="og:article:published_time"]');
    if (!publishedMeta) return null;
    const millis = Date.parse(publishedMeta.getAttribute("content"));
    return Number.isNaN(millis) ? null : millis;
  }

  /**
   * Point d'entrée. `applyCutoff()` n'est déclenché que depuis deux endroits :
   * l'appel initial, et le listener chrome.storage.onChanged (seule source de
   * vérité pour tout changement de réglage, popup comme écran de choix sur la
   * page — les callbacks de openChooser se contentent d'écrire dans le
   * storage, sans appeler applyCutoff() elles-mêmes).
   * @memberof module:content
   * @returns {Promise<void>}
   */
  async function run() {
    let calendar;
    try {
      calendar = await NGA.loadCalendar();
    } catch (e) {
      reveal();
      return;
    }

    const currentWeekend = NGA.findCurrentWeekend(calendar, Date.now());
    let cutoff = await NGA.getCutoff();
    console.log("[NGA] week-end courant =", currentWeekend.id, "cutoff lu du storage =", cutoff);

    /**
     * Affiche l'écran de choix de coupure plein page ; les callbacks se
     * contentent d'écrire le nouveau réglage dans le storage (voir la note sur `run`).
     * @memberof module:content
     * @returns {void}
     */
    function openChooser() {
      stopSafetyTimer();
      NGA.showChooserOverlay(calendar, currentWeekend, cutoff, {
        onApplyFilter: async (weekend, session) => {
          await NGA.setCutoff({
            mode: "session",
            weekendId: weekend.id,
            label: weekend.name + " – " + session.label,
            cutoffUtcMillis: Date.parse(session.start_utc),
            savedAt: Date.now(),
          });
        },
        onShowAll: async () => {
          await NGA.setCutoff({ mode: "all", label: "Tout afficher", cutoffUtcMillis: null, savedAt: Date.now() });
        },
      });
    }

    /**
     * Applique la coupure courante à la page actuelle : ouvre le chooser si
     * aucune coupure n'est configurée, révèle sans filtrage si mode "all" ou
     * page hors scope, sinon bloque ou masque selon la date de l'article/des
     * cartes trouvées.
     * @memberof module:content
     * @returns {void}
     */
    function applyCutoff() {
      if (!cutoff) {
        openChooser();
        return;
      }

      if (cutoff.mode === "all") {
        NGA.unmaskAllCards();
        reveal();
        return;
      }

      if (OUT_OF_SCOPE_PATH_RE.test(window.location.pathname)) {
        NGA.unmaskAllCards();
        reveal();
        return;
      }

      whenDomReady(async () => {
        const articleMillis = articlePublishedMillis();
        console.log("[NGA] applyCutoff, cutoff =", cutoff, "articleMillis =", articleMillis);

        if (articleMillis !== null) {
          const selfId = articleIdFromHref(window.location.href);
          if (selfId) {
            await NGA.mergeSpoilerCache({ [selfId]: articleMillis });
          }

          if (articleMillis >= cutoff.cutoffUtcMillis) {
            stopSafetyTimer();
            NGA.showArticleBlockedOverlay(cutoff, currentWeekend, openChooser);
            return;
          }

          await maskArticleLinks(cutoff);
          reveal();
          return;
        }

        if (findCards().length) {
          await maskArticleLinks(cutoff);
        }
        reveal();
      });
    }

    applyCutoff();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!(NGA.CUTOFF_KEY in changes)) return;
      cutoff = changes[NGA.CUTOFF_KEY].newValue || null;
      rearm();
      applyCutoff();
    });
  }

  run();
})(window.NGAGuard);
