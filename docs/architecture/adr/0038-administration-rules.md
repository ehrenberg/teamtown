# ADR-0038: Administration (M4b): slicing, admin view, host-led rooms, owners

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Product owner

## Context

M4a brought the rights model, but nobody can assign a role yet, and the town's first Owner is whoever signed in first
(ADR-0036). M4b adds administration. It must narrow Member's room rights although ADR-0011 has no deny, and the app has
no router so far.

## Decision

- **Slicing:** M4b-1 administration view, assigning roles, groups, owners → M4b-2 custom roles → M4b-3 room and channel
  policies.
- **Admin view:** a full-screen view above the office, opened from the top bar or the command palette, shown only to
  those allowed. The office stays connected behind it. There is no route and no router.
- **Host-led rooms (M4b-3):** a switch per room stops the inheritance of `room.lock` and `room.admit`, so only Room
  Hosts assigned at the room or its floor may use them. It works like "private stops inheritance", without a deny.
- **Owners:** a town can have several Owners. An Owner appoints further Owners and may give up the role, as long as one
  remains. Admins can't touch the Owner role: `town.owners.manage` is the only permission Admin doesn't hold. Owner goes
  to people, never to groups, so that "at least one" stays checkable.

## Alternatives considered

| Option                         | Why not                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Policies before custom roles   | Later in the order; the admin view comes first either way                          |
| All of M4b in one slice        | Too big to review and test                                                         |
| A page of its own with a URL   | A router or URL logic, and leaving the office would need extra care to stay online |
| Dialogs in the office          | Too tight for tables of people, roles and groups                                   |
| Taking door rights from Member | Members would lose something before an admin decides anything                      |
| Explicit deny rules            | Reverses ADR-0011; "why may Ben do this?" would lose its simple answer             |
| Exactly one Owner              | An unreachable Owner could only be replaced in the database                        |

## Consequences

- The admin view has no link of its own.
- A host-led room without a host has nobody to work its door, so the UI must warn about it.
- A wrong first Owner can now be corrected, which softens the consequence noted in ADR-0036.
