---
name: time-series-processing
description: "Use when: normalizing dates or units across data sources, computing rolling returns or volatility, building rebased indices, calculating spreads or correlations, deduplicating or validating time series, writing Python transform functions for the pipeline, or preparing data for the data.js output schema. NOT for API fetching or frontend rendering."
---

# Time-Series Processing

## 1. Identity

You write the Python transformation layer between raw API data and the clean, analytics-ready schema in `data.js`. Your output is independent of API sources and independent of frontend rendering — you operate on lists of dicts and output lists of dicts.

## 2. Core Mission

- Normalize dates, units, and frequencies across heterogeneous sources
- Compute derived fields: returns, changes, rolling volatility, cross-country spreads, correlation inputs, rebased indices
- Deduplicate, fill gaps, and validate time series
- Prepare the final `data.js` output schema

## 3. When to Use This Skill

- Raw API data needs unit conversion (USD/bbl → EUR/MWh via FX)
- Two time series have different frequencies and need alignment (daily + hourly)
- Computing a rolling metric (volatility, correlation, Z-score)
- Building a rebased index (base 100 at some anchor date)
- Detecting and handling gaps (weekends, bank holidays, missing delivery points)
- Preparing the final merge of multiple sources into `data.js`
- Validating output data integrity before writing `data.js`

## 4. When NOT to Use This Skill

- Making HTTP requests to APIs (→ `api-integration`)
- Deciding which metrics to compute (→ `market-data-architect`)
- Frontend JavaScript data processing (→ `static-frontend-engineer` or `charting-analytics`)
- Writing GitHub Actions workflows (→ `github-actions-automation`)

## 5. Inputs Expected

- Raw records from `api-integration` adapters (list of OHLC dicts)
- Source map from `market-data-architect` (units, currencies, frequencies)
- Derived metric specification: rolling window, base date, spread definition, etc.
- Target schema (what `data.js` must look like)

## 6. Outputs Required

Python module with typed functions:
- Each function has a clear signature, docstring, and return type annotation
- Functions are pure (same input → same output, no side effects)
- Output always matches the canonical schema
- Validation assertions that write to `data.js` only when data quality passes

See [./templates/transform-pipeline.py](./templates/transform-pipeline.py) for the boilerplate.

## 7. Core Transform Functions

### Date Normalization
```python
def normalize_dates(records: list[dict], date_field: str = "date") -> list[dict]:
    """
    Ensure all dates are 'YYYY-MM-DD' strings, sorted ascending,
    with duplicates removed (keep last value for a given date).
    """
    seen = {}
    for r in records:
        date = str(r[date_field])[:10]   # truncate to YYYY-MM-DD
        seen[date] = {**r, date_field: date}
    return sorted(seen.values(), key=lambda x: x[date_field])
```

### Rolling Volatility (annualized, close-to-close)
```python
import math

def rolling_volatility(
    records: list[dict],
    window: int = 30,
    price_field: str = "close"
) -> list[dict]:
    """
    Compute annualized 30-day rolling volatility of log returns.
    Appends 'vol30d' field to each record (null where insufficient history).
    """
    prices = [r[price_field] for r in records]
    log_returns = [
        math.log(prices[i] / prices[i-1]) if prices[i-1] > 0 else None
        for i in range(1, len(prices))
    ]
    log_returns = [None] + log_returns   # align with prices

    result = []
    for i, r in enumerate(records):
        vol = None
        if i >= window:
            window_returns = [x for x in log_returns[i-window+1:i+1] if x is not None]
            if len(window_returns) >= window // 2:
                mean = sum(window_returns) / len(window_returns)
                variance = sum((x - mean) ** 2 for x in window_returns) / len(window_returns)
                vol = round(math.sqrt(variance * 252) * 100, 2)  # annualized %
        result.append({**r, "vol30d": vol})
    return result
```

### YoY Change
```python
def add_yoy_change(records: list[dict], price_field: str = "close") -> list[dict]:
    """
    Appends 'yoy_change_pct' to each record.
    YoY = (today - same_day_last_year) / |same_day_last_year| * 100.
    """
    by_date = {r["date"]: r[price_field] for r in records}

    def prior_year_date(date_str: str) -> str:
        y, m, d = date_str.split("-")
        return f"{int(y)-1}-{m}-{d}"

    result = []
    for r in records:
        pyd = prior_year_date(r["date"])
        prev = by_date.get(pyd)
        curr = r[price_field]
        if prev is not None and prev != 0:
            yoy = round((curr - prev) / abs(prev) * 100, 2)
        else:
            yoy = None
        result.append({**r, "yoy_change_pct": yoy})
    return result
```

### Cross-Country Spread
```python
def compute_spread(
    records_a: list[dict],
    records_b: list[dict],
    label_a: str = "de",
    label_b: str = "fr",
    price_field: str = "close"
) -> list[dict]:
    """
    Returns list of {date, spread} where spread = price_a - price_b.
    Only includes dates present in both series.
    """
    by_date_b = {r["date"]: r[price_field] for r in records_b}
    result = []
    for r in records_a:
        price_b = by_date_b.get(r["date"])
        if price_b is not None:
            result.append({
                "date": r["date"],
                f"{label_a}_{label_b}_spread": round(r[price_field] - price_b, 2)
            })
    return result
```

### Unit Conversion: USD/bbl → EUR/MWh (for Brent → Gas price proxy)
```python
def convert_bbl_to_eur_mwh(
    records: list[dict],
    fx_records: list[dict],
    price_field: str = "close",
    bbl_to_mwh: float = 1.7,   # approximate energy content
) -> list[dict]:
    """
    Convert USD/barrel to EUR/MWh using daily ECB EUR/USD rate.
    1 barrel of oil ≈ 1.7 MWh energy equivalent.
    Records missing FX date are skipped (returned with None close).
    """
    fx_by_date = {r["date"]: r["close"] for r in fx_records}   # EUR/USD rate

    result = []
    for r in records:
        fx = fx_by_date.get(r["date"])
        if fx and fx > 0:
            eur_mwh = round(r[price_field] / fx / bbl_to_mwh, 2)
            result.append({**r, price_field: eur_mwh, "currency": "EUR", "unit": "EUR/MWh"})
        else:
            result.append({**r, price_field: None})  # missing FX — show gap
    return result
```

### Rebased Index (base 100)
```python
def rebase_to_100(
    records: list[dict],
    base_date: str,
    price_field: str = "close"
) -> list[dict]:
    """
    Rebase price series so that the value at base_date == 100.
    Useful for cross-commodity comparison charts.
    """
    base_val = next((r[price_field] for r in records if r["date"] == base_date), None)
    if base_val is None or base_val == 0:
        raise ValueError(f"No valid base value found at {base_date}")

    return [{**r, "rebased": round(r[price_field] / base_val * 100, 2)} for r in records]
```

## 8. Guardrails

- **Pure functions only.** No global state, no HTTP calls, no file I/O inside transform functions.
- **Missing values → `None`.** Never return `0` for a missing value — `None` tells the chart to show a gap.
- **Preserve source units** in intermediate steps. Only convert at the explicit conversion step.
- **Weekend/holiday gaps are real data.** Do not forward-fill European power price gaps — they reflect the market.
- **Do not blend historical and forward data.** If a source provides both, split them before normalization.
- **Annualized volatility formula**: std(log_returns) × √252 × 100 — use this consistently.
- **Correlation**: Pearson r over aligned date pairs. Require at least `window/2` overlapping dates, otherwise return `None`.

## 9. Quality Checklist

- [ ] All date strings normalized to `YYYY-MM-DD`
- [ ] No duplicate dates in any output series
- [ ] Missing values are `None`, not `0` or `""`
- [ ] Rolling metrics correctly handle the warm-up period (first N records return `None`)
- [ ] Unit conversion includes the FX rate date alignment
- [ ] Historical and forward data are in separate output fields
- [ ] All transform functions have type annotations and docstrings
- [ ] Output validated before writing to `data.js` (schema check)

## 10. Handoff Instructions

After delivering transform functions:
- → `github-actions-automation`: pass the function call sequence and expected data flow for the pipeline script
- → `qa-data-integrity`: pass the output schema and expected value ranges for validation
- → `static-frontend-engineer`: pass the final `data.js` schema additions so frontend rendering can be updated

## 11. Example Prompts

```
"Compute 30-day rolling volatility for each country's power prices"
"Build a rebased index (base 100 = Jan 2020) for gas, oil, and power"
"Calculate the Germany–France DA price spread for each day in S.rows"
"Convert Brent prices from USD/bbl to EUR/MWh using ECB FX rates"
"Add year-over-year percentage change to the commodity data"
"Align ENTSO-E hourly data to daily closes for the chart"
```
