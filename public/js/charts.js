// ECharts wrappers. Each function manages its own instance lifecycle.
// Instances are stored by DOM id so setOption() updates in-place on re-render.
var Charts = (function () {

  var _instances = {};

  // Country-consistent colour palette
  var COUNTRY_COLORS = {
    ES: '#d4a017',
    DE: '#4a9ebb',
    FR: '#3ea669',
    IT: '#e05252',
    GB: '#a371f7',
    NL: '#f0883e'
  };
  var FALLBACK_COLORS = ['#4a9ebb', '#d4a017', '#3ea669', '#e05252', '#a371f7', '#f0883e'];

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

  // Shared tooltip / axis style fragments
  var _tooltipStyle = {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
    borderWidth: 1,
    textStyle: { color: '#c9d1d9', fontFamily: 'inherit', fontSize: 12 }
  };

  var _axisLabelStyle = { color: '#7d8590', fontSize: 11, fontFamily: 'inherit' };
  var _splitLine = { lineStyle: { color: '#21262d' } };

  // --- Time series chart --------------------------------------------------------

  function renderTimeSeries(containerId, opts) {
    // opts: { primarySeries, primaryName, primaryIso,
    //         comparisonMap (iso -> series), smoothedSeries, smoothingWindow,
    //         aggregation }
    var chart = _get(containerId);
    if (!chart) return;

    var series = [];
    var colorIdx = 0;

    var primaryColor = COUNTRY_COLORS[opts.primaryIso] || FALLBACK_COLORS[0];

    if (opts.primarySeries && opts.primarySeries.length > 0) {
      series.push({
        name: opts.primaryName || opts.primaryIso || 'Primary',
        type: opts.aggregation === 'yearly' ? 'bar' : 'line',
        data: opts.primarySeries.map(function (r) {
          var x = opts.aggregation === 'yearly' ? (r.label || r.dateString.slice(0, 4)) : r.dateString;
          return [x, +r.price.toFixed(2)];
        }),
        symbol: 'none',
        lineStyle: { width: 2, color: primaryColor },
        itemStyle: { color: primaryColor },
        barMaxWidth: 40
      });
      colorIdx++;
    }

    // Smoothing overlay (only for daily aggregation)
    if (opts.smoothedSeries && opts.smoothedSeries.length > 0 && opts.smoothingWindow > 0 && opts.aggregation === 'daily') {
      series.push({
        name: opts.smoothingWindow + 'd avg',
        type: 'line',
        data: opts.smoothedSeries.map(function (r) { return [r.dateString, +r.price.toFixed(2)]; }),
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#ffffff', opacity: 0.35, type: 'dashed' },
        itemStyle: { color: '#ffffff' }
      });
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
            return [x, +r.price.toFixed(2)];
          }),
          symbol: 'none',
          lineStyle: { width: 1.5, color: c },
          itemStyle: { color: c },
          barMaxWidth: 40
        });
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
      grid: { left: 62, right: 20, top: 36, bottom: 38 },
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'cross', lineStyle: { type: 'dashed', color: '#30363d' } } }, _tooltipStyle),
      legend: {
        show: series.length > 1,
        top: 4,
        right: 20,
        textStyle: { color: '#7d8590', fontSize: 11 },
        inactiveColor: '#333'
      },
      xAxis: {
        type: xAxisType,
        data: xAxisData,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisTick: { lineStyle: { color: '#30363d' } },
        axisLabel: _axisLabelStyle,
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'EUR/MWh',
        nameTextStyle: Object.assign({ align: 'right', padding: [0, 6, 0, 0] }, _axisLabelStyle),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: _axisLabelStyle,
        splitLine: _splitLine
      },
      series: series
    }, true);
  }

  // --- Spread chart -------------------------------------------------------------

  function renderSpreadChart(containerId, spreadSeries, benchmarkName) {
    var chart = _get(containerId);
    if (!chart) return;

    if (!spreadSeries || spreadSeries.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: 'Spread vs ' + (benchmarkName || 'Benchmark'), textStyle: { color: '#7d8590', fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
        series: [],
        xAxis: { type: 'time' },
        yAxis: { type: 'value' }
      }, true);
      return;
    }

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Spread vs ' + (benchmarkName || 'Benchmark'), textStyle: { color: '#7d8590', fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 54, right: 10, top: 34, bottom: 34 },
      tooltip: Object.assign({ trigger: 'axis' }, _tooltipStyle),
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 10 }),
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'EUR/MWh',
        nameTextStyle: Object.assign({ align: 'right' }, _axisLabelStyle, { fontSize: 10 }),
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 10 }),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: _splitLine
      },
      series: [{
        type: 'line',
        data: spreadSeries.map(function (r) { return [r.dateString, +r.price.toFixed(2)]; }),
        symbol: 'none',
        lineStyle: { width: 1.5, color: '#d4a017' },
        areaStyle: { color: 'rgba(212, 160, 23, 0.08)' },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0 }], lineStyle: { color: '#30363d', type: 'dashed' } }
      }]
    }, true);
  }

  // --- Distribution histogram ---------------------------------------------------

  function renderHistogram(containerId, bins, currentPrice) {
    var chart = _get(containerId);
    if (!chart) return;

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
        itemStyle: { color: highlight ? '#d4a017' : 'rgba(74, 158, 187, 0.55)' }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Price Distribution', textStyle: { color: '#7d8590', fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 36, right: 10, top: 34, bottom: 34 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) { return bins[params[0].dataIndex].lo.toFixed(1) + '–' + bins[params[0].dataIndex].hi.toFixed(1) + ' EUR/MWh<br/>Days: ' + params[0].value; }
      }, _tooltipStyle),
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 9, interval: Math.floor(bins.length / 5) }),
        axisLine: { lineStyle: { color: '#30363d' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 10 }),
        splitLine: _splitLine,
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

    if (!series || series.length === 0) {
      chart.setOption({ backgroundColor: 'transparent', series: [] }, true);
      return;
    }

    var color = COUNTRY_COLORS[iso] || '#4a9ebb';
    var labels = series.map(function (r) { return r.dateString.slice(0, 7); });
    var values = series.map(function (r) { return +r.price.toFixed(2); });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Monthly Average', textStyle: { color: '#7d8590', fontSize: 11, fontWeight: 'normal' }, top: 4, left: 10 },
      grid: { left: 54, right: 16, top: 30, bottom: 36 },
      tooltip: Object.assign({ trigger: 'axis' }, _tooltipStyle),
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 10, rotate: 30 }),
        axisLine: { lineStyle: { color: '#30363d' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'EUR/MWh',
        nameTextStyle: Object.assign({ align: 'right' }, _axisLabelStyle, { fontSize: 10 }),
        axisLabel: Object.assign({}, _axisLabelStyle, { fontSize: 10 }),
        splitLine: _splitLine,
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
