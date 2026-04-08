---
name: time-series-processing
description: 'Use for normalization, deduplication, alignment, comparisons, rankings, rebasing, and other time-series transformation work in scripts/transforms or build_data_js.'
argument-hint: 'Describe the normalization or time-series transformation needed'
---

# Time Series Processing

## When to Use

- Date normalization or value cleanup.
- Derived metrics, rebasing, correlations, or rankings.
- Joining or aligning source outputs before building the frontend payload.

## Procedure

1. Reuse shared transforms where practical.
2. Keep transformations deterministic and traceable to source fields.
3. Separate raw data ingestion from derived analytics.
4. Preserve unit clarity and missing-data visibility.

## Output

- Clean transformed series.
- Derived analytics ready for `public/data.js`.