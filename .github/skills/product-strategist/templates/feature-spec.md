# Feature Specification — Template

> Copy this template and fill in all sections. Every section is required. Use "N/A" only if genuinely not applicable, not as a shortcut.

---

## Feature Title

<!-- Imperative phrase. e.g. "Add Rolling Volatility Panel for All Selected Countries" -->

[FEATURE TITLE]

---

## Problem Statement

<!-- 2–3 sentences. What gap exists? What decision is the user unable to make right now? Do NOT prescribe the solution. -->

[PROBLEM STATEMENT]

---

## User Story

<!-- As a [market professional role], I want [specific capability] so that [outcome]. -->

As a [role], I want [what], so that [why].

---

## Functional Requirements

<!-- Number each requirement. Each must be independently testable. Start with verbs: "Display...", "Calculate...", "Update...", "Show..." -->

1. 
2. 
3. 
4. 
5. 

---

## MVP Scope

<!-- The minimum the feature must deliver to be useful. Explicitly close scope with "Does NOT include:". -->

**Includes:**
- 
- 

**Does NOT include:**
- 
- 

---

## Stretch Goals

<!-- Future enhancements. Explicitly out of scope for this iteration. Not incomplete MVP. -->

- 
- 

---

## Data Dependencies

<!-- For each data requirement: does it exist or not? Where does it come from? -->

| Data | Status | Source | Notes |
|------|--------|--------|-------|
| [metric] | ✅ Exists in `data.js` | ENTSO-E via pipeline | `S.rows[].price` |
| [metric] | ❌ Does not exist | FMP sym TBD | Needs new adapter |
| [metric] | ⚠️ Exists but needs transform | ECB | Daily FX needs rebasing |

---

## UI Module Mapping

<!-- Which files are affected? Which page? New file or extension of existing? -->

| File | Change type | Notes |
|------|-------------|-------|
| `index.html` / `power.html` | New panel added | After section X |
| `power.js` | New render function | No changes to shared.js |
| `styles.css` | New component class (if any) | |
| `shared.js` | ⚠️ Requires review | Only if new registry entry needed |

---

## Acceptance Criteria

<!-- Binary: each is either Pass or Fail. Not "looks good" or "seems correct". -->

- [ ] [Criterion 1 — measurable and objective]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] Chart renders in both light and dark mode without visual defects
- [ ] No console errors in Chrome DevTools
- [ ] Empty state is visible (not a blank element) when data is missing

---

## Downstream Handoff

<!-- Which agent receives this spec next? What specific question must they answer or deliverable must they produce? -->

**Next agent:** `[agent-name]`

**Handoff context:**
- [What this agent needs to produce]
- [Any open question they must resolve]
- [Any constraint to preserve]
