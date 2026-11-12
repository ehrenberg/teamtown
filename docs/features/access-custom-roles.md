# Feature: Custom roles

- **Status:** In progress
- **Brainstorming ID:** A3 Custom roles
- **Bounded context(s):** Access, web client
- **Milestone:** M4b-2 (ADR-0011, ADR-0038)

## Problem / user value

As an Owner or Admin, I want to put together a role of my own, such as "Team Lead" = Room Host plus Channel Moderator,
so that I can match responsibilities in my organisation without giving anyone more than they need.

## Behaviour

1. **A "Roles" tab** in Administration lists the built-in roles with their permissions, and the town's own roles.
2. **Creating.** A custom role has a name (unique, 1 to 80 characters) and at least one permission from the catalogue,
   grouped by area. It may hold any permission except `town.owners.manage` (P-36), so nobody gets the Owner's rights
   through it, and an Admin can't give out more than an Admin holds.
3. **Built-in roles stay as they are** (P-39). Each can be copied as a starting point for a custom role.
4. **Where a role applies follows from its permissions** (P-37), for built-in and custom roles alike: room permissions
   allow the town, a floor or a room; floor permissions the town or a floor; channel permissions the town or a channel;
   town permissions the town only. A role with several kinds applies where all of them do. Assigning offers only those
   places, and the server checks the same.
5. **Changing** a role's name or permissions takes effect at once for everyone who holds it (P-38). _Proposal:_ a
   change that would make the role no longer fit a place where it is already assigned is refused, with a plain
   message, until those assignments are taken back; an assignment that silently does nothing would confuse.
6. **Deleting** asks first and says how many assignments go with it; after confirming, the role and its assignments are
   gone (P-38).
7. **Assigning** works as in M4b-1, with the custom roles listed after the built-in ones.

## Acceptance criteria

- [ ] Given an Admin, when they create "Team Lead" with `room.lock` and `message.pin`, then it can be assigned for the
      whole town only, and the person holding it gets both permissions at once.
- [ ] Given a role with room permissions only, then it can be assigned to a floor or a room, and not to a channel.
- [ ] Given a role that includes `town.owners.manage`, then creating or saving it is refused (`400`).
- [ ] Given a role assigned to a room, when its permissions are changed to channel ones, then the change is refused
      (`409`) with a plain message, and nothing changes.
- [ ] Given a role assigned to two people, when it is deleted after confirming, then both lose its permissions at once.
- [ ] Given a built-in role, then it can't be changed or deleted, but copied into a new custom role.
- [ ] Given a Member, then the roles API answers `403`.
- [ ] Non-spatial path: everything works in the Administration view, by keyboard; there is no world part.
- [ ] Accessibility: permissions are labelled checkboxes in labelled groups; the delete confirmation is announced.
- [ ] i18n: every permission and all new strings exist in English and German, using German **du**.

## Permissions

`town.roles.manage`, as in M4b-1. No new permission.

## Domain changes

- **`CustomRole`** (Access): `roleId` (`custom-…`), `name`, `permissions`. Stored in `access.custom_role`; built-in
  roles stay in code.
- **`placesFor(permissions)`** replaces the per-role table of M4b-1 and decides where any role can be assigned.
- `holds` evaluates assignments against a role lookup of built-in and custom roles; an unknown role grants nothing.
- `CachedAccessPolicy` keeps the custom roles in memory and forgets them, and every person, on a role change.

## API & realtime contracts

In `packages/contracts/src/access/`, all behind `town.roles.manage`:

- `GET /api/access/overview` also returns `roles`: every role with `roleId`, `name` (custom only), `permissions`,
  `builtIn` and `places` (`town`, `floor`, `room`, `channel`).
- `POST /api/access/roles`, `PATCH` / `DELETE /api/access/roles/{roleId}`: body `{ name, permissions }`.
- Assignments accept a custom `roleId`.
- Error codes: `invalid-role` (400), `role-name-taken` (409), `role-assigned-elsewhere` (409), `built-in-role` (400).

No realtime messages.

## Privacy impact

Role definitions are configuration. They hold no personal data, and nothing about presence (ADR-0012).

## UI / design

A third tab "Roles" in Administration: role cards with their permissions as text, a form with checkboxes grouped by
area, an inline delete confirmation. No world representation.

## Open questions

_None._ P-36 to P-39 were decided on 2026-11-12; point 5 is a proposal within P-38.
