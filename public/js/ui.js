// Renders the Data & Analysis tab. All functions read from AppState and the
// normalised data object. Called by renderApp() in app.js on every state change.
var UI = (function () {

  var _data = null; // set once during initControls

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  function fmt(n, dp) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(dp != null ? dp : 1);
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

  function setActive(container, selector, activeClass, targetAttr, targetValue) {
    container.querySelectorAll(selector).forEach(function (el) {
      el.classList.toggle(activeClass, el.getAttribute(targetAttr) === targetValue);
    });
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

    var compareChecks = data.countryOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<label class="check-label">'
        + '<input type="checkbox" class="ctrl-compare" value="' + iso + '"> ' + name
        + '</label>';
    }).join('');

    panel.innerHTML = '<div class="controls-inner">'
      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Primary</label>'
      + '<select id="ctrl-primary">' + countryOptions + '</select>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Compare</label>'
      + '<div class="multi-check" id="ctrl-compare-wrap">' + compareChecks + '</div>'
      + '</div>'

      + '<div class="ctrl-group">'
      + '<label class="ctrl-label">Benchmark</label>'
      + '<select id="ctrl-benchmark">' + countryOptions + '</select>'
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
      + '<input type="date" id="ctrl-date-start" class="date-input">'
      + '<span class="date-sep">–</span>'
      + '<input type="date" id="ctrl-date-end" class="date-input">'
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

    // Comparison checkboxes
    var compareWrap = document.getElementById('ctrl-compare-wrap');
    if (compareWrap) {
      compareWrap.addEventListener('change', function (e) {
        if (e.target.classList.contains('ctrl-compare')) {
          var checked = [];
          compareWrap.querySelectorAll('.ctrl-compare:checked').forEach(function (el) {
            checked.push(el.value);
          });
          // Prevent comparing with primary
          var state = AppState.getState();
          checked = checked.filter(function (iso) { return iso !== state.primaryCountry; });
          AppState.setState({ comparisonCountries: checked });
        }
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
        AppState.setState({ dateRange: { start: start, end: end } });
      });
    }

    // Manual date inputs
    var startInput = document.getElementById('ctrl-date-start');
    var endInput = document.getElementById('ctrl-date-end');
    if (startInput) {
      startInput.addEventListener('change', function () {
        AppState.setState({ dateRange: { start: this.value } });
      });
    }
    if (endInput) {
      endInput.addEventListener('change', function () {
        AppState.setState({ dateRange: { end: this.value } });
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
      compareWrap.querySelectorAll('.ctrl-compare').forEach(function (el) {
        el.checked = state.comparisonCountries.indexOf(el.value) !== -1 && el.value !== state.primaryCountry;
        el.disabled = el.value === state.primaryCountry;
      });
    }

    var startInput = document.getElementById('ctrl-date-start');
    var endInput = document.getElementById('ctrl-date-end');
    if (startInput && state.dateRange.start) startInput.value = state.dateRange.start;
    if (endInput && state.dateRange.end) endInput.value = state.dateRange.end;

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
    var allStats = Analytics.computeStats(data.seriesByIso[state.primaryCountry] || []);
    var regime = Analytics.classifyRegime(stats.latest, data.seriesByIso[state.primaryCountry]);
    var pt = Analytics.findPeakTrough(series);
    var regimeClass = regime === 'low' ? 'regime-low' : regime === 'high' ? 'regime-high' : 'regime-normal';

    // Spread vs benchmark (latest value)
    var spread = null;
    if (state.primaryCountry !== state.benchmarkCountry) {
      var spreadSeries = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
      if (spreadSeries.length > 0) spread = spreadSeries[spreadSeries.length - 1].price;
    }

    var benchName = (data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry;
    var spreadLabel = 'Spread vs ' + benchName;
    var spreadVal = spread != null ? (spread >= 0 ? '+' : '') + fmt(spread) : '—';
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

    var rankings = Analytics.rankCountriesByDate(data, state.rankingDate || data.latestDate);
    if (rankings.length === 0) {
      el.innerHTML = '<div class="panel-title">Country Ranking</div><p class="muted small">No data</p>';
      return;
    }

    var maxPrice = rankings[0].price;

    var rows = rankings.map(function (r, i) {
      var barW = maxPrice > 0 ? (r.price / maxPrice * 100).toFixed(1) : 0;
      var color = Charts.COUNTRY_COLORS[r.iso] || '#4a9ebb';
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

    // Ranking date selector
    var dateLabel = state.rankingDate || data.latestDate || '';

    el.innerHTML = '<div class="panel-title">Country Ranking'
      + '<input type="date" id="ctrl-ranking-date" class="date-input date-input--inline" value="' + dateLabel + '">'
      + '</div>'
      + '<table class="ranking-table"><tbody>' + rows + '</tbody></table>';

    // Attach listener
    var rankInput = document.getElementById('ctrl-ranking-date');
    if (rankInput) {
      rankInput.addEventListener('change', function () {
        AppState.setState({ rankingDate: this.value });
      });
    }
  }

  // --------------------------------------------------------------------------
  // Spread chart
  // --------------------------------------------------------------------------

  function renderSpread(state, data) {
    var benchName = (data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry;
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
