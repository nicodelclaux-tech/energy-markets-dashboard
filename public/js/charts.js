// ECharts wrappers. Each function manages its own instance lifecycle.
// Instances are stored by DOM id so setOption() updates in-place on re-render.
var Charts = (function () {

  var _instances = {};

  // Country-consistent colour palette
  var COUNTRY_COLORS = {
    ES: '#4f7f5e',
    DE: '#4f759b',
    FR: '#83b692',
    IT: '#006daa',
    GB: '#3a4a6a',
    NL: '#3e90bf',
    NO: '#6f92b5',
    SE: '#1c2a4a',
    FI: '#a3cbb0',
    DK: '#c23a38'
  };
  var FALLBACK_COLORS = ['#4f759b', '#4f7f5e', '#83b692', '#006daa', '#3a4a6a', '#3e90bf'];

  // --- Instance management ------------------------------------------------------

  function _get(id) {
    var dom = document.getElementById(id);
    if (!dom) return null;
    if (_instances[id] && !_instances[id].isDisposed()) {
      return _instances[id];
    }
    _instances[id] = echarts.init(dom, null, { renderer: 'canvas' });
    return _instances[id];
  }

  function resizeAll() {
    Object.keys(_instances).forEach(function (id) {
      if (_instances[id] && !_instances[id].isDisposed()) {
        _instances[id].resize();
      }
    });
  }

  function _theme() {
    var css = getComputedStyle(document.body);
    var border = css.getPropertyValue('--border').trim() || '#30363d';
    var muted = css.getPropertyValue('--muted').trim() || '#7d8590';
    var text = css.getPropertyValue('--text').trim() || '#c9d1d9';
    var surface = css.getPropertyValue('--surface').trim() || '#161b22';
    var accent = css.getPropertyValue('--accent').trim() || '#4a9ebb';
    var accentSoft = css.getPropertyValue('--accent-soft').trim() || 'rgba(74, 158, 187, 0.06)';
    var accentFill = css.getPropertyValue('--accent-fill').trim() || 'rgba(74, 158, 187, 0.14)';
    var accentStrong = css.getPropertyValue('--accent-strong').trim() || 'rgba(74, 158, 187, 0.55)';
    var highlight = css.getPropertyValue('--highlight').trim() || '#d4a017';
    var highlightSoft = css.getPropertyValue('--highlight-soft').trim() || 'rgba(212, 160, 23, 0.08)';
    return {
      border: border,
      muted: muted,
      text: text,
      surface: surface,
      accent: accent,
      accentSoft: accentSoft,
      accentFill: accentFill,
      accentStrong: accentStrong,
      highlight: highlight,
      highlightSoft: highlightSoft,
      splitLine: { lineStyle: { color: border } },
      axisLabel: { color: muted, fontSize: 11, fontFamily: 'inherit' },
      tooltip: {
        backgroundColor: surface,
        borderColor: border,
        borderWidth: 1,
        textStyle: { color: text, fontFamily: 'inherit', fontSize: 12 }
      }
    };
  }

  function _fmtVal(n) {
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n);
    return r < 0 ? '(' + Math.abs(r) + ')' : String(r);
  }

  // --- Time series chart --------------------------------------------------------

  function renderTimeSeries(containerId, opts) {
    // opts: { primarySeries, primaryName, primaryIso,
    //         comparisonMap (iso -> series), smoothedSeries, smoothingWindow,
    //         aggregation }
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();

    var series = [];
    var legendData = [];
    var colorIdx = 0;

    var primaryColor = COUNTRY_COLORS[opts.primaryIso] || FALLBACK_COLORS[0];

    if (opts.percentileBandSeries && opts.percentileBandSeries.length > 0) {
      series.push({
        name: '__iqr_base__',
        type: 'line',
        stack: 'iqr-band',
        data: opts.percentileBandSeries.map(function (r) {
          var x = opts.aggregation === 'yearly' ? r.dateString.slice(0, 4) : r.dateString;
          return [x, Math.round(r.p25)];
        }),
        symbol: 'none',
        silent: true,
        tooltip: { show: false },
        emphasis: { disabled: true },
        lineStyle: { width: 0, opacity: 0 },
        itemStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        z: 0
      });
      series.push({
        name: '__iqr_fill__',
        type: 'line',
        stack: 'iqr-band',
        data: opts.percentileBandSeries.map(function (r) {
          var x = opts.aggregation === 'yearly' ? r.dateString.slice(0, 4) : r.dateString;
          return [x, Math.max(0, Math.round(r.p75) - Math.round(r.p25))];
        }),
        symbol: 'none',
        silent: true,
        tooltip: { show: false },
        emphasis: { disabled: true },
        lineStyle: { width: 0, opacity: 0 },
        itemStyle: { opacity: 0 },
        areaStyle: { color: t.accentSoft },
        z: 0
      });
    }

    if (opts.primarySeries && opts.primarySeries.length > 0) {
      var primaryName = opts.primaryName || opts.primaryIso || 'Primary';
      series.push({
        name: primaryName,
        type: opts.aggregation === 'yearly' ? 'bar' : 'line',
        data: opts.primarySeries.map(function (r) {
          var x = opts.aggregation === 'yearly' ? (r.label || r.dateString.slice(0, 4)) : r.dateString;
          return [x, Math.round(r.price)];
        }),
        symbol: 'none',
        lineStyle: { width: 2, color: primaryColor },
        itemStyle: { color: primaryColor },
        barMaxWidth: 40,
        z: 3
      });
      legendData.push(primaryName);
      colorIdx++;
    }

    // EU average overlay for context
    if (opts.euAvgSeries && opts.euAvgSeries.length > 0) {
      series.push({
        name: 'EU Avg',
        type: opts.aggregation === 'yearly' ? 'line' : 'line',
        data: opts.euAvgSeries.map(function (r) {
          var x = opts.aggregation === 'yearly' ? (r.label || r.dateString.slice(0, 4)) : r.dateString;
          return [x, Math.round(r.price)];
        }),
        symbol: 'none',
        lineStyle: { width: 1.4, color: t.muted, type: 'solid', opacity: 0.9 },
        itemStyle: { color: t.muted },
        z: 2
      });
      legendData.push('EU Avg');
    }

    // Smoothing overlay (only for daily aggregation)
    if (opts.smoothedSeries && opts.smoothedSeries.length > 0 && opts.smoothingWindow > 0 && opts.aggregation === 'daily') {
      series.push({
        name: opts.smoothingWindow + 'd avg',
        type: 'line',
        data: opts.smoothedSeries.map(function (r) { return [r.dateString, Math.round(r.price)]; }),
        symbol: 'none',
        lineStyle: { width: 1.5, color: t.text, opacity: 0.35, type: 'dashed' },
        itemStyle: { color: t.text },
        z: 2
      });
      legendData.push(opts.smoothingWindow + 'd avg');
    }

    // Comparison countries
    if (opts.comparisonMap) {
      Object.keys(opts.comparisonMap).forEach(function (iso) {
        var s = opts.comparisonMap[iso];
        if (!s || s.length === 0) return;
        var c = COUNTRY_COLORS[iso] || FALLBACK_COLORS[colorIdx % FALLBACK_COLORS.length];
        series.push({
          name: iso,
          type: opts.aggregation === 'yearly' ? 'bar' : 'line',
          data: s.map(function (r) {
            var x = opts.aggregation === 'yearly' ? (r.label || r.dateString.slice(0, 4)) : r.dateString;
            return [x, Math.round(r.price)];
          }),
          symbol: 'none',
          lineStyle: { width: 1.5, color: c },
          itemStyle: { color: c },
          barMaxWidth: 40,
          z: 2
        });
        legendData.push(iso);
        colorIdx++;
      });
    }

    var xAxisType = opts.aggregation === 'yearly' ? 'category' : 'time';
    var xAxisData = opts.aggregation === 'yearly'
      ? (opts.primarySeries || []).map(function (r) { return r.label || r.dateString.slice(0, 4); })
      : undefined;

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Price Trend (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 62, right: 20, top: 36, bottom: 56 },
      tooltip: Object.assign({
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { type: 'dashed', color: t.border } },
        formatter: function (params) {
          if (!params || !params.length) return '';
          var visibleParams = params.filter(function (p) { return p.seriesName && p.seriesName.indexOf('__') !== 0; });
          var headerSource = visibleParams[0] || params[0];
          var header = headerSource.axisValueLabel || headerSource.axisValue || '';
          var lines = visibleParams.map(function (p) { return p.marker + ' ' + p.seriesName + ': ' + _fmtVal(p.value[1]); });
          return [header].concat(lines).join('<br/>');
        }
      }, t.tooltip),
      legend: {
        show: legendData.length > 1,
        data: legendData,
        icon: 'circle',
        top: 4,
        right: 20,
        textStyle: { color: t.muted, fontSize: 11 },
        inactiveColor: t.border
      },
      xAxis: {
        type: xAxisType,
        data: xAxisData,
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { lineStyle: { color: t.border } },
        axisLabel: t.axisLabel,
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: Object.assign({}, t.axisLabel, { formatter: _fmtVal }),
        splitLine: t.splitLine
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 10, borderColor: t.border, fillerColor: t.accentFill, handleSize: 10 }
      ],
      series: series
    }, true);
  }

  // --- Spread chart -------------------------------------------------------------

  function renderSpreadChart(containerId, spreadSeries, benchmarkName) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();

    if (!spreadSeries || spreadSeries.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: 'Spread vs ' + (benchmarkName || 'Benchmark') + ' (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
        series: [],
        xAxis: { type: 'time' },
        yAxis: { type: 'value' }
      }, true);
      return;
    }

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Spread vs ' + (benchmarkName || 'Benchmark') + ' (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 54, right: 10, top: 34, bottom: 34 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) {
          if (!params || !params.length) return '';
          var p = params[0];
          return (p.axisValueLabel || p.axisValue || '') + '<br/>' + p.marker + ' Spread: ' + _fmtVal(p.value[1]);
        }
      }, t.tooltip),
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: t.border } },
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10 }),
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10, formatter: _fmtVal }),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: t.splitLine
      },
      series: [{
        type: 'line',
        data: spreadSeries.map(function (r) { return [r.dateString, Math.round(r.price)]; }),
        symbol: 'none',
        lineStyle: { width: 1.5, color: t.highlight },
        areaStyle: { color: t.highlightSoft },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: t.border, type: 'dashed' } }
      }]
    }, true);
  }

  // --- Distribution histogram ---------------------------------------------------

  function renderHistogram(containerId, bins, currentPrice) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();

    if (!bins || bins.length === 0) {
      chart.setOption({ backgroundColor: 'transparent', series: [], xAxis: { type: 'category', data: [] }, yAxis: { type: 'value' } }, true);
      return;
    }

    var labels = bins.map(function (b) { return b.lo.toFixed(0); });
    var data = bins.map(function (b, i) {
      // Highlight the bin containing the current price
      var highlight = currentPrice != null && currentPrice >= b.lo && currentPrice < b.hi;
      return {
        value: b.count,
        itemStyle: { color: highlight ? t.highlight : t.accentStrong }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Price Distribution (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 36, right: 10, top: 34, bottom: 34 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) { return _fmtVal(bins[params[0].dataIndex].lo) + '–' + _fmtVal(bins[params[0].dataIndex].hi) + ' EUR/MWh<br/>Days: ' + params[0].value; }
      }, t.tooltip),
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 9, interval: Math.floor(bins.length / 5) }),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10 }),
        splitLine: t.splitLine,
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{ type: 'bar', data: data, barCategoryGap: '2%' }]
    }, true);
  }

  // --- Monthly summary bar chart ------------------------------------------------

  function renderMonthlyBar(containerId, series, iso) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();

    if (!series || series.length === 0) {
      chart.setOption({ backgroundColor: 'transparent', series: [] }, true);
      return;
    }

    var color = COUNTRY_COLORS[iso] || '#4f759b';
    var labels = series.map(function (r) { return r.dateString.slice(0, 7); });
    var values = series.map(function (r) { return Math.round(r.price); });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Monthly Average (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 4, left: 10 },
      grid: { left: 54, right: 16, top: 30, bottom: 36 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) {
          if (!params || !params.length) return '';
          var p = params[0];
          return (p.axisValueLabel || p.axisValue || '') + '<br/>' + p.marker + ' Avg: ' + _fmtVal(p.value) + ' EUR/MWh';
        }
      }, t.tooltip),
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10, rotate: 30 }),
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10, formatter: _fmtVal }),
        splitLine: t.splitLine,
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        data: values.map(function (v) { return { value: v, itemStyle: { color: color, opacity: 0.75 } }; }),
        barMaxWidth: 32
      }]
    }, true);
  }

  return {
    COUNTRY_COLORS: COUNTRY_COLORS,
    renderTimeSeries: renderTimeSeries,
    renderSpreadChart: renderSpreadChart,
    renderHistogram: renderHistogram,
    renderMonthlyBar: renderMonthlyBar,
    resizeAll: resizeAll
  };
}());
