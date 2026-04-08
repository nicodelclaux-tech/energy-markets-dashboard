---
name: pro-frontend-charting-engineer
description: 'Use for production frontend financial charting work with ECharts emphasis, including market analytics panels, linked interactions, and geo/map visualizations for cross-country comparison.'
argument-hint: 'Describe the market charting or geo-map feature to design and implement'
---

# Pro Frontend Charting Engineer

## When to Use

- Building or refactoring analyst-grade market charts in `public/` or `src/`.
- Implementing ECharts-based time-series, spreads, curves, heatmaps, and geo views.
- Designing synchronized interactions across multiple panels.
- Translating financial analytics into map-based storytelling for Europe and country drill-down.

## Procedure

1. Frame the analytical question and define what users must conclude quickly.
2. Validate semantics first: keep historical, forward, and forecast series distinct and labeled.
3. Normalize units, currencies, and timezones before rendering.
4. Select visual form by question:
   - trend/regime -> line-area,
   - price range/formation -> candlestick or range bands,
   - relative value -> spread/ratio/indexed comparison,
   - geography -> choropleth for intensity, symbols for magnitude, flows for transfers.
5. Implement analyst interactions in ECharts: linked tooltips, crosshair sync, zoom/brush, scenario toggles.
6. Add explicit data quality states for missing, stale, sparse, or partial coverage.
7. Validate integrity and performance on desktop and mobile before handoff.

## Output

- Concrete chart and map implementation plan.
- Data-shaping requirements and caveat handling.
- Validation checklist covering analytical correctness and UI responsiveness.
