# Agent Support Pack — Energy Markets Dashboard

This document is the canonical reference for the Claude Code agent harness in this project. It describes every agent and skill, the orchestration model, and the setup files that keep the agent aligned during implementation.

---

## 1. Architecture Overview

| Layer | Location | Purpose |
|---|---|---|
| Static frontend | `public/` | HTML/CSS/JS dashboard, served directly from `index.html` |
| Data generation | `scripts/` + `config/` | Python pipeline; output is `public/data.js` |
| Agent harness | `.github/agents/` + `.github/skills/` | Agent definitions and skill SKILL.md files |
| Routing + instructions | `.github/copilot-instructions.md` + `.github/instructions/` | Task routing and scoped Copilot instructions |
| Reusable prompts | `.github/prompts/` | Workflow starters for common task types |

**Key constraints:**
- The app opens directly from `index.html` — no server required
- Tailwind CSS is loaded via CDN: `@tailwindcss/browser@4` — **no build step, no Node.js on the user's machine**
- ECharts loaded via CDN: `https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js`
- All component classes defined in `<style type="text/tailwindcss">` block in `index.html`
- Design system: Axiom Institutional (slate palette, dark-first, 0px border-radius, IBM Plex Mono / Inter)

---

## 2. Agent Roster

### Orchestrator

| Agent file | Role |
|---|---|
| `boss.agent.md` | **Orchestrator.** Decomposes tasks, routes to specialists, spawns background sub-agents. Does not write code. |

### Specialist Agents

| Agent file | Skill | Role |
|---|---|---|
| `product-strategist.agent.md` | `product-strategist/` | Feature specs from vague requests; MVP scope; acceptance criteria |
| `dashboard-ui-architect.agent.md` | `dashboard-ui-architect/` | Information architecture; panel hierarchy; state model; trigger map |
| `visual-design-system.agent.md` | `visual-design-system/` | CSS tokens; component patterns; Axiom design system enforcement |
| `charting-analytics.agent.md` | `charting-analytics/` | ECharts config selection; chart type decisions; custom legend system |
| `pro-frontend-charting-engineer.agent.md` | `pro-frontend-charting-engineer/` | Complex chart builds from first principles; geo/map charts; synchronized interactions |
| `static-frontend-engineer.agent.md` | `static-frontend-engineer/` | HTML/CSS/JS implementation of approved specs |
| `market-data-architect.agent.md` | `market-data-architect/` | Data model; `COMMODITY_REGISTRY`; `data.js` schema design |
| `api-integration.agent.md` | `api-integration/` | Python API adapters; fetch resilience; error handling |
| `time-series-processing.agent.md` | `time-series-processing/` | Python transforms; rolling vol, YoY, spread, rebase |
| `news-intelligence.agent.md` | `news-intelligence/` | Article tagging, relevance scoring, duplicate filtering |
| `github-actions-automation.agent.md` | `github-actions-automation/` | Workflow YAML; scheduled refresh; secrets management |
| `qa-data-integrity.agent.md` | `qa-data-integrity/` | Data freshness/coverage/sanity validation; frontend audit |
| `repo-librarian.agent.md` | `repo-librarian/` | README, ARCHITECTURE.md, EXTENDING.md; no code changes |

> **Note:** `pro-frontend-charting-engineer` is the only agent with `user-invocable: true` and an `argument-hint` — it can be called directly with a chart description.

---

## 3. Standard Routing Pipelines

These are the pre-built workflow starters in `.github/prompts/`:

| Prompt file | Pipeline |
|---|---|
| `new-dashboard-feature.prompt.md` | product-strategist → dashboard-ui-architect → visual-design-system → charting-analytics → static-frontend-engineer → qa-data-integrity → repo-librarian |
| `add-data-source.prompt.md` | market-data-architect → api-integration → time-series-processing → qa-data-integrity → repo-librarian |
| `add-country.prompt.md` | product-strategist → market-data-architect → api-integration → time-series-processing → dashboard-ui-architect → static-frontend-engineer → qa-data-integrity |
| `improve-news.prompt.md` | news-intelligence → static-frontend-engineer → qa-data-integrity |
| `fix-chart.prompt.md` | charting-analytics (single agent) |
| `build-dashboard.prompt.md` | Full 5-phase agentic build |
| `build-data-pipeline.prompt.md` | Full 5-phase pipeline build |
| `build-ui.prompt.md` | Full 4-phase UI build |

To use the **boss agent** for any of the above: describe your task and Claude will route it automatically through the correct pipeline.

---

## 4. Project-Local Setup Files

### `CLAUDE.md` (repo root)

The highest-value guidance file. Already in place at `.claude/CLAUDE.md`. Key constraints it enforces:

- App opens from `index.html` (static, no backend)
- Python pipeline: `fetch_all.py` → `build_data_js.py` flow
- `public/data.js` is generated output — not source of truth
- Six focus countries: ES, DE, FR, IT, GB, NL
- Tailwind via CDN (no build step, no Node.js)

### `.claude/settings.local.json`

Standardizes Claude Code tool permissions. Recommended:

```json
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(python:*)",
      "Bash(git:*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)"
    ],
    "deny": [
      "Bash(npm install -g:*)",
      "Bash(sudo:*)",
      "Bash(docker:*)",
      "Bash(rm -rf /*)"
    ]
  }
}
```

### Hooks

**`.claude/hooks/pre_tool_use.py`** — Warn against patterns that break the static build:

```python
#!/usr/bin/env python3
import json, sys

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    tool_input = json.dumps(payload).lower()
    blocked = ["express", "fastapi", "flask", "docker", "postgres", "mongodb",
               "auth", "login", "next.js server", "server-side routing"]
    warnings = [p for p in blocked if p in tool_input]
    if warnings:
        sys.stderr.write(
            "Warning: action may violate static/local-first constraints: "
            + ", ".join(warnings) + "\n"
        )

if __name__ == "__main__":
    main()
```

**`.claude/hooks/post_tool_use.py`** — Remind agent to update docs after structural changes:

```python
#!/usr/bin/env python3
import json, sys

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    text = json.dumps(payload).lower()
    tracked = ["index.html", "app.js", "analytics.js", "ui.js", "charts.js",
               "data-loader.js", "commodity-ui.js", "overview.js"]
    if any(name in text for name in tracked):
        sys.stderr.write(
            "Reminder: if architecture, data flow, or UX behavior changed, "
            "consider updating docs/ and .github/instructions/\n"
        )

if __name__ == "__main__":
    main()
```

---

## 5. Scoped Instruction Files

These files in `.github/instructions/` are loaded by Copilot when working in the relevant scope:

| File | Scope | Content |
|---|---|---|
| `frontend-dashboard.instructions.md` | `public/**`, `src/**` | Static-first rules, `window.APP_DATA` contract, Axiom design system |
| `data-pipeline.instructions.md` | `scripts/**`, `config/**`, `data/**` | Fetch-then-build flow, adapter isolation, precompute in Python |
| `country-expansion.instructions.md` | Country/market expansion work | Full-stack change checklist starting from `config/series_map.py` |
| `qa-data-integrity.instructions.md` | General | Behavioral regression first, freshness/coverage/sanity checks |

---

## 6. Design System Quick Reference

| Token | Dark value | Light value | Usage |
|---|---|---|---|
| `--bg` | `#020617` | `#f8fafc` | Page background |
| `--surface` | `#0f172a` | `#f1f5f9` | Panel / card background |
| `--surface-2` | `#1e293b` | `#e2e8f0` | Elevated surface |
| `--border` | `#1e293b` | `#cbd5e1` | All borders |
| `--text` | `#e2e8f0` | `#0f172a` | Primary text |
| `--muted` | `#64748b` | `#64748b` | Labels, timestamps |
| `--emerald` | `#34d399` | `#059669` | Gains / positive |
| `--rose` | `#fb7185` | `#e11d48` | Losses / negative |
| `--amber` | `#fbbf24` | `#d97706` | Warnings / stale |
| `--sky` | `#38bdf8` | `#0284c7` | Accent / active |
| `--violet` | `#a78bfa` | `#7c3aed` | Secondary accent |

Theme switching: dark is `:root` default; `html[data-theme="light"]` activates light mode.

Tailwind utilities: `bg-app-bg`, `bg-app-surface`, `text-app-text`, `text-app-muted`, `text-app-sky`, `text-app-emerald`, `text-app-rose`, `text-app-amber`, `border-app-border`, etc.

Component classes: `kpi-card`, `section-block`, `chart-panel`, `secondary-panel`, `btn-pill`, `btn-pill--active`, `btn-secondary`, `quality-badge`, `quality-badge--ok/warn/bad`, `regime-badge`, `regime-low/normal/high`.

---

## 7. Data Contract

`public/data.js` exposes `window.APP_DATA` (or the exported global defined in that file). It is **generated output** from `scripts/build_data_js.py`. Never edit it manually.

Key sections (may vary — check actual file):
- Power price time series per country
- Commodity OHLC (oil, gas, coal, EUA)
- FX rates
- News articles

Missing/stale data must be **surfaced explicitly** in both the generated JSON (metadata flags) and the UI (quality badges, empty states).

---

## 8. Best Minimal Setup for Claude Code Alignment

If starting fresh or onboarding a new contributor, these six files deliver the most alignment for the least overhead:

1. `CLAUDE.md` (repo root)
2. `.github/copilot-instructions.md`
3. `.github/instructions/frontend-dashboard.instructions.md`
4. `.github/instructions/data-pipeline.instructions.md`
5. `.github/agents/boss.agent.md`
6. `.github/skills/qa-data-integrity/SKILL.md`

The boss agent + QA agent pairing ensures every task is routed correctly and every output is validated.
