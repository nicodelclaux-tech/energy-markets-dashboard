# Energy Markets Dashboard Copilot Instructions

## Purpose

This repository builds a professional static dashboard for European energy and commodity market analysis.

## Architecture

- The static frontend reads from `public/data.js` through the files under `public/` and `src/`.
- The Python pipeline fetches and normalizes source data under `scripts/`, `config/`, and `data/`.
- GitHub Actions refreshes cached data daily through `.github/workflows/refresh-data.yml`.
- Specialized reusable workflows live under `.github/skills/` and should be preferred when their descriptions match the request.
- **Tailwind CSS is loaded via CDN** (`@tailwindcss/browser@4`) — no build step, no Node.js required. Component classes are defined in the `<style type="text/tailwindcss">` block in `public/index.html`.
- **Design system:** Axiom Institutional — slate palette, dark-first (`html[data-theme="light"]` for light mode), 0px border-radius, IBM Plex Mono for numeric data.

## Core Rules

- Keep historical, forward, and forecast data distinct.
- Keep source-specific logic inside adapters.
- Precompute analytics in Python where practical instead of pushing heavy logic into the browser.
- Expose missing and stale data explicitly in generated outputs and UI states.
- Prefer modular, maintainable code over shortcuts.

## Focus Countries

- Spain
- Germany
- France
- Italy
- United Kingdom
- Netherlands

## Routing

For each new chat request, classify the work before answering or editing. Use the `boss` agent to automatically orchestrate multi-step tasks across multiple specialists.

- Dashboard feature or product change: follow `product-strategist`, then `dashboard-ui-architect`, `visual-design-system`, `charting-analytics`, `static-frontend-engineer`, `qa-data-integrity`, and finish with `repo-librarian` checks when relevant.
- Frontend or UI implementation: prefer `dashboard-ui-architect`, `visual-design-system`, `charting-analytics`, and `static-frontend-engineer`.
- Complex or novel chart: prefer `pro-frontend-charting-engineer` before `static-frontend-engineer`.
- New data source, adapter, or pipeline change: prefer `market-data-architect`, `api-integration`, `time-series-processing`, `qa-data-integrity`, and `repo-librarian`.
- New country support: treat it as a cross-cutting change spanning config, adapters, transforms, generated output, and UI implications.
- Review, validation, or debugging: start from `qa-data-integrity`, then use the domain-specific skill for the affected area.
- News or narrative ranking work: prefer `news-intelligence` before touching ranking or presentation logic.
- Workflow automation or scheduled refresh changes: prefer `github-actions-automation`.

## Skill Usage

- Use `boss` (`.github/agents/boss.agent.md`) to orchestrate multi-step work — it decomposes the request, routes subtasks, and spawns background sub-agents automatically.
- Prefer the skills defined under `.github/skills/` when their descriptions match the task.
- Use the skill guidance as a workflow, not as rigid role-play.
- Combine multiple skills when a request spans planning, data ingestion, transformations, frontend rendering, and validation.
- If the request is ambiguous and routing changes the implementation path, ask one short clarification question. Otherwise proceed.

## Working Conventions

- For pipeline changes, preserve the `fetch_all.py` then `build_data_js.py` flow.
- Keep adapter-specific parsing and API behavior inside `scripts/adapters/`.
- Keep derived analytics inside `scripts/transforms/` or the build step when practical.
- Treat `public/data.js` as generated output, not the source of truth.
- When adding new series or countries, update config maps first and propagate the change through fetch, build, and presentation layers.
- When changing UI behavior, preserve the institutional dashboard style and keep missing-data states visible instead of silently hiding gaps.