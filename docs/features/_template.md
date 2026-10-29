# Feature: <Name>

- **Status:** Draft | Ready | In progress | Done
- **Brainstorming ID:** <e.g. C4>
- **Bounded context(s):** <e.g. Meetings, Presence>
- **Milestone:** <e.g. M2 Talk>

## Problem / user value

As a <persona>, I want <capability>, so that <benefit>.

## Behaviour

Describe the behaviour, including edge cases. Use the ubiquitous language.

## Acceptance criteria

- [ ] Given … when … then …
- [ ] Non-spatial path: how is this done in list mode or via the command palette?
- [ ] Accessibility: keyboard, screen reader labels
- [ ] i18n: EN + DE strings

## Permissions

Which permissions are checked, at which scope? New permissions?

## Domain changes

New or changed aggregates, value objects, domain events.

## API & realtime contracts

REST endpoints and/or realtime commands and events (schemas in `packages/contracts`).

## Privacy impact

What is persisted? What is logged? Does it touch presence data? (Presence data must never be persisted.)

## UI / design

Links to mockups; world representation (objects, animations, indicators).

## Open questions

- …
