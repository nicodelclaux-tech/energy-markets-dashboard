---
description: "Use when working on adapters, source ingestion, normalization, build_data_js, fetch_all, config mapping, public/data.js generation, market data coverage, or pipeline orchestration."
name: "Data Pipeline Instructions"
applyTo: ["scripts/**", "config/**", "data/**"]
---

# Data Pipeline Instructions

- Keep source-specific logic inside the relevant file in `scripts/adapters/`.
- Preserve the two-step flow: fetch raw cache first, then build `public/data.js` from cached inputs.
- When adding a source, make the adapter resilient to partial failure and surface warnings through `data/raw/fetch_meta.json`.
- Normalize dates, values, and deduplication in shared transforms where practical instead of duplicating logic in adapters.
- Keep historical, forward, and forecast datasets separated in both code and output structure.
- If a new series must appear in the dashboard, update the config mapping, raw/cache handling, build step, and any affected frontend consumers.
- Prefer precomputing comparisons, rankings, and derived analytics in Python.
- Do not hide missing coverage; expose missing or stale data in metadata or downstream UI-friendly structures.