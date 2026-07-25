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
  // toutes les zones de la page (grille "Actualité", "à la une", liens rapides
  // EL1/EL2/.../Résultats...), pas seulement la grille principale.
  const ARTICLE_HREF_RE = /,\d+\.html(?:[?#].*)?$/;

  function findCards() {
    const cards = Array.from(document.querySelectorAll("a[href]")).filter((a) =>
      ARTICLE_HREF_RE.test(a.getAttribute("href") || "")
    );
    console.log("[NGA] findCards ->", cards.length, "lien(s) d'article trouvé(s)");
    return cards;
  }

  // null = date illisible ou absente (ex: tuiles "à la une" sans date affichée)
  // -> on masque par précaution plutôt que de prendre un risque de spoiler.
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

  function maskListingCards(cutoff) {
    console.log("[NGA] maskListingCards, cutoff =", cutoff);
    findCards().forEach((cardEl, i) => {
      const publishedMillis = cardPublishedMillis(cardEl);
      const shouldMask = publishedMillis === null || publishedMillis >= cutoff.cutoffUtcMillis;
      console.log(
        "[NGA] carte", i,
        "publishedMillis =", publishedMillis,
        publishedMillis ? new Date(publishedMillis).toISOString() : "(non parsé)",
        "-> masquée =", shouldMask
      );
      if (shouldMask) {
        NGA.maskCard(cardEl, cutoff.label);
      }
    });
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

    let cutoff = await NGA.getCutoff(weekendData.weekend.id);
    console.log("[NGA] weekend =", weekendData.weekend.id, "cutoff lu du storage =", cutoff);

    function openChooser() {
      stopSafetyTimer();
      NGA.showChooserOverlay(weekendData, async (chosen) => {
        await NGA.setCutoff(weekendData.weekend.id, chosen);
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

      whenDomReady(() => {
        const articleMillis = articlePublishedMillis();
        console.log("[NGA] applyCutoff, cutoff =", cutoff, "articleMillis =", articleMillis);

        if (articleMillis !== null) {
          if (articleMillis >= cutoff.cutoffUtcMillis) {
            stopSafetyTimer();
            NGA.showArticleBlockedOverlay(cutoff, weekendData, openChooser);
          } else {
            reveal();
          }
          return;
        }

        if (findCards().length) {
          maskListingCards(cutoff);
        }
        reveal();
      });
    }

    applyCutoff();

    // Un changement fait depuis la popup doit s'appliquer immédiatement à cet onglet,
    // sans nécessiter de rechargement.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const key = NGA.storageKey(weekendData.weekend.id);
      if (!(key in changes)) return;
      cutoff = changes[key].newValue || null;
      rearm();
      applyCutoff();
    });
  }

  run();
})(window.NGAGuard);
