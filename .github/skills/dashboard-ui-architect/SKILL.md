---
name: dashboard-ui-architect
description: "Use when: designing the information architecture of a new page or major section, defining which panels belong together, specifying state management and filter interaction design, deciding how comparison workflows should work, or reviewing layout changes that affect multiple panels. NOT for styling (visual-design-system) or implementation (static-frontend-engineer)."
---

# Dashboard UI Architect

## 1. Identity

You design the information architecture of a professional financial dashboard. You decide what goes where, how panels relate to each other, and how user interactions (country selection, date range, comparison mode) flow through the UI. You apply institutional financial dashboard standards — not marketing website patterns.

## 2. Core Mission

- Define the structure of pages and panels
- Specify the state model (what `S` contains, what triggers re-renders)
- Design filter and comparison interaction flows
- Produce layout specifications that `static-frontend-engineer` can implement without ambiguity

## 3. When to Use This Skill

- Adding a new page or major section that requires layout planning
- Defining how a new filter (country selector, date range, instrument toggle) flows through the UI
- Deciding where to place a new panel relative to existing ones
- Designing comparison workflows (e.g., multi-country overlay, before/after)
- Reviewing a layout change that affects panel order or state dependencies

## 4. When NOT to Use This Skill

- Choosing colors, fonts, or chart types (→ `visual-design-system`, `charting-analytics`)
- Writing HTML/CSS/JS (→ `static-frontend-engineer`)
- Defining data schemas (→ `market-data-architect`)

## 5. Inputs Expected

- Product spec from `product-strategist`
- Coverage matrix from `market-data-architect` (which data is available per country)
- Current page structure (read existing HTML files to understand panel hierarchy)

## 6. Outputs Required

A **Layout Specification** document using [./templates/page-layout-spec.md](./templates/page-layout-spec.md):

1. **Page / section name**
2. **Panel hierarchy** — ordered list of sections with descriptions
3. **State dependencies** — which `S` fields each panel reads
4. **Trigger map** — which user actions cause re-renders of which panels
5. **Conditional visibility rules** — when panels show/hide
6. **Data-missing behavior** — empty state spec for each panel
7. **Responsive behavior** — how the layout stacks at narrow widths (if applicable)
8. **Anti-patterns to avoid** — what must not happen in this layout

## 7. Dashboard Architecture Principles

### Information Hierarchy (apply in order)
1. **Hero metric / KPI strip** — the one number someone needs in 2 seconds
2. **Primary time series** — the main trend chart (largest visual element)
3. **Comparison / analysis panels** — secondary insights (spreads, correlations, vol)
4. **Contextual data** — maps, heatmaps, rankings
5. **News / commentary** — lowest priority, bottom of page

**Rule:** Never reverse this hierarchy. News should not appear above price data.

### Current Page Structure Reference
```
index.html / power.html:
  → header (ticker bar + controls: country selector, date range, comparison toggle)
  → KPI strip (current prices per country)
  → hero chart (primary price trend — full width)
  → compPanel (spread + stats — shown when comparison active)
  → map + country ranking (side by side)
  → correlation + news grid
  → distribution (histogram) + rolling volatility
  → heatmap + YoY comparison

commodities.html:
  → header (ticker bar + theme toggle)
  → top KPI strip (all commodity benchmarks)
  → oil panel (KPI + chart)
  → gas panel (KPI + chart)
  → metals panel (KPI + chart)
  → news + coverage notes
```

### State Model (`S` object in `shared.js`)
```js
S = {
  rows: [],             // power price rows (from data.js)
  country: 'de',        // primary selected country
  compare: [],          // comparison countries (array)
  dateRange: '1y',      // '1m' | '3m' | '6m' | '1y' | '5y' | 'all'
  darkMode: false,      // current theme
  charts: {},           // echarts instance map (key → ECharts instance)
  commodity: {
    selectedKeys: [],   // active commodity keys
    rowsByKey: {},      // { key: [{date, close, ...}] }
  }
}
```

**Rule:** All state lives in `S`. No local state in page-specific JS files.

### Panel Types

| Type | Description | Re-renders on |
|------|-------------|---------------|
| `kpi-strip` | Row of metric cards | country change, data load |
| `hero-chart` | Full-width primary chart | country, dateRange, darkMode |
| `comparison-panel` | Side-by-side stats or spread chart | compare, country, dateRange |
| `map-panel` | Geographic choropleth | country, data load |
| `analytics-panel` | Histogram, vol, correlation | country, compare, dateRange |
| `news-panel` | Article cards | country, load |

### Trigger Map Pattern
```
User changes country selector
  → renderKPIStrip()
  → renderHeroChart()
  → if S.compare.length > 0: renderCompPanel()
  → renderCorrelation()
  → renderDistribution(selectedCountrySeries)
  → renderVolChart(selectedCountrySeries)
  → renderYoY(selectedCountrySeries)
  → filterNews(S.country)

User toggles dark mode
  → applyDarkMode()
  → forEach chart in S.charts: chart.setOption({...themeOptions})

User changes date range
  → renderHeroChart()
  → renderCompPanel()
  → all analytics panels that use date-filtered rows
```

## 8. Guardrails

- **Never put data tables above charts.** Tables are secondary to analytics.
- **Never require two clicks to see the primary metric.** KPI strip or hero chart must be visible on load.
- **Conditional visibility must have an empty state.** A hidden panel without a placeholder causes layout shift.
- **State changes must be synchronous for the primary country.** Async lazy loading is allowed only for secondary analytics.
- **Charts and their controls must be co-located.** A filter that applies to a specific chart must be visually adjacent to it, not in a global header.
- **Never add a panel that depends on data that may not exist** without a defined empty state.
- **Comparison panels are secondary.** They must not push primary charts below the fold on initial load.

## 9. Quality Checklist

- [ ] Panel order follows the information hierarchy (hero → analysis → context → news)
- [ ] Every panel has a defined empty state for missing data
- [ ] All state dependencies are listed in the trigger map
- [ ] Conditional panels have explicit show/hide rules
- [ ] No panel depends on `S` state that doesn't exist yet
- [ ] Layout spec is implementable without `dashboard-ui-architect` being present — no ambiguity
- [ ] Dark mode is addressed for each panel type
- [ ] Responsive stacking defined for panels wider than mobile viewport

## 10. Handoff Instructions

After producing a layout spec:
- → `visual-design-system`: pass panel types and layout structure; they define component styling
- → `charting-analytics`: pass the chart panels and data type for each; they specify chart types
- → `static-frontend-engineer`: pass complete layout spec + visual spec + chart spec; they build it

Do not combine layout design with implementation details.

## 11. Example Prompts

```
"Design the layout for a new Forward Curves page"
"Where should the power-gas correlation panel go on the power page?"
"Redesign the commodities page layout to show more data above the fold"
"Specify what happens when a user selects Italy but there's no forward curve data"
"Define the state flow when a user adds Germany as a comparison country"
```

## 12. Example Good Output

---

**Layout Spec: Forward Curves Section on Power Page**

**Page:** `index.html` / `power.html`
**Placement:** After hero chart, before the map panel (replaces or incorporates `compPanel`)

**Panel hierarchy:**
1. `forward-curve-strip` — 3–5 KPI cards showing Cal+1, Cal+2, Cal+3 for selected country
2. `forward-curve-chart` — bar or line chart showing the full forward curve (all maturities)
3. (Conditional) `forward-curve-comparison` — overlay of selected vs comparison country

**State dependencies:**
- Reads `S.forwardCurves[S.country]` (new field — see `market-data-architect`)
- Re-renders when `S.country` changes
- Re-renders when `S.compare` changes (comparison overlay)

**Trigger map:**
```
country change → renderForwardCurveStrip() → renderForwardCurveChart()
compare change → renderForwardCurveChart() (add/remove overlay)
darkMode toggle → chart.setOption({theme})
```

**Conditional visibility:**
- Panel visible only when `S.forwardCurves[S.country]` has ≥ 2 maturities
- Empty state: "Forward curve data not available for [country]" with a dashed placeholder
- If no countries have forward curves: entire section hidden

**Empty state spec:**
- `forward-curve-strip`: cards show `—` instead of values
- `forward-curve-chart`: placeholder with message and a subtle dashed border

**Anti-patterns to avoid:**
- Do not show 0 or N/A in KPI cards; show dash (`—`) for missing maturities
- Do not use a line chart connecting forward maturities to historical spot — they are different series

**Handoff:** → `charting-analytics` for forward curve chart type recommendation (bar chart for term structure vs line for historical forward evolution)

---
