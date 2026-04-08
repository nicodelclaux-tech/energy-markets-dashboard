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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeNewsText(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s*\|\s*/g, ' | ')
      .replace(/\s*-\s*/g, ' - ')
      .trim();
  }

  function formatNewsDate(value) {
    if (!value) return 'Unknown date';
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) return escapeHtml(value);
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getNewsSourceLabel(url) {
    if (!url) return 'Unknown source';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (err) {
      return url;
    }
  }

  function sanitizeExternalUrl(url) {
    if (!url) return '#';
    try {
      var parsed = new URL(url);
      var protocol = (parsed.protocol || '').toLowerCase();
      if (protocol === 'http:' || protocol === 'https:') {
        return parsed.toString();
      }
    } catch (err) {
      return '#';
    }
    return '#';
  }

  function formatUpdatedAt(updatedAt) {
    if (!updatedAt) return 'Update time unavailable';
    var parsed = new Date(updatedAt);
    if (isNaN(parsed.getTime())) return 'Updated: ' + escapeHtml(String(updatedAt));
    var now = Date.now();
    var deltaMin = Math.max(0, Math.round((now - parsed.getTime()) / 60000));
    if (deltaMin < 60) return 'Updated ' + deltaMin + 'm ago';
    if (deltaMin < 1440) return 'Updated ' + Math.round(deltaMin / 60) + 'h ago';
    return 'Updated ' + Math.round(deltaMin / 1440) + 'd ago';
  }

  function flagEmoji(iso) {
    var code = String(iso || '').toLowerCase().slice(0, 2);
    if (code.length !== 2 || !/^[a-z]{2}$/.test(code)) return '';
    return '<img src="assets/flags/' + code + '.svg" alt="' + code.toUpperCase() + '" class="market-primary-flag-img">';
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
    var chartToolbar = document.getElementById('chart-main-toolbar');
    if (!panel || !chartToolbar) return;

    var countryOptions = data.countryOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<option value="' + iso + '">' + name + '</option>';
    }).join('');

    var benchmarkOptions = '<option value="EU_AVG">EU Average</option>' + countryOptions;

    var compareButtons = data.countryOrder.map(function (iso) {
      var name = (data.countriesByIso[iso] || {}).name || iso;
      return '<button class="btn-pill btn-pill--country" data-compare-iso="' + iso + '">' + name + '</button>';
    }).join('');

    var _currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    var _themeIconFile = _currentTheme === 'dark' ? 'light-mode.svg' : 'dark-mode.svg';
    var _themeToggleBtn = '<button class="btn-icon" data-action="toggle-theme" aria-label="Toggle theme"><img src="assets/icons/' + _themeIconFile + '" alt="Toggle theme" class="theme-toggle-icon"></button>';

    panel.innerHTML = '<div class="market-header-bar">'
      + '<span id="market-primary-flag" class="market-primary-flag"></span>'
      + '<span id="market-primary-name" class="market-primary-name"></span>'
      + '<div class="market-header-actions">'
      + qualityBadge(formatUpdatedAt((data.meta || {}).updatedAt), 'neutral')
      + sourceBadge(data.meta || {}, 'entsoe', 'ENTSO-E')
      + _themeToggleBtn
      + '</div>'
      + '</div>';

    chartToolbar.innerHTML = '<div class="chart-toolbar-inner">'
      + '<div class="chart-toolbar-heading">'
      + '<div class="chart-toolbar-title">Price Trend</div>'
      + '<div class="chart-toolbar-subtitle">Daily wholesale power pricing with benchmark, peer comparison, and rolling signal overlays.</div>'
      + '</div>'
      + '<div class="chart-toolbar-controls">'
      + '<div class="chart-toolbar-group">'
      + '<label class="ctrl-label">Period</label>'
      + '<div class="btn-group" id="ctrl-presets">'
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
      + '<select id="ctrl-primary">' + countryOptions + '</select>'
      + '</div>'
      + '<div class="chart-toolbar-group chart-toolbar-group--wide">'
      + '<label class="ctrl-label">Compare</label>'
      + '<div class="btn-group btn-group-wrap" id="ctrl-compare-wrap">' + compareButtons + '</div>'
      + '</div>'
      + '<div class="chart-toolbar-group">'
      + '<label class="ctrl-label">Benchmark</label>'
      + '<select id="ctrl-benchmark">' + benchmarkOptions + '</select>'
      + '</div>'
      + '<div class="chart-toolbar-fixed">Daily \u2022 30d \u2022 180d</div>'
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

    var heatmapContainer = document.getElementById('heatmap-container');
    if (heatmapContainer) {
      heatmapContainer.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-map-window]');
        if (!btn) return;
        AppState.setState({ mapWindow: btn.getAttribute('data-map-window') });
      });
    }

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

    var flagEl = document.getElementById('market-primary-flag');
    if (flagEl) {
      var isCountry = _data && _data.countryOrder.indexOf(state.primaryCountry) !== -1;
      flagEl.innerHTML = isCountry ? flagEmoji(state.primaryCountry) : '';
    }
    var primaryNameEl = document.getElementById('market-primary-name');
    if (primaryNameEl) {
      primaryNameEl.textContent = (state.primaryCountry === 'EU_AVG')
        ? 'EU Average'
        : (( _data.countriesByIso[state.primaryCountry] || {}).name || state.primaryCountry);
    }
  }

  // --------------------------------------------------------------------------
  // KPI row
  // --------------------------------------------------------------------------

  function renderKPIs(state, data) {
    var el = document.getElementById('kpi-row');
    if (!el) return;

    var isCountryPrimary = data.countryOrder.indexOf(state.primaryCountry) !== -1;
    var unitLabel = data.unitsByIso[state.primaryCountry] || 'EUR/MWh';
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var regime = Analytics.classifyRegime(stats.latest, data.seriesByIso[state.primaryCountry]);
    var pt = Analytics.findPeakTrough(series);
    var regimeClass = regime === 'low' ? 'regime-low' : regime === 'high' ? 'regime-high' : 'regime-normal';

    // EU avg comparison helpers (only for country primaries)
    var euStats = null;
    var allCountryStats = [];
    if (isCountryPrimary) {
      var euAvgS = Analytics.getBenchmarkSeries(data, 'EU_AVG', state.dateRange);
      euStats = Analytics.computeStats(euAvgS);
      allCountryStats = data.countryOrder.map(function (iso) {
        return Analytics.computeStats(Analytics.getSeriesForCountry(data, iso, state.dateRange));
      });
    }

    function compareToEU(val, euVal) {
      if (val == null || euVal == null || euVal === 0) return null;
      var pct = (val - euVal) / Math.abs(euVal);
      if (pct > 0.05) return 'above';
      if (pct < -0.05) return 'below';
      return 'inline';
    }

    function percentileRank(val, allVals) {
      if (val == null || !allVals.length) return null;
      var pos = allVals.filter(function (v) { return v != null && v <= val; }).length;
      return Math.round((pos / allVals.length) * 100);
    }

    function euBadges(val, euVal, allVals) {
      if (!isCountryPrimary || val == null) return '';
      var cmp = compareToEU(val, euVal);
      if (!cmp) return '';
      var cmpCls = cmp === 'above' ? 'eu-compare-above' : cmp === 'below' ? 'eu-compare-below' : 'eu-compare-inline';
      var cmpLabel = cmp === 'above' ? '\u2191 ABOVE EU AVG' : cmp === 'below' ? '\u2193 BELOW EU AVG' : '\u2194 INLINE EU AVG';
      var pctHtml = '';
      if (allVals) {
        var pct = percentileRank(val, allVals.filter(function (v) { return v != null; }));
        if (pct != null) pctHtml = '<span class="percentile-badge">p' + pct + '</span>';
      }
      return '<span class="eu-compare-badge ' + cmpCls + '">' + cmpLabel + '</span>' + pctHtml;
    }

    // Spread vs benchmark (latest value)
    var spread = null;
    if (isCountryPrimary && state.primaryCountry !== state.benchmarkCountry) {
      var spreadSeries = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
      if (spreadSeries.length > 0) spread = spreadSeries[spreadSeries.length - 1].price;
    }

    var benchName = state.benchmarkCountry === 'EU_AVG'
      ? 'EU Average'
      : ((data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry);
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

    var allAvgs    = allCountryStats.map(function (s) { return s.avg; });
    var allMins    = allCountryStats.map(function (s) { return s.min; });
    var allMaxes   = allCountryStats.map(function (s) { return s.max; });
    var allStdDevs = allCountryStats.map(function (s) { return s.stdDev; });
    var allSpreads = isCountryPrimary ? data.countryOrder.map(function (iso) {
      var sp = Analytics.spreadToBenchmark(data, iso, 'EU_AVG', state.dateRange);
      return sp.length > 0 ? sp[sp.length - 1].price : null;
    }) : [];

    el.innerHTML = '<div class="kpi-inner">'
      + card('Latest Price',
          fmt(stats.latest) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          null,
          '<span class="regime-badge ' + regimeClass + '">' + (regime !== 'unknown' ? regime.toUpperCase() : '') + '</span>')
      + card('Average',
          fmt(stats.avg) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          euBadges(stats.avg, euStats && euStats.avg, allAvgs) || 'period avg')
      + card('Min',
          fmt(stats.min) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          euBadges(stats.min, euStats && euStats.min, allMins) || fmtDate(pt.troughDate))
      + card('Max',
          fmt(stats.max) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          euBadges(stats.max, euStats && euStats.max, allMaxes) || fmtDate(pt.peakDate))
      + card('Volatility (\u03c3)',
          fmt(stats.stdDev) + '<span class="kpi-unit"> ' + unitLabel + '</span>',
          euBadges(stats.stdDev, euStats && euStats.stdDev, allStdDevs) || 'std dev, period')
      + card(spreadLabel,
          '<span class="' + spreadClass + '">' + spreadVal + '</span><span class="kpi-unit"> ' + unitLabel + '</span>',
          euBadges(spread, 0, allSpreads) || (isCountryPrimary ? 'current vs benchmark' : 'benchmark N/A'))
      + '</div>';
  }

  // --------------------------------------------------------------------------
  // Main chart
  // --------------------------------------------------------------------------

  function renderMainChart(state, data) {
    var isCountryPrimary = data.countryOrder.indexOf(state.primaryCountry) !== -1;
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var aggMode = 'daily';
    var agg = Analytics.applyAggregation(series, aggMode);
    var percentileBandSeries = isCountryPrimary
      ? Analytics.computePercentileBand(data, state.dateRange, aggMode, data.countryOrder)
      : [];

    var euAvgSeries = [];
    if (isCountryPrimary) {
      euAvgSeries = Analytics.getBenchmarkSeries(data, 'EU_AVG', state.dateRange);
      euAvgSeries = Analytics.applyAggregation(euAvgSeries, aggMode);
    }

    var smoothedList = [30, 180].map(function (window) {
      return {
        name: window + 'd avg',
        type: window === 30 ? 'dashed' : 'dotted',
        data: Analytics.rollingAverage(series, window)
      };
    });

    var compIsos = isCountryPrimary
      ? state.comparisonCountries.filter(function (iso) { return iso !== state.primaryCountry; })
      : [];
    var compMap = compIsos.length > 0
      ? Analytics.getAlignedComparison(data, compIsos, state.dateRange)
      : null;

    // Aggregate comparison series too
    if (compMap) {
      var aggMap = {};
      Object.keys(compMap).forEach(function (iso) {
        aggMap[iso] = Analytics.applyAggregation(compMap[iso], aggMode);
      });
      compMap = aggMap;
    }

    var name = (data.countriesByIso[state.primaryCountry] || {}).name || state.primaryCountry;

    Charts.renderTimeSeries('chart-main', {
      primarySeries: agg,
      primaryName: name,
      primaryIso: state.primaryCountry,
      unitLabel: data.unitsByIso[state.primaryCountry] || 'EUR/MWh',
      comparisonMap: compMap,
      euAvgSeries: euAvgSeries,
      percentileBandSeries: percentileBandSeries,
      smoothedSeriesList: smoothedList,
      nonCoreLineType: 'dotted',
      comparisonLineType: 'solid',
      aggregation: aggMode
    });
  }

  // --------------------------------------------------------------------------
  // Ranking table
  // --------------------------------------------------------------------------

  function renderNews(state, data) {
    var el = document.getElementById('news-container');
    if (!el) return;

    var selected = [state.primaryCountry]
      .concat(state.comparisonCountries || [])
      .concat(state.benchmarkCountry && state.benchmarkCountry !== 'EU_AVG' ? [state.benchmarkCountry] : [])
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

    var countrySet = selected.map(function (iso) { return String(iso).toUpperCase(); });
    var items = (data.news || []).filter(function (n) {
      var tags = Array.isArray(n.country_tags) ? n.country_tags : [];
      if (countrySet.length === 0) return true;
      return tags.some(function (tag) { return countrySet.indexOf(String(tag).toUpperCase()) !== -1; });
    }).slice(0, 10);

    var rows = items.map(function (n) {
      var tags = Array.isArray(n.country_tags) ? n.country_tags.slice(0, 5) : [];
      var headline = escapeHtml(normalizeNewsText(n.headline || 'Untitled'));
      var summary = escapeHtml(normalizeNewsText(n.summary || ''));
      var url = escapeHtml(sanitizeExternalUrl(n.url));
      var source = escapeHtml(getNewsSourceLabel(n.url));
      var metaDate = escapeHtml(formatNewsDate(n.published_at));
      var score = typeof n.relevance_score === 'number' ? n.relevance_score.toFixed(2) : null;
      var tagHtml = tags.map(function (tag) {
        return '<span class="news-tag">' + escapeHtml(String(tag).toUpperCase()) + '</span>';
      }).join('');

      return '<li class="news-item">'
        + '<div class="news-item-head">'
        + '<span class="news-source-chip">' + source + '</span>'
        + '<span class="news-date">' + metaDate + '</span>'
        + (score ? '<span class="news-score">Score ' + score + '</span>' : '')
        + '</div>'
        + '<a class="news-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + headline + '</a>'
        + (summary ? '<p class="news-summary">' + summary + '</p>' : '')
        + (tagHtml ? '<div class="news-tags">' + tagHtml + '</div>' : '')
        + '</li>';
    }).join('');

    el.innerHTML = '<div class="panel-title">News Feed<span class="panel-subtitle">Country-tagged stories for selected markets</span></div>'
      + (rows ? '<ul class="news-list">' + rows + '</ul>' : '<p class="news-empty muted small">No relevant news.</p>');
  }

  function renderHeatmap(state, data) {
    var el = document.getElementById('heatmap-container');
    if (!el) return;

    function resolveWindow(code, endDateStr) {
      var endDate = new Date(endDateStr + 'T00:00:00Z');
      var startDate = new Date(endDate.getTime());
      if (code === 'CURRENT') {
        return { start: endDateStr, end: endDateStr, metricLabel: 'Latest Price' };
      }
      if (code === '7D') {
        startDate.setDate(startDate.getDate() - 6);
        return { start: startDate.toISOString().slice(0, 10), end: endDateStr, metricLabel: '7d Avg' };
      }
      if (code === '30D') {
        startDate.setDate(startDate.getDate() - 29);
        return { start: startDate.toISOString().slice(0, 10), end: endDateStr, metricLabel: '30d Avg' };
      }
      if (code === 'YTD') {
        return { start: endDateStr.slice(0, 4) + '-01-01', end: endDateStr, metricLabel: 'YTD Avg' };
      }
      return { start: data.earliestDate, end: endDateStr, metricLabel: 'All Period Avg' };
    }

    var windowCode = state.mapWindow || 'CURRENT';
    var end = state.dateRange.end || data.latestDate;
    var win = resolveWindow(windowCode, end);
    var start = win.start;
    var metricLabel = win.metricLabel;

    var values = [];
    var countries = data.countryOrder.map(function (iso) {
      var s = (data.seriesByIso[iso] || []).filter(function (r) { return r.dateString >= start && r.dateString <= end; });
      if (s.length === 0) return { iso: iso, value: null, observations: 0, endDate: end };
      var value = windowCode === 'CURRENT'
        ? s[s.length - 1].price
        : (s.reduce(function (a, b) { return a + b.price; }, 0) / s.length);
      values.push(value);
      return { iso: iso, value: value, observations: s.length, endDate: end };
    });

    var toggles = [
      { key: 'CURRENT', label: 'Current' },
      { key: '7D', label: '7d Avg' },
      { key: '30D', label: '30d Avg' },
      { key: 'YTD', label: 'YTD' },
      { key: 'ALL', label: 'All' }
    ].map(function (t) {
      var active = (t.key === windowCode) ? ' btn-pill--active' : '';
      return '<button class="btn-pill' + active + '" data-map-window="' + t.key + '">' + t.label + '</button>';
    }).join('');
    var coverage = countries.filter(function (r) { return r.value != null; }).length;
    var total = countries.length;

    el.innerHTML = '<div class="panel-title">Europe Price Map<span class="panel-subtitle">Europe - ' + metricLabel + ' (EUR/MWh)</span><div class="heatmap-toolbar">' + toggles + '</div></div>'
      + '<div class="heatmap-panel">'
      + '<div class="heatmap-summary small muted">Window: ' + windowCode + ' ending ' + end + ' • Coverage: ' + coverage + '/' + total + ' markets</div>'
      + '<div class="europe-map-shell">'
      + '<div id="chart-heatmap-map" class="chart-canvas chart-heatmap-map" role="img" aria-label="Europe power price heatmap map"></div>'
      + '</div>'
      + '</div>';

    var labelByIso = {};
    data.countryOrder.forEach(function (iso) {
      labelByIso[iso] = ((data.countriesByIso[iso] || {}).name || iso);
    });
    Charts.renderPowerHeatmapMap('chart-heatmap-map', {
      countries: countries,
      labelByIso: labelByIso,
      primaryIso: state.primaryCountry,
      unitLabel: 'EUR/MWh',
      metricLabel: metricLabel
    });
  }

  function renderRanking(state, data) {
    var el = document.getElementById('ranking-container');
    if (!el) return;

    var rankingDate = state.dateRange.end || data.latestDate;
    var rankings = Analytics.rankCountriesByDate(data, rankingDate, data.countryOrder);
    if (rankings.length === 0) {
      el.innerHTML = '<div class="panel-title">Country Ranking</div><p class="muted small">No data</p>';
      return;
    }

    var maxPrice = rankings[0].price;

    var rows = rankings.map(function (r, i) {
      var barW = maxPrice > 0 ? (r.price / maxPrice * 100).toFixed(1) : 0;
      var color = Charts.COUNTRY_COLORS[r.iso] || '#4f759b';
      var isPrimary = r.iso === state.primaryCountry;
      var unit = data.unitsByIso[r.iso] || 'EUR/MWh';
      return '<tr class="' + (isPrimary ? 'ranking-primary' : '') + '">'
        + '<td class="rank-pos">' + (i + 1) + '</td>'
        + '<td class="rank-name">' + r.name + '</td>'
        + '<td class="rank-bar-cell">'
        + '<div class="rank-bar-wrap">'
        + '<div class="rank-bar-fill" style="width:' + barW + '%;background:' + color + (isPrimary ? '' : ';opacity:0.5') + '"></div>'
        + '</div>'
        + '</td>'
        + '<td class="num rank-price"><span class="rank-price-value">' + fmt(r.price) + '</span><span class="rank-price-unit">' + unit + '</span></td>'
        + '</tr>';
    }).join('');

    el.innerHTML = '<div class="panel-title">Country Ranking<span class="panel-subtitle">Latest available price snapshot across tracked power markets</span></div>'
      + '<table class="ranking-table"><tbody>' + rows + '</tbody></table>';
  }

  // --------------------------------------------------------------------------
  // Spread chart
  // --------------------------------------------------------------------------

  function renderSpread(state, data) {
    var isCountryPrimary = data.countryOrder.indexOf(state.primaryCountry) !== -1;
    if (!isCountryPrimary) {
      setPanelTitle('chart-title-spread-power', 'Spread vs Benchmark', 'Not available for non-country selection');
      Charts.renderSpreadChart('chart-spread', [], 'Benchmark');
      return;
    }
    var benchName = state.benchmarkCountry === 'EU_AVG'
      ? 'EU Average'
      : ((data.countriesByIso[state.benchmarkCountry] || {}).name || state.benchmarkCountry);
    var spread = Analytics.spreadToBenchmark(data, state.primaryCountry, state.benchmarkCountry, state.dateRange);
    setPanelTitle('chart-title-spread-power', 'Spread vs Benchmark', 'Primary market minus ' + benchName);
    Charts.renderSpreadChart('chart-spread', spread, benchName);
  }

  // --------------------------------------------------------------------------
  // Distribution chart
  // --------------------------------------------------------------------------

  function renderDistribution(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var stats = Analytics.computeStats(series);
    var bins = Analytics.computeDistribution(series, 20);
    setPanelTitle('chart-title-dist-power', 'Price Distribution', 'Frequency profile for selected period');
    Charts.renderHistogram('chart-dist', bins, stats.latest, data.unitsByIso[state.primaryCountry] || 'EUR/MWh');
  }

  // --------------------------------------------------------------------------
  // Monthly summary chart
  // --------------------------------------------------------------------------

  function renderMonthlySummary(state, data) {
    var series = Analytics.getSeriesForCountry(data, state.primaryCountry, state.dateRange);
    var monthly = Analytics.aggregateMonthly(series);
    setPanelTitle('chart-title-monthly-power', 'Monthly Average Profile', 'Seasonality view of average monthly price');
    Charts.renderMonthlyBar('chart-monthly', monthly, state.primaryCountry, data.unitsByIso[state.primaryCountry] || 'EUR/MWh');
  }

  // --------------------------------------------------------------------------
  // Data quality warnings banner
  // --------------------------------------------------------------------------

  function renderWarningsBanner(data) {
    var el = document.getElementById('app-warnings');
    if (!el) return;
    var warnings = (data.meta && data.meta.warnings) || [];
    if (warnings.length === 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    var items = warnings.slice(0, 3).map(function (w) {
      return '<li class="warning-item small muted">' + escapeHtml(String(w)) + '</li>';
    }).join('');
    var more = warnings.length > 3 ? '<li class="warning-item small muted">… and ' + (warnings.length - 3) + ' more</li>' : '';
    el.innerHTML = '<div class="warning-banner">'
      + '<div class="warning-header">⚠ Data Quality Notice</div>'
      + '<ul class="warning-list">' + items + more + '</ul>'
      + '</div>';
  }

  return {
    initControls: initControls,
    syncControls: syncControls,
    renderKPIs: renderKPIs,
    renderMainChart: renderMainChart,
    renderRanking: renderRanking,
    renderNews: renderNews,
    renderHeatmap: renderHeatmap,
    renderSpread: renderSpread,
    renderDistribution: renderDistribution,
    renderMonthlySummary: renderMonthlySummary,
    renderWarningsBanner: renderWarningsBanner
  };
}());
