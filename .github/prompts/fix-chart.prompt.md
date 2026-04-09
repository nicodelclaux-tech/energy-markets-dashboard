---
name: fix-chart
description: "Fix a broken, visually incorrect, or misconfigured ECharts chart on any dashboard page."
---

# Fix Chart — Single Agent Task

For chart bugs, use a single agent. Do not invoke a full workflow.

## When to use this prompt
- Chart renders blank or throws a JS error
- Wrong series colors or missing legend entries
- Dark mode breaks the chart (grid lines, axis labels disappear)
- Chart shows `0` instead of a gap for missing data
- Tooltip shows wrong values or wrong format
- Historical and forward curve data appear blended in one series

## Approach

Load `.github/skills/charting-analytics/SKILL.md`, then:

1. **Read the broken chart code** — find the `S.charts[key]` registration or `echarts.init()` call
2. **Identify the failure mode** from this list:
   - Null values zerofilled → set `connectNulls: false`
   - Missing dark mode → use `mc()` for background, `gc()` for grid color
   - Wrong color → check against PALETTE order, use `var(--pos)` / `var(--neg)` for direction
   - Series collision (historical+forward) → split into two series, label each
   - DOM not found → verify element exists before `echarts.init()`
   - Wrong axis type → `'time'` for date axes, `'category'` for string labels
3. **Apply the minimal fix** — one chart, one issue per edit
4. **Verify dark mode toggle** — the chart must re-render when `S.darkMode` changes

## Common Fixes

```js
// Fix: null values incorrectly zerofilled
series: [{ type: 'line', connectNulls: false, data: rows }]

// Fix: dark mode grid color
grid: { borderColor: gc() }
xAxis: { axisLine: { lineStyle: { color: gc() } } }

// Fix: re-render on dark mode toggle
document.body.addEventListener('darkModeChange', () => {
  myChart.setOption(buildOptions(), true);
});
```

## Output Format
The corrected chart configuration or JS function, with the specific fix highlighted and explained in one sentence.
