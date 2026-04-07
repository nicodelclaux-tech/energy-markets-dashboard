# Energy Markets Dashboard — Data Pipeline

A production-grade Python pipeline that pulls European energy market data every morning, normalises it, stores a rolling 5-year history, and outputs a single `public/data.js` file consumed by a static HTML dashboard.

---

## Project structure

```
/config
  settings.py        — env vars, paths, timeouts
  series_map.py      — countries, EIC codes, tickers, series IDs, news topics
/scripts
  fetch_all.py       — orchestrator; runs all adapters
  build_data_js.py   — reads raw cache → writes public/data.js
  /adapters
    entsoe.py        — ENTSO-E day-ahead electricity prices (XML API)
    ember.py         — Ember generation-mix (API + free CSV fallback)
    fmp.py           — Financial Modeling Prep commodity & FX prices
    ecb.py           — ECB Statistical Data Warehouse FX rates (no key)
    eia.py           — EIA oil/gas spot prices + storage
    news.py          — Guardian API + GDELT fallback news feed
  /transforms
    normalize.py     — dates, values, dedup, frequency alignment
    comparisons.py   — changes, 5Y range, rebase-100, correlations
    rankings.py      — country ranking utilities
    news_ranker.py   — relevance scoring, topic/country detection
/data
  /raw               — per-source CSV/JSON cache (committed to repo)
  /processed         — optional processed exports
/public
  data.js            — dashboard output (refreshed daily by CI)
/.github/workflows
  refresh-data.yml   — daily 6am UTC GitHub Actions workflow
```

---

## Prerequisites

- Python 3.11+
- A GitHub repository with Actions enabled

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/energy-markets-dashboard.git
cd energy-markets-dashboard
pip install -r requirements.txt
```

### 2. Create your `.env` file

```bash
cp .env.example .env
# Edit .env with your API keys (see "API Keys" section below)
```

### 3. Run the pipeline

```bash
# Step 1 — fetch raw data from all sources (writes to data/raw/)
python scripts/fetch_all.py

# Step 2 — build public/data.js from the cached raw data
python scripts/build_data_js.py

# Dry-run (no network calls, useful for testing the build step)
python scripts/fetch_all.py --dry-run
python scripts/build_data_js.py
```

---

## API keys

| Variable | Source | Registration URL |
|---|---|---|
| `ENTSOE_API_KEY` | ENTSO-E Transparency Platform | https://transparency.entsoe.eu/usrm/user/createPublicUser |
| `FMP_API_KEY` | Financial Modeling Prep (free tier) | https://financialmodelingprep.com/developer/docs |
| `EIA_API_KEY` | US Energy Information Administration | https://www.eia.gov/opendata/register.php |
| `GUARDIAN_API_KEY` | The Guardian Open Platform (free) | https://open-platform.theguardian.com/access/ |
| `EMBER_API_KEY` | Ember Climate API (optional) | https://api.ember-energy.org — public datasets work without a key |

> **Note:** The ECB FX adapter requires no API key.

---

## GitHub Actions setup

The workflow at `.github/workflows/refresh-data.yml` runs every morning at 06:00 UTC and can also be triggered manually from the Actions tab.

### Adding secrets to your repository

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add each key:
   - `ENTSOE_API_KEY`
   - `FMP_API_KEY`
   - `EIA_API_KEY`
   - `GUARDIAN_API_KEY`
   - `EMBER_API_KEY` (optional)

The workflow commits `public/data.js`, `data/raw/`, and `data/processed/` back to the repository with a `[skip ci]` commit message so it doesn't trigger itself.

---

## Output format (`public/data.js`)

The file sets a single global variable:

```javascript
window.APP_DATA = {
  meta: {
    updatedAt: "ISO timestamp",
    sources: { entsoe: { status, total_rows, elapsed_s }, ... },
    coverage: { DE: 1825, FR: 1825, ... },
    warnings: ["error messages from failed adapters"]
  },
  series: {
    entsoe_prices: { DE: [{date, value, unit}, ...], FR: [...], ... },
    brent:     [{date, value, unit}, ...],
    wti:       [{date, value, unit}, ...],
    henry_hub: [{date, value, unit}, ...],
    ng_storage:[{date, value, unit}, ...],
    eurusd:    [{date, value, unit}, ...],
    gbpusd:    [{date, value, unit}, ...],
    gbpeur:    [{date, value, unit}, ...]
  },
  countries: {
    DE: {
      power_prices: [{date, value, unit}],
      generation_mix: { wind_offshore: 12.4, solar: 15.3, ... },
      fundamentals: { latest_price_eur_mwh: 80.55 }
    }
  },
  forwardCurves: {},
  comparisons: {
    brent: {
      latest_value, latest_date,
      change_1d, pct_change_1d, change_1w, pct_change_1w,
      change_1m, pct_change_1m, change_1y, pct_change_1y,
      high_5y, low_5y, current_pct_rank,
      rebase_100: [{date, value, unit}]
    },
    _correlations: { brent_vs_wti: [{date, value}], ... }
  },
  rankings: {
    latest_price_eur_mwh: {
      rankings: [{country, value, rank}],
      top: [...], bottom: [...]
    }
  },
  news: [
    {
      id, headline, url, publishedAt, source,
      country_tags, topic_tags, summary, relevance_score
    }
  ]
};
```

---

## Extending the pipeline

### Add a new country

1. Add the ISO code + display name to `COUNTRIES` in `config/series_map.py`
2. Add the ENTSO-E bidding-zone EIC to `ENTSOE_BIDDING_ZONES`
3. All adapters iterate over `COUNTRIES` automatically

### Add a new commodity

1. Add a FMP ticker to `FMP_SYMBOLS`, or an EIA series to `EIA_SERIES` in `config/series_map.py`
2. Reference the new key in `build_data_js.py`

### Add a new data source

1. Create `scripts/adapters/mysource.py` with a `fetch_all() -> dict` function
2. Add it to `ADAPTER_MODULES` in `scripts/fetch_all.py`
3. Load and use its output in `scripts/build_data_js.py`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| All series are `[]` | No API keys set | Add `.env` or set env vars |
| ENTSO-E returns 401 | Invalid/expired token | Regenerate at transparency.entsoe.eu |
| FMP error message | Free-tier rate limit | Pipeline retries automatically |
| `meta.warnings` not empty | Adapter failed | Check Actions log for details |
| `data/raw/` empty after fetch | Network error / missing keys | Run `fetch_all.py` locally with valid `.env` |