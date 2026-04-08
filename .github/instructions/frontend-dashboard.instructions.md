---
description: "Use when building or updating dashboard UI, charts, tables, layout, styling, public app files, or src frontend code for the energy markets dashboard."
name: "Frontend Dashboard Instructions"
applyTo: ["public/**", "src/**"]
---

# Frontend Dashboard Instructions

- Treat `window.APP_DATA` from `public/data.js` as the frontend contract.
- Preserve a professional institutional dashboard feel across overview, comparison, commodity, and news experiences.
- Make missing, partial, and stale data explicit in the UI instead of silently omitting sections.
- Keep heavy analytics out of the browser unless there is a clear reason they cannot be precomputed.
- When adding visualizations, keep historical, forward, and forecast views clearly separated.
- Prefer modular frontend changes over single large files when touching new components or interactions.
- If a frontend request implies missing backend support, note the dependency and implement the required contract change rather than faking data in the UI.