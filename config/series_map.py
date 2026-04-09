"""
config/series_map.py
--------------------
Single source of truth for countries, bidding-zone EIC codes, commodity
tickers, EIA series IDs, and news-topic keyword lists.

Edit this file to add / remove countries or instruments without touching
any adapter code.
"""

# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------
# Maps ISO 3166-1 alpha-2 code → display name
# "Focus" countries used by ENTSO-E and Ember adapters (electricity data).
COUNTRIES: dict[str, str] = {
    "ES": "Spain",
    "DE": "Germany",
    "FR": "France",
    "IT": "Italy",
    "GB": "United Kingdom",
    "NL": "Netherlands",
    "NO": "Norway",
    "SE": "Sweden",
    "FI": "Finland",
    "DK": "Denmark",
    "IE": "Ireland",
}

# Full geographic scope: EU-27 + EEA (IS, LI, NO) + UK + Switzerland.
# Used by the Alpha Vantage news adapter and the GIE adapter.
ALL_COUNTRIES: dict[str, str] = {
    # EU-27
    "AT": "Austria",
    "BE": "Belgium",
    "BG": "Bulgaria",
    "CY": "Cyprus",
    "CZ": "Czech Republic",
    "DE": "Germany",
    "DK": "Denmark",
    "EE": "Estonia",
    "ES": "Spain",
    "FI": "Finland",
    "FR": "France",
    "GR": "Greece",
    "HR": "Croatia",
    "HU": "Hungary",
    "IE": "Ireland",
    "IT": "Italy",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "LV": "Latvia",
    "MT": "Malta",
    "NL": "Netherlands",
    "PL": "Poland",
    "PT": "Portugal",
    "RO": "Romania",
    "SE": "Sweden",
    "SI": "Slovenia",
    "SK": "Slovakia",
    # EEA (non-EU)
    "IS": "Iceland",
    "LI": "Liechtenstein",
    "NO": "Norway",
    # UK + Switzerland
    "GB": "United Kingdom",
    "CH": "Switzerland",
}

# ENTSO-E bidding-zone EIC codes (used as both in_Domain and out_Domain for
# day-ahead price queries).
ENTSOE_BIDDING_ZONES: dict[str, str] = {
    "ES": "10YES-REE------0",
    "DE": "10Y1001A1001A82H",   # DE-LU merged zone
    "FR": "10YFR-RTE------C",
    "IT": "10Y1001A1001A70O",   # IT-North
    "GB": "10YGB----------A",
    "NL": "10YNL----------L",
    "NO": "10YNO-2--------T",   # NO2 (southern Norway) — most liquid EU-connected zone
    "SE": "10Y1001A1001A46L",   # SE3 (central/Stockholm)
    "FI": "10YFI-1--------U",   # Finland (single zone)
    "DK": "10YDK-1--------W",   # DK1 (western Denmark, Continental-connected)
    "IE": "10Y1001A1001A59C",   # SEM (all-island single electricity market)
}

# ---------------------------------------------------------------------------
# Commodities & FX  — Financial Modeling Prep tickers
# ---------------------------------------------------------------------------
# FMP symbol → (display name, unit)
FMP_SYMBOLS: dict[str, tuple[str, str]] = {
    "OUSX": ("Brent Crude",      "USD/bbl"),
    "OJSX": ("WTI Crude",        "USD/bbl"),
    "NGAS": ("Henry Hub Gas",    "USD/MMBtu"),
    "EURUSD": ("EUR/USD",        "FX"),
    "GBPUSD": ("GBP/USD",        "FX"),
}

# ---------------------------------------------------------------------------
# EIA v2 series
# ---------------------------------------------------------------------------
# Logical name → (route suffix, facet series key, unit, frequency)
EIA_SERIES: dict[str, tuple[str, str, str, str]] = {
    "brent":     ("petroleum/pri/spt/data/", "RBRTE", "USD/bbl",    "daily"),
    "wti":       ("petroleum/pri/spt/data/", "RWTC",  "USD/bbl",    "daily"),
    "henry_hub": ("natural-gas/pri/fut/data/", "RNGWHHD", "USD/MMBtu", "weekly"),
    "ng_storage":("natural-gas/stor/sum/data/", "NW2_EPG0_SWO_R48_BCF", "Bcf", "weekly"),
}

# ---------------------------------------------------------------------------
# ECB exchange-rate series  (free, no API key required)
# ---------------------------------------------------------------------------
# Logical name → ECB flow key
ECB_SERIES: dict[str, str] = {
    "eurusd": "EXR/D.USD.EUR.SP00.A",
    "gbpeur": "EXR/D.GBP.EUR.SP00.A",
}

# ---------------------------------------------------------------------------
# News topics
# ---------------------------------------------------------------------------
# Topic label → keywords to search / detect in headlines / summaries
NEWS_TOPICS: dict[str, list[str]] = {
    "power":        ["power", "electricity", "grid", "megawatt", "MWh", "generation"],
    "gas":          ["gas", "natural gas", "TTF", "pipeline", "LNG"],
    "LNG":          ["LNG", "liquefied natural gas", "regasification", "FSRU"],
    "renewables":   ["renewable", "wind", "solar", "photovoltaic", "offshore", "onshore"],
    "nuclear":      ["nuclear", "reactor", "uranium", "fission", "EPR"],
    "weather":      ["weather", "heatwave", "cold snap", "drought", "storm", "temperature"],
    "regulation":   ["regulation", "policy", "directive", "legislation", "reform", "market design"],
    "emissions":    ["emissions", "CO2", "carbon", "EUA", "ETS", "greenhouse"],
    "market_reform":["market reform", "electricity market", "capacity market", "energy reform"],
}

# ---------------------------------------------------------------------------
# Alpha Vantage metals / commodities
# ---------------------------------------------------------------------------
# Logical name → (AV function, from_symbol, to_symbol or None, unit, description)
# Gold and Silver use the FX_DAILY endpoint (XAU/XAG are ISO currency codes).
# Copper uses the dedicated COPPER commodity endpoint.
AV_METALS: dict[str, tuple] = {
    "gold":   ("FX_DAILY",  "XAU", "USD",  "USD/oz",  "Gold Spot"),
    "silver": ("FX_DAILY",  "XAG", "USD",  "USD/oz",  "Silver Spot"),
    "copper": ("COPPER",    None,   None,   "USD/lb",  "Copper Spot"),
}

# Alpha Vantage NEWS_SENTIMENT topic identifiers.
# Each string is a valid value for the ?topics= parameter.
AV_NEWS_TOPICS: list[str] = [
    "energy_transportation",
    "commodities",
    "financial_markets",
    "economy_macro",
]

# ---------------------------------------------------------------------------
# GIE / AGSI country scope
# ---------------------------------------------------------------------------
# Countries that have gas storage facilities tracked by AGSI (GIE).
# Not all ALL_COUNTRIES have storage; missing ones are silently skipped.
GIE_GAS_COUNTRIES: list[str] = [
    "AT", "BE", "BG", "CZ", "DE", "DK", "ES", "FR", "HR",
    "HU", "IE", "IT", "LT", "LU", "LV", "NL", "PL", "PT",
    "RO", "SE", "SK", "SI", "GB",
]

# Countries that have LNG import terminals tracked by ALSI (GIE).
GIE_LNG_COUNTRIES: list[str] = [
    "BE", "ES", "FI", "FR", "GB", "GR", "IT", "LT", "NL",
    "PL", "PT", "SE",
]
