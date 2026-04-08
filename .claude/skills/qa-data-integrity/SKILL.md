---
name: qa-data-integrity
description: 'Use for code review, regression checks, stale or missing data validation, payload verification, dashboard correctness checks, and confirming that pipeline failures stay visible.'
argument-hint: 'Describe the feature or pipeline area to validate'
---

# QA Data Integrity

## When to Use

- Final review of data or UI changes.
- Debugging incorrect metrics, broken charts, or hidden failures.
- Checking missing-data and stale-data handling.

## Procedure

1. Look for behavioral regressions before style issues.
2. Verify payload shapes and metadata remain coherent.
3. Confirm failures surface through warnings, status, or empty states.
4. Recommend targeted validation steps tied to the changed path.

## Output

- Findings ordered by risk.
- Verification gaps.
- Concrete follow-up checks.