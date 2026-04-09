/**
 * MarketWidget — Google Finance-style market tracker component.
 *
 * Usage:
 *   MarketWidget.mount(document.getElementById('widget-mount'));
 *
 * Requires: ECharts loaded in page scope (window.echarts).
 * No other external dependencies.
 */
(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
     Mock data
     ───────────────────────────────────────────────────────────────────────── */

  /** Generate the last N weekday date strings MM/DD. */
  function tradingDates(n) {
    var result = [];
    var d = new Date();
    var offset = 0;
    while (result.length < n) {
      var dt = new Date(d);
      dt.setDate(d.getDate() - offset);
      var day = dt.getDay();
      if (day !== 0 && day !== 6) {
        result.unshift(
          String(dt.getMonth() + 1).padStart(2, '0') + '/' +
          String(dt.getDate()).padStart(2, '0')
        );
      }
      offset++;
    }
    return result;
  }

  /* Build a price series from a base value and an array of deltas. */
  function series(base, deltas) {
    return deltas.map(function (d) { return Math.round((base + d) * 100) / 100; });
  }

  var D1  = tradingDates(8);
  var D1W = tradingDates(5);
  var D1M = tradingDates(22);
  var D6M = tradingDates(26);  // reduced for performance; shape still clear

  /* Chart shape for US 30 1M: rise → plateau → sharp drop → recovery */
  var US30_1M = series(47400, [
     0,  180,  320,  410,  480,  390,  300,  220,
   160,   60, -120, -380, -720,-1100,-1600,-2000,
  -1700,-1200, -600, -100,  320,  480
  ]);

  var DATA = {
    indices: {
      label: 'US 30',
      chartSeries: {
        '1D':  { dates: D1,  values: series(47871, [ 0, 60,-30, 90,-50, 30,-80,-39]) },
        '1W':  { dates: D1W, values: series(47910, [ 0,-100, 200,-150,-39]) },
        '1M':  { dates: D1M, values: US30_1M },
        '6M':  { dates: D6M, values: series(44000, [ 0,200,400,600,800,600,400,800,1000,1200,1400,1200,1000,1400,1800,2000,1800,2200,2400,2600,2400,2200,2600,2800,3000,2871]) },
        '1Y':  { dates: D6M, values: series(40000, [ 0,400,800,1200,1600,1200,800,1600,2000,2400,2800,2400,2000,2800,3200,4000,3600,4400,4800,5200,4800,4400,5200,6000,6800,7871]) },
        '5Y':  { dates: D6M, values: series(30000, [ 0,1000,2000,3000,4000,3000,2000,4000,5000,6000,7000,6000,5000,7000,8000,10000,9000,11000,12000,13000,12000,11000,13000,14000,16000,17871]) },
        'Max': { dates: D6M, values: series(10000, [ 0,2000,4000,6000,8000,6000,4000,8000,10000,12000,14000,12000,10000,14000,16000,20000,18000,22000,24000,26000,24000,22000,26000,28000,32000,37871]) }
      },
      rows: [
        { name: 'US 30',        price: 47871.60, change:    -39.2,  pct:  -0.08, active: true },
        { name: 'US 500',       price:  6769.10, change:    -13.9,  pct:  -0.20 },
        { name: 'Dow Jones',    price: 47909.92, change:  +1325.46, pct:  +2.85 },
        { name: 'S&P 500',      price:  6782.96, change:   +166.11, pct:  +2.51 },
        { name: 'Nasdaq',       price: 22635.00, change:   +617.15, pct:  +2.80 },
        { name: 'S&P 500 VIX',  price:    21.04, change:     -4.74, pct: -18.39 },
        { name: 'Dollar Index', price:    98.91, change:    +0.080, pct:  +0.08 }
      ]
    },
    commodities: {
      label: 'Crude Oil WTI',
      chartSeries: {
        '1D':  { dates: D1,  values: series(63.14, [0, 0.4,-0.2, 0.6,-0.3, 0.2,-0.4, 0.54]) },
        '1W':  { dates: D1W, values: series(62.6,  [0, 0.3, 0.7, 0.2, 0.54]) },
        '1M':  { dates: D1M, values: series(62,    [0, 0.3, 0.8, 1.2, 1.6, 1.1, 0.6, 0.2,-0.3,-0.9,-1.5,-2.0,-2.6,-3.1,-3.8,-4.2,-3.5,-2.6,-1.7,-0.8, 0.3, 1.14]) },
        '6M':  { dates: D6M, values: series(60,    [0,0.3,0.7,1.2,1.8,1.4,1.0,1.6,2.2,2.8,2.2,1.6,2.2,2.8,3.5,2.9,2.3,3.0,3.7,4.4,3.7,3.0,3.7,4.4,5.1,3.14]) },
        '1Y':  { dates: D6M, values: series(55,    [0,0.8,1.6,2.4,3.2,2.4,1.6,3.2,4.0,4.8,4.0,3.2,4.8,5.6,6.4,5.6,4.8,6.4,7.2,8.0,7.2,6.4,7.2,8.0,9.0,8.14]) },
        '5Y':  { dates: D6M, values: series(40,    [0,1,2,4,6,5,4,6,8,10,9,8,10,12,14,12,10,14,16,18,16,14,18,20,22,23.14]) },
        'Max': { dates: D6M, values: series(20,    [0,2,4,8,12,10,8,12,16,20,18,16,20,24,28,24,20,28,32,36,32,28,36,40,44,43.14]) }
      },
      rows: [
        { name: 'Crude Oil WTI', price:   63.14, change:  +0.54, pct:  +0.86, active: true },
        { name: 'Brent Crude',   price:   66.87, change:  +0.61, pct:  +0.92 },
        { name: 'Natural Gas',   price:    3.21, change:  -0.08, pct:  -2.43 },
        { name: 'Gold',          price: 3342.60, change: +38.20, pct:  +1.16 },
        { name: 'Silver',        price:   32.84, change:  +0.42, pct:  +1.30 },
        { name: 'Copper',        price:    4.68, change:  +0.06, pct:  +1.30 },
        { name: 'TTF Gas',       price:   34.21, change:  -0.54, pct:  -1.55 }
      ]
    },
    bonds: {
      label: 'US 10Y',
      chartSeries: {
        '1D':  { dates: D1,  values: [4.30,4.32,4.31,4.33,4.32,4.34,4.33,4.32] },
        '1W':  { dates: D1W, values: [4.28,4.30,4.32,4.31,4.32] },
        '1M':  { dates: D1M, values: series(4.10, [0,0.03,-0.02,0.06,-0.04,0.08,-0.06,0.10,-0.08,0.12,-0.10,0.14,-0.12,0.16,-0.14,0.18,-0.16,0.14,-0.08,0.04,0.02,0.22]) },
        '6M':  { dates: D6M, values: series(3.90, [0,0.02,0.05,0.08,0.12,0.10,0.08,0.12,0.16,0.20,0.16,0.12,0.16,0.22,0.28,0.22,0.16,0.22,0.28,0.34,0.28,0.22,0.34,0.38,0.42,0.42]) },
        '1Y':  { dates: D6M, values: series(3.60, [0,0.05,0.10,0.15,0.20,0.16,0.12,0.18,0.25,0.32,0.26,0.20,0.28,0.36,0.44,0.36,0.28,0.38,0.48,0.58,0.48,0.38,0.52,0.62,0.72,0.72]) },
        '5Y':  { dates: D6M, values: series(1.50, [0,0.1,0.2,0.4,0.6,0.5,0.4,0.6,0.8,1.0,0.8,0.6,0.9,1.2,1.5,1.2,0.9,1.2,1.6,2.0,1.6,1.2,1.6,2.1,2.6,2.82]) },
        'Max': { dates: D6M, values: series(0.50, [0,0.2,0.4,0.7,1.1,1.6,2.1,2.6,3.1,2.6,2.1,2.6,3.1,3.6,3.1,2.6,3.1,3.6,4.1,3.6,3.1,3.4,3.7,3.9,3.85,3.82]) }
      },
      rows: [
        { name: 'US 10Y',      price: 4.32, change: +0.06, pct:  +1.41, active: true },
        { name: 'US 2Y',       price: 3.87, change: +0.03, pct:  +0.78 },
        { name: 'US 30Y',      price: 4.78, change: +0.08, pct:  +1.70 },
        { name: 'Germany 10Y', price: 2.54, change: +0.04, pct:  +1.60 },
        { name: 'UK 10Y',      price: 4.65, change: +0.05, pct:  +1.09 },
        { name: 'France 10Y',  price: 3.22, change: +0.05, pct:  +1.58 },
        { name: 'Italy 10Y',   price: 3.87, change: -0.02, pct:  -0.51 }
      ]
    },
    stocks: {
      label: 'Apple',
      chartSeries: {
        '1D':  { dates: D1,  values: series(210.62, [0, 1.2,-0.6, 2.0,-1.0, 0.8,-1.6, 0] ) },
        '1W':  { dates: D1W, values: series(205.20, [0, 1.5, 3.0, 1.0, 5.42]) },
        '1M':  { dates: D1M, values: series(196, [0,2,4,6,9,7,5,3,1,-1,-3,-5,-8,-11,-14,-16,-13,-10,-6,-2, 2,14.62]) },
        '6M':  { dates: D6M, values: series(175, [0,1,3,5,7,6,5,7,9,11,9,7,9,12,15,12,9,12,16,20,16,12,16,22,28,35.62]) },
        '1Y':  { dates: D6M, values: series(155, [0,2,4,6,9,7,5,9,13,17,13,9,14,19,24,19,14,20,26,32,26,20,28,35,42,55.62]) },
        '5Y':  { dates: D6M, values: series(80,  [0,4,8,12,18,14,10,16,22,28,22,16,24,32,40,32,24,34,44,54,44,34,48,62,76,130.62]) },
        'Max': { dates: D6M, values: series(1,   [0,4,8,14,20,16,12,18,24,32,26,20,28,38,48,40,32,44,56,70,58,46,64,82,100,209.62]) }
      },
      rows: [
        { name: 'Apple',     price:  210.62, change:  +5.42, pct:  +2.64, active: true },
        { name: 'Microsoft', price:  384.57, change:  +8.34, pct:  +2.22 },
        { name: 'Nvidia',    price:  875.40, change: +32.10, pct:  +3.81 },
        { name: 'Amazon',    price:  196.26, change:  +4.22, pct:  +2.20 },
        { name: 'Tesla',     price:  236.48, change: -12.34, pct:  -4.96 },
        { name: 'Meta',      price:  538.22, change: +14.68, pct:  +2.80 },
        { name: 'Alphabet',  price:  170.38, change:  +3.82, pct:  +2.29 }
      ]
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Formatters
     ───────────────────────────────────────────────────────────────────────── */

  function fmtPrice(v) {
    if (v >= 1000)  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (v >= 10)    return v.toFixed(2);
    if (v >= 1)     return v.toFixed(3);
    return v.toFixed(4);
  }

  function fmtChange(v) {
    var sign = v >= 0 ? '+' : '';
    if (Math.abs(v) >= 1000) return sign + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (Math.abs(v) >= 1)    return sign + v.toFixed(2);
    return sign + v.toFixed(3);
  }

  function fmtPct(v) {
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Styles (injected once into <head>)
     ───────────────────────────────────────────────────────────────────────── */

  var STYLE = [
    '.mw{background:#fff;border:1px solid #dadce0;border-radius:8px;',
      'font-family:"Google Sans",Roboto,Arial,sans-serif;font-size:14px;overflow:hidden;}',

    /* tabs */
    '.mw-tabs{display:flex;align-items:stretch;padding:0 4px;border-bottom:1px solid #e8eaed;}',
    '.mw-tab{padding:12px 10px;font-size:13px;font-weight:500;color:#5f6368;cursor:pointer;',
      'background:none;border:none;border-bottom:2px solid transparent;font-family:inherit;',
      'white-space:nowrap;margin-bottom:-1px;transition:color 0.15s;}',
    '.mw-tab:hover{color:#202124;}',
    '.mw-tab.mw-active{color:#1a73e8;font-weight:700;border-bottom-color:#1a73e8;}',
    '.mw-sep{color:#dadce0;padding:0 2px;align-self:center;font-size:16px;user-select:none;line-height:1;}',
    '.mw-more{margin-left:auto;padding:0 10px;color:#5f6368;cursor:pointer;background:none;border:none;',
      'font-size:22px;line-height:1;align-self:center;}',

    /* time range bar */
    '.mw-ranges{display:flex;align-items:center;padding:2px 8px;border-bottom:1px solid #e8eaed;gap:0;}',
    '.mw-range{padding:6px 8px;font-size:12px;font-weight:500;color:#80868b;cursor:pointer;background:none;',
      'border:none;border-bottom:2px solid transparent;font-family:inherit;white-space:nowrap;margin-bottom:-1px;}',
    '.mw-range:hover{color:#202124;}',
    '.mw-range.mw-active{color:#202124;font-weight:700;border-bottom-color:#202124;}',
    '.mw-range-spacer{flex:1;}',
    '.mw-grid-btn{padding:4px 6px;color:#80868b;cursor:pointer;background:none;border:none;',
      'font-size:18px;line-height:1;transition:color 0.15s;}',
    '.mw-grid-btn:hover{color:#202124;}',

    /* table */
    '.mw-table{width:100%;border-collapse:collapse;}',
    '.mw-table tbody tr{border-top:1px solid #f1f3f4;cursor:pointer;transition:background 0.12s;}',
    '.mw-table tbody tr:hover{background:#f8f9fa;}',
    '.mw-table tbody tr.mw-row-active{background:#e6f4ea;}',
    '.mw-table tbody tr.mw-row-active:hover{background:#d4edda;}',
    '.mw-table td{padding:9px 12px;font-size:13px;white-space:nowrap;vertical-align:middle;}',
    '.mw-td-name{font-weight:600;color:#202124;min-width:110px;}',
    '.mw-td-price{text-align:right;color:#202124;font-variant-numeric:tabular-nums;}',
    '.mw-td-change,.mw-td-pct{text-align:right;font-variant-numeric:tabular-nums;}',
    '.mw-td-icon{text-align:right;width:28px;padding-left:4px;padding-right:8px;}',
    '.mw-pos{color:#1e8e3e;}',
    '.mw-neg{color:#d93025;}'
  ].join('');

  /* ─────────────────────────────────────────────────────────────────────────
     History icon SVG
     ───────────────────────────────────────────────────────────────────────── */

  function historyIcon(isNeg) {
    var c = isNeg ? '#d93025' : '#1e8e3e';
    return (
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" ' +
        'xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle">' +
        '<circle cx="10" cy="10" r="8.5" stroke="' + c + '" stroke-width="1.4"/>' +
        '<polyline points="10,6 10,10.5 13,12.5" stroke="' + c + '" stroke-width="1.4" ' +
          'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '<path d="M5.5 7.5 A5 5 0 0 1 14.5 7.5" stroke="' + c + '" stroke-width="1.4" ' +
          'stroke-linecap="round" fill="none"/>' +
        '<polyline points="5.5,5.5 5.5,7.5 7.5,7.5" stroke="' + c + '" stroke-width="1.4" ' +
          'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '</svg>'
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Component
     ───────────────────────────────────────────────────────────────────────── */

  var MarketWidget = {
    _el:            null,
    _chart:         null,
    _activeTab:     'indices',
    _activeRange:   '1M',
    _styleInjected: false,

    /** Inject component CSS once. */
    _injectStyle: function () {
      if (this._styleInjected) return;
      var s = document.createElement('style');
      s.textContent = STYLE;
      document.head.appendChild(s);
      this._styleInjected = true;
    },

    /** Mount into DOM element el. */
    mount: function (el) {
      this._injectStyle();
      this._el = el;
      this._render();
    },

    /** Full re-render (tab switch resets range to 1M). */
    _render: function () {
      var self = this;
      var tabKeys   = ['indices', 'commodities', 'bonds', 'stocks'];
      var rangeKeys = ['1D', '1W', '1M', '6M', '1Y', '5Y', 'Max'];
      var tabData   = DATA[this._activeTab];

      /* ── tabs ── */
      var tabsHtml = tabKeys.map(function (t, i) {
        var label  = t.charAt(0).toUpperCase() + t.slice(1);
        var active = t === self._activeTab ? ' mw-active' : '';
        var sep    = i < tabKeys.length - 1 ? '<span class="mw-sep">|</span>' : '';
        return '<button class="mw-tab' + active + '" data-tab="' + t + '">' + label + '</button>' + sep;
      }).join('') + '<button class="mw-more" aria-label="More options">⋮</button>';

      /* ── time range bar ── */
      var rangesHtml = rangeKeys.map(function (r) {
        var active = r === self._activeRange ? ' mw-active' : '';
        return '<button class="mw-range' + active + '" data-range="' + r + '">' + r + '</button>';
      }).join('') +
        '<span class="mw-range-spacer"></span>' +
        '<button class="mw-grid-btn" title="Table view">&#9783;</button>';

      /* ── table rows ── */
      var rowsHtml = tabData.rows.map(function (row) {
        var rowActive   = row.active ? ' mw-row-active' : '';
        var changeClass = row.change >= 0 ? ' mw-pos' : ' mw-neg';
        return (
          '<tr class="' + rowActive + '" data-name="' + row.name + '">' +
            '<td class="mw-td-name">'   + row.name                            + '</td>' +
            '<td class="mw-td-price">'  + fmtPrice(row.price)                 + '</td>' +
            '<td class="mw-td-change' + changeClass + '">' + fmtChange(row.change) + '</td>' +
            '<td class="mw-td-pct'    + changeClass + '">' + fmtPct(row.pct)       + '</td>' +
            '<td class="mw-td-icon">' + historyIcon(row.change < 0)           + '</td>' +
          '</tr>'
        );
      }).join('');

      this._el.innerHTML =
        '<div class="mw">' +
          '<div class="mw-tabs">'   + tabsHtml   + '</div>' +
          '<div class="mw-ranges">' + rangesHtml + '</div>' +
          '<div id="mw-chart-canvas" style="width:100%;height:200px;"></div>' +
          '<table class="mw-table"><tbody>' + rowsHtml + '</tbody></table>' +
        '</div>';

      this._initChart();
      this._bindEvents();
    },

    /** Initialise or re-initialise ECharts instance. */
    _initChart: function () {
      var canvas = document.getElementById('mw-chart-canvas');
      if (!canvas || typeof echarts === 'undefined') return;
      if (this._chart) { this._chart.dispose(); }
      this._chart = echarts.init(canvas, null, { renderer: 'svg' });
      this._updateChart();
    },

    /** Push new dataset to the existing chart instance. */
    _updateChart: function () {
      if (!this._chart) return;

      var tabData    = DATA[this._activeTab];
      var dataset    = tabData.chartSeries[this._activeRange] || tabData.chartSeries['1M'];
      var dates      = dataset.dates;
      var values     = dataset.values;

      var isDown     = values[values.length - 1] < values[0];
      var lineColor  = isDown ? '#d93025' : '#1a73e8';
      var fillStart  = isDown ? 'rgba(217,48,37,0.15)'  : 'rgba(26,115,232,0.15)';
      var fillEnd    = isDown ? 'rgba(217,48,37,0.01)'  : 'rgba(26,115,232,0.01)';

      var minVal = Math.min.apply(null, values);
      var maxVal = Math.max.apply(null, values);
      var pad    = (maxVal - minVal) * 0.18 || 0.5;

      /* Show ~5 evenly spaced x-axis labels */
      var step   = Math.max(1, Math.floor((dates.length - 1) / 4));
      var xData  = dates.map(function (d, i) {
        return (i === 0 || i === dates.length - 1 || i % step === 0) ? d : '';
      });

      this._chart.setOption({
        animation: false,
        grid:   { top: 10, right: 58, bottom: 26, left: 10 },
        xAxis: {
          type:        'category',
          data:        xData,
          boundaryGap: false,
          axisLine:    { show: false },
          axisTick:    { show: false },
          axisLabel:   { color: '#5f6368', fontSize: 11, interval: 0 },
          splitLine:   { show: false }
        },
        yAxis: {
          type:      'value',
          position:  'right',
          min:       minVal - pad,
          max:       maxVal + pad,
          axisLine:  { show: false },
          axisTick:  { show: false },
          axisLabel: {
            color:     '#5f6368',
            fontSize:  11,
            formatter: function (v) {
              if      (Math.abs(v) >= 10000) return (v / 1000).toFixed(0) + 'k';
              else if (Math.abs(v) >= 1000)  return (v / 1000).toFixed(1) + 'k';
              else if (Math.abs(v) >= 10)    return v.toFixed(0);
              else                            return v.toFixed(2);
            }
          },
          splitLine: { lineStyle: { color: '#f1f3f4', width: 1 } }
        },
        series: [{
          type:      'line',
          data:      values,
          smooth:    false,
          symbol:    'none',
          lineStyle: { color: lineColor, width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: fillStart },
                { offset: 1, color: fillEnd   }
              ]
            }
          }
        }]
      });
    },

    /** Wire tab, range, and row click events via delegation. */
    _bindEvents: function () {
      var self = this;
      this._el.addEventListener('click', function (e) {

        /* Tab switch */
        var tabBtn = e.target.closest('.mw-tab');
        if (tabBtn && tabBtn.dataset.tab) {
          self._activeTab   = tabBtn.dataset.tab;
          self._activeRange = '1M';
          self._render();
          return;
        }

        /* Time range switch — update chart only, no full re-render */
        var rangeBtn = e.target.closest('.mw-range');
        if (rangeBtn && rangeBtn.dataset.range) {
          self._activeRange = rangeBtn.dataset.range;
          self._el.querySelectorAll('.mw-range').forEach(function (b) {
            b.classList.toggle('mw-active', b === rangeBtn);
          });
          self._updateChart();
          return;
        }

        /* Row selection — highlight without re-rendering */
        var row = e.target.closest('tr[data-name]');
        if (row) {
          var name    = row.dataset.name;
          var tabData = DATA[self._activeTab];
          tabData.rows.forEach(function (r) { r.active = r.name === name; });
          self._el.querySelectorAll('tr[data-name]').forEach(function (tr) {
            tr.classList.toggle('mw-row-active', tr.dataset.name === name);
          });
        }
      });
    }
  };

  global.MarketWidget = MarketWidget;

})(window);
