# Data Dictionary

> All canonical data fields used in the Power Dashboard. Update this file whenever a new source is added or a schema changes.

---

## Power Prices (ENTSO-E)

| Field | Type | Unit | Source | Notes |
|-------|------|------|--------|-------|
| `date` | string | ISO 8601 date | ENTSO-E | `YYYY-MM-DD` |
| `de` | number | EUR/MWh | ENTSO-E | Germany Day-Ahead price |
| `fr` | number | EUR/MWh | ENTSO-E | France Day-Ahead price |
| `es` | number | EUR/MWh | ENTSO-E | Spain Day-Ahead price |
| `it` | number | EUR/MWh | ENTSO-E | Italy (North) Day-Ahead price |
| `uk` | number | GBP/MWh | ENTSO-E | UK N2EX Day-Ahead price |
| `nl` | number | EUR/MWh | ENTSO-E | Netherlands Day-Ahead price |

Stored in `S.rows[]` after `loadData()`.

---

## Commodity Prices (FMP)

| Field | Type | Unit | FMP Symbol | Status | Color |
|-------|------|------|-----------|--------|-------|
| `brent` | OHLC | USD/bbl | `BZUSD` | ✅ Verified | `#c0392b` |
| `gold` | OHLC | USD/oz | `GCUSD` | ✅ Verified | `#d97706` |
| `henryhub` | OHLC | USD/MMBtu | `NGUSD` | ⚠️ 402 | `#2563eb` |
| `wti` | OHLC | USD/bbl | `CLUSD` | ⚠️ 402 | `#7c3aed` |

Stored in `S.commodity.rowsByKey[key][]` after `fetchCommodityHistory()`.

### OHLC Schema
```js
{
  date: 'YYYY-MM-DD',
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number   // may be 0 or null for commodities
}
```

---

## FX Rates (ECB)

| Field | Type | Unit | Source | Notes |
|-------|------|------|--------|-------|
| `eur_usd` | number | EUR/USD | ECB | Daily reference rate |
| `eur_gbp` | number | EUR/GBP | ECB | Daily reference rate |

---

## Forward Curves (proposed schema — not yet implemented)

```js
// window.MARKET_DATA.forwardCurves
{
  de_power: [
    { maturity: 'Cal-2026', price: 87.50, currency: 'EUR/MWh', asOf: '2026-04-07' }
  ],
  fr_power: [...],
  ttf_gas: [
    { maturity: 'M+1', price: 35.20, currency: 'EUR/MWh', asOf: '2026-04-07' }
  ]
}
```

**Rule:** Forward curve data must always carry `asOf` date. Never blend with historical spot in the same chart series.

---

## Naming Conventions

- Country codes: lowercase two-letter ISO codes (`de`, `fr`, `es`, `it`, `uk`, `nl`)
- Commodity keys: lowercase hyphenated (`brent`, `ttf-gas`, `eua-carbon`)
- Dates: `YYYY-MM-DD` strings throughout (no Date objects in `data.js`)
- Units: always in canonical unit (EUR/MWh for power; convert at pipeline time)
- Missing values: `null` (never `0`, never `""`, never omitted)

---

## Source Coverage Matrix

```
              | DE | FR | ES | IT | UK | NL |
DA Power      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
Net Load      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
Wind Gen      | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
Solar Gen     | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
Nuclear Gen   | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
Fwd Curve     | ✅ | ⚠️ | ❌ | ❌ | ✅ | ❌ |
```

Key: ✅ Available | ⚠️ Partial / requires additional work | ❌ Not available

---

## Data Quality Flags

| Flag | Meaning |
|------|---------|
| `verified: true` | End-to-end confirmed by QA agent |
| `verified: false` | Registered but not yet tested |
| `⚠️ 402` | API endpoint requires paid plan upgrade |
| `stale` | Last successful fetch > 36 hours ago |
