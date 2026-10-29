---
name: ui-review
description: Review TeamTown UI or world-rendering changes against the brand guide, design tokens, accessibility, i18n, voice & tone and the "spatial is optional" principle. Use before opening a PR that touches apps/web, packages/ui or design/.
---

# UI review checklist

Read the changed files, then check each point and report findings with `file:line`. Only report real
issues. Suggest a concrete fix for each.

## Brand & tokens (`docs/design/brand-guide.md`, `design/tokens/tokens.json`)

- No raw hex colours or pixel values outside the token set; semantic tokens preferred (`action.primary`, not `terracotta.700`).
- Text contrast meets WCAG AA. Terracotta-500 and sage-500 are **not** used for small text on cream.
- Fonts: Outfit for display and headlines, Inter for UI text.
- Status is shown with **colour and shape** (never colour only).

## Accessibility

- Interactive elements are keyboard-reachable with a visible focus ring, and have an accessible name.
- Radix primitives are used for dialogs, menus and popovers (no hand-rolled focus traps).
- Motion respects `prefers-reduced-motion`.
- Target size ≥ 24 px.

## Spatial is optional

- Any new world interaction also exists in list mode, the sidebar or the command palette.
- World components only render store state; no business logic or socket calls in R3F components.

## i18n & voice

- No hard-coded user-facing strings; EN and DE keys both exist.
- Copy follows the voice: warm and clear, lightly playful; errors plain and helpful, never jokey.

## Privacy

- UI doesn't reveal what the user may not see (e.g. names inside locked rooms show as silhouettes).
- Nothing new is stored about presence (also check analytics or logging calls).

## World art (`docs/design/world-art-direction.md`)

- Light from the top left, palette material, and triangle budgets respected for new assets.
