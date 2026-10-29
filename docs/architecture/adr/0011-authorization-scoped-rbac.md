# ADR-0011: Scoped role-based access control

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Channels and rooms need rights and roles that admins understand. Rooms and channels can be private,
and guests need narrowly scoped access.

## Decision

- Roles are named permission sets, assigned to persons or groups **at a scope**
  (town → floor → room, town → channel). Permissions inherit downwards.
- Private resources stop the inheritance of access permissions.
- There are no explicit deny rules.
- Implemented in the Access module and exposed through the `AccessPolicy` port.

Details: [permissions.md](../permissions.md).

## Alternatives considered

| Option | Why not |
|--------|---------|
| ReBAC (OpenFGA) | Additional service, harder to explain to admins |
| Global roles only | Too coarse for room hosts, channel moderators and guests |

## Consequences

- Explainable permissions ("granted by role X at scope Y").
- Permission evaluation must be cached and invalidated correctly.
