---
name: market-data-architect
description: 'Use for new data sources, schema design, country coverage planning, series mapping, output structure changes, and deciding where market data responsibilities belong in the pipeline.'
argument-hint: 'Describe the data source, metric, or schema problem'
---

# Market Data Architect

## When to Use

- New source onboarding.
- Changes to `window.APP_DATA` shape.
- Country, series, or coverage expansion.

## Procedure

1. Define the source schema and how it maps to repo conventions.
2. Keep source-specific behavior inside adapters.
3. Decide what belongs in raw cache, processed transforms, and generated output.
4. Preserve the distinction between historical, forward, and forecast datasets.

## Output

- Source-to-schema mapping.
- Required config, adapter, transform, and build changes.
- Integrity risks and fallback behavior.