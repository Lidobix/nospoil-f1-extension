// Parsing des dates telles qu'affichées par motorsport.nextgen-auto.com (ex: "25 juil. 2026" + "20:05").
window.NGAGuard = window.NGAGuard || {};

(function (NGA) {
  const FRENCH_MONTHS = {
    janv: 1, jan: 1,
    févr: 2, fevr: 2, fév: 2, fev: 2,
    mars: 3,
    avr: 4,
    mai: 5,
    juin: 6,
    juil: 7,
    août: 8, aout: 8,
    sept: 9,
    oct: 10,
    nov: 11,
    déc: 12, dec: 12,
  };

  function normalize(token) {
    return token
      .toLowerCase()
      .replace(/\./g, "")
      .trim();
  }

  // dateText: "25 juil. 2026" — timeText: "20:05"
  // Renvoie { y, m, d, h, mi } (heure locale au site, Europe/Paris) ou null si non reconnu.
  NGA.parseFrenchListingDate = function (dateText, timeText) {
    if (!dateText || !timeText) return null;
    const dateMatch = /^(\d{1,2})\s+([^\s]+)\s+(\d{4})$/.exec(dateText.trim());
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
    if (!dateMatch || !timeMatch) return null;

    const day = Number(dateMatch[1]);
    const monthKey = normalize(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const month = FRENCH_MONTHS[monthKey];
    if (!month) return null;

    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);

    return { y: year, m: month, d: day, h: hour, mi: minute };
  };
})(window.NGAGuard);
