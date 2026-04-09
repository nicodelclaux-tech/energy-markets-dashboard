---
name: github-actions-automation
description: "Use when: creating or modifying GitHub Actions workflows, setting up the daily data refresh schedule, adding new pipeline steps, handling workflow failures, managing secrets and environment variables, adding monitoring or alerting to the pipeline, or debugging CI/CD issues. NOT for Python data logic (time-series-processing) or API adapter code (api-integration)."
---

# GitHub Actions / Automation

## 1. Identity

You build and maintain the scheduled pipeline that refreshes market data daily and commits the updated `data.js` file to the repository. You own the automation layer — workflow YAML, environment variables, secret management, and operational reliability.

## 2. Core Mission

- Design and maintain the GitHub Actions workflow for daily data refresh
- Ensure the pipeline runs reliably: retries, timeout handling, error notifications
- Manage secrets and environment context for API keys
- Keep the refresh-to-commit cycle atomic (all-or-nothing on data quality)

## 3. When to Use This Skill

- Creating the initial daily refresh workflow
- Adding a new pipeline step (new API source, new transform)
- Debugging a failed workflow run
- Configuring new GitHub Secrets for new API keys
- Adding schedule changes (frequency, timezone)
- Adding notifications (GitHub Issues on failure, Slack webhook)
- Optimizing pipeline performance (parallelism, caching)

## 4. When NOT to Use This Skill

- Writing Python data logic (→ `time-series-processing`)
- Writing API adapter functions (→ `api-integration`)
- Configuring GitHub Pages deployment (different scope)

## 5. Inputs Expected

- Pipeline script name and entry point (e.g., `scripts/refresh.py`)
- Required environment variables (API key names from `api-integration`)
- Expected output file (`data.js`)
- Failure behavior: silent skip, notification, or hard fail?
- Schedule requirement (e.g., "every morning at 6:00 UTC")

## 6. Standard Daily Refresh Workflow

```yaml
# .github/workflows/daily-refresh.yml
name: Daily Market Data Refresh

on:
  schedule:
    - cron: '0 6 * * 1-5'   # 06:00 UTC, Monday–Friday
  workflow_dispatch:         # Manual trigger for testing

permissions:
  contents: write            # Needed to commit data.js

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 15      # Hard stop — never let a hung job consume credits

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r scripts/requirements.txt

      - name: Run data refresh pipeline
        env:
          FMP_API_KEY:     ${{ secrets.FMP_API_KEY }}
          ENTSO_E_TOKEN:   ${{ secrets.ENTSO_E_TOKEN }}
          ECB_API_KEY:     ${{ secrets.ECB_API_KEY }}    # optional — ECB is free
          EIA_API_KEY:     ${{ secrets.EIA_API_KEY }}    # optional
          GNEWS_API_KEY:   ${{ secrets.GNEWS_API_KEY }}  # optional
        run: python scripts/refresh.py

      - name: Validate output
        run: python scripts/validate_output.py data.js

      - name: Commit updated data
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data.js
          git diff --staged --quiet || git commit -m "chore: refresh market data $(date -u '+%Y-%m-%d %H:%M UTC')"
          git push
```

## 7. Workflow Design Principles

### Atomicity
```yaml
# Only commit if validation passes
- name: Run pipeline + validate
  run: |
    python scripts/refresh.py && python scripts/validate_output.py data.js
    # If validate_output.py exits non-zero, the commit step is never reached
```

### Failure Notification (GitHub Issue on failure)
```yaml
- name: Create failure issue
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `Pipeline failure: ${new Date().toISOString().split('T')[0]}`,
        body: `The daily refresh workflow failed.\n\nRun: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
        labels: ['pipeline-failure']
      });
```

### Caching Python Dependencies
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.11'
    cache: 'pip'              # caches ~/.cache/pip across runs
```

### Manual Backfill Trigger
```yaml
on:
  workflow_dispatch:
    inputs:
      from_date:
        description: 'Historical start date (YYYY-MM-DD)'
        required: false
        default: ''
      dry_run:
        description: 'Run without committing (true/false)'
        required: false
        default: 'false'
```

## 8. Secret Management

### Required Secrets
Configure in: Repository Settings → Secrets and variables → Actions

| Secret name | Required | Description |
|-------------|----------|-------------|
| `FMP_API_KEY` | ✅ | Financial Modeling Prep API key |
| `ENTSO_E_TOKEN` | ✅ (for power data) | ENTSO-E Transparency Platform security token |
| `ECB_API_KEY` | ❌ (free API) | ECB — no auth needed; omit or leave empty |
| `EIA_API_KEY` | Optional | EIA US energy data |
| `GNEWS_API_KEY` | Optional | GNews API for news feed |

### Never in Workflow YAML
- ❌ Never hardcode API keys in workflow files
- ❌ Never `echo` secrets in run steps (they'll appear in logs)
- ❌ Never store keys in `config.js` for server-use (config.js is public)

### `config.js` vs Secrets
`config.js` is a **public file** readable by anyone who visits the dashboard. It should only contain:
- FMP API key for **client-visible** commodity history fetching (acceptable because FMP restricts by origin)
- Dashboard configuration (thresholds, registry, timeouts)

GitHub Secrets are for **pipeline-only** values (ENTSO-E tokens, write credentials).

## 9. Pipeline Script Interface

Your workflow calls Python scripts. These scripts must follow this contract:

```python
# scripts/refresh.py — entry point
# Exit code 0 = success (data.js written)
# Exit code 1 = failure (data.js NOT written or invalid)

if __name__ == '__main__':
    import sys
    try:
        run_pipeline()
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
```

```python
# scripts/validate_output.py — validation guard
# Usage: python scripts/validate_output.py data.js
# Exit code 0 = data.js is valid
# Exit code 1 = invalid (prevents commit)

import sys, json

def validate(path):
    with open(path) as f:
        content = f.read()
    # data.js is a JS file, not JSON — check the window.MARKET_DATA assignment
    assert 'window.MARKET_DATA' in content, "Missing MARKET_DATA declaration"
    assert 'lastUpdated' in content, "Missing lastUpdated field"
    # Add more checks as pipeline grows
    print(f"✓ {path} is valid")

if __name__ == '__main__':
    validate(sys.argv[1])
```

## 10. Schedule Conventions

| Use case | Cron |
|---------|------|
| Weekday morning refresh (EU open) | `0 6 * * 1-5` (06:00 UTC = 07:00 CET) |
| Pre-market refresh (includes weekend) | `0 5 * * *` |
| Mid-day top-up | `0 12 * * 1-5` |
| Add 30min variance to avoid peak-hour API contention | `30 6 * * 1-5` |

## 11. Guardrails

- **`timeout-minutes: 15`** is mandatory. A hung Python script must not block the runner forever.
- **`permissions: contents: write`** must be explicitly set. Workflows default to read-only.
- **Commit only when data changes.** The `git diff --staged --quiet` guard prevents empty commits.
- **Validate before commit.** Never commit `data.js` without the validation step passing.
- **Secrets are never printed.** Sanity-check any `run:` step that could accidentally echo a secret.

## 12. Quality Checklist

- [ ] `timeout-minutes` set on all jobs
- [ ] `workflow_dispatch` trigger present for manual testing
- [ ] All API keys loaded from Secrets, not hardcoded
- [ ] Validation step runs before commit step
- [ ] Commit step guarded against empty diffs
- [ ] `git config user.name/email` set to bot identity (not personal account)
- [ ] Failure notification defined (issue creation or similar)
- [ ] `cache: 'pip'` enabled for Python step
- [ ] Secrets registry documented in this file or README

## 13. Handoff Instructions

After delivering a workflow:
- → `qa-data-integrity`: pass the validation script and expected data.js content so they can write stronger assertions
- → `repo-librarian`: pass new secret names and setup instructions for README

## 14. Example Prompts

```
"Create the initial daily refresh GitHub Actions workflow"
"Add ECB EUR/USD rate fetching to the existing refresh pipeline"
"The pipeline failed at 06:00 UTC — debug the error and fix the workflow"
"Add a manual backfill trigger that accepts a start date parameter"
"Set up failure notification via a GitHub Issue when the pipeline fails"
"Add caching for the pip install step to speed up workflow runs"
```
