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
    var W = 80, H = 24, PAD = 2;
    var n = prices.length - 1;
    var pts = prices.map(function (p, i) {
      var x = PAD + (i / n) * (W - 2 * PAD);
      var y = H - PAD - ((p - min) / range) * (H - 2 * PAD);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + '<polyline points="' + pts + '" stroke="' + (color || '#4a9ebb') + '" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
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
      + '<div class="range-current-dot" style="left:' + dotPct + '%;background:' + (color || '#4a9ebb') + '"></div>'
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

  // --------------------------------------------------------------------------
  // Row builders
  // --------------------------------------------------------------------------

  function powerRow(iso, data) {
    var series = data.seriesByIso[iso] || [];
    var name = (data.countriesByIso[iso] || {}).name || iso;
    var color = Charts.COUNTRY_COLORS[iso] || '#4a9ebb';
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
      + '<td class="row-name">' + name + '</td>'
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

    // No historical data for commodities currently — show no range bar
    var rangeCell = '<td class="range-cell"><div class="range-bar-wrap range-na"><span class="range-na-text">No hist.</span></div></td>';

    var futureCells = data.futures.months.map(function (m) {
      return futureCell(comm[m] != null ? comm[m] : null, spot);
    }).join('');

    // No sparkline for commodities (series empty)
    var spark = '<svg width="80" height="24"></svg>';

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

  function render(data) {
    var el = document.getElementById('market-table-container');
    if (!el) return;

    var months = data.futures.months || [];
    var monthHeaders = months.map(function (m) { return '<th class="num futures-hdr">' + m + '</th>'; }).join('');

    var powerRows = data.countryOrder.map(function (iso) { return powerRow(iso, data); }).join('');
    var commodityKeys = ['WTI', 'Brent', 'Henry Hub', 'TTF', 'Gold', 'Diesel'];
    var commodityRows = commodityKeys.map(function (k) { return commodityRow(k, data); }).join('');

    el.innerHTML = '<div class="section-block">'
      + '<div class="section-label">Market Overview</div>'
      + '<div class="table-scroll">'
      + '<table class="market-table">'
      + '<thead><tr>'
      + '<th>Name</th><th class="muted small">Unit</th><th class="num">Latest</th>'
      + '<th class="range-hdr">52-Week Range</th>'
      + monthHeaders
      + '<th>Trend (90d)</th>'
      + '</tr></thead>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="' + (5 + months.length) + '">Commodities</td></tr>'
      + commodityRows
      + '</tbody>'
      + '<tbody>'
      + '<tr class="section-header-row"><td colspan="' + (5 + months.length) + '">Power Prices</td></tr>'
      + powerRows
      + '</tbody>'
      + '</table>'
      + '</div>'
      + '</div>';
  }

  return { render: render };
}());
