---
description: "Use when validating data integrity, reviewing dashboard changes, checking stale or missing data handling, verifying generated output, or debugging chart and pipeline correctness."
name: "QA Data Integrity Instructions"
---

# QA Data Integrity Instructions

- Review changes for behavioral regressions first: broken coverage, mislabeled series, mixed data horizons, stale timestamps, and hidden failures.
- Verify generated structures remain consistent with `window.APP_DATA` expectations.
- Confirm adapter failures surface through metadata and warnings instead of failing silently.
- Check that UI changes preserve visible empty, missing, and loading states where the data can be incomplete.
- When reviewing pipeline changes, inspect both raw cache outputs and the generated dashboard payload.
- Prefer targeted verification steps tied to the changed workflow, such as running `python scripts/fetch_all.py --dry-run` or `python scripts/build_data_js.py` when feasible.