// Reads window.APP_DATA (set by data.js) and window.FUTURES_DATA (set by futures.js).
// Normalises ENTSO-E price series into a consistent internal model.
// Can be replaced later by an async API loader — just return the same shape.
var DataLoader = (function () {

  var COUNTRY_NAMES = {
    ES: 'Spain',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    GB: 'United Kingdom',
    NL: 'Netherlands',
    NO: 'Norway',
    SE: 'Sweden',
    FI: 'Finland',
    DK: 'Denmark'
  };

  // Desired display order in the UI.
  var COUNTRY_ORDER = ['ES', 'DE', 'FR', 'IT', 'GB', 'NL', 'NO', 'SE', 'FI', 'DK'];

  function loadData() {
    var raw = window.APP_DATA || {};
    var entsoe = (raw.series && raw.series.entsoe_prices) || {};

    var rows = [];
    var seriesByIso = {};
    var countriesByIso = {};
    var allDatesSet = {};

    COUNTRY_ORDER.forEach(function (iso) {
      var records = entsoe[iso];
      countriesByIso[iso] = { iso: iso, name: COUNTRY_NAMES[iso] || iso };

      if (!Array.isArray(records) || records.length === 0) {
        seriesByIso[iso] = [];
        return;
      }

      var series = [];
      records.forEach(function (r) {
        if (!r || !r.date || r.value == null) return;
        var price = parseFloat(r.value);
        if (isNaN(price)) return;
        // Parse date as UTC midnight to avoid timezone shifts
        var d = new Date(r.date + 'T00:00:00Z');
        if (isNaN(d.getTime())) return;
        series.push({ date: d, dateString: r.date, price: price });
        rows.push({ iso: iso, name: COUNTRY_NAMES[iso] || iso, dateString: r.date, date: d, price: price });
        allDatesSet[r.date] = true;
      });

      series.sort(function (a, b) { return a.date - b.date; });
      seriesByIso[iso] = series;
    });

    rows.sort(function (a, b) { return a.date - b.date; });
    var allDates = Object.keys(allDatesSet).sort();
    var latestDate = allDates.length ? allDates[allDates.length - 1] : null;
    var earliestDate = allDates.length ? allDates[0] : null;

    var dataCoverage = {};
    COUNTRY_ORDER.forEach(function (iso) {
      dataCoverage[iso] = (seriesByIso[iso] || []).length;
    });

    return {
      rows: rows,
      countriesByIso: countriesByIso,
      countryOrder: COUNTRY_ORDER,
      seriesByIso: seriesByIso,
      allDates: allDates,
      dataCoverage: dataCoverage,
      latestDate: latestDate,
      earliestDate: earliestDate,
      futures: window.FUTURES_DATA || { months: [], power: {}, commodities: {} },
      meta: raw.meta || {},
      news: raw.news || []
    };
  }

  return { loadData: loadData, COUNTRY_NAMES: COUNTRY_NAMES, COUNTRY_ORDER: COUNTRY_ORDER };
}());
