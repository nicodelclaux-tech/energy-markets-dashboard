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
    DK: '#c23a38',
    WTI: '#006daa',
    Brent: '#3e90bf',
    TTF: '#4f7f5e',
    HENRY_HUB: '#6f92b5',
    GOLD: '#b9890d'
  };
  var FALLBACK_COLORS = ['#4f759b', '#4f7f5e', '#83b692', '#006daa', '#3a4a6a', '#3e90bf'];
  var ISO_TO_WORLD_NAME = {
    AT: 'Austria',
    BE: 'Belgium',
    CH: 'Switzerland',
    CZ: 'Czech Republic',
    DE: 'Germany',
    DK: 'Denmark',
    ES: 'Spain',
    FI: 'Finland',
    FR: 'France',
    GB: 'United Kingdom',
    GR: 'Greece',
    HU: 'Hungary',
    IE: 'Ireland',
    IT: 'Italy',
    NL: 'Netherlands',
    NO: 'Norway',
    PL: 'Poland',
    PT: 'Portugal',
    RO: 'Romania',
    SE: 'Sweden',
    SI: 'Slovenia',
    SK: 'Slovakia'
  };
  var POWER_MAP_KEY = 'emd-power-europe-map-v1';
  var _powerMapRegistered = false;
  var POWER_MAP_SVG = ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 10 460 430">'
    + '<path d="M92 136 L110 118 L152 94 L208 104 L250 126 L276 118 L320 72 L352 78 L404 98 L432 132 L440 170 L426 210 L408 238 L388 254 L364 250 L350 258 L330 282 L344 312 L372 356 L390 398 L356 402 L326 352 L298 292 L264 298 L240 290 L212 302 L178 370 L126 366 L98 322 L102 284 L150 246 L188 218 L202 182 L178 156 L134 160 Z" fill="rgba(79,117,155,0.06)" stroke="rgba(79,117,155,0.14)" stroke-width="1.5"/>'
    + '<path name="IE" d="M108 144 L98 154 L100 170 L112 178 L122 168 L120 150 Z"/>'
    + '<path name="GB" d="M140 120 L128 136 L132 160 L148 176 L162 168 L168 144 L160 126 Z"/>'
    + '<path name="PT" d="M122 298 L112 314 L118 336 L128 350 L138 338 L136 312 Z"/>'
    + '<path name="ES" d="M138 292 L128 306 L132 340 L160 356 L204 348 L220 322 L212 294 L178 284 Z"/>'
    + '<path name="FR" d="M214 218 L198 242 L206 276 L236 296 L270 286 L286 256 L274 224 L242 210 Z"/>'
    + '<path name="BE" d="M270 210 L262 220 L266 232 L278 234 L286 224 L282 212 Z"/>'
    + '<path name="NL" d="M282 182 L276 194 L280 208 L292 210 L300 196 L296 182 Z"/>'
    + '<path name="DE" d="M302 188 L286 204 L292 242 L318 260 L346 246 L352 214 L334 186 Z"/>'
    + '<path name="DK" d="M316 154 L306 164 L310 176 L324 178 L334 170 L330 156 Z"/>'
    + '<path name="NO" d="M320 58 L302 88 L304 126 L320 146 L338 128 L342 92 L336 60 Z"/>'
    + '<path name="SE" d="M348 92 L336 118 L344 168 L366 176 L382 138 L378 100 Z"/>'
    + '<path name="FI" d="M392 110 L382 132 L386 170 L410 176 L430 150 L422 116 Z"/>'
    + '<path name="CH" d="M300 260 L292 266 L298 274 L314 274 L320 266 L314 258 Z"/>'
    + '<path name="AT" d="M322 254 L310 264 L320 276 L350 274 L366 262 L354 250 Z"/>'
    + '<path name="IT" d="M334 276 L322 294 L328 318 L346 340 L362 366 L376 392 L396 392 L386 366 L372 340 L386 316 L376 290 L356 274 Z"/>'
    + '<path name="PL" d="M362 184 L348 198 L354 234 L384 242 L404 224 L400 192 Z"/>'
    + '</svg>';

  // --- Instance management ------------------------------------------------------

  function _get(id) {
    var dom = document.getElementById(id);
    if (!dom) return null;
    if (_instances[id] && !_instances[id].isDisposed()) {
      return _instances[id];
    }
    try {
      _instances[id] = echarts.init(dom, null, { renderer: 'canvas' });
      return _instances[id];
    } catch (err) {
      dom.innerHTML = '<div class="chart-empty-state">Chart unavailable</div>';
      return null;
    }
  }

  function _renderMessage(containerId, title, message) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    chart.setOption({
      backgroundColor: 'transparent',
      title: title ? { text: title, textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 } : { show: false },
      xAxis: { show: false, type: 'category', data: [] },
      yAxis: { show: false, type: 'value' },
      series: [],
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: {
          text: message,
          fill: t.muted,
          fontSize: 12,
          fontFamily: 'inherit',
          textAlign: 'center'
        }
      }]
    }, true);
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
      splitLine: { show: false },
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

  function _ensurePowerMapRegistered() {
    if (_powerMapRegistered) return POWER_MAP_KEY;

    if (typeof EuropeMap !== 'undefined'
      && EuropeMap.ensureRegistered
      && EuropeMap.ensureRegistered()) {
      POWER_MAP_KEY = EuropeMap.getMapKey ? EuropeMap.getMapKey() : POWER_MAP_KEY;
      _powerMapRegistered = true;
      return POWER_MAP_KEY;
    }

    try {
      echarts.registerMap(POWER_MAP_KEY, { svg: POWER_MAP_SVG });
      _powerMapRegistered = true;
      return POWER_MAP_KEY;
    } catch (err) {
      return null;
    }
  }

  // --- Time series chart --------------------------------------------------------

  function renderTimeSeries(containerId, opts) {
    // opts: { primarySeries, primaryName, primaryIso,
    //         comparisonMap (iso -> series), smoothedSeriesList,
    //         aggregation }
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    var unitLabel = opts.unitLabel || 'EUR/MWh';

    if ((!opts.primarySeries || opts.primarySeries.length === 0)
      && (!opts.comparisonMap || Object.keys(opts.comparisonMap).length === 0)
      && (!opts.euAvgSeries || opts.euAvgSeries.length === 0)) {
      _renderMessage(containerId, 'Price Trend (' + unitLabel + ')', 'No data for selected period');
      return;
    }

    var series = [];
    var legendData = [];
    var colorIdx = 0;

    var primaryColor = COUNTRY_COLORS[opts.primaryIso] || FALLBACK_COLORS[0];
    var nonCoreLineType = opts.nonCoreLineType || 'dotted';
    var comparisonLineType = opts.comparisonLineType || nonCoreLineType;

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
        areaStyle: { color: t.accentFill },
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
        lineStyle: { width: 1.4, color: t.muted, type: nonCoreLineType, opacity: 0.9 },
        itemStyle: { color: t.muted },
        z: 2
      });
      legendData.push('EU Avg');
    }

    // Smoothing overlays (only for daily aggregation)
    if (opts.smoothedSeriesList && opts.smoothedSeriesList.length > 0 && opts.aggregation === 'daily') {
      opts.smoothedSeriesList.forEach(function (smoothCfg, idx) {
        var smoothData = smoothCfg.data || [];
        if (smoothData.length === 0) return;
        var name = smoothCfg.name || ('smooth ' + (idx + 1));
        series.push({
          name: name,
          type: 'line',
          data: smoothData.map(function (r) { return [r.dateString, Math.round(r.price)]; }),
          symbol: 'none',
          lineStyle: {
            width: 1.4,
            color: t.text,
            opacity: idx === 0 ? 0.5 : 0.3,
            type: smoothCfg.type || nonCoreLineType
          },
          itemStyle: { color: t.text },
          z: 2
        });
        legendData.push(name);
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
            return [x, Math.round(r.price)];
          }),
          symbol: 'none',
          lineStyle: { width: 1.6, color: c, type: comparisonLineType },
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
      title: { text: 'Price Trend (' + unitLabel + ')', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
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
        icon: 'path://M2 7 L14 7',
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
      _renderMessage(containerId, 'Spread vs ' + (benchmarkName || 'Benchmark') + ' (EUR/MWh)', 'No spread data for selected period');
      return;
    }

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Spread vs ' + (benchmarkName || 'Benchmark') + ' (EUR/MWh)', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 54, right: 10, top: 34, bottom: 56 },
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
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 10, borderColor: t.border, fillerColor: t.accentFill, handleSize: 10 }
      ],
      series: [{
        type: 'line',
        data: spreadSeries.map(function (r) { return [r.dateString, Math.round(r.price)]; }),
        symbol: 'none',
        lineStyle: { width: 1.8, color: '#005a8c' },
        areaStyle: { color: 'rgba(0, 109, 170, 0.12)' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          data: [{ yAxis: 0 }],
          lineStyle: { color: t.border, type: 'dashed' }
        }
      }]
    }, true);
  }

  // --- Distribution histogram ---------------------------------------------------

  function renderHistogram(containerId, bins, currentPrice, unitLabel) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    var unit = unitLabel || 'EUR/MWh';

    if (!bins || bins.length === 0) {
      _renderMessage(containerId, 'Price Distribution (' + unit + ')', 'No distribution data for selected period');
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
      title: { text: 'Price Distribution (' + unit + ')', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 6, left: 10 },
      grid: { left: 36, right: 10, top: 34, bottom: 56 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) { return _fmtVal(bins[params[0].dataIndex].lo) + '–' + _fmtVal(bins[params[0].dataIndex].hi) + ' ' + unit + '<br/>Days: ' + params[0].value; }
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
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 10, borderColor: t.border, fillerColor: t.accentFill, handleSize: 10 }
      ],
      series: [{ type: 'bar', data: data, barCategoryGap: '2%' }]
    }, true);
  }

  // --- Monthly summary bar chart ------------------------------------------------

  function renderMonthlyBar(containerId, series, iso, unitLabel) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    var unit = unitLabel || 'EUR/MWh';

    if (!series || series.length === 0) {
      _renderMessage(containerId, 'Monthly Average (' + unit + ')', 'No monthly data for selected period');
      return;
    }

    var color = COUNTRY_COLORS[iso] || '#4f759b';
    var values = series.map(function (r) { return [r.dateString, Math.round(r.price)]; });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      title: { text: 'Monthly Average (' + unit + ')', textStyle: { color: t.muted, fontSize: 11, fontWeight: 'normal' }, top: 4, left: 10 },
      grid: { left: 54, right: 16, top: 30, bottom: 56 },
      tooltip: Object.assign({
        trigger: 'axis',
        formatter: function (params) {
          if (!params || !params.length) return '';
          var p = params[0];
          return (p.axisValueLabel || p.axisValue || '') + '<br/>' + p.marker + ' Avg: ' + _fmtVal(p.value[1]) + ' ' + unit;
        }
      }, t.tooltip),
      xAxis: {
        type: 'time',
        axisLabel: Object.assign({}, t.axisLabel, { fontSize: 10 }),
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
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, height: 18, bottom: 10, borderColor: t.border, fillerColor: t.accentFill, handleSize: 10 }
      ],
      series: [{
        type: 'bar',
        data: values.map(function (v) { return { value: v, itemStyle: { color: color, opacity: 0.75 } }; }),
        barMaxWidth: 32
      }]
    }, true);
  }

  // --- Europe country heatmap (Power Markets) ---------------------------------

  function renderPowerHeatmapMap(containerId, opts) {
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    var mapKey = _ensurePowerMapRegistered();
    var mapLayout = (typeof EuropeMap !== 'undefined' && EuropeMap.getLayout)
      ? EuropeMap.getLayout()
      : null;

    if (!mapKey) {
      _renderMessage(containerId, 'Europe Price Map', 'Map assets unavailable');
      return;
    }

    var countries = (opts && opts.countries) || [];
    var unit = (opts && opts.unitLabel) || 'EUR/MWh';
    var metricLabel = (opts && opts.metricLabel) || 'Latest';
    var labelByIso = (opts && opts.labelByIso) || {};
    var primaryIso = (opts && opts.primaryIso) || null;

    var values = countries
      .map(function (r) { return r && r.value != null ? r.value : null; })
      .filter(function (v) { return v != null && !isNaN(v); });

    var hasData = values.length > 0;
    var min = hasData ? Math.min.apply(null, values) : 0;
    var max = hasData ? Math.max.apply(null, values) : 1;

    var mapData = countries.map(function (row) {
      var hasValue = row && row.value != null && !isNaN(row.value);
      var style = null;
      if (row && row.iso === primaryIso) {
        style = {
          borderColor: '#6b1f2b',
          borderWidth: 2.6
        };
      }
      var countryName = (typeof EuropeMap !== 'undefined' && EuropeMap.getGeoNameByIso)
        ? EuropeMap.getGeoNameByIso(row.iso, ISO_TO_WORLD_NAME[row.iso] || row.iso)
        : (ISO_TO_WORLD_NAME[row.iso] || row.iso);
      return {
        name: countryName,
        value: hasValue ? row.value : null,
        meta: {
          iso: row.iso,
          label: labelByIso[row.iso] || row.iso,
          worldName: countryName,
          observations: row.observations || 0,
          endDate: row.endDate || null
        },
        itemStyle: style
      };
    });

    var seriesCfg = {
      name: 'Power price heatmap',
      type: 'map',
      map: mapKey,
      roam: false,
      selectedMode: false,
      emphasis: {
        label: { color: t.text },
        itemStyle: {
          borderColor: t.text,
          borderWidth: 1.8,
          shadowBlur: 6,
          shadowColor: 'rgba(11, 19, 43, 0.14)'
        }
      },
      select: {
        disabled: true
      },
      itemStyle: {
        borderColor: 'rgba(58, 74, 106, 0.35)',
        borderWidth: 0.9,
        areaColor: '#d8d8d8'
      },
      label: {
        show: false,
        formatter: '{b}'
      },
      data: mapData
    };

    if (mapLayout) {
      seriesCfg.center = mapLayout.center;
      seriesCfg.zoom = mapLayout.zoom;
      seriesCfg.layoutCenter = mapLayout.layoutCenter;
      seriesCfg.layoutSize = mapLayout.layoutSize;
    }

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      tooltip: Object.assign({
        trigger: 'item',
        formatter: function (params) {
          if (!params || !params.data) return '';
          var meta = params.data.meta || {};
          var label = meta.label || params.name;
          if (params.value == null || isNaN(params.value)) {
            return label + ' (' + (meta.iso || params.name) + ')<br/>No data in selected window';
          }
          var obs = meta.observations ? '<br/>Observations: ' + meta.observations : '';
          var endDate = meta.endDate ? '<br/>Last date: ' + meta.endDate : '';
          return label + ' (' + (meta.iso || params.name) + ')<br/>'
            + metricLabel + ': ' + _fmtVal(params.value) + ' ' + unit
            + obs + endDate;
        }
      }, t.tooltip),
      visualMap: {
        show: hasData,
        min: min,
        max: max,
        calculable: true,
        orient: 'vertical',
        right: 8,
        top: 'middle',
        itemWidth: 12,
        itemHeight: 108,
        text: [String(Math.round(max)), String(Math.round(min))],
        textGap: 8,
        textStyle: { color: t.muted, fontSize: 11 },
        formatter: function (v) {
          return _fmtVal(v);
        },
        inRange: { color: ['#2f8f63', '#dfb648', '#bf4a3f'] },
        outOfRange: { color: '#cfcfcf' },
        borderColor: 'transparent'
      },
      series: [seriesCfg]
    }, true);
  }

  // --- Forward curve chart (contract months vs price, 3 historical snapshots) ---

  function renderForwardCurve(containerId, opts) {
    // opts: { title, unit, months[], current[], w1ago[], m1ago[], color }
    var chart = _get(containerId);
    if (!chart) return;
    var t = _theme();
    var c = opts.color || t.accent;
    var months = opts.months || [];
    var monthTickLabels = months.map(function (m) {
      var s = String(m || '');
      var hit = s.match(/^[A-Za-z]{3}/);
      return hit ? hit[0] : s.slice(0, 3);
    });
    var current = opts.current || [];
    var w1ago   = opts.w1ago   || [];
    var m1ago   = opts.m1ago   || [];

    function fmtTip(v) {
      if (v == null || isNaN(v)) return '—';
      return typeof v === 'number' && v < 20 ? v.toFixed(2) : Math.round(v);
    }

    var hasCurrent = current.some(function (v) { return v != null; });
    var hasW1      = w1ago.some(function (v) { return v != null; });
    var hasM1      = m1ago.some(function (v) { return v != null; });

    var series = [];
    if (hasCurrent) series.push({
      name: 'Current', type: 'line',
      data: current.map(function (v, i) { return [monthTickLabels[i], v]; }),
      lineStyle: { color: c, width: 2, type: 'solid' },
      itemStyle: { color: c },
      symbol: 'circle',
      symbolSize: 4,
      label: { show: false },
      emphasis: { label: { show: false } },
      z: 4
    });
    if (hasW1) series.push({
      name: '1W ago', type: 'line',
      data: w1ago.map(function (v, i) { return [monthTickLabels[i], v]; }),
      lineStyle: { color: c, width: 1.5, type: 'dotted', opacity: 0.7 },
      itemStyle: { color: c },
      symbol: 'none',
      label: { show: false },
      emphasis: { label: { show: false } },
      z: 3
    });
    if (hasM1) series.push({
      name: '1M ago', type: 'line',
      data: m1ago.map(function (v, i) { return [monthTickLabels[i], v]; }),
      lineStyle: { color: c, width: 1.5, type: 'dotted', opacity: 0.4 },
      itemStyle: { color: c },
      symbol: 'none',
      label: { show: false },
      emphasis: { label: { show: false } },
      z: 2
    });

    chart.setOption({
      backgroundColor: 'transparent',
      animation: false,
      grid: { left: 38, right: 8, top: 20, bottom: 24, containLabel: false },
      tooltip: Object.assign({
        trigger: 'axis',
        confine: true,
        formatter: function (params) {
          if (!params || !params.length) return '';
          var header = params[0].axisValue || '';
          var lines  = params.map(function (p) {
            return p.marker + ' ' + p.seriesName + ': ' + fmtTip(p.value[1]);
          });
          return [header].concat(lines).join('<br/>');
        }
      }, t.tooltip),
      legend: {
        show: false,
        data: series.map(function (s) { return s.name; }),
        top: 4, left: 8, orient: 'horizontal',
        textStyle: { color: t.muted, fontSize: 8, fontFamily: 'inherit' },
        itemHeight: 5, itemWidth: 12,
        icon: 'path://M2 4 L18 4'
      },
      xAxis: {
        type: 'category',
        data: monthTickLabels,
        axisLine: { lineStyle: { color: t.border } },
        axisTick: { lineStyle: { color: t.border } },
        axisLabel: { color: t.muted, fontSize: 8, fontFamily: 'inherit', rotate: 0 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, fontSize: 8, fontFamily: 'inherit', formatter: fmtTip },
        splitLine: t.splitLine,
        scale: true
      },
      series: series
    }, true);
  }

  return {
    COUNTRY_COLORS: COUNTRY_COLORS,
    renderTimeSeries: renderTimeSeries,
    renderSpreadChart: renderSpreadChart,
    renderHistogram: renderHistogram,
    renderMonthlyBar: renderMonthlyBar,
    renderPowerHeatmapMap: renderPowerHeatmapMap,
    renderForwardCurve: renderForwardCurve,
    resizeAll: resizeAll
  };
}());
