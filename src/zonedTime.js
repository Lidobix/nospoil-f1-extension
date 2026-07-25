// Conversions fuseau horaire génériques (pas de règle DST codée en dur : tout passe par Intl,
// donc valable pour n'importe quelle année/zone, y compris les changements heure été/hiver).
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  // Décalage (en minutes) entre UTC et `timeZone` au moment `utcMillis`.
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

  // Convertit une heure "murale" locale (y, m 1-12, d, h, mi) dans `timeZone` vers un instant UTC (ms).
  // Convergence itérative : robuste autour des transitions DST.
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
