# ADR-0036: Govern (M4): slicing, first Owner, groups, member defaults

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Product owner

## Context

M4 adds rights and roles (MVP scope A2–A5; [ADR-0011](0011-authorization-scoped-rbac.md),
[permissions.md](../permissions.md)) and replaces the interim rules of ADR-0031 (doors) and ADR-0033 (channels). It
is too big for one step, an instance has no administrators yet, the setup wizard only arrives with M5, and people
already rely on today's behaviour in rooms and channels.

## Decision

- **Slicing:** M4a Access core (the Access module, built-in roles, groups in the model, `AccessPolicy`, the interim
  rules replaced) → M4b administration (assigning roles, groups, custom roles, room and channel policies, admin UI) →
  M4c audit log → M4d guest links. Each slice is usable on its own, and guests come last so that inviting them is
  audited from the start.
- **First Owner:** the first person to sign in to an instance becomes its Owner. Exactly one person can win this,
  also when two sign in at the same moment.
- **Groups:** groups are managed inside TeamTown, independent of the login provider. Roles can be assigned to people
  and to groups.
- **Member defaults:** nobody loses anything through M4a. The Member role also holds `room.admit` and `room.lock`, so
  anyone inside a room keeps switching its door and answering knocks, and a channel's creator becomes its Channel
  Moderator. Administrators narrow this with policies in M4b.

## Alternatives considered

| Option                                 | Why not                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Audit log before the admin UI          | The first slices show little; the audit log still precedes guests                      |
| Guests right after the core            | Guests would run for a while without administration and without an audit log           |
| First Owner by configuration           | Needs setup; the owner prefers no configuration                                        |
| First Owner from a Keycloak role       | Two places for roles, harder to explain                                                |
| Assign roles to people only            | Larger teams would assign every role one by one                                        |
| Groups from a Keycloak claim           | Fresh only at sign-in and without sync (SCIM isn't in the MVP); ties groups to the IdP |
| Only assigned Room Hosts control doors | Without assigned hosts nobody could admit anyone to a knock room                       |
| First person in a room is its host     | Evaluating who came first moves close to the limit of ADR-0012                         |

## Consequences

- An instance reachable before its operator signs in can get the wrong Owner: operators must sign in first, or keep
  the instance closed until they have. The showcase instance needs this as a deployment step (M6).
- `Channel.creatorId` stops granting anything once it is migrated to a Channel Moderator assignment.
- With no explicit deny (ADR-0011), narrowing Member's room rights needs a room policy that stops their inheritance,
  which M4b must specify.
- Follow-ups: feature specs for M4a–M4d. Guest identity is decided with M4d.
