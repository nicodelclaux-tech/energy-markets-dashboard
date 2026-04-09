---
name: new-dashboard-feature
description: "Run Workflow W1 to add a new feature to the dashboard from idea to production-ready implementation."
---

# Workflow W1 — New Dashboard Feature

Follow this exact sequence. Do not skip steps.

## Step 1 — product-strategist
Load `.github/skills/product-strategist/SKILL.md`, then:
- Clarify the user request into a complete feature spec using the template at `.github/skills/product-strategist/templates/feature-spec.md`
- Confirm: what data does this need? Is it already in `data.js`? If not, stop and run Workflow W2 first.
- Define: which page, which section, what filters, what empty state

## Step 2 — dashboard-ui-architect
Load `.github/skills/dashboard-ui-architect/SKILL.md`, then:
- Design the panel layout and position within the information hierarchy
- Define: `S` state additions, trigger map, panel type
- Produce a layout spec (use template if creating a new page section)

## Step 3 — visual-design-system
Load `.github/skills/visual-design-system/SKILL.md`, then:
- Specify all component styles using design tokens only
- Confirm dark mode support
- Flag any new CSS variables needed (requires explicit justification)

## Step 4 — charting-analytics
Load `.github/skills/charting-analytics/SKILL.md`, then:
- Select the correct chart type for the data
- Produce the full ECharts options object using `bAxis`, `mc`, `gc` helpers
- Confirm: historical vs forward data are in separate series

## Step 5 — static-frontend-engineer
Load `.github/skills/static-frontend-engineer/SKILL.md`, then:
- Implement the HTML, JS, and CSS from the specs produced in steps 1–4
- Check for `shared.js` function name collisions before writing
- Test dark mode, empty state, and missing data

## Step 6 — qa-data-integrity
Load `.github/skills/qa-data-integrity/SKILL.md`, then:
- Verify the new component renders correctly with actual `data.js` values
- Check no zero-fill, no silent nulls, no broken dark mode

## Step 7 — repo-librarian
Load `.github/skills/repo-librarian/SKILL.md`, then:
- Update README.md if the feature is user-visible
- Update EXTENDING.md if the feature establishes a new pattern
