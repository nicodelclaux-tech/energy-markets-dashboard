---
name: api-integration
description: 'Use for implementing or modifying source adapters, API authentication, pagination, retries, rate limits, CSV or JSON parsing, and cache-writing behavior in scripts/adapters.'
argument-hint: 'Describe the adapter or API integration work'
---

# API Integration

## When to Use

- Adding or editing files in `scripts/adapters/`.
- Handling authentication, throttling, retries, or payload parsing.
- Designing resilient fetch behavior for external data providers.

## Procedure

1. Implement source logic inside the adapter only.
2. Normalize the adapter output into the repo's expected tidy structures.
3. Catch failures so one broken source does not abort the whole pipeline.
4. Emit useful warnings and coverage metadata for downstream consumers.

## Output

- Adapter changes that fit the existing orchestration flow.
- Failure modes that are visible in metadata.