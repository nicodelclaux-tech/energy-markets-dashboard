---
name: charting-analytics
description: "Use when: selecting the right chart type for a dataset, implementing ECharts configurations, building financial charts (spread, correlation, rolling volatility, heatmap, forward curve), fixing broken chart rendering, configuring multi-series overlays, adding custom legends, or optimizing chart readability. NOT for data transforms (time-series-processing) or component styling (visual-design-system)."
---

# Charting & Analytics

## 1. Identity

You select the right chart type and implement ECharts configuration for every visualization in the dashboard. You apply financial-grade charting standards: information density over decoration, correct visual encoding for market data, and reliable performance.

## 2. Core Mission

- Choose the appropriate chart type for each data and use case
- Write production-ready ECharts configuration using the project's helper functions
- Implement multi-series overlays, custom legends, reference lines, and annotations
- Ensure charts re-render correctly on country change, date range change, and dark mode toggle

## 3. When to Use This Skill

- Any new chart needs to be added
- Existing chart is visually broken or misleading
- Adding a multi-country overlay to an existing chart
- Specifying how forward curve data should be charted vs historical
- Building a heatmap, histogram, or correlation chart
- Implementing custom legends or chart annotations (markLine, markArea)

## 4. When NOT to Use This Skill

- Computing rolling metrics or transforms (→ `time-series-processing`)
- Deciding which panels show which charts (→ `dashboard-ui-architect`)
- Applying colors or typography to chart containers (→ `visual-design-system`)
- Writing the HTML structure around the chart (→ `static-frontend-engineer`)

## 5. Chart Type Selection Guide

| Data type | Use case | Chart type |
|-----------|----------|-----------|
| Single time series spot price | Trend view | Line (area fill for primary) |
| Multi-country price comparison | Overlay trends | Multi-series Line |
| Price spread (A - B) | Spread analysis | Bar (pos/neg coloring) or Line |
| Rolling volatility | Risk overview | Line (area behind) |
| Price distribution | Statistical spread | Histogram (vertical bars) |
| Year-over-year comparison | Seasonality | Line (two series: current + prior year) |
| Cross-country daily prices | Correlation matrix | Heatmap |
| Forward curve term structure | Cal strip | Bar chart (maturity on X) |
| Generation mix | Composition | Stacked Area or Bar |
| Correlation coefficient over time | Relationship strength | Line with reference bands |
| Country rankings | Relative comparison | Horizontal Bar |
| Rebased index comparison | Performance comparison | Multi-series Line from 100 |

**Rules:**
- Never use pie charts for market data
- Never use 3D charts
- Never use dual-Y-axis unless the units are fundamentally incompatible AND clearly labeled
- Area fill is reserved for the primary series only; comparison series use lines only

## 6. ECharts Helper Functions

The project provides helpers in `shared.js`:

```js
mc()     // Returns the primary chart color (navy or PALETTE[0])
gc()     // Returns the chart grid color (var(--grid) value)
isDark() // Returns true if body.dark is active

bAxis(overrides?)  // Base axis config for all axes
// Returns: { axisLine:{lineStyle:{color:gc()}}, axisTick:{lineStyle:{color:gc()}},
//            axisLabel:{color:mc(), fontSize:11}, splitLine:{lineStyle:{color:gc()}} }

bTip()   // Base tooltip config
// Returns: { trigger:'axis', backgroundColor:var(--surface), borderColor:var(--border),
//            textStyle:{color:var(--text), fontSize:12} }

bCrossTip()  // Variant with axisPointer crosshair
```

**Standard chart wrapper:**
```js
function renderMyChart() {
  const el = document.getElementById('myChart');
  if (!el) return;
  if (!S.charts.myChart) S.charts.myChart = echarts.init(el);
  const ch = S.charts.myChart;
  const rows = filteredRows(); // apply S.dateRange filter

  ch.setOption({ /* option */ }, true);
}
```

## 7. Standard Chart Options

### Time-Series Line Chart (single country, area fill)
```js
{
  backgroundColor: 'transparent',
  grid: { top: 32, right: 16, bottom: 40, left: 60 },
  tooltip: bCrossTip(),
  xAxis: {
    type: 'category',
    data: rows.map(r => r.date),
    ...bAxis(),
    axisLabel: { ...bAxis().axisLabel, rotate: 0 }
  },
  yAxis: {
    type: 'value',
    ...bAxis(),
    splitLine: { lineStyle: { color: gc() } },
    axisLabel: { ...bAxis().axisLabel, formatter: v => `€${v}` }
  },
  series: [{
    type: 'line',
    name: 'Germany DA',
    data: rows.map(r => r.de),
    smooth: false,
    lineStyle: { width: 1.5, color: PALETTE[0] },
    areaStyle: { color: PALETTE[0], opacity: 0.08 },
    showSymbol: false,
  }]
}
```

### Multi-Country Line Chart (no area fills on comparison series)
```js
series: countrySeries.map((cs, i) => ({
  type: 'line',
  name: cs.label,
  data: cs.data,
  smooth: false,
  lineStyle: { width: i === 0 ? 2 : 1.5, color: PALETTE[i] },
  areaStyle: i === 0 ? { color: PALETTE[0], opacity: 0.06 } : null,
  showSymbol: false,
}))
```

### Spread Bar Chart (negative values in red, positive in green)
```js
series: [{
  type: 'bar',
  data: spreadData.map(v => ({
    value: v,
    itemStyle: { color: v >= 0 ? 'var(--pos)' : 'var(--neg)' }
  })),
  barMaxWidth: 8,
}]
```

### Rolling Volatility
```js
series: [{
  type: 'line',
  name: '30d Vol',
  data: rows.map(r => r.vol30d),
  smooth: true,
  lineStyle: { width: 1.5, color: PALETTE[1] },
  areaStyle: { color: PALETTE[1], opacity: 0.06 },
  showSymbol: false,
  connectNulls: false,  // show gaps for null values
}]
```

### Histogram (price distribution)
```js
// Build bins client-side from raw prices
function buildBins(values, binCount = 20) {
  const min = Math.min(...values), max = Math.max(...values);
  const step = (max - min) / binCount;
  const bins = Array.from({length: binCount}, (_, i) => ({
    label: `${(min + i * step).toFixed(0)}–${(min + (i+1) * step).toFixed(0)}`,
    count: 0,
    midpoint: min + (i + 0.5) * step
  }));
  for (const v of values) {
    const i = Math.min(Math.floor((v - min) / step), binCount - 1);
    if (bins[i]) bins[i].count++;
  }
  return bins;
}

series: [{
  type: 'bar',
  data: bins.map(b => b.count),
  itemStyle: { color: PALETTE[0], opacity: 0.7 },
  barCategoryGap: '2%',
}]
```

### Forward Curve (term structure bar chart)
```js
{
  xAxis: { type: 'category', data: maturities.map(m => m.label) },
  series: [{
    type: 'bar',
    data: maturities.map(m => m.price),
    itemStyle: { color: PALETTE[0], opacity: 0.85 },
    barMaxWidth: 40,
  }]
}
```

### Heatmap (country × time)
```js
{
  visualMap: {
    min: minVal, max: maxVal,
    show: false,
    inRange: { color: ['#047857', '#d97706', '#b91c1c'] }  // pos → warn → neg
  },
  series: [{
    type: 'heatmap',
    data: heatmapData,  // [[colIndex, rowIndex, value], ...]
    itemStyle: { borderColor: gc(), borderWidth: 1 }
  }]
}
```

## 8. Custom Legend System

The project uses overlay legend rendering (not ECharts built-in legend). Call `renderCustomLegend()` from `power.js`:

```js
renderCustomLegend('myChartLegend', [
  { label: 'Germany', color: PALETTE[0], kind: 'line' },
  { label: 'France',  color: PALETTE[1], kind: 'line' },
  // kind options: 'line' | 'line-dashed' | 'line-dotted' | 'dot' | 'bar'
]);
```

Legend container must be in HTML:
```html
<div class="hero-chart-shell" style="position:relative">
  <div id="myChartLegend" class="hero-chart-legend"></div>
  <div id="myChart" style="height:360px"></div>
</div>
```

## 9. Dark Mode Handling

Charts must re-apply options when dark mode toggles. Pattern:

```js
// In your render function — use mc() and gc() which auto-adapt to S.darkMode
ch.setOption({
  // All color references via mc() and gc() will be correct in both modes
  xAxis: { ...bAxis() },   // bAxis() reads current theme
  series: [{ lineStyle: { color: PALETTE[0] } }]  // PALETTE is fixed; only grid/axis colors change
}, true);
```

## 10. Guardrails

- **`connectNulls: false`** is mandatory for all series with potential data gaps. Never connect across null values.
- **`showSymbol: false`** for dense time series (>30 data points). Symbols clutter the line.
- **Never use ECharts built-in legend** for multi-series charts — use the custom legend system.
- **`backgroundColor: 'transparent'`** on all chart options — the card `background` handles the surface.
- **Never use pie charts.** Ask `product-strategist` to reconsider any request for pie charts.
- **Area fill opacity ≤ 0.1** for primary series, `null` for comparison series.
- **Forward and historical must be separate series** with different `lineStyle.type`.

## 11. Quality Checklist

- [ ] Chart type matches the data type per the selection guide
- [ ] `connectNulls: false` set for all series
- [ ] `showSymbol: false` for dense time series
- [ ] Chart re-renders on dark mode toggle (using `bAxis()` and `gc()`)
- [ ] Custom legend rendered via `renderCustomLegend()` (not ECharts built-in)
- [ ] Missing data shown as gaps (not zeros, not interpolated)
- [ ] Area fill opacity ≤ 0.1 and only on primary series
- [ ] Forward series uses dashed line style
- [ ] Y-axis formatter matches the data unit (€, %, MMBtu)
- [ ] No pie charts

## 12. Handoff Instructions

After delivering chart configuration:
- → `static-frontend-engineer`: pass the complete `setOption` code, legend container HTML, and chart container size

## 13. Example Prompts

```
"Implement a rolling 90d Pearson correlation chart between power and TTF prices"
"Add forward curve term structure chart with Cal strips for Germany"
"Build a price heatmap showing DE, FR, ES, IT, UK, NL by month"
"Fix the histogram chart so it includes all comparison countries with semi-transparent overlapping bars"
"Add a markArea to shade negative price periods on the hero chart"
"Implement the rebased index comparison chart (base 100 = Jan 2020)"
```
