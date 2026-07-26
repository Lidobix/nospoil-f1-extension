// Orchestrateur : anti-flash, décision de blocage/masquage, écoute des changements de réglage.
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const root = document.documentElement;
  root.style.visibility = "hidden";

  let revealed = false;
  let safetyTimer = setTimeout(reveal, 3000);

  function reveal() {
    if (revealed) return;
    revealed = true;
    clearTimeout(safetyTimer);
    NGA.hideOverlay();
    root.style.visibility = "";
  }

  // À appeler dès qu'un écran de blocage s'affiche pour de bon (en attente d'une
  // action de l'utilisateur) : ce n'est plus un état "chargement", le garde-fou
  // anti-blocage ne doit donc plus le révéler tout seul après 3s.
  function stopSafetyTimer() {
    clearTimeout(safetyTimer);
  }

  function rearm() {
    revealed = false;
    root.style.visibility = "hidden";
    NGA.hideOverlay();
    safetyTimer = setTimeout(reveal, 3000);
  }

  function whenDomReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  // Détection par motif d'URL (",<id>.html") plutôt que par classes CSS : couvre
  // toutes les zones de la page (grille "Actualité", "à la une", liens rapides,
  // "à lire aussi" dans le corps d'un article), pas seulement une grille précise.
  const ARTICLE_ID_RE = /,(\d+)\.html(?:[?#].*)?$/;

  function articleIdFromHref(href) {
    const m = ARTICLE_ID_RE.exec(href || "");
    return m ? m[1] : null;
  }

  // Le widget "Photos" (colonne de droite) liste des galeries par simple
  // vignette + légende, sans date. La page dédiée /formule-1/photos/ liste ces
  // mêmes galeries avec une date (page 1 = dernier week-end en date). On s'en
  // sert comme source pour apprendre les vraies dates de ces galeries.
  const PHOTOS_LISTING_URL = "https://motorsport.nextgen-auto.com/fr/formule-1/photos/";

  function isPhotoGalleryHref(href) {
    return /\/formule-1\/photos\//.test(href || "");
  }

  async function fetchPhotoGalleryDates() {
    try {
      const res = await fetch(PHOTOS_LISTING_URL, { credentials: "omit" });
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
      console.log("[NGA] fetchPhotoGalleryDates ->", Object.keys(dates).length, "date(s) apprise(s)");
      return dates;
    } catch (e) {
      console.log("[NGA] fetchPhotoGalleryDates a échoué", e);
      return {};
    }
  }

  // Tableau "programme du week-end" (Libres 1, Libres 2, ... Course avec leurs
  // horaires) : ce n'est pas du contenu spoilant en soi (juste des horaires),
  // donc on ne le soumet pas au masquage. La page de destination d'un lien
  // "Résultats et résumé" reste de toute façon protégée par son propre contrôle
  // de date une fois ouverte.
  const SCHEDULE_WIDGET_SELECTOR = ".container.grid.grid-cols-1.divide-y";

  function findCards() {
    const cards = Array.from(document.querySelectorAll("a[href]")).filter((a) => {
      if (!ARTICLE_ID_RE.test(a.getAttribute("href") || "")) return false;
      if (a.closest(SCHEDULE_WIDGET_SELECTOR)) return false;
      return true;
    });
    console.log("[NGA] findCards ->", cards.length, "lien(s) d'article trouvé(s)");
    return cards;
  }

  // null = date illisible ou absente à côté du lien (ex: tuiles "à la une" ou
  // liens "à lire aussi" sans date affichée).
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

  // Masque tous les liens d'article de la page courante (grille datée, tuiles
  // "à la une", "à lire aussi", peu importe). Pour chaque lien : on essaie
  // d'abord sa date affichée ; à défaut on interroge la mémoire des dates
  // apprises pour ce week-end ; à défaut de tout ça, on masque par précaution.
  // Les dates trouvées via un span sont à leur tour ajoutées à la mémoire, pour
  // que ce même article soit reconnu correctement s'il réapparaît ailleurs sans
  // date (ex: dans un autre article, en lien "à lire aussi").
  async function maskArticleLinks(cutoff, weekendId) {
    let cache = await NGA.getSpoilerCache(weekendId);
    const learned = {};
    const cards = findCards();

    const needsPhotoLookup = cards.some((cardEl) => {
      const href = cardEl.getAttribute("href") || "";
      const id = articleIdFromHref(href);
      return (
        id &&
        cache[id] === undefined &&
        isPhotoGalleryHref(href) &&
        cardPublishedMillis(cardEl) === null
      );
    });

    if (needsPhotoLookup) {
      const photoDates = await fetchPhotoGalleryDates();
      if (Object.keys(photoDates).length) {
        await NGA.mergeSpoilerCache(weekendId, photoDates);
        cache = Object.assign({}, cache, photoDates);
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
      }
    });

    if (Object.keys(learned).length) {
      await NGA.mergeSpoilerCache(weekendId, learned);
    }
  }

  // null = ce n'est pas une page d'article (pas de meta og:type=article exploitable).
  function articlePublishedMillis() {
    const typeMeta = document.querySelector('meta[property="og:type"]');
    if (!typeMeta || typeMeta.getAttribute("content") !== "article") return null;
    const publishedMeta = document.querySelector('meta[property="og:article:published_time"]');
    if (!publishedMeta) return null;
    const millis = Date.parse(publishedMeta.getAttribute("content"));
    return Number.isNaN(millis) ? null : millis;
  }

  async function run() {
    let weekendData;
    try {
      weekendData = await NGA.loadWeekendData();
    } catch (e) {
      reveal();
      return;
    }

    if (!NGA.isWeekendActive(weekendData, Date.now())) {
      reveal();
      return;
    }

    const weekendId = weekendData.weekend.id;
    let cutoff = await NGA.getCutoff(weekendId);
    console.log("[NGA] weekend =", weekendId, "cutoff lu du storage =", cutoff);

    function openChooser() {
      stopSafetyTimer();
      NGA.showChooserOverlay(weekendData, async (chosen) => {
        await NGA.setCutoff(weekendId, chosen);
        cutoff = chosen;
        applyCutoff();
      });
    }

    function applyCutoff() {
      if (!cutoff) {
        openChooser();
        return;
      }

      if (cutoff.mode === "all") {
        reveal();
        return;
      }

      whenDomReady(async () => {
        const articleMillis = articlePublishedMillis();
        console.log("[NGA] applyCutoff, cutoff =", cutoff, "articleMillis =", articleMillis);

        if (articleMillis !== null) {
          // On connaît la vraie date de CETTE page : on la mémorise dans tous les
          // cas, qu'elle soit bloquée ou non, pour les prochaines fois où cet
          // article réapparaîtra ailleurs sans date (ex: en lien "à lire aussi").
          const selfId = articleIdFromHref(window.location.href);
          if (selfId) {
            await NGA.mergeSpoilerCache(weekendId, { [selfId]: articleMillis });
          }

          if (articleMillis >= cutoff.cutoffUtcMillis) {
            stopSafetyTimer();
            NGA.showArticleBlockedOverlay(cutoff, weekendData, openChooser);
            return;
          }

          // Article sûr : on masque quand même les liens "à lire aussi" de son
          // corps avant de révéler la page.
          await maskArticleLinks(cutoff, weekendId);
          reveal();
          return;
        }

        if (findCards().length) {
          await maskArticleLinks(cutoff, weekendId);
        }
        reveal();
      });
    }

    applyCutoff();

    // Un changement fait depuis la popup doit s'appliquer immédiatement à cet onglet,
    // sans nécessiter de rechargement.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const key = NGA.storageKey(weekendId);
      if (!(key in changes)) return;
      cutoff = changes[key].newValue || null;
      rearm();
      applyCutoff();
    });
  }

  run();
})(window.NGAGuard);
