# ADR-0015: Own design system on Radix primitives and Tailwind

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown needs a distinctive, accessible, business-ready UI matching its brand
(Terracotta palette, Outfit + Inter, see [brand-guide.md](../../design/brand-guide.md)).

## Decision

- **Radix UI primitives** for accessible behaviour (dialogs, menus, popovers, tabs, …).
- **Tailwind CSS**, configured from the **design tokens** in `design/tokens/tokens.json`.
- Components live in `packages/ui`.

## Alternatives considered

| Option | Why not |
|--------|---------|
| shadcn/ui as is | Generic look without heavy customisation |
| Mantine | Less control over the brand |
| CSS Modules + custom components | Accessibility would need to be built by hand |

## Consequences

- One token source drives the web UI, Electron and the marketing site.
