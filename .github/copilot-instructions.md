# Energy Markets Dashboard — Copilot Instructions

## Purpose

Professional static dashboard for European energy and commodity market analysis. All UI is rendered client-side from pre-built JavaScript data blobs; there is no server.

---

## Architecture

<<<<<<< Updated upstream
- The static frontend reads from `public/data.js` through the files under `public/` and `src/`.
- The Python pipeline fetches and normalizes source data under `scripts/`, `config/`, and `data/`.
- GitHub Actions refreshes cached data daily through `.github/workflows/refresh-data.yml`.
- Specialized reusable workflows live under `.github/skills/` and should be preferred when their descriptions match the request.
- **Tailwind CSS is loaded via CDN** (`@tailwindcss/browser@4`) — no build step, no Node.js required. Component classes are defined in the `<style type="text/tailwindcss">` block in `public/index.html`.
- **Design system:** Axiom Institutional — slate palette, dark-first (`html[data-theme="light"]` for light mode), 0px border-radius, IBM Plex Mono for numeric data.
=======
### Frontend (`public/`)

| File | Role |
|---|---|
| `index.html` | Single-page app shell. Contains the Tailwind CDN script and the entire Tailwind config inline inside `<style type="text/tailwindcss">`. |
| `styles.css` | Theme tokens (CSS custom properties), layout structure, chart sizing, table styles, controls panel, news/map panels. Does **not** define component classes — those live in the inline Tailwind block. |
| `app.js` | Entry point: tab routing, theme toggle, `renderApp()` orchestration, chart resize. |
| `js/` | Modular rendering files: `state.js`, `data-loader.js`, `analytics.js`, `charts.js`, `overview.js`, `ui.js`, `commodity-ui.js`, `map.js`. |
| `data.js` / `futures.js` | Generated data blobs — do not edit by hand. |

### Tailwind CSS

- **No build step.** Tailwind v4 is loaded via CDN: `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4">`.
- All theme tokens, utilities, and component classes are declared in the `<style type="text/tailwindcss">` block inside `index.html`.
- `tailwind-input.css` is kept as a reference source for future CLI builds but is **not loaded by the page**.
- `tailwind.css` is **no longer used** by the page. Do not edit or regenerate it.
- When adding new Tailwind utilities or component classes, edit the `<style type="text/tailwindcss">` block in `index.html`.

### Theme System

- Dark/light theme is driven entirely by CSS custom properties (`--bg`, `--surface`, `--text`, etc.) defined in `styles.css`.
- `html[data-theme="light"]` overrides the dark defaults.
- Tailwind tokens (`--color-app-*`) are mapped to these vars via `@theme inline` so utility classes update automatically on theme switch.
- The theme toggle is in `app.js` (`_applyTheme()`); it sets `data-theme` on `<html>` and persists to `localStorage`.
- **Never use hardcoded dark hex values** (e.g. `rgba(255,255,255,0.65)`) in component styles. Always use CSS vars (`var(--text)`, `var(--muted)`, etc.) so both themes render correctly.

### Component Ownership

All blocks, badges, buttons, and dropdowns are styled via `@layer components` inside the Tailwind inline block:
- **Blocks:** `.section-block`, `.kpi-card`, `.chart-panel`, `.secondary-panel`, `.fwd-curve-card`
- **Buttons:** `.btn-pill` (+ `--active`, `--country`), `.btn-secondary`, `.btn-icon`
- **Badges:** `.regime-badge` (+ `--low/normal/high`), `.eu-compare-badge`, `.percentile-badge`, `.quality-badge` (+ `--ok/bad/warn/neutral`)
- **Dropdowns:** `select`

`styles.css` handles layout structure only — grid templates, sticky panels, spacing, chart heights, table rules.

### Python Pipeline (`scripts/`)

- `fetch_all.py` → adapter files in `scripts/adapters/` → raw cache in `data/`
- `build_data_js.py` → transforms in `scripts/transforms/` → `public/data.js` + `public/futures.js`
- Keep adapter-specific API logic inside `scripts/adapters/`.
- Keep derived analytics inside `scripts/transforms/` or the build step.
- `public/data.js` is generated output — never edit by hand.

---
>>>>>>> Stashed changes

## Core Rules

1. Keep historical, forward, and forecast data distinct.
2. Keep source-specific logic inside adapters.
3. Precompute analytics in Python; avoid heavy data logic in the browser.
4. Expose missing and stale data explicitly — never silently hide gaps.
5. Prefer modular, maintainable code over shortcuts.
6. Never run build scripts (`npm`, `npx`, `node`) — the user's machine cannot execute them. Use CDN-only approaches.

---

## Focus Countries

Spain · Germany · France · Italy · United Kingdom · Netherlands

---

<<<<<<< Updated upstream
For each new chat request, classify the work before answering or editing. Use the `boss` agent to automatically orchestrate multi-step tasks across multiple specialists.

- Dashboard feature or product change: follow `product-strategist`, then `dashboard-ui-architect`, `visual-design-system`, `charting-analytics`, `static-frontend-engineer`, `qa-data-integrity`, and finish with `repo-librarian` checks when relevant.
- Frontend or UI implementation: prefer `dashboard-ui-architect`, `visual-design-system`, `charting-analytics`, and `static-frontend-engineer`.
- Complex or novel chart: prefer `pro-frontend-charting-engineer` before `static-frontend-engineer`.
- New data source, adapter, or pipeline change: prefer `market-data-architect`, `api-integration`, `time-series-processing`, `qa-data-integrity`, and `repo-librarian`.
- New country support: treat it as a cross-cutting change spanning config, adapters, transforms, generated output, and UI implications.
- Review, validation, or debugging: start from `qa-data-integrity`, then use the domain-specific skill for the affected area.
- News or narrative ranking work: prefer `news-intelligence` before touching ranking or presentation logic.
- Workflow automation or scheduled refresh changes: prefer `github-actions-automation`.
=======
## Skill Routing

Classify the request before acting:
>>>>>>> Stashed changes

| Request type | Skills to prefer |
|---|---|
| Dashboard feature / product change | `product-strategist` → `dashboard-ui-architect` → `visual-design-system` → `charting-analytics` → `static-frontend-engineer` → `qa-data-integrity` → `repo-librarian` |
| Frontend / UI implementation | `dashboard-ui-architect`, `visual-design-system`, `charting-analytics`, `static-frontend-engineer` |
| New data source / adapter / pipeline | `market-data-architect`, `api-integration`, `time-series-processing`, `qa-data-integrity`, `repo-librarian` |
| New country support | Cross-cutting: config → adapters → transforms → generated output → UI |
| Review / validation / debugging | `qa-data-integrity`, then domain skill for the affected area |
| News / narrative ranking | `news-intelligence` before touching ranking or presentation logic |
| Workflow automation / scheduled refresh | `github-actions-automation` |

<<<<<<< Updated upstream
- Use `boss` (`.github/agents/boss.agent.md`) to orchestrate multi-step work — it decomposes the request, routes subtasks, and spawns background sub-agents automatically.
- Prefer the skills defined under `.github/skills/` when their descriptions match the task.
- Use the skill guidance as a workflow, not as rigid role-play.
- Combine multiple skills when a request spans planning, data ingestion, transformations, frontend rendering, and validation.
- If the request is ambiguous and routing changes the implementation path, ask one short clarification question. Otherwise proceed.
=======
- Use skills as a workflow guide, not rigid role-play.
- Combine multiple skills when a request spans planning, ingestion, transforms, rendering, and validation.
- If routing materially changes the implementation path, ask one short clarifying question. Otherwise proceed.

---
>>>>>>> Stashed changes

## Working Conventions

- For pipeline changes, preserve the `fetch_all.py` → `build_data_js.py` flow.
- When adding new series or countries, update config maps first and propagate through fetch, build, and presentation layers.
- When changing UI, preserve the institutional dashboard aesthetic (no rounded corners, corporate typography, monochromatic theme tokens).
- When adding component styles, add them to `@layer components` in the `<style type="text/tailwindcss">` block in `index.html`. Do not add them to `styles.css`.
- When adding new color utilities (`bg-app-*`, `text-app-*`, `border-app-*`), add them to `@layer utilities` in the same inline block.
- JS rendering files (`ui.js`, `commodity-ui.js`, `overview.js`) generate HTML via `innerHTML`. Class names used there must match the Tailwind component definitions.
