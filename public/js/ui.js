// Renders the Data & Analysis tab. All functions read from AppState and the
// normalised data object. Called by renderApp() in app.js on every state change.
var UI = (function () {

  var _data = null; // set once during initControls

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n);
    return r < 0 ? '(' + Math.abs(r) + ')' : String(r);
  }

  function fmtDate(ds) {
    if (!ds) return '—';
    return ds; // YYYY-MM-DD is already readable
  }

  // Subtract months from a date string YYYY-MM-DD
  function subtractMonths(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  // --------------------------------------------------------------------------
  // Controls — built once, synced on each render
  // --------------------------------------------------------------------------

  function initControls(data) {
    _data = data;
    var panel = document.getElementById('controls-panel');
    if (!panel) return;

    var countryOptions = data.countryOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<option value="' + iso + '">' + name + '</option>';
    }).join('');

    var benchmarkOptions = '<option value="EU_AVG">EU Average</option>' + countryOptions;

    var compareButtons = data.countryOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<button class="btn-pill btn-pill--country" data-compare-iso="' + iso + '">' + name + '</button>';
    }).join('');

    panel.innerHTML = '<div class="controls-inner">'
      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Primary</label>'
      + '<select id="ctrl-primary">' + countryOptions + '</select>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Compare</label>'
      + '<div class="btn-group btn-group-wrap" id="ctrl-compare-wrap">' + compareButtons + '</div>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Benchmark</label>'
      + '<select id="ctrl-benchmark">' + benchmarkOptions + '</select>'
      + '</div>'

      + '<div class="ctrl-group ctrl-group--wide">'
      + '<label class="ctrl-label">Period</label>'
      + '<div class="btn-group" id="ctrl-presets">'
      + '<button class="btn-pill" data-months="1">1M</button>'
      + '<button class="btn-pill" data-months="3">3M</button>'
      + '<button class="btn-pill" data-months="6">6M</button>'
      + '<button class="btn-pill" data-months="12">1Y</button>'
      + '<button class="btn-pill" data-months="24">2Y</button>'
      + '<button class="btn-pill btn-pill--active" data-months="0">All</button>'
      + '</div>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Aggregation</label>'
      + '<div class="btn-group">'
      + '<button class="btn-pill btn-pill--active" data-agg="daily">Daily</button>'
      + '<button class="btn-pill" data-agg="monthly">Monthly</button>'
      + '<button class="btn-pill" data-agg="yearly">Yearly</button>'
      + '</div>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Smooth</label>'
      + '<div class="btn-group">'
      + '<button class="btn-pill" data-smooth="0">None</button>'
      + '<button class="btn-pill btn-pill--active" data-smooth="7">7d</button>'
      + '<button class="btn-pill" data-smooth="30">30d</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    _attachControlListeners(data);
  }

  function _attachControlListeners(data) {
    // Primary country
    var selPrimary = document.getElementById('ctrl-primary');
    if (selPrimary) {
      selPrimary.addEventListener('change', function () {
        AppState.setState({ primaryCountry: this.value });
      });
    }

    // Benchmark
    var selBench = document.getElementById('ctrl-benchmark');
    if (selBench) {
      selBench.addEventListener('change', function () {
        AppState.setState({ benchmarkCountry: this.value });
      });
    }

    // Comparison toggle buttons
    var compareWrap = document.getElementById('ctrl-compare-wrap');
    if (compareWrap) {
      compareWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-compare-iso]');
        if (!btn) return;
        var iso = btn.getAttribute('data-compare-iso');
        var state = AppState.getState();
        if (iso === state.primaryCountry) return;
        var next = state.comparisonCountries.slice();
        var idx = next.indexOf(iso);
        if (idx >= 0) next.splice(idx, 1);
        else next.push(iso);
        AppState.setState({ comparisonCountries: next });
      });
    }

    // Date presets
    var presets = document.getElementById('ctrl-presets');
    if (presets) {
      presets.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-months]');
        if (!btn) return;
        var months = parseInt(btn.getAttribute('data-months'), 10);
        var end = data.latestDate;
        var start = months === 0 ? data.earliestDate : subtractMonths(end, months);
        AppState.setState({ dateRange: { start: start, end: end }, periodPreset: months });
      });
    }

    // Aggregation
    var aggGroup = document.querySelector('[data-agg]');
    if (aggGroup) {
      document.querySelectorAll('[data-agg]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          AppState.setState({ aggregation: btn.getAttribute('data-agg') });
        });
      });
    }

    // Smoothing
    document.querySelectorAll('[data-smooth]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AppState.setState({ smoothingWindow: parseInt(btn.getAttribute('data-smooth'), 10) });
      });
    });
  }

  // Sync control visual state (active buttons, select values, date inputs) after re-render
  function syncControls(state) {
    var selPrimary = document.getElementById('ctrl-primary');
    if (selPrimary && selPrimary.value !== state.primaryCountry) selPrimary.value = state.primaryCountry;

    var selBench = document.getElementById('ctrl-benchmark');
    if (selBench && selBench.value !== state.benchmarkCountry) selBench.value = state.benchmarkCountry;

    // Uncheck primary from comparison, update checkboxes
    var compareWrap = document.getElementById('ctrl-compare-wrap');
    if (compareWrap) {
      compareWrap.querySelectorAll('[data-compare-iso]').forEach(function (el) {
        var iso = el.getAttribute('data-compare-iso');
        var selected = state.comparisonCountries.indexOf(iso) !== -1 && iso !== state.primaryCountry;
        el.classList.toggle('btn-pill--active', selected);
        el.disabled = iso === state.primaryCountry;
      });
    }

    document.querySelectorAll('#ctrl-presets [data-months]').forEach(function (btn) {
      btn.classList.toggle('btn-pill--active', parseInt(btn.getAttribute('data-months'), 10) === state.periodPreset);
    });

    // Active states for button groups
    document.querySelectorAll('[data-agg]').forEach(function (btn) {
      btn.classList.toggle('btn-pill--active', btn.getAttribute('data-agg') === state.aggregation);
    });
    document.querySelectorAll('[data-smooth]').forEach(function (btn) {
      btn.classList.toggle('btn-pill--active', btn.getAttribute('data-smooth') === String(state.smoothingWindow));
    });
  }

  // --------------------------------------------------------------------------
  // KPI row
  // --------------------------------------------------------------------------

  function renderKPIs(state, data) {
    var el = document.getElementById('kpi-row');
    if (!el) return;

    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var regime = Analytics.classifyRegime(stats.latest, data.seriesByIso[state.primaryCountry]);
    var pt = Analytics.findPeakTrough(series);
    var regimeClass = regime === 'low' ? 'regime-low' : regime === 'high' ? 'regime-high' : 'regime-normal';

    // Spread vs benchmark (latest value)
    var spread = null;
    if (state.primaryCountry !== state.benchmarkCountry) {
      var spreadSeries = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
      if (spreadSeries.length > 0) spread = spreadSeries[spreadSeries.length - 1].price;
    }

    var benchName = state.benchmarkCountry === 'EU_AVG'
      ? 'EU Average'
      : ((data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry);
    var spreadLabel = 'Spread vs ' + benchName;
    var spreadVal = spread != null ? fmt(spread) : '—';
    var spreadClass = spread == null ? '' : spread > 0 ? 'kpi-positive' : 'kpi-negative';

    function card(label, value, sub, extraClass) {
      return '<div class="kpi-card' + (extraClass ? ' ' + extraClass : '') + '">'
        + '<div class="kpi-label">' + label + '</div>'
        + '<div class="kpi-value">' + value + '</div>'
        + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '')
        + '</div>';
    }

    el.innerHTML = '<div class="kpi-inner">'
      + card('Latest Price', fmt(stats.latest) + '<span class="kpi-unit"> EUR/MWh</span>',
        '<span class="regime-badge ' + regimeClass + '">' + (regime !== 'unknown' ? regime.toUpperCase() : '') + '</span>')
      + card('Average', fmt(stats.avg) + '<span class="kpi-unit"> EUR/MWh</span>', 'period avg')
      + card('Min', fmt(stats.min) + '<span class="kpi-unit"> EUR/MWh</span>', fmtDate(pt.troughDate))
      + card('Max', fmt(stats.max) + '<span class="kpi-unit"> EUR/MWh</span>', fmtDate(pt.peakDate))
      + card('Volatility (σ)', fmt(stats.stdDev) + '<span class="kpi-unit"> EUR/MWh</span>', 'std dev, period')
      + card(spreadLabel, '<span class="' + spreadClass + '">' + spreadVal + '</span><span class="kpi-unit"> EUR/MWh</span>', 'current vs benchmark')
      + '</div>';
  }

  // --------------------------------------------------------------------------
  // Main chart
  // --------------------------------------------------------------------------

  function renderMainChart(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var agg = Analytics.applyAggregation(series, state.aggregation);
    var percentileBandSeries = Analytics.computePercentileBand(data, state.dateRange, state.aggregation, data.countryOrder);

    var euAvgSeries = Analytics.getBenchmarkSeries(data, 'EU_AVG', state.dateRange);
    euAvgSeries = Analytics.applyAggregation(euAvgSeries, state.aggregation);

    var smoothed = [];
    if (state.smoothingWindow > 0 && state.aggregation === 'daily') {
      smoothed = Analytics.rollingAverage(series, state.smoothingWindow);
    }

    var compIsos = state.comparisonCountries.filter(function (iso) { return iso !== state.primaryCountry; });
    var compMap = compIsos.length > 0
      ? Analytics.getAlignedComparison(data, compIsos, state.dateRange)
      : null;

    // Aggregate comparison series too
    if (compMap) {
      var aggMap = {};
      Object.keys(compMap).forEach(function (iso) {
        aggMap[iso] = Analytics.applyAggregation(compMap[iso], state.aggregation);
      });
      compMap = aggMap;
    }

    var name = (data.countriesByIso[state.primaryCountry] || {}).name || state.primaryCountry;

    Charts.renderTimeSeries('chart-main', {
      primarySeries: agg,
      primaryName: name,
      primaryIso: state.primaryCountry,
      comparisonMap: compMap,
      euAvgSeries: euAvgSeries,
      percentileBandSeries: percentileBandSeries,
      smoothedSeries: smoothed,
      smoothingWindow: state.smoothingWindow,
      aggregation: state.aggregation
    });
  }

  // --------------------------------------------------------------------------
  // Ranking table
  // --------------------------------------------------------------------------

  function renderRanking(state, data) {
    var el = document.getElementById('ranking-container');
    if (!el) return;

    var rankingDate = state.dateRange.end || data.latestDate;
    var rankings = Analytics.rankCountriesByDate(data, rankingDate);
    if (rankings.length === 0) {
      el.innerHTML = '<div class="panel-title">Country Ranking</div><p class="muted small">No data</p>';
      return;
    }

    var maxPrice = rankings[0].price;

    var rows = rankings.map(function (r, i) {
      var barW = maxPrice > 0 ? (r.price / maxPrice * 100).toFixed(1) : 0;
      var color = Charts.COUNTRY_COLORS[r.iso] || '#4f759b';
      var isPrimary = r.iso === state.primaryCountry;
      return '<tr class="' + (isPrimary ? 'ranking-primary' : '') + '">'
        + '<td class="rank-pos">' + (i + 1) + '</td>'
        + '<td class="rank-name">' + r.name + '</td>'
        + '<td class="rank-bar-cell">'
        + '<div class="rank-bar-wrap">'
        + '<div class="rank-bar-fill" style="width:' + barW + '%;background:' + color + (isPrimary ? '' : ';opacity:0.5') + '"></div>'
        + '</div>'
        + '</td>'
        + '<td class="num rank-price">' + fmt(r.price) + '</td>'
        + '</tr>';
    }).join('');

    el.innerHTML = '<div class="panel-title">Country Ranking</div>'
      + '<table class="ranking-table"><tbody>' + rows + '</tbody></table>';
  }

  // --------------------------------------------------------------------------
  // Spread chart
  // --------------------------------------------------------------------------

  function renderSpread(state, data) {
    var benchName = state.benchmarkCountry === 'EU_AVG'
      ? 'EU Average'
      : ((data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry);
    var spread = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
    Charts.renderSpreadChart('chart-spread', spread, benchName);
  }

  // --------------------------------------------------------------------------
  // Distribution chart
  // --------------------------------------------------------------------------

  function renderDistribution(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var bins = Analytics.computeDistribution(series, 20);
    Charts.renderHistogram('chart-dist', bins, stats.latest);
  }

  // --------------------------------------------------------------------------
  // Monthly summary chart
  // --------------------------------------------------------------------------

  function renderMonthlySummary(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var monthly = Analytics.aggregateMonthly(series);
    Charts.renderMonthlyBar('chart-monthly', monthly, state.primaryCountry);
  }

  return {
    initControls: initControls,
    syncControls: syncControls,
    renderKPIs: renderKPIs,
    renderMainChart: renderMainChart,
    renderRanking: renderRanking,
    renderSpread: renderSpread,
    renderDistribution: renderDistribution,
    renderMonthlySummary: renderMonthlySummary
  };
}());
