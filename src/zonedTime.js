/**
 * Conversions fuseau horaire génériques, basées sur Intl (pas de règle DST
 * codée en dur) : valable pour n'importe quelle année/zone, y compris les
 * changements heure été/hiver.
 */
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  /**
   * Calcule le décalage entre UTC et `timeZone` au moment `utcMillis`.
   * @memberof NGA
   * @function getTzOffsetMinutes
   * @param {number} utcMillis - instant UTC (ms depuis epoch) auquel évaluer le décalage.
   * @param {string} timeZone - identifiant de fuseau IANA (ex: "Europe/Paris").
   * @returns {number} décalage en minutes (UTC -> heure locale de `timeZone`).
   */
  NGA.getTzOffsetMinutes = function (utcMillis, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(utcMillis));
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );
    return (asUTC - utcMillis) / 60000;
  };

  /**
   * Convertit une heure "murale" locale dans `timeZone` vers un instant UTC,
   * par convergence itérative (robuste autour des transitions DST).
   * @memberof NGA
   * @function zonedTimeToUtc
   * @param {number} y - année (ex: 2026).
   * @param {number} m - mois, 1-12.
   * @param {number} d - jour du mois.
   * @param {number} h - heure locale (0-23).
   * @param {number} mi - minute locale (0-59).
   * @param {string} timeZone - identifiant de fuseau IANA (ex: "Europe/Paris").
   * @returns {number} instant UTC correspondant (ms depuis epoch).
   */
  NGA.zonedTimeToUtc = function (y, m, d, h, mi, timeZone) {
    let guess = Date.UTC(y, m - 1, d, h, mi, 0);
    for (let i = 0; i < 3; i++) {
      const offsetMinutes = NGA.getTzOffsetMinutes(guess, timeZone);
      const corrected = Date.UTC(y, m - 1, d, h, mi, 0) - offsetMinutes * 60000;
      if (corrected === guess) break;
      guess = corrected;
    }
    return guess;
  };
})(window.NGAGuard);
