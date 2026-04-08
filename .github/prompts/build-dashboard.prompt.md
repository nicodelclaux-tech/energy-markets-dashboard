---
description: "Build or extend the European energy markets dashboard using the repo workflow for product strategy, UI architecture, design system, charting, frontend implementation, and QA."
name: "Build Dashboard"
argument-hint: "Describe the dashboard feature, page, or workflow to build"
agent: "agent"
---

Build or extend the European energy markets dashboard for this repository.

Use this workflow:

1. Frame the user outcome and dashboard scope using the product strategy lens.
2. Define the page, information architecture, and interaction model.
3. Establish the visual system and chart treatment needed for the feature.
4. Implement the frontend and data contract changes required by the design.
5. Validate data integrity, missing-data states, and dashboard behavior.

Constraints:

- Keep historical, forward, and forecast data distinct.
- Use `window.APP_DATA` as the data contract unless the task explicitly includes pipeline changes.
- Preserve the institutional tone of the dashboard.
- Surface missing and stale data explicitly.