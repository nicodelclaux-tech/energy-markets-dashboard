---
name: pro-frontend-charting-engineer
description: 'Design and implement production-grade frontend charting for financial markets analytics, including time-series, spreads, seasonality, and geo/map visualizations. Use when building institutional dashboards, selecting chart types, defining interaction models, and validating analytical integrity in market UIs.'
argument-hint: 'Dataset shape, target audience, and required chart/map outputs'
user-invocable: true
disable-model-invocation: false
---

# Pro Frontend Charting Engineer

## Outcome
Ship high-trust, analyst-grade chart experiences for market dashboards with clear analytical intent, strong interaction design, and explicit handling of data caveats.

## When To Use
- Build or refactor frontend charting for commodities, power, gas, FX, rates, and macro overlays.
- Select between line, area, candlestick, spread, curve, heatmap, and map-based visual encodings.
- Implement synchronized tooltips, linked crosshairs, zoom/brush windows, and comparative views.
- Build geographic views such as choropleths, proportional symbol maps, and cross-border flow maps.
- Add quality gates so missing, stale, sparse, or mixed-frequency data is visible to users.

## Required Inputs
- Primary user goal and decision context.
- Data grain and horizon (intraday, daily, monthly; historical, forward, forecast).
- Metric definitions with units/currencies and conversion rules.
- Geography scope (country, region, bidding zone, node) and map granularity.
- Known caveats (gaps, revisions, latency, source confidence).

## Workflow
1. Frame the analytical question.
   - Define what decision the chart supports and the comparison dimension (time, geography, product, regime).
   - Write a one-line chart thesis: what should be obvious in 5 seconds.

2. Classify data semantics before visual decisions.
   - Tag each series as historical, forward, or forecast and prevent accidental mixing.
   - Normalize time zones, units, and currencies before plotting.
   - Surface missingness and freshness metadata as first-class fields.

3. Choose visual form with explicit branching.
   - Trend and regime change: line or area with optional rolling bands.
   - Price formation and ranges: candlestick/OHLC or box/range bands.
   - Relative value: spread chart, ratio chart, or indexed-to-100 comparison.
   - Term structure: curve chart with tenor ordering and rollover controls.
   - Regional comparison: choropleth for intensity, symbol map for magnitude, flow map for transfers.

4. Define interaction model for analyst speed.
   - Add synchronized crosshair and tooltip across related panels.
   - Provide brush/zoom with quick resets and stable y-axis behavior.
   - Include period toggles (1M, 3M, YTD, 1Y, 3Y, max) and benchmark toggles.
   - Preserve keyboard accessibility and deterministic focus order.

5. Build geo/map charts with cartographic guardrails.
   - Match projection and boundaries to the business question; avoid misleading distortion.
   - Use sequential scales for magnitude and diverging scales for signed deltas.
   - Include explicit legends, units, and no-data states.
   - Avoid overplotting with aggregation, clustering, or threshold filters.

6. Encode analytical context, not just visuals.
   - Annotate key events (policy changes, outages, weather shocks) with timestamped markers.
   - Show reference bands (percentiles, z-score regimes, policy thresholds).
   - Make calculation method discoverable in labels or tooltip footers.

7. Validate integrity and performance before handoff.
   - Confirm values in tooltips match source calculations.
   - Check timezone boundaries, DST transitions, and forward curve tenor alignment.
   - Test mobile density, label collisions, and interaction latency.
   - Ensure stale or missing data is visible and not silently interpolated.

## Decision Matrix
- If users need exact trade-level timing, prioritize precision interactions over decorative styling.
- If users compare regions, prioritize normalized scales and ranking toggles.
- If series volatility is high, add optional smoothing but keep raw view available.
- If data confidence varies by source, encode confidence tier in legend and tooltip.

## Completion Checks
- The chart thesis is clear within 5 seconds for the target user.
- Users can answer the primary question without external calculations.
- Historical, forward, and forecast series remain visually and semantically distinct.
- Missing/stale data is explicit in chart and legend states.
- Map legends, projections, and no-data handling are correct and interpretable.
- Interaction remains responsive at expected production data volume.

## Example Prompts
- Design an analyst-grade spread dashboard for TTF vs Henry Hub with synchronized crosshairs and regime shading.
- Build a European power price choropleth with country drill-down, no-data states, and day-over-day delta view.
- Refactor this chart module to separate data semantics validation from rendering and interaction wiring.
