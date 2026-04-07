"""
config/settings.py
------------------
Central settings loaded from environment variables (or a .env file).
All adapters import from here; no API key is ever hard-coded.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env if it exists (ignored in CI where secrets are injected directly)
load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_RAW_DIR = ROOT_DIR / "data" / "raw"
DATA_PROCESSED_DIR = ROOT_DIR / "data" / "processed"
PUBLIC_DIR = ROOT_DIR / "public"
OUTPUT_DATA_JS = PUBLIC_DIR / "data.js"

# Ensure directories exist at import time
DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# API keys  (set via environment / GitHub Actions secrets)
# ---------------------------------------------------------------------------
ENTSOE_API_KEY: str = os.environ.get("ENTSOE_API_KEY", "")
FMP_API_KEY: str = os.environ.get("FMP_API_KEY", "")
EIA_API_KEY: str = os.environ.get("EIA_API_KEY", "")
GUARDIAN_API_KEY: str = os.environ.get("GUARDIAN_API_KEY", "")
EMBER_API_KEY: str = os.environ.get("EMBER_API_KEY", "")

# ---------------------------------------------------------------------------
# HTTP settings
# ---------------------------------------------------------------------------
REQUEST_TIMEOUT: int = 30          # seconds per request
MAX_RETRIES: int = 3
RETRY_BACKOFF: float = 2.0         # exponential factor for tenacity

# ---------------------------------------------------------------------------
# Data window
# ---------------------------------------------------------------------------
LOOKBACK_YEARS: int = 5
