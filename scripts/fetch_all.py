"""
scripts/fetch_all.py
--------------------
Orchestration script: runs every configured adapter in isolation and writes
raw data to data/raw/.

Each adapter is wrapped in a try/except so that a single failing source never
aborts the pipeline.  All errors are collected and written to
``data/raw/fetch_meta.json`` for downstream consumption by build_data_js.py.

Usage
-----
    python scripts/fetch_all.py             # full run
    python scripts/fetch_all.py --dry-run   # skip network calls, just log
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Logging — configure before any adapter imports
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)-30s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("fetch_all")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.settings import DATA_RAW_DIR

# Adapters are imported lazily so that a broken adapter module doesn't
# prevent the others from running
ADAPTER_MODULES = [
    ("entsoe",  "scripts.adapters.entsoe",  "fetch_all"),
    ("ember",   "scripts.adapters.ember",   "fetch_all"),
    ("fmp",     "scripts.adapters.fmp",     "fetch_all"),
    ("ecb",     "scripts.adapters.ecb",     "fetch_all"),
    ("eia",     "scripts.adapters.eia",     "fetch_all"),
    ("news",    "scripts.adapters.news",    "fetch_all"),
]


def run(dry_run: bool = False) -> dict:
    """
    Run every adapter and return a metadata summary dict.

    Returns
    -------
    {
        "updatedAt": "...",
        "sources": {name: {"status": "ok"|"error"|"skipped", "message": "...", ...}},
        "warnings": ["..."],
    }
    """
    meta: dict = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {},
        "warnings": [],
    }

    if dry_run:
        logger.info("DRY RUN — no network calls will be made")

    for name, module_path, func_name in ADAPTER_MODULES:
        logger.info("=" * 60)
        logger.info("Running adapter: %s", name)
        t0 = time.time()
        try:
            if dry_run:
                meta["sources"][name] = {"status": "skipped", "message": "dry-run"}
                continue

            import importlib
            mod = importlib.import_module(module_path)
            fn = getattr(mod, func_name)
            result = fn()

            elapsed = round(time.time() - t0, 1)
            # Summarise what was returned
            if isinstance(result, dict):
                total_rows = sum(
                    len(df) for df in result.values()
                    if hasattr(df, "__len__")
                )
                coverage = {k: len(v) for k, v in result.items() if hasattr(v, "__len__")}
                meta["sources"][name] = {
                    "status": "ok",
                    "total_rows": total_rows,
                    "coverage": coverage,
                    "elapsed_s": elapsed,
                }
            elif isinstance(result, list):
                meta["sources"][name] = {
                    "status": "ok",
                    "total_items": len(result),
                    "elapsed_s": elapsed,
                }
            else:
                meta["sources"][name] = {"status": "ok", "elapsed_s": elapsed}

            logger.info("Adapter %s finished in %.1fs", name, elapsed)

        except Exception as exc:
            elapsed = round(time.time() - t0, 1)
            msg = f"{type(exc).__name__}: {exc}"
            logger.error("Adapter %s FAILED: %s", name, msg)
            meta["sources"][name] = {
                "status": "error",
                "message": msg,
                "elapsed_s": elapsed,
            }
            meta["warnings"].append(f"[{name}] {msg}")

    # Persist metadata
    meta_path = DATA_RAW_DIR / "fetch_meta.json"
    DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    logger.info("Fetch metadata written → %s", meta_path)

    failed = [k for k, v in meta["sources"].items() if v.get("status") == "error"]
    if failed:
        logger.warning("Failed adapters: %s", ", ".join(failed))
    else:
        logger.info("All adapters completed successfully")

    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch market data from all configured sources.")
    parser.add_argument("--dry-run", action="store_true", help="Skip all network calls")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
