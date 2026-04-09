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

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
  // Build SVG sparkline — color auto: green if trending up, red if down.
  function sparkline(series, count) {
    var subset = series.slice(-count);
    if (subset.length < 2) return '<svg width="80" height="24"></svg>';
    var prices = subset.map(function (r) { return r.price; });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = max - min || 1;
    var trendColor = prices[prices.length - 1] >= prices[0] ? '#34d399' : '#fb7185';
    var W = 80, H = 16, PAD = 1;
    var n = prices.length - 1;
    var pts = prices.map(function (p, i) {
      var x = PAD + (i / n) * (W - 2 * PAD);
      var y = H - PAD - ((p - min) / range) * (H - 2 * PAD);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + '<polyline points="' + pts + '" stroke="' + trendColor + '" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
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

  // % change vs N-day rolling average
  function chgVsAvg(series, days) {
    if (!series || series.length < 2) return null;
    var current = series[series.length - 1].price;
    var subset = series.slice(-days);
    if (subset.length < 2) return null;
    var prices = subset.map(function (r) { return r.price; });
    var avg = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
    if (!avg) return null;
    return (current - avg) / Math.abs(avg) * 100;
  }

  // Power spread vs EU average (current minus simple mean of all power countries)
  function spreadVsEuAvg(current, data) {
    if (current == null) return null;
    var vals = data.countryOrder.map(function (iso) {
      var s = data.seriesByIso[iso] || [];
      return s.length > 0 ? s[s.length - 1].price : null;
    }).filter(function (v) { return v != null; });
    if (!vals.length) return null;
    var eu = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return current - eu;
  }

  // Colored % change cell
  function fmtPctCell(n) {
    if (n == null || isNaN(n)) return '<td class="num muted small">—</td>';
    var cls = n > 2 ? 'col-rose' : n < -2 ? 'col-emerald' : 'col-dim';
    var sign = n > 0 ? '+' : '';
    return '<td class="num small ' + cls + '">' + sign + n.toFixed(1) + '%</td>';
  }

  // Colored absolute spread cell (EUR/MWh or equivalent)
  function fmtSpreadCell(n) {
    if (n == null || isNaN(n)) return '<td class="num muted small">—</td>';
    var cls = n > 5 ? 'col-rose' : n < -5 ? 'col-emerald' : 'col-dim';
    var sign = n > 0 ? '+' : '';
    var val = Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n).toString();
    return '<td class="num small ' + cls + '">' + sign + val + '</td>';
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
    var stats = rangeStats(series, data.latestDate);
    var spot = stats ? stats.current : null;
    var latestCell = spot != null
      ? '<td class="num latest">' + fmt(spot) + '</td>'
      : '<td class="num muted">—</td>';
    var spark = series.length > 0 ? sparkline(series, 90) : '<svg width="80" height="24"></svg>';
    var chg30 = chgVsAvg(series, 30);
    var chg90 = chgVsAvg(series, 90);
    var spread = spreadVsEuAvg(spot, data);
    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-country-iso="' + esc(iso) + '">' + esc(name) + '</button></td>'
      + '<td class="muted small">EUR/MWh</td>'
      + latestCell
      + fmtPctCell(chg30)
      + fmtPctCell(chg90)
      + fmtSpreadCell(spread)
      + '<td class="sparkline-cell">' + spark + '</td>'
      + '</tr>';
  }

  function commodityRowSpot(key, data) {
    var meta = COMMODITY_META[key] || {};
    var series = data.seriesByIso[key] || [];
    var stats = rangeStats(series, data.latestDate);
    var futures = findCommodityFuturesEntry(key, data);
    var spot = futures && futures.spot != null ? futures.spot : (stats ? stats.current : null);
    var latestCell = spot != null
      ? '<td class="num latest">' + fmtNum(spot) + '</td>'
      : '<td class="num muted">—</td>';
    var spark = series.length > 0 ? sparkline(series, 90) : '<svg width="80" height="24"></svg>';
    var unit = (futures && futures.unit) || data.unitsByIso[key] || '';
    var chg30 = chgVsAvg(series, 30);
    var chg90 = chgVsAvg(series, 90);
    return '<tr>'
      + '<td class="row-name"><button type="button" class="row-link" data-commodity-key="' + esc(key) + '">'
      + esc(key)
      + '</button></td>'
      + '<td class="muted small">' + esc(unit) + '</td>'
      + latestCell
      + fmtPctCell(chg30)
      + fmtPctCell(chg90)
      + '<td class="num muted small">—</td>'
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

    var commodityKeys = ['WTI', 'Brent', 'Henry Hub', 'TTF', 'Gold', 'Diesel'];

    var commodityRowsSpot = commodityKeys.map(function (k) { return commodityRowSpot(k, data); }).join('');
    var powerRowsSpot = data.countryOrder.map(function (iso) { return powerRowSpot(iso, data); }).join('');
    var commodityRowsFutures = commodityKeys.map(function (k) { return commodityRowFutures(k, data); }).join('');
    var powerRowsFutures = data.countryOrder.map(function (iso) { return powerRowFutures(iso, data); }).join('');

    // Spot Market table
    var spotTable = '<table class="market-table">'
      + '<thead><tr>'
      + '<th>Name</th><th class="muted small">Unit</th><th class="num">Latest</th>'
      + '<th class="num">Chg. v 30d Avg</th><th class="num">Chg. v 90d Avg</th><th class="num">Spread vs. EU avg</th><th>Trend (90d)</th>'
      + '</tr></thead>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="7">Oil &amp; Gas</td></tr>'
      + commodityRowsSpot
      + '</tbody>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="7">Power Prices</td></tr>'
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
      + '<tr class="section-header-row"><td colspan="' + (1 + months.length) + '">Commodities</td></tr>'
      + commodityRowsFutures
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
    renderResources();
  }

  // --------------------------------------------------------------------------
  // Resources section
  // --------------------------------------------------------------------------

  function renderResources() {
    var el = document.getElementById('resources-container');
    if (!el) return;
    if (typeof NewsSources === 'undefined') return;

    var sources = NewsSources.getAll();
    if (!sources || sources.length === 0) return;

    var cards = sources.map(function (src) {
      var catColor = NewsSources.getCategoryColor(src.category) || 'var(--muted)';
      var badge = '<span class="resource-category-badge" style="border-color:' + catColor + ';color:' + catColor + '">'
        + esc(src.category || '') + '</span>';
      var name = src.url
        ? '<a class="resource-card-name" href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(src.name || '') + '</a>'
        : '<span class="resource-card-name">' + esc(src.name || '') + '</span>';
      var desc = '<div class="resource-card-desc">' + esc(src.description || '') + '</div>';
      return '<div class="resource-card">'
        + '<div class="resource-card-top">' + name + badge + '</div>'
        + desc
        + '</div>';
    }).join('');

    el.innerHTML = '<section class="section-block resources-section">'
      + '<div class="section-label">Data Sources &amp; References</div>'
      + '<div class="resources-grid">' + cards + '</div>'
      + '</section>';
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
