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

  function findCards() {
    const cards = Array.from(document.querySelectorAll("a[href]")).filter((a) =>
      ARTICLE_ID_RE.test(a.getAttribute("href") || "")
    );
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
    const cache = await NGA.getSpoilerCache(weekendId);
    const learned = {};

    findCards().forEach((cardEl, i) => {
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
