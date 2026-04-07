# Project Orchestration Guide

## Purpose
This repository builds a professional static dashboard for European energy and commodity market analysis.

## Architecture
- Static frontend reads from `public/data.js`
- Python pipeline fetches and normalizes data
- GitHub Actions refreshes data daily
- `.claude/skills` contains specialized agent skills

## Focus Countries
- Spain
- Germany
- France
- Italy
- United Kingdom
- Netherlands

## Core Rules
1. Keep historical, forward, and forecast data distinct.
2. Keep source-specific logic inside adapters.
3. Precompute analytics in Python where practical.
4. Expose missing and stale data explicitly.
5. Prefer modular, maintainable code over shortcuts.

## Default Handoffs
- New feature: product-strategist -> dashboard-ui-architect -> visual-design-system -> charting-analytics -> static-frontend-engineer -> qa-data-integrity -> repo-librarian
- New data source: market-data-architect -> api-integration -> time-series-processing -> qa-data-integrity -> repo-librarian
- New country: product-strategist -> market-data-architect -> api-integration -> time-series-processing -> dashboard-ui-architect -> static-frontend-engineer -> qa-data-integrity

## Repo Layout
- `.claude/` agent system
- `plans/` specs and roadmaps
- `prompts/` reusable prompts
- `scripts/` pipeline code
- `config/` settings and metric maps
- `data/` raw and processed cache
- `public/` static site assets
- `src/` modular frontend source
- `.github/workflows/` automation
