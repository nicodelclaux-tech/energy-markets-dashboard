// Renders the Commodity Markets tab. Mirrors Power Markets layout with
// commodity-only controls and analytics.
var CommodityUI = (function () {

  var _data = null;

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n);
    return r < 0 ? '(' + Math.abs(r) + ')' : String(r);
  }

  function fmtDate(ds) {
    if (!ds) return '—';
    return ds;
  }

  function subtractMonths(dateStr, months) {
    var d = new Date(dateStr + 'T00:00:00Z');
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }

  function formatUpdatedAt(updatedAt) {
    if (!updatedAt) return 'Update time unavailable';
    var parsed = new Date(updatedAt);
    if (isNaN(parsed.getTime())) return 'Updated: ' + String(updatedAt);
    var now = Date.now();
    var deltaMin = Math.max(0, Math.round((now - parsed.getTime()) / 60000));
    if (deltaMin < 60) return 'Updated ' + deltaMin + 'm ago';
    if (deltaMin < 1440) return 'Updated ' + Math.round(deltaMin / 60) + 'h ago';
    return 'Updated ' + Math.round(deltaMin / 1440) + 'd ago';
  }

  function flagEmoji(iso) {
    var code = String(iso || '').toLowerCase().slice(0, 2);
    if (code.length !== 2 || !/^[a-z]{2}$/.test(code)) return '';
    return '<img src="../assets/Flags/' + code + '.svg" alt="' + code.toUpperCase() + '" class="market-primary-flag-img">';
  }

  var _COMMODITY_ICONS = {
    'OUSX':   'oil.svg',
    'OJSX':   'oil.svg',
    'NGAS':   'gas.svg',
    'TTF':    'gas.svg',
    'GOLD':   'gold.svg',
    'DIESEL': 'diesel.png'
  };

  function commodityIcon(iso) {
    var file = _COMMODITY_ICONS[String(iso || '').toUpperCase()];
    if (!file) return '';
    return '<img src="../assets/Icons/' + file + '" alt="' + iso + '" class="market-primary-flag-img">';
  }

  function qualityBadge(label, tone) {
    return '<span class="quality-badge quality-badge--' + tone + '">' + label + '</span>';
  }

  function sourceBadge(meta, key, label) {
    var src = ((meta || {}).sources || {})[key] || {};
    var status = src.status || 'unknown';
    var tone = status === 'ok' ? 'ok' : status === 'error' ? 'bad' : 'warn';
    return qualityBadge(label + ': ' + status.toUpperCase(), tone);
  }

  function setPanelTitle(elId, title, subtitle) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = title + (subtitle ? '<span class="panel-subtitle">' + subtitle + '</span>' : '');
  }

  function initControls(data) {
    _data = data;
    var panel = document.getElementById('controls-panel-commodity');
    var chartToolbar = document.getElementById('chart-main-toolbar-commodity');
    if (!panel || !chartToolbar) return;

    var _currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    var _themeIconFile = _currentTheme === 'dark' ? 'light-mode.svg' : 'dark-mode.svg';
    var _themeToggleBtn = '<button class="btn-icon" data-action="toggle-theme" aria-label="Toggle theme"><img src="../assets/Icons/' + _themeIconFile + '" alt="Toggle theme" class="theme-toggle-icon"></button>';

    var commodityOrder = data.commodityOrder || [];
    var commodityOptions = commodityOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<option value="' + iso + '">' + name + '</option>';
    }).join('');

    var compareButtons = commodityOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<button class="btn-pill btn-pill--country" data-compare-commodity="' + iso + '">' + name + '</button>';
    }).join('');

    panel.innerHTML = '<div class="market-header-bar">'
      + '<span id="market-primary-flag-commodity" class="market-primary-flag"></span>'
      + '<span id="market-primary-name-commodity" class="market-primary-name"></span>'
      + '<div class="market-header-actions">'
      + qualityBadge(formatUpdatedAt((data.meta || {}).updatedAt), 'neutral')
      + sourceBadge(data.meta || {}, 'fmp', 'FMP')
      + sourceBadge(data.meta || {}, 'eia', 'EIA')
      + sourceBadge(data.meta || {}, 'ecb', 'ECB')
      + _themeToggleBtn
      + '</div>'
      + '</div>';

    chartToolbar.innerHTML = '<div class="chart-toolbar-inner">'
      + '<div class="chart-toolbar-heading">'
      + '<div class="chart-toolbar-title">Price Trend</div>'
      + '<div class="chart-toolbar-subtitle">Commodity and FX references with peer spreads and rolling trend overlays.</div>'
      + '</div>'
      + '<div class="chart-toolbar-controls">'
      + '<div class="chart-toolbar-group">'
      + '<label class="ctrl-label">Period</label>'
      + '<div class="btn-group" id="ctrl-presets-commodity">'
      + '<button class="btn-pill" data-months="1">1M</button>'
      + '<button class="btn-pill" data-months="3">3M</button>'
      + '<button class="btn-pill" data-months="6">6M</button>'
      + '<button class="btn-pill btn-pill--active" data-months="12">1Y</button>'
      + '<button class="btn-pill" data-months="24">2Y</button>'
      + '<button class="btn-pill" data-months="0">All</button>'
      + '</div>'
      + '</div>'
      + '<div class="chart-toolbar-group">'
      + '<label class="ctrl-label">Primary</label>'
      + '<select id="ctrl-primary-commodity">' + commodityOptions + '</select>'
      + '</div>'
      + '<div class="chart-toolbar-group chart-toolbar-group--wide">'
      + '<label class="ctrl-label">Compare</label>'
      + '<div class="btn-group btn-group-wrap" id="ctrl-compare-wrap-commodity">' + compareButtons + '</div>'
      + '</div>'
      + '<div class="chart-toolbar-group">'
      + '<label class="ctrl-label">Benchmark</label>'
      + '<select id="ctrl-benchmark-commodity">' + commodityOptions + '</select>'
      + '</div>'
      + '<div class="chart-toolbar-fixed">Daily \u2022 30d \u2022 180d</div>'
      + '</div>'
      + '</div>';

    attachControlListeners(data);
  }

  function attachControlListeners(data) {
    var selPrimary = document.getElementById('ctrl-primary-commodity');
    if (selPrimary) {
      selPrimary.addEventListener('change', function () {
        AppState.setCommodityState({ primaryCountry: this.value });
      });
    }

    var selBench = document.getElementById('ctrl-benchmark-commodity');
    if (selBench) {
      selBench.addEventListener('change', function () {
        AppState.setCommodityState({ benchmarkCountry: this.value });
      });
    }

    var compareWrap = document.getElementById('ctrl-compare-wrap-commodity');
    if (compareWrap) {
      compareWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-compare-commodity]');
        if (!btn) return;
        var iso = btn.getAttribute('data-compare-commodity');
        var state = AppState.getCommodityState();
        if (iso === state.primaryCountry) return;
        var next = state.comparisonCountries.slice();
        var idx = next.indexOf(iso);
        if (idx >= 0) next.splice(idx, 1);
        else next.push(iso);
        AppState.setCommodityState({ comparisonCountries: next });
      });
    }

    var presets = document.getElementById('ctrl-presets-commodity');
    if (presets) {
      presets.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-months]');
        if (!btn) return;
        var months = parseInt(btn.getAttribute('data-months'), 10);
        var end = data.latestDate;
        var start = months === 0 ? data.earliestDate : subtractMonths(end, months);
        AppState.setCommodityState({ dateRange: { start: start, end: end }, periodPreset: months });
      });
    }


  }

  function syncControls(state) {
    var selPrimary = document.getElementById('ctrl-primary-commodity');
    if (selPrimary && selPrimary.value !== state.primaryCountry) selPrimary.value = state.primaryCountry;

    var selBench = document.getElementById('ctrl-benchmark-commodity');
    if (selBench && selBench.value !== state.benchmarkCountry) selBench.value = state.benchmarkCountry;

    var compareWrap = document.getElementById('ctrl-compare-wrap-commodity');
    if (compareWrap) {
      compareWrap.querySelectorAll('[data-compare-commodity]').forEach(function (el) {
        var iso = el.getAttribute('data-compare-commodity');
        var selected = state.comparisonCountries.indexOf(iso) !== -1 && iso !== state.primaryCountry;
        el.classList.toggle('btn-pill--active', selected);
        el.disabled = iso === state.primaryCountry;
      });
    }

    document.querySelectorAll('#ctrl-presets-commodity [data-months]').forEach(function (btn) {
      btn.classList.toggle('btn-pill--active', parseInt(btn.getAttribute('data-months'), 10) === state.periodPreset);
    });

    var primaryNameEl = document.getElementById('market-primary-name-commodity');
    if (primaryNameEl && _data) {
      primaryNameEl.textContent = (_data.countriesByIso[state.primaryCountry] || {}).name || state.primaryCountry;
    }
    var flagEl = document.getElementById('market-primary-flag-commodity');
    if (flagEl && _data) {
      var isCountry = _data.countryOrder.indexOf(state.primaryCountry) !== -1;
      flagEl.innerHTML = isCountry ? flagEmoji(state.primaryCountry) : commodityIcon(state.primaryCountry);
    }
  }

  function renderKPIs(state, data) {
    var el = document.getElementById('kpi-row-commodity');
    if (!el) return;

    var unitLabel = data.unitsByIso[state.primaryCountry] || 'EUR/MWh';
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var regime = Analytics.classifyRegime(stats.latest, data.seriesByIso[state.primaryCountry]);
    var pt = Analytics.findPeakTrough(series);
    var regimeClass = regime === 'low' ? 'regime-low' : regime === 'high' ? 'regime-high' : 'regime-normal';

    var spread = null;
    if (state.primaryCountry !== state.benchmarkCountry) {
      var spreadSeries = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
      if (spreadSeries.length > 0) spread = spreadSeries[spreadSeries.length - 1].price;
    }

    var benchName = (data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry;
    var spreadLabel = 'Spread vs ' + benchName;
    var spreadVal = spread != null ? fmt(spread) : '\u2014';
    var spreadClass = spread == null ? '' : spread > 0 ? 'kpi-positive' : 'kpi-negative';

    function card(label, value, sub, topRightHtml) {
      return '<div class="kpi-card">'
        + '<div class="kpi-card-head">'
        + '<div class="kpi-label">' + label + '</div>'
        + (topRightHtml ? '<div>' + topRightHtml + '</div>' : '')
        + '</div>'
        + '<div class="kpi-value">' + value + '</div>'
        + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '')
        + '</div>';
    }

    el.innerHTML = '<div class="kpi-inner">'
      + card('Latest Price',
          fmt(stats.latest) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          null,
          '<span class="regime-badge ' + regimeClass + '">' + (regime !== 'unknown' ? regime.toUpperCase() : '') + '</span>')
      + card('Average',  fmt(stats.avg)    + '<span class="kpi-unit"> ' + unitLabel + '</span>', 'period avg')
      + card('Min',      fmt(stats.min)    + '<span class="kpi-unit"> ' + unitLabel + '</span>', fmtDate(pt.troughDate))
      + card('Max',      fmt(stats.max)    + '<span class="kpi-unit"> ' + unitLabel + '</span>', fmtDate(pt.peakDate))
      + card('Volatility (\u03c3)', fmt(stats.stdDev) + '<span class="kpi-unit"> ' + unitLabel + '</span>', 'std dev, period')
      + card(spreadLabel,
          '<span class="' + spreadClass + '">' + spreadVal + '</span><span class="kpi-unit"> ' + unitLabel + '</span>',
          'current vs benchmark')
      + '</div>';
  }
  function renderMainChart(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var aggMode = 'daily';
    var agg = Analytics.applyAggregation(series, aggMode);

    var smoothedList = [30, 180].map(function (window) {
      return {
        name: window + 'd avg',
        type: window === 30 ? 'dashed' : 'dotted',
        data: Analytics.rollingAverage(series, window)
      };
    });

    var compIsos = state.comparisonCountries.filter(function (iso) { return iso !== state.primaryCountry; });
    var compMap = compIsos.length > 0
      ? Analytics.getAlignedComparison(data, compIsos, state.dateRange)
      : null;

    if (compMap) {
      var aggMap = {};
      Object.keys(compMap).forEach(function (iso) {
        aggMap[iso] = Analytics.applyAggregation(compMap[iso], aggMode);
      });
      compMap = aggMap;
    }

    var name = (data.countriesByIso[state.primaryCountry] || {}).name || state.primaryCountry;
    setPanelTitle('chart-title-main-commodity', 'Commodity Price Trend', name + ' against selected commodity references');

    Charts.renderTimeSeries('chart-main-commodity', {
      primarySeries: agg,
      primaryName: name,
      primaryIso: state.primaryCountry,
      unitLabel: data.unitsByIso[state.primaryCountry] || 'EUR/MWh',
      comparisonMap: compMap,
      euAvgSeries: [],
      percentileBandSeries: [],
      smoothedSeriesList: smoothedList,
      nonCoreLineType: 'dotted',
      aggregation: aggMode
    });
  }

  function renderRanking(state, data) {
    var el = document.getElementById('ranking-container-commodity');
    if (!el) return;

    var rankingDate = state.dateRange.end || data.latestDate;
    var rankings = Analytics.rankCountriesByDate(data, rankingDate, data.commodityOrder || []);
    if (rankings.length === 0) {
      el.innerHTML = '<div class="panel-title">Commodity Ranking</div><p class="muted small">No data</p>';
      return;
    }

    var maxPrice = rankings[0].price;

    var rows = rankings.map(function (r, i) {
      var barW = maxPrice > 0 ? (r.price / maxPrice * 100).toFixed(1) : 0;
      var color = Charts.COUNTRY_COLORS[r.iso] || '#4f759b';
      var isPrimary = r.iso === state.primaryCountry;
      var unit = data.unitsByIso[r.iso] || '';
      return '<tr class="' + (isPrimary ? 'ranking-primary' : '') + '">'
        + '<td class="rank-pos">' + (i + 1) + '</td>'
        + '<td class="rank-name">' + r.name + '</td>'
        + '<td class="rank-bar-cell">'
        + '<div class="rank-bar-wrap">'
        + '<div class="rank-bar-fill" style="width:' + barW + '%;background:' + color + (isPrimary ? '' : ';opacity:0.5') + '"></div>'
        + '</div>'
        + '</td>'
        + '<td class="num rank-price"><span class="rank-price-value">' + fmt(r.price) + '</span>'
        + (unit ? '<span class="rank-price-unit">' + unit + '</span>' : '')
        + '</td>'
        + '</tr>';
    }).join('');

    el.innerHTML = '<div class="panel-title">Commodity Ranking<span class="panel-subtitle">Latest available print across tracked commodity references</span></div>'
      + '<table class="ranking-table"><tbody>' + rows + '</tbody></table>';
  }

  function renderSpread(state, data) {
    var benchName = (data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry;
    var spread = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
    setPanelTitle('chart-title-spread-commodity', 'Spread vs Benchmark', 'Primary contract minus ' + benchName);
    Charts.renderSpreadChart('chart-spread-commodity', spread, benchName);
  }

  function renderDistribution(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var bins = Analytics.computeDistribution(series, 20);
    setPanelTitle('chart-title-dist-commodity', 'Price Distribution', 'Frequency profile for selected commodity period');
    Charts.renderHistogram('chart-dist-commodity', bins, stats.latest, data.unitsByIso[state.primaryCountry] || 'EUR/MWh');
  }

  function renderMonthlySummary(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var monthly = Analytics.aggregateMonthly(series);
    setPanelTitle('chart-title-monthly-commodity', 'Monthly Average Profile', 'Seasonality view for selected commodity');
    Charts.renderMonthlyBar('chart-monthly-commodity', monthly, state.primaryCountry, data.unitsByIso[state.primaryCountry] || 'EUR/MWh');
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
