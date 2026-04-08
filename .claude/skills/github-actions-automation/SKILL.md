---
name: github-actions-automation
description: 'Use for GitHub Actions workflows, scheduled data refreshes, secrets usage, CI safety, automation changes, and repository jobs that fetch or publish dashboard data.'
argument-hint: 'Describe the workflow or automation change'
---

# GitHub Actions Automation

## When to Use

- Editing `.github/workflows/`.
- Changing refresh schedules or workflow steps.
- Improving automation around data fetch, build, or publish steps.

## Procedure

1. Preserve the fetch then build sequence unless the architecture changes intentionally.
2. Keep workflows idempotent and safe for scheduled runs.
3. Use secrets for credentials and avoid embedding sensitive values.
4. Ensure failures are diagnosable from workflow logs and generated metadata.

## Output

- Workflow changes that align with the repo's data refresh contract.