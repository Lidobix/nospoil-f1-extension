#!/usr/bin/env node
/**
 * Canari de structure : vérifie, sur le site live, que les sélecteurs DOM
 * dont dépend l'extension (src/content.js) trouvent toujours ce qu'ils
 * attendent. Ne fait pas tourner content.js tel quel (couplé à
 * chrome.storage/chrome.runtime) : réplique uniquement les extractions DOM,
 * en réutilisant le vrai code de parsing (frenchDate.js/zonedTime.js/
 * weekend.js) pour ne pas dupliquer cette logique et risquer une dérive.
 *
 * Sortie : code 0 si tout est conforme, code 1 sinon (utilisé par le
 * workflow GitHub Actions pour déclencher une alerte).
 */
const { JSDOM } = require("jsdom");

global.window = global.window || {};
require("../src/zonedTime.js");
require("../src/frenchDate.js");
require("../src/weekend.js");
const NGA = global.window.NGAGuard;

const HOME_URL = "https://motorsport.nextgen-auto.com/fr/";
const ARTICLE_ID_RE = /,(\d+)\.html(?:[?#].*)?$/;
const SCHEDULE_WIDGET_SELECTOR = ".container.grid.grid-cols-1.divide-y";
const MIN_CARDS = 5;
const MIN_DATED_RATIO = 0.5;

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error("[FAIL]", msg);
}
function warn(msg) {
  warnings.push(msg);
  console.warn("[WARN]", msg);
}
function ok(msg) {
  console.log("[OK]", msg);
}

async function fetchDocument(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "nga-spoiler-guard-canary (+https://github.com/Lidobix/nospoil-f1-extension)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  const html = await res.text();
  return new JSDOM(html, { url }).window.document;
}

function findCards(document) {
  return Array.from(document.querySelectorAll("a[href]")).filter((a) => {
    if (!ARTICLE_ID_RE.test(a.getAttribute("href") || "")) return false;
    if (a.closest(SCHEDULE_WIDGET_SELECTOR)) return false;
    return true;
  });
}

function cardPublishedMillis(cardEl) {
  const paragraphs = cardEl.querySelectorAll("p");
  if (!paragraphs.length) return null;
  const infoP = paragraphs[paragraphs.length - 1];
  const spans = infoP.querySelectorAll("span");
  if (spans.length < 2) return null;
  const parsed = NGA.parseFrenchListingDate(spans[0].textContent.trim(), spans[1].textContent.trim());
  if (!parsed) return null;
  return NGA.zonedTimeToUtc(parsed.y, parsed.m, parsed.d, parsed.h, parsed.mi, NGA.SITE_TIMEZONE);
}

async function main() {
  console.log("[NGA canary] GET", HOME_URL);
  const document = await fetchDocument(HOME_URL);

  const cards = findCards(document);
  console.log(`[NGA canary] ${cards.length} lien(s) d'article trouvé(s) sur la page d'accueil`);
  if (cards.length < MIN_CARDS) {
    fail(
      `Seulement ${cards.length} lien(s) d'article trouvé(s) sur la home (attendu >= ${MIN_CARDS}) — le motif d'URL des articles ou la structure des cartes a peut-être changé.`
    );
  } else {
    ok(`${cards.length} lien(s) d'article trouvé(s)`);
  }

  if (!document.querySelector(SCHEDULE_WIDGET_SELECTOR)) {
    warn(
      `Sélecteur du widget "programme du week-end" (${SCHEDULE_WIDGET_SELECTOR}) introuvable sur la home — normal hors week-end de course, à surveiller sinon.`
    );
  }

  let datedCount = 0;
  for (const card of cards) {
    if (cardPublishedMillis(card) !== null) datedCount++;
  }
  const ratio = cards.length ? datedCount / cards.length : 0;
  console.log(`[NGA canary] ${datedCount}/${cards.length} carte(s) avec une date lisible (${Math.round(ratio * 100)}%)`);
  if (cards.length && ratio < MIN_DATED_RATIO) {
    fail(
      `Seulement ${Math.round(ratio * 100)}% des cartes ont une date lisible (attendu >= ${MIN_DATED_RATIO * 100}%) — le format de date affiché (ex: "25 juil. 2026" / "20:05") a peut-être changé.`
    );
  } else if (cards.length) {
    ok(`${Math.round(ratio * 100)}% des cartes ont une date lisible`);
  }

  const articleHref = cards.map((a) => a.getAttribute("href")).find((href) => href && ARTICLE_ID_RE.test(href));
  if (!articleHref) {
    warn("Aucun lien d'article exploitable pour vérifier la structure d'une page article.");
  } else {
    const articleUrl = new URL(articleHref, HOME_URL).toString();
    console.log("[NGA canary] GET", articleUrl);
    const articleDoc = await fetchDocument(articleUrl);
    const typeMeta = articleDoc.querySelector('meta[property="og:type"]');
    const publishedMeta = articleDoc.querySelector('meta[property="og:article:published_time"]');
    if (!typeMeta || typeMeta.getAttribute("content") !== "article") {
      fail(`meta[property="og:type"] absente ou différente de "article" sur ${articleUrl}.`);
    } else if (!publishedMeta || Number.isNaN(Date.parse(publishedMeta.getAttribute("content")))) {
      fail(`meta[property="og:article:published_time"] absente ou illisible sur ${articleUrl}.`);
    } else {
      ok(`Métadonnées article valides sur ${articleUrl}`);
    }
  }

  console.log(`\n[NGA canary] ${failures.length} échec(s), ${warnings.length} avertissement(s).`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error("[NGA canary] Erreur inattendue:", e);
  process.exit(1);
});
