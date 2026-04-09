---
name: add-country
description: "Run Workflow W3 to add a new European country to the power dashboard — prices, generation mix, and news."
---

# Workflow W3 — Add New Country

Follow this exact sequence. Required countries already live: ES, DE, FR, IT, GB, NL.

## Step 1 — product-strategist
Load `.github/skills/product-strategist/SKILL.md`, then:
- Confirm the country's ISO code, display name, and grid operator
- Confirm which data is realistically available: DA price, generation mix, load, forward curve
- Define: which pages will show this country's data, and in what panels

## Step 2 — market-data-architect
Load `.github/skills/market-data-architect/SKILL.md`, then:
- Add the country to the power prices schema in the data dictionary
- Confirm the ENTSO-E EIC code (or alternative data source) for this country
- Update the country coverage matrix

## Step 3 — api-integration
Load `.github/skills/api-integration/SKILL.md`, then:
- Add the country to the ENTSO-E adapter (new EIC code → country key mapping)
- Confirm the API returns data for this country in the standard schema
- Test with a manual pipeline run

## Step 4 — time-series-processing
Load `.github/skills/time-series-processing/SKILL.md`, then:
- Apply the same normalization pipeline to the new country's data
- Verify timezone conversion is correct for this country
- Add to the `validate_output.py` country coverage check

## Step 5 — dashboard-ui-architect
Load `.github/skills/dashboard-ui-architect/SKILL.md`, then:
- Update the country filter to include the new country
- Define where the country appears in all affected panels (map, comparison chart, KPI grid)

## Step 6 — static-frontend-engineer
Load `.github/skills/static-frontend-engineer/SKILL.md`, then:
- Add the country to the country selector component
- Add the country to ECharts map data (if using choropleth)
- Update comparison chart series to include the new country's series
- Add the country to the news filter tag list

## Step 7 — qa-data-integrity
Load `.github/skills/qa-data-integrity/SKILL.md`, then:
- Verify the new country appears in validation checks
- Confirm data freshness, schema completeness, and price sanity
- Confirm the chart and KPI card render correctly

## Step 8 — repo-librarian (optional, if expanding supported country list)
Load `.github/skills/repo-librarian/SKILL.md`, then:
- Update README.md to list the new country
- Update EXTENDING.md with any country-specific lessons learned
