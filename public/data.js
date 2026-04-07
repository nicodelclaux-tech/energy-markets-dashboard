// public/data.js
// Synthetic sample output — replaced each morning by the GitHub Actions pipeline.
// Structure mirrors exactly what build_data_js.py generates from live data.

window.APP_DATA = {
  "meta": {
    "updatedAt": "2026-04-07T06:00:00+00:00",
    "sources": {
      "entsoe": { "status": "ok", "total_rows": 10950, "elapsed_s": 12.4 },
      "ember":  { "status": "ok", "total_rows": 720,   "elapsed_s": 3.1 },
      "fmp":    { "status": "ok", "total_rows": 9125,  "elapsed_s": 5.6 },
      "ecb":    { "status": "ok", "total_rows": 3650,  "elapsed_s": 2.3 },
      "eia":    { "status": "ok", "total_rows": 7300,  "elapsed_s": 8.9 },
      "news":   { "status": "ok", "total_items": 42,   "elapsed_s": 4.2 }
    },
    "coverage": {
      "ES": 1825, "DE": 1825, "FR": 1825,
      "IT": 1825, "GB": 1825, "NL": 1825
    },
    "warnings": []
  },

  "series": {
    "entsoe_prices": {
      "DE": [
        { "date": "2026-04-05", "value": 82.34, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 79.10, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 80.55, "unit": "EUR/MWh" }
      ],
      "FR": [
        { "date": "2026-04-05", "value": 75.20, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 72.85, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 74.00, "unit": "EUR/MWh" }
      ],
      "ES": [
        { "date": "2026-04-05", "value": 68.90, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 65.40, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 67.10, "unit": "EUR/MWh" }
      ],
      "IT": [
        { "date": "2026-04-05", "value": 90.15, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 87.30, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 88.75, "unit": "EUR/MWh" }
      ],
      "GB": [
        { "date": "2026-04-05", "value": 95.60, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 91.20, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 93.45, "unit": "EUR/MWh" }
      ],
      "NL": [
        { "date": "2026-04-05", "value": 83.10, "unit": "EUR/MWh" },
        { "date": "2026-04-06", "value": 80.55, "unit": "EUR/MWh" },
        { "date": "2026-04-07", "value": 81.90, "unit": "EUR/MWh" }
      ]
    },
    "brent": [
      { "date": "2026-04-05", "value": 84.20, "unit": "USD/bbl" },
      { "date": "2026-04-06", "value": 83.75, "unit": "USD/bbl" },
      { "date": "2026-04-07", "value": 84.50, "unit": "USD/bbl" }
    ],
    "wti": [
      { "date": "2026-04-05", "value": 80.10, "unit": "USD/bbl" },
      { "date": "2026-04-06", "value": 79.65, "unit": "USD/bbl" },
      { "date": "2026-04-07", "value": 80.40, "unit": "USD/bbl" }
    ],
    "henry_hub": [
      { "date": "2026-04-05", "value": 2.35, "unit": "USD/MMBtu" },
      { "date": "2026-04-06", "value": 2.38, "unit": "USD/MMBtu" },
      { "date": "2026-04-07", "value": 2.40, "unit": "USD/MMBtu" }
    ],
    "ng_storage": [
      { "date": "2026-04-04", "value": 1842.0, "unit": "Bcf" }
    ],
    "eurusd": [
      { "date": "2026-04-05", "value": 1.0835, "unit": "FX" },
      { "date": "2026-04-06", "value": 1.0812, "unit": "FX" },
      { "date": "2026-04-07", "value": 1.0845, "unit": "FX" }
    ],
    "gbpusd": [
      { "date": "2026-04-05", "value": 1.2640, "unit": "FX" },
      { "date": "2026-04-06", "value": 1.2615, "unit": "FX" },
      { "date": "2026-04-07", "value": 1.2655, "unit": "FX" }
    ],
    "gbpeur": [
      { "date": "2026-04-05", "value": 0.8571, "unit": "FX" },
      { "date": "2026-04-06", "value": 0.8545, "unit": "FX" },
      { "date": "2026-04-07", "value": 0.8562, "unit": "FX" }
    ]
  },

  "countries": {
    "DE": {
      "power_prices": [
        { "date": "2026-04-07", "value": 80.55, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "wind_offshore": 12.4,
        "wind_onshore":  28.1,
        "solar":         15.3,
        "nuclear":        0.0,
        "gas":           18.7,
        "coal":           9.2,
        "hydro":          3.1,
        "other":          13.2
      },
      "fundamentals": { "latest_price_eur_mwh": 80.55 }
    },
    "FR": {
      "power_prices": [
        { "date": "2026-04-07", "value": 74.00, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "nuclear": 68.5,
        "hydro":   10.2,
        "wind":     8.1,
        "solar":    4.3,
        "gas":      6.9,
        "other":    2.0
      },
      "fundamentals": { "latest_price_eur_mwh": 74.00 }
    },
    "ES": {
      "power_prices": [
        { "date": "2026-04-07", "value": 67.10, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "wind":   28.4,
        "solar":  19.6,
        "nuclear": 20.1,
        "hydro":  13.2,
        "gas":    11.5,
        "other":   7.2
      },
      "fundamentals": { "latest_price_eur_mwh": 67.10 }
    },
    "IT": {
      "power_prices": [
        { "date": "2026-04-07", "value": 88.75, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "gas":   42.1,
        "solar": 16.8,
        "hydro": 18.3,
        "wind":  10.4,
        "other": 12.4
      },
      "fundamentals": { "latest_price_eur_mwh": 88.75 }
    },
    "GB": {
      "power_prices": [
        { "date": "2026-04-07", "value": 93.45, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "wind_offshore": 32.1,
        "wind_onshore":  10.5,
        "nuclear":       14.2,
        "gas":           28.4,
        "solar":          5.8,
        "hydro":          2.1,
        "other":          6.9
      },
      "fundamentals": { "latest_price_eur_mwh": 93.45 }
    },
    "NL": {
      "power_prices": [
        { "date": "2026-04-07", "value": 81.90, "unit": "EUR/MWh" }
      ],
      "generation_mix": {
        "wind":  38.2,
        "solar": 14.5,
        "gas":   32.8,
        "other": 14.5
      },
      "fundamentals": { "latest_price_eur_mwh": 81.90 }
    }
  },

  "forwardCurves": {},

  "comparisons": {
    "brent": {
      "latest_value": 84.50,
      "latest_date": "2026-04-07",
      "change_1d": 0.75, "pct_change_1d": 0.90,
      "change_1w": 2.10, "pct_change_1w": 2.55,
      "change_1m": -1.30, "pct_change_1m": -1.52,
      "change_1y": 5.20,  "pct_change_1y":  6.56,
      "high_5y": 127.98, "low_5y": 19.33, "current_pct_rank": 62.4
    },
    "entsoe_DE": {
      "latest_value": 80.55,
      "latest_date": "2026-04-07",
      "change_1d": 1.45, "pct_change_1d": 1.83,
      "change_1w": -3.20, "pct_change_1w": -3.82,
      "change_1m": 4.80,  "pct_change_1m":  6.34,
      "change_1y": -12.50, "pct_change_1y": -13.44,
      "high_5y": 545.40, "low_5y": -22.50, "current_pct_rank": 30.2
    }
  },

  "rankings": {
    "latest_price_eur_mwh": {
      "rankings": [
        { "country": "ES", "value": 67.10,  "rank": 1 },
        { "country": "FR", "value": 74.00,  "rank": 2 },
        { "country": "DE", "value": 80.55,  "rank": 3 },
        { "country": "NL", "value": 81.90,  "rank": 4 },
        { "country": "IT", "value": 88.75,  "rank": 5 },
        { "country": "GB", "value": 93.45,  "rank": 6 }
      ],
      "top":    [{ "country": "GB", "value": 93.45, "rank": 1 }],
      "bottom": [{ "country": "ES", "value": 67.10, "rank": 1 }]
    }
  },

  "news": [
    {
      "id": "a1b2c3d4e5f60001",
      "headline": "Germany accelerates offshore wind buildout amid power price pressures",
      "url": "https://www.theguardian.com/example-article-1",
      "publishedAt": "2026-04-07T08:30:00Z",
      "source": "guardian",
      "country_tags": ["DE"],
      "topic_tags": ["renewables", "power"],
      "summary": "Berlin has approved permits for an additional 4 GW of offshore wind capacity to come online by 2028.",
      "relevance_score": 8.5
    },
    {
      "id": "a1b2c3d4e5f60002",
      "headline": "France restarts two nuclear units ahead of summer demand peak",
      "url": "https://www.theguardian.com/example-article-2",
      "publishedAt": "2026-04-07T09:15:00Z",
      "source": "guardian",
      "country_tags": ["FR"],
      "topic_tags": ["nuclear", "power"],
      "summary": "EDF confirmed units 3 and 4 at Tricastin are back online following scheduled maintenance.",
      "relevance_score": 8.2
    },
    {
      "id": "a1b2c3d4e5f60003",
      "headline": "Spain sets new record for solar generation, prices fall below EUR 40/MWh",
      "url": "https://www.theguardian.com/example-article-3",
      "publishedAt": "2026-04-06T14:00:00Z",
      "source": "guardian",
      "country_tags": ["ES"],
      "topic_tags": ["renewables", "power"],
      "summary": "Iberian solar generation hit an all-time high of 22 GW on Easter Sunday.",
      "relevance_score": 9.0
    }
  ]
};
