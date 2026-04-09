---
name: add-data-source
description: "Run Workflow W2 to integrate a new external data source into the pipeline and surface it in data.js."
---

# Workflow W2 — Add New Data Source

Follow this exact sequence. Do not skip steps.

## Step 1 — market-data-architect
Load `.github/skills/market-data-architect/SKILL.md`, then:
- Define the new instrument(s): symbol, unit, exchange timezone, source
- Add a `COMMODITY_REGISTRY` entry to `config.js` with `verified: false`
- Check: does the source already have an adapter? If yes, go to Step 3.
- Extend the data dictionary template: `.github/skills/market-data-architect/templates/data-dictionary.md`

## Step 2 — api-integration
Load `.github/skills/api-integration/SKILL.md`, then:
- Implement the Python adapter using the template at `.github/skills/api-integration/templates/adapter-template.py`
- Map raw API response to the canonical schema defined in Step 1
- Handle 402/429/5xx errors per the error table in the SKILL.md
- Unit test the adapter with a manual run and confirm schema output

## Step 3 — time-series-processing
Load `.github/skills/time-series-processing/SKILL.md`, then:
- Apply date normalization, unit conversion (if needed), and null-not-zero rule
- Add any required derived metrics (rolling vol, YoY, spread)
- Update the transform pipeline to include the new source

## Step 4 — qa-data-integrity
Load `.github/skills/qa-data-integrity/SKILL.md`, then:
- Run `validate_output.py` against the new data
- Confirm: freshness, schema completeness, price sanity ranges, gap detection
- Mark the COMMODITY_REGISTRY entry `verified: true` only after passing validation

## Step 5 — repo-librarian
Load `.github/skills/repo-librarian/SKILL.md`, then:
- Document the new source in README.md (required API key, endpoint, data type)
- Add to scripts/README.md (adapter file, entry point, output schema)
