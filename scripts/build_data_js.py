"""
scripts/build_data_js.py
------------------------
Reads all cached raw files produced by fetch_all.py, applies normalization
and comparison transforms, then writes a single ``public/data.js`` file that
a static HTML dashboard can consume directly.

The output structure is:

    window.APP_DATA = {
      meta:        { updatedAt, sources, coverage, warnings },
      series:      { entsoe_prices, brent, wti, henry_hub, ... },
      countries:   { DE: { power_prices, generation_mix, fundamentals }, ... },
      forwardCurves: {},
      comparisons: { brent: {...}, entsoe_DE: {...}, ... },
      news:        [...]
    };

Usage
-----
    python scripts/build_data_js.py
    python scripts/build_data_js.py --output /custom/path/data.js
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)-25s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("build_data_js")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.series_map import COUNTRIES, FMP_SYMBOLS, ECB_SERIES, EIA_SERIES
from config.settings import DATA_RAW_DIR, OUTPUT_DATA_JS
from scripts.transforms.comparisons import compute_all_comparisons
from scripts.transforms.normalize import normalize_dates, normalize_values, dedup_series
from scripts.transforms.rankings import compute_country_rankings
from scripts.transforms.news_ranker import rank_news

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_csv(path: Path) -> pd.DataFrame:
    """Read CSV if it exists; return empty DataFrame otherwise."""
    if path.exists() and path.stat().st_size > 0:
        try:
            return pd.read_csv(path, parse_dates=["date"])
        except Exception as exc:
            logger.warning("Could not read %s: %s", path, exc)
    return pd.DataFrame()


def _to_records(df: pd.DataFrame, value_col: str = "value", unit: str = "") -> list[dict]:
    """Convert a tidy DataFrame into a list of {date, value, unit} dicts."""
    if df.empty or value_col not in df.columns or "date" not in df.columns:
        return []
    records = []
    for _, row in df.iterrows():
        val = row[value_col]
        if pd.isna(val):
            continue
        records.append({
            "date": str(row["date"])[:10],
            "value": round(float(val), 4),
            "unit": row.get("unit", unit) if "unit" in df.columns else unit,
        })
    return records


def _df_to_series(df: pd.DataFrame, value_col: str = "value") -> pd.Series:
    """Convert a date/value DataFrame into a DatetimeIndex Series."""
    if df.empty or "date" not in df.columns or value_col not in df.columns:
        return pd.Series(dtype=float)
    s = df.set_index(pd.to_datetime(df["date"]))[value_col].sort_index()
    return s.dropna()


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def load_entsoe_prices() -> dict[str, pd.DataFrame]:
    """Load cached ENTSO-E day-ahead prices for each country."""
    logger.info("Loading ENTSO-E prices …")
    result: dict[str, pd.DataFrame] = {}
    for cc in COUNTRIES:
        df = _read_csv(DATA_RAW_DIR / f"entsoe_{cc}.csv")
        if not df.empty:
            df = normalize_dates(df)
            df = normalize_values(df)
            df = dedup_series(df, ["date", "country_code"])
        result[cc] = df
    return result


def load_commodity_series() -> dict[str, pd.DataFrame]:
    """Load cached FMP commodity and FX price series."""
    logger.info("Loading commodity series …")
    result: dict[str, pd.DataFrame] = {}
    for symbol in FMP_SYMBOLS:
        df = _read_csv(DATA_RAW_DIR / f"fmp_{symbol}.csv")
        if not df.empty:
            df = normalize_dates(df)
            if "close" in df.columns:
                df = normalize_values(df, value_col="close")
            df = dedup_series(df, ["date", "symbol"])
        result[symbol] = df

    # EIA series (brent, wti, henry_hub, ng_storage)
    for sid in EIA_SERIES:
        df = _read_csv(DATA_RAW_DIR / f"eia_{sid}.csv")
        if not df.empty:
            df = normalize_dates(df)
            df = normalize_values(df)
            df = dedup_series(df, ["date", "series_id"])
        result[f"eia_{sid}"] = df

    # ECB FX series
    for sid in ECB_SERIES:
        df = _read_csv(DATA_RAW_DIR / f"ecb_{sid}.csv")
        if not df.empty:
            df = normalize_dates(df)
            df = normalize_values(df)
            df = dedup_series(df, ["date", "series_id"])
        result[f"ecb_{sid}"] = df

    return result


def load_ember_mixes() -> dict[str, pd.DataFrame]:
    """Load cached Ember generation-mix data for each country."""
    logger.info("Loading Ember generation mixes …")
    result: dict[str, pd.DataFrame] = {}
    for cc in COUNTRIES:
        df = _read_csv(DATA_RAW_DIR / f"ember_{cc}.csv")
        if not df.empty:
            df = normalize_dates(df)
        result[cc] = df
    return result


def load_news() -> list[dict]:
    """Load cached news articles."""
    logger.info("Loading news …")
    news_path = DATA_RAW_DIR / "news.json"
    if not news_path.exists():
        return []
    try:
        with open(news_path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:
        logger.warning("Could not load news.json: %s", exc)
        return []


def load_fetch_meta() -> dict:
    """Load the fetch metadata produced by fetch_all.py."""
    meta_path = DATA_RAW_DIR / "fetch_meta.json"
    if not meta_path.exists():
        return {"sources": {}, "warnings": []}
    try:
        with open(meta_path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {"sources": {}, "warnings": []}


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build(output_path: Path) -> None:
    """Assemble window.APP_DATA and write it to *output_path*."""
    logger.info("Building data.js → %s", output_path)

    # ---- Load ----
    entsoe = load_entsoe_prices()
    commodities = load_commodity_series()
    ember = load_ember_mixes()
    raw_news = load_news()
    fetch_meta = load_fetch_meta()

    # ---- Series section ----
    def _best_commodity(primary_key: str, fallback_key: str, value_col: str = "value") -> list[dict]:
        """Return records from primary key; fall back to secondary if empty."""
        df = commodities.get(primary_key, pd.DataFrame())
        vc = "close" if "close" in df.columns else value_col
        records = _to_records(df, value_col=vc)
        if not records:
            df2 = commodities.get(fallback_key, pd.DataFrame())
            vc2 = "close" if "close" in df2.columns else value_col
            records = _to_records(df2, value_col=vc2)
        return records

    series_out: dict = {
        "entsoe_prices": {
            cc: _to_records(df, value_col="value", unit="EUR/MWh")
            for cc, df in entsoe.items()
        },
        # FMP tickers (fallback to EIA for oil/gas)
        "brent":      _best_commodity("OUSX", "eia_brent"),
        "wti":        _best_commodity("OJSX", "eia_wti"),
        "henry_hub":  _best_commodity("NGAS", "eia_henry_hub"),
        "ng_storage": _to_records(commodities.get("eia_ng_storage", pd.DataFrame())),
        # FX: prefer ECB (more complete); FMP as fallback
        "eurusd": _to_records(
            commodities.get("ecb_eurusd", pd.DataFrame()),
            value_col="value"
        ) or _to_records(
            commodities.get("EURUSD", pd.DataFrame()),
            value_col="close"
        ),
        "gbpusd": _to_records(commodities.get("GBPUSD", pd.DataFrame()), value_col="close"),
        "gbpeur": _to_records(commodities.get("ecb_gbpeur", pd.DataFrame()), value_col="value"),
    }

    # ---- Countries section ----
    countries_out: dict = {}
    country_fundamentals: dict[str, dict] = {}
    for cc in COUNTRIES:
        price_df = entsoe.get(cc, pd.DataFrame())
        power_prices = _to_records(price_df, value_col="value", unit="EUR/MWh")

        # Latest price
        latest_price = None
        if power_prices:
            latest_price = power_prices[-1]["value"]

        # Generation mix pivot
        ember_df = ember.get(cc, pd.DataFrame())
        gen_mix: dict = {}
        if not ember_df.empty and "source_type" in ember_df.columns and "value_twh" in ember_df.columns:
            latest_month = ember_df["date"].max() if "date" in ember_df.columns else None
            if latest_month:
                recent = ember_df[ember_df["date"] == latest_month]
                gen_mix = dict(
                    zip(
                        recent.get("source_type", pd.Series(dtype=str)),
                        recent.get("value_twh", pd.Series(dtype=float)).round(3),
                    )
                )

        countries_out[cc] = {
            "power_prices": power_prices,
            "generation_mix": gen_mix,
            "fundamentals": {
                "latest_price_eur_mwh": latest_price,
            },
        }
        country_fundamentals[cc] = {"latest_price_eur_mwh": latest_price}

    # ---- Comparisons section ----
    logger.info("Computing comparisons …")

    def _price_series(df: pd.DataFrame, value_col: str = "value") -> pd.Series:
        vc = "close" if "close" in df.columns else value_col
        return _df_to_series(df, value_col=vc)

    def _best_series(primary_key: str, fallback_key: str, value_col: str = "value") -> pd.Series:
        """Return price Series from primary; fall back to secondary if empty."""
        s = _price_series(commodities.get(primary_key, pd.DataFrame()))
        if s.empty:
            s = _price_series(commodities.get(fallback_key, pd.DataFrame()))
        return s

    named_series: dict[str, pd.Series] = {}
    for cc, df in entsoe.items():
        named_series[f"entsoe_{cc}"] = _price_series(df)
    named_series["brent"]     = _best_series("OUSX",   "eia_brent")
    named_series["wti"]       = _best_series("OJSX",   "eia_wti")
    named_series["henry_hub"] = _best_series("NGAS",   "eia_henry_hub")
    named_series["eurusd"]    = _best_series("ecb_eurusd", "EURUSD")
    named_series["gbpusd"]    = _price_series(commodities.get("GBPUSD", pd.DataFrame()))

    unit_map = {
        **{f"entsoe_{cc}": "EUR/MWh" for cc in COUNTRIES},
        "brent": "USD/bbl", "wti": "USD/bbl",
        "henry_hub": "USD/MMBtu",
        "eurusd": "FX", "gbpusd": "FX",
    }
    comparisons_out = compute_all_comparisons(named_series, units=unit_map)

    # Country rankings
    rankings_out = compute_country_rankings(country_fundamentals)

    # ---- News section ----
    news_out = rank_news(raw_news, max_per_country=5, min_score=2.0)

    # ---- Meta section ----
    warnings = list(fetch_meta.get("warnings", []))
    sources_meta = fetch_meta.get("sources", {})

    app_data = {
        "meta": {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "sources": sources_meta,
            "coverage": {
                cc: len(series_out["entsoe_prices"].get(cc, []))
                for cc in COUNTRIES
            },
            "warnings": warnings,
        },
        "series": series_out,
        "countries": countries_out,
        "forwardCurves": {},
        "comparisons": comparisons_out,
        "rankings": rankings_out,
        "news": news_out,
    }

    # ---- Write ----
    output_path.parent.mkdir(parents=True, exist_ok=True)
    js_content = "window.APP_DATA = " + json.dumps(app_data, ensure_ascii=False, indent=2) + ";\n"
    output_path.write_text(js_content, encoding="utf-8")

    size_kb = round(output_path.stat().st_size / 1024, 1)
    n_series = len(named_series)
    logger.info(
        "data.js written: %.1f KB  (%d news articles, %d series)",
        size_kb,
        len(news_out),
        n_series,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build public/data.js from raw cached data.")
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_DATA_JS,
        help="Output path for data.js (default: public/data.js)",
    )
    args = parser.parse_args()
    build(args.output)


if __name__ == "__main__":
    main()
