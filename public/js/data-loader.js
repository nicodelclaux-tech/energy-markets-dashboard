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
  var COMMODITY_KEY_META = {
    wti: { id: 'WTI', name: 'WTI', unit: 'USD/bbl' },
    brent: { id: 'Brent', name: 'Brent', unit: 'USD/bbl' },
    henry_hub: { id: 'HENRY_HUB', name: 'Henry Hub', unit: 'USD/MMBtu' },
    gold: { id: 'GOLD', name: 'Gold', unit: 'USD/oz' },
    ttf: { id: 'TTF', name: 'TTF', unit: 'EUR/MWh' }
  };
  var EXCLUDED_SERIES_KEYS = {
    entsoe_prices: true,
    eurusd: true,
    gbpusd: true,
    gbpeur: true,
    ng_storage: true
  };

  function _normalizeRecords(records, defaultUnit) {
    if (!Array.isArray(records)) return [];
    var out = [];
    records.forEach(function (r) {
      if (!r || !r.date || r.value == null) return;
      var price = parseFloat(r.value);
      if (isNaN(price)) return;
      var d = new Date(r.date + 'T00:00:00Z');
      if (isNaN(d.getTime())) return;
      out.push({
        date: d,
        dateString: r.date,
        price: price,
        unit: r.unit || defaultUnit || ''
      });
    });
    out.sort(function (a, b) { return a.date - b.date; });
    return out;
  }

  function loadData() {
    var raw = window.APP_DATA || {};
    var rawSeries = raw.series || {};
    var entsoe = (raw.series && raw.series.entsoe_prices) || {};

    var rows = [];
    var seriesByIso = {};
    var countriesByIso = {};
    var unitsByIso = {};
    var allDatesSet = {};
    var commodityOrder = [];

    COUNTRY_ORDER.forEach(function (iso) {
      var records = entsoe[iso];
      countriesByIso[iso] = { iso: iso, name: COUNTRY_NAMES[iso] || iso };
      unitsByIso[iso] = 'EUR/MWh';

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

    function upsertCommodity(id, name, series, unit) {
      if (!id) return;
      seriesByIso[id] = series || [];
      countriesByIso[id] = { iso: id, name: name || id };
      unitsByIso[id] = unit || '';
      if (commodityOrder.indexOf(id) === -1) commodityOrder.push(id);
      (series || []).forEach(function (r) { allDatesSet[r.dateString] = true; });
    }

    // Commodities from APP_DATA.series
    Object.keys(rawSeries).forEach(function (key) {
      if (EXCLUDED_SERIES_KEYS[key]) return;
      var records = rawSeries[key];
      if (!Array.isArray(records)) return;
      var meta = COMMODITY_KEY_META[key] || { id: key.toUpperCase(), name: key.replace(/_/g, ' '), unit: '' };
      var series = _normalizeRecords(records, meta.unit);
      upsertCommodity(meta.id, meta.name, series, meta.unit);
    });

    // Ensure futures commodities are represented (TTF, Gold, etc.) even without historical series
    var futuresCommodities = ((window.FUTURES_DATA || {}).commodities || {});
    Object.keys(futuresCommodities).forEach(function (name) {
      var key = String(name || '').toLowerCase().replace(/\s+/g, '_');
      var meta = COMMODITY_KEY_META[key] || { id: name.toUpperCase().replace(/\s+/g, '_'), name: name, unit: futuresCommodities[name].unit || '' };
      if (commodityOrder.indexOf(meta.id) !== -1 && (seriesByIso[meta.id] || []).length > 0) return;
      var spot = futuresCommodities[name].spot;
      var fallbackSeries = [];
      if (spot != null && !isNaN(parseFloat(spot))) {
        var refDate = (allDatesSet && Object.keys(allDatesSet).length > 0)
          ? Object.keys(allDatesSet).sort()[Object.keys(allDatesSet).length - 1]
          : new Date().toISOString().slice(0, 10);
        var d = new Date(refDate + 'T00:00:00Z');
        if (!isNaN(d.getTime())) {
          fallbackSeries = [{ date: d, dateString: refDate, price: parseFloat(spot), unit: meta.unit || '' }];
        }
      }
      upsertCommodity(meta.id, meta.name, fallbackSeries, meta.unit || futuresCommodities[name].unit || '');
    });

    var preferredCommodityOrder = ['WTI', 'Brent', 'HENRY_HUB', 'GOLD', 'TTF'];
    commodityOrder.sort(function (a, b) {
      var ia = preferredCommodityOrder.indexOf(a);
      var ib = preferredCommodityOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
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
      primaryOrder: COUNTRY_ORDER,
      commodityOrder: commodityOrder,
      seriesByIso: seriesByIso,
      unitsByIso: unitsByIso,
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
