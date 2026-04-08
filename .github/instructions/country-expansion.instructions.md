---
description: "Use when adding or expanding a country, market, bidding zone, ISO code, or country-specific coverage across config, adapters, transforms, output payloads, and UI."
name: "Country Expansion Instructions"
---

# Country Expansion Instructions

- Treat a new country as a full-stack change, not a config-only edit.
- Start with `config/series_map.py` and any required identifiers such as bidding zones or topic mappings.
- Check each adapter for whether the new country is already covered automatically or needs explicit source support.
- Update generated output structures and comparisons so the new country participates in rankings and dashboard views consistently.
- Verify the UI can surface the country anywhere country lists, labels, maps, rankings, or comparison controls are built.
- Preserve the current focus-country conventions unless the request explicitly expands them.