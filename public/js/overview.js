// Renders the Overview tab: market price table with range bars, futures columns,
// and sparklines. Pure DOM manipulation — no ECharts used here.
var Overview = (function () {

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Commodity icon paths and accent colours
  var COMMODITY_META = {
    'WTI':        { icon: 'assets/icons/wti.svg',       color: '#d4a017' },
    'Brent':      { icon: 'assets/icons/brent.svg',     color: '#4a9ebb' },
    'Henry Hub':  { icon: 'assets/icons/henry-hub.svg', color: '#f0883e' },
    'TTF':        { icon: 'assets/icons/ttf.svg',       color: '#2f9cb2' },
    'Gold':       { icon: 'assets/icons/gold.svg',      color: '#e0b84a' },
    'Diesel':     { icon: 'assets/icons/diesel.svg',    color: '#cf4444' }
  };

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n);
    return r < 0 ? '(' + Math.abs(r) + ')' : String(r);
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '—';
    // Show decimals for small values (gas, gold spot)
    if (Math.abs(n) < 10) return n.toFixed(2);
    return String(Math.round(n));
  }

  // Build SVG sparkline from a series array (last `count` points).
  function sparkline(series, count, color) {
    var subset = series.slice(-count);
    if (subset.length < 2) return '<svg width="80" height="24"></svg>';
    var prices = subset.map(function (r) { return r.price; });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = max - min || 1;
    var W = 80, H = 16, PAD = 1;
    var n = prices.length - 1;
    var pts = prices.map(function (p, i) {
      var x = PAD + (i / n) * (W - 2 * PAD);
      var y = H - PAD - ((p - min) / range) * (H - 2 * PAD);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + '<polyline points="' + pts + '" stroke="' + (color || '#4f759b') + '" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
      + '</svg>';
  }

  // 52-week range stats for a given series.
  function rangeStats(series, latestDate) {
    if (!series || series.length === 0) return null;
    var cutoff = new Date(latestDate + 'T00:00:00Z');
    cutoff.setDate(cutoff.getDate() - 365);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    var subset = series.filter(function (r) { return r.dateString >= cutoffStr; });
    if (subset.length === 0) return null;
    var prices = subset.map(function (r) { return r.price; });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var avg = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
    var current = series[series.length - 1].price;
    return { min: min, max: max, avg: avg, current: current };
  }

  // Render a range bar div given { min, max, avg, current }.
  function rangebar(stats, color) {
    if (!stats) {
      return '<div class="range-bar-wrap range-na"><span class="range-na-text">No data</span></div>';
    }
    var range = stats.max - stats.min || 1;
    var dotPct = ((stats.current - stats.min) / range * 100).toFixed(1);
    var avgPct = ((stats.avg - stats.min) / range * 100).toFixed(1);
    var tip = 'Min: ' + fmt(stats.min) + ' | Avg: ' + fmt(stats.avg) + ' | Max: ' + fmt(stats.max) + ' | Current: ' + fmt(stats.current);
    return '<div class="range-bar-wrap" title="' + tip + '">'
      + '<div class="range-track"></div>'
      + '<div class="range-avg-tick" style="left:' + avgPct + '%"></div>'
      + '<div class="range-current-dot" style="left:' + dotPct + '%;background:' + (color || '#4f759b') + '"></div>'
      + '</div>';
  }

  // Colour a futures cell relative to spot: lower = green (cheaper), higher = red.
  function futureCell(value, spot) {
    if (value == null) return '<td class="num">—</td>';
    var cls = '';
    if (spot != null) {
      var diff = value - spot;
      if (diff < -2) cls = ' future-down';
      else if (diff > 2) cls = ' future-up';
    }
    return '<td class="num' + cls + '">' + fmtNum(value) + '</td>';
  }

  // Build an icon <img> tag for a commodity, or empty string if no icon.
  function commIconImg(key, color) {
    var meta = COMMODITY_META[key];
    if (!meta) return '';
    return '<img src="' + meta.icon + '" alt="" class="comm-icon-img" style="color:' + color + '" width="16" height="16">';
  }

  function normalizeCommodityId(v) {
    return String(v || '').trim().toUpperCase().replace(/\s+/g, '_');
  }

  function findCommodityFuturesEntry(commodityId, data) {
    var map = (data.futures && data.futures.commodities) || {};
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (normalizeCommodityId(keys[i]) === normalizeCommodityId(commodityId)) {
        return map[keys[i]];
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Row builders
  // --------------------------------------------------------------------------

  function powerRow(iso, data) {
    var series = data.seriesByIso[iso] || [];
    var name = (data.countriesByIso[iso] || {}).name || iso;
    var color = Charts.COUNTRY_COLORS[iso] || '#4f759b';
    var stats = rangeStats(series, data.latestDate);
    var spot = stats ? stats.current : null;
    var latestCell = spot != null
      ? '<td class="num latest">' + fmt(spot) + '</td>'
      : '<td class="num muted">—</td>';

    var futures = (data.futures.power && data.futures.power[iso]) || {};
    var futureCells = data.futures.months.map(function (m) {
      return futureCell(futures[m] != null ? futures[m] : null, spot);
    }).join('');

    var spark = series.length > 0 ? sparkline(series, 90, color) : '<svg width="80" height="24"></svg>';

    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-country-iso="' + esc(iso) + '">' + esc(name) + '</button></td>'
      + '<td class="muted small">EUR/MWh</td>'
      + latestCell
      + '<td class="range-cell">' + rangebar(stats, color) + '</td>'
      + futureCells
      + '<td class="sparkline-cell">' + spark + '</td>'
      + '</tr>';
  }

  function commodityRow(key, data) {
    var comm = data.futures.commodities[key];
    if (!comm) return '';
    var meta = COMMODITY_META[key] || {};
    var color = meta.color || '#4a9ebb';
    var spot = comm.spot != null ? comm.spot : null;
    var latestCell = spot != null
      ? '<td class="num latest">' + fmtNum(spot) + '</td>'
      : '<td class="num muted">—</td>';

    var rangeCell = '<td class="range-cell">' + rangebar(stats, color) + '</td>';

    var futureCells = data.futures.months.map(function (m) {
      if (!futures) return futureCell(null, spot);
      return futureCell(futures[m] != null ? futures[m] : null, spot);
    }).join('');

    var spark = series.length > 0 ? sparkline(series, 90, color) : '<svg width="80" height="24"></svg>';
    var unit = (futures && futures.unit) || data.unitsByIso[key] || '';

    var iconHtml = commIconImg(key, color);

    return '<tr>'
      + '<td class="row-name"><span class="comm-icon">' + iconHtml + '<span>' + key + '</span></span></td>'
      + '<td class="muted small">' + (comm.unit || '') + '</td>'
      + latestCell
      + rangeCell
      + futureCells
      + '<td class="sparkline-cell">' + spark + '</td>'
      + '</tr>';
  }

  // --------------------------------------------------------------------------
  // Main render
  // --------------------------------------------------------------------------

  function powerRowSpot(iso, data) {
    var series = data.seriesByIso[iso] || [];
    var name = (data.countriesByIso[iso] || {}).name || iso;
    var color = Charts.COUNTRY_COLORS[iso] || '#4f759b';
    var stats = rangeStats(series, data.latestDate);
    var spot = stats ? stats.current : null;
    var latestCell = spot != null
      ? '<td class="num latest">' + fmt(spot) + '</td>'
      : '<td class="num muted">—</td>';
    var spark = series.length > 0 ? sparkline(series, 90, color) : '<svg width="80" height="24"></svg>';

    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-country-iso="' + esc(iso) + '">' + esc(name) + '</button></td>'
      + '<td class="muted small">EUR/MWh</td>'
      + latestCell
      + '<td class="range-cell">' + rangebar(stats, color) + '</td>'
      + '<td class="sparkline-cell">' + spark + '</td>'
      + '</tr>';
  }

  function commodityRowSpot(key, data) {
    var name = (data.countriesByIso[key] || {}).name || key;
    var series = data.seriesByIso[key] || [];
    var color = Charts.COUNTRY_COLORS[key] || '#4f759b';
    var stats = rangeStats(series, data.latestDate);
    var futures = findCommodityFuturesEntry(key, data);
    var spot = futures && futures.spot != null ? futures.spot : (stats ? stats.current : null);
    var latestCell = spot != null
      ? '<td class="num latest">' + fmt(spot) + '</td>'
      : '<td class="num muted">—</td>';
    var rangeCell = '<td class="range-cell">' + rangebar(stats, color) + '</td>';
    var spark = series.length > 0 ? sparkline(series, 90, color) : '<svg width="80" height="24"></svg>';
    var unit = (futures && futures.unit) || data.unitsByIso[key] || '';

    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-commodity-key="' + esc(key) + '">' + esc(name) + '</button></td>'
      + '<td class="muted small">' + esc(unit) + '</td>'
      + latestCell
      + rangeCell
      + '<td class="sparkline-cell">' + spark + '</td>'
      + '</tr>';
  }

  function powerRowFutures(iso, data) {
    var series = data.seriesByIso[iso] || [];
    var name = (data.countriesByIso[iso] || {}).name || iso;
    var stats = rangeStats(series, data.latestDate);
    var spot = stats ? stats.current : null;
    var futures = (data.futures.power && data.futures.power[iso]) || {};
    var futureCells = data.futures.months.map(function (m) {
      return futureCell(futures[m] != null ? futures[m] : null, spot);
    }).join('');

    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-country-iso="' + esc(iso) + '">' + esc(name) + '</button></td>'
      + futureCells
      + '</tr>';
  }

  function commodityRowFutures(key, data) {
    var name = (data.countriesByIso[key] || {}).name || key;
    var series = data.seriesByIso[key] || [];
    var stats = rangeStats(series, data.latestDate);
    var futures = findCommodityFuturesEntry(key, data);
    var spot = futures && futures.spot != null ? futures.spot : (stats ? stats.current : null);
    var futureCells = data.futures.months.map(function (m) {
      if (!futures) return futureCell(null, spot);
      return futureCell(futures[m] != null ? futures[m] : null, spot);
    }).join('');

    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-commodity-key="' + esc(key) + '">' + esc(name) + '</button></td>'
      + futureCells
      + '</tr>';
  }

  function render(data) {
    var el = document.getElementById('market-table-container');
    if (!el) return;

    var months = data.futures.months || [];
    var monthHeaders = months.map(function (m) { return '<th class="futures-hdr">' + m + '</th>'; }).join('');

    var powerRows = data.countryOrder.map(function (iso) { return powerRow(iso, data); }).join('');
    var commodityKeys = ['WTI', 'Brent', 'Henry Hub', 'TTF', 'Gold', 'Diesel'];
    var commodityRows = commodityKeys.map(function (k) { return commodityRow(k, data); }).join('');

    // Spot Market table
    var spotTable = '<table class="market-table">'
      + '<thead><tr>'
      + '<th>Name</th><th class="muted small">Unit</th><th class="num">Latest</th>'
      + '<th class="range-hdr">52-Week Range</th><th>Trend (90d)</th>'
      + '</tr></thead>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="5">Oil &amp; Gas</td></tr>'
      + commodityRowsSpot
      + '</tbody>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="5">Power Prices</td></tr>'
      + powerRowsSpot
      + '</tbody>'
      + '</table>';

    // Futures table
    var futuresTable = '<table class="market-table">'
      + '<thead><tr>'
      + '<th>Name</th>'
      + monthHeaders
      + '</tr></thead>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="' + (5 + months.length) + '">Commodities</td></tr>'
      + commodityRows
      + '</tbody>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="' + (1 + months.length) + '">Power Prices</td></tr>'
      + powerRowsFutures
      + '</tbody>'
      + '</table>';

    el.innerHTML = '<div class="overview-outer">'
      + '<div class="section-block overview-block-spot">'
      + '<div class="section-label">Spot Market</div>'
      + '<div class="table-scroll">'
      + spotTable
      + '</div>'
      + '</div>'
      + '<div class="section-block overview-block-futures">'
      + '<div class="section-label">Futures</div>'
      + '<div class="table-scroll">'
      + futuresTable
      + '</div>'
      + '</div>'
      + '</div>';

    el.onclick = function (event) {
      var btn = event.target.closest('[data-country-iso]');
      if (btn) {
        var iso = btn.getAttribute('data-country-iso');
        if (iso) AppState.setState({ primaryCountry: iso });
        if (window.APP && typeof window.APP.activateTab === 'function') {
          window.APP.activateTab('power');
        }
      } else {
        var commodityBtn = event.target.closest('[data-commodity-key]');
        if (!commodityBtn) return;
        var commodityKey = commodityBtn.getAttribute('data-commodity-key');
        if (commodityKey) AppState.setCommodityState({ primaryCountry: commodityKey });
        if (window.APP && typeof window.APP.activateTab === 'function') {
          window.APP.activateTab('commodities');
        }
      }
    };

    renderForwardCurves(data);
  }

  // --------------------------------------------------------------------------
  // Forward curve charts
  // --------------------------------------------------------------------------

  function renderForwardCurves(data) {
    var el = document.getElementById('forward-curve-container');
    if (!el) return;

    var months = (data.futures && data.futures.months) || [];
    if (months.length === 0) { el.innerHTML = ''; return; }

    var COMMODITY_CURVES = [
      { key: 'WTI',       label: 'WTI',        unit: 'USD/bbl',   color: '#006daa' },
      { key: 'Brent',     label: 'Brent',       unit: 'USD/bbl',   color: '#3e90bf' },
      { key: 'HENRY_HUB', label: 'Henry Hub',   unit: 'USD/MMBtu', color: '#6f92b5' },
      { key: 'TTF',       label: 'TTF Gas',     unit: 'EUR/MWh',   color: '#4f7f5e' }
    ];

    var ALL_POWER = ['ES', 'DE', 'FR', 'IT', 'GB', 'NL', 'NO', 'SE', 'FI', 'DK'];

    // Compute forward curve trend: compare first vs last non-null current value
    function curveTrend(currentArr) {
      var vals = (currentArr || []).filter(function (v) { return v != null && !isNaN(v); });
      if (vals.length < 2) return null;
      var first = vals[0], last = vals[vals.length - 1];
      var pct = (last - first) / (Math.abs(first) || 1) * 100;
      if (pct < -2) return 'down';
      if (pct >  2) return 'up';
      return 'flat';
    }

    function trendBadge(trend) {
      if (!trend) return '';
      var cfg = {
        down: { cls: 'regime-low',    label: '\u25BC FALLING' },
        flat: { cls: 'regime-normal', label: '\u2192 STABLE'  },
        up:   { cls: 'regime-high',   label: '\u25B2 RISING'  }
      };
      var c = cfg[trend];
      if (!c) return '';
      return '<span class="fwd-trend-badge regime-badge ' + c.cls + '">' + c.label + '</span>';
    }

    function curveCard(id, title, unit, trend) {
      return '<article class="fwd-curve-card">'
        + '<header class="fwd-curve-card-head">'
        + '<h4 class="fwd-curve-card-title">' + esc(title) + '</h4>'
        + '<span class="fwd-curve-card-unit">' + esc(unit) + '</span>'
        + '</header>'
        + '<div id="fwd-' + id + '" class="fwd-chart-canvas">'
        + trendBadge(trend)
        + '</div>'
        + '</article>';
    }

    var commodityCards = COMMODITY_CURVES.map(function (c) {
      var curr = months.map(function (m) { return ((data.futures.commodities || {})[c.key] || {})[m]; });
      return curveCard(c.key, c.label, c.unit, curveTrend(curr));
    }).join('');

    var powerCards = ALL_POWER.map(function (iso) {
      var title = (data.countriesByIso[iso] || {}).name || iso;
      var curr = months.map(function (m) { return ((data.futures.power || {})[iso] || {})[m]; });
      return curveCard(iso, title, 'EUR/MWh', curveTrend(curr));
    }).join('');

    el.innerHTML = '<section class="section-block fwd-curves-section">'
      + '<div class="section-label">Forward Curves (Commodities + Power)</div>'
      + '<div class="fwd-curves-grid">'
      + commodityCards
      + powerCards
      + '</div>'
      + '</section>';

    // Render commodity charts
    COMMODITY_CURVES.forEach(function (c) {
      var curr = months.map(function (m) { return ((data.futures.commodities || {})[c.key] || {})[m]; });
      var w1   = months.map(function (m) { return ((data.futures.commodities_1w || {})[c.key] || {})[m]; });
      var m1   = months.map(function (m) { return ((data.futures.commodities_1m || {})[c.key] || {})[m]; });
      Charts.renderForwardCurve('fwd-' + c.key, {
        title: '', unit: '', months: months,
        current: curr, w1ago: w1, m1ago: m1, color: c.color
      });
    });

    // Render power charts
    ALL_POWER.forEach(function (iso) {
      var name  = (data.countriesByIso[iso] || {}).name || iso;
      var color = (Charts.COUNTRY_COLORS && Charts.COUNTRY_COLORS[iso]) || '#4f759b';
      var curr  = months.map(function (m) { return ((data.futures.power || {})[iso] || {})[m]; });
      var w1    = months.map(function (m) { return ((data.futures.power_1w || {})[iso] || {})[m]; });
      var m1    = months.map(function (m) { return ((data.futures.power_1m || {})[iso] || {})[m]; });
      Charts.renderForwardCurve('fwd-' + iso, {
        title: '', unit: '', months: months,
        current: curr, w1ago: w1, m1ago: m1, color: color
      });
    });
  }

  return { render: render };
}());
