---
description: "Build or extend the market data pipeline, adapters, transforms, and generated public/data.js output for the energy markets dashboard."
name: "Build Data Pipeline"
argument-hint: "Describe the source, metric, or pipeline change to implement"
agent: "agent"
---

Build or extend the data pipeline for this repository.

Use this workflow:

1. Define the source and schema impact.
2. Implement or update adapter logic in isolation.
3. Normalize and transform the data into the existing payload shape.
4. Update `public/data.js` generation and metadata handling.
5. Validate failure handling, warnings, and downstream dashboard compatibility.

Constraints:

- Keep source-specific logic inside adapters.
- Preserve the fetch step followed by build step architecture.
- Prefer Python-side precomputation for derived analytics.
- Expose missing and stale data explicitly.