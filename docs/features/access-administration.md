# Feature: Administration of roles and groups

- **Status:** Done (2026-11-04)
- **Brainstorming ID:** A3 Custom roles (groundwork)
- **Bounded context(s):** Access, web client
- **Milestone:** M4b-1 (ADR-0011, ADR-0036, ADR-0038)

## Problem / user value

As a town's Owner or Admin, I want to see who holds which role, assign and take back roles, and manage groups, so that
I can hand out responsibility without touching a database.

## Behaviour

1. **Opening.** Whoever holds `town.roles.manage` sees "Administration" in the top bar and in the command palette. It
   opens a full-screen view above the office, and Escape or "Back to the office" closes it. The connection, a call and
   the chat stay as they are behind it (ADR-0038).
2. **People.** A list of everyone with their assigned roles, each with where it applies, searchable by name. Everyone
   holds Member without an assignment, so Member isn't listed.
3. **Assigning.** Owner, Admin, Editor at town scope; Editor also per floor; Room Host for the town, a floor or a room;
   Channel Moderator for the town or a public channel. Each assignment can be taken back. Guest arrives with M4d.
4. **Private channels.** Assignments in private channels show as "Private channel", without a name: admins don't read
   private content (ADR-0026).
5. **Groups.** Create, rename and delete groups, add and remove people, and assign roles to a group like to a person.
   Deleting a group removes its assignments. Group names are unique.
6. **Owners (ADR-0038).** Only Owners assign and take back Owner, which goes to people only. The last Owner can't lose
   the role, and the UI says why. An Owner may give up the role while another remains.
7. **Effect.** The server applies a change to the next action at once. Open clients show their changed actions the next
   time they load the channel list or `/access/me`; there is no live push in this slice.

## Acceptance criteria

- [x] Given an Admin, when they open Administration, then they see people and groups, and given a Member, then
      neither the entry nor the API is available (`403`).
- [x] Given an Admin, when they make someone Channel Moderator of a channel, then that person can pin there at once.
- [x] Given a group with the Room Host role and a person in it, then the person holds `room.admit` there, and when they
      leave the group, they no longer do.
- [x] Given an Admin, when they try to assign or take back Owner through the API, then it is refused (`403`).
- [x] Given two Owners who take the role from each other at the same moment, then one Owner remains.
- [x] Given the only Owner, when they give up the role, then it is refused (`409`), in plain words.
- [x] Given a role assigned to a private channel, then the view shows no channel name.
- [x] Non-spatial path: the view has no world part; it opens from the top bar and the palette and works by keyboard.
- [x] Accessibility: labelled controls, focus trapped and returned, role state as text, not colour alone.
- [x] i18n: all strings in English and German, using German **du**.

## Permissions

`town.roles.manage` covers reading the overview, roles and groups. New **`town.owners.manage`**, Owner only, covers
the Owner role (ADR-0038). Member doesn't hold either.

## Domain changes

- `Assignment` principal: person or group; `assignableScopes` per role; Owner only for people.
- `AssignRole`, `RevokeRole`, group use cases; `CachedAccessPolicy` forgets everyone on a group change.
- Taking Owner away locks the Owner rows in one transaction, so two Owners can't remove each other.
- The role-change events for the audit log arrive with M4c, its first consumer. They were planned for M4b in
  `access-core.md`; nothing listens before.

## API & realtime contracts

New in `packages/contracts/src/access/`, all behind `town.roles.manage` except `/access/me`:

- `GET /api/access/me`: `{ canManageRoles, canManageOwners }`.
- `GET /api/access/overview`: assignments and groups. Names come from `/api/people`, `/api/floors` and
  `/api/channels/browse`, since Access keeps none.
- `PUT` / `DELETE /api/access/assignments`: body `{ principal, roleId, scope }`, idempotent.
- `POST /api/access/groups`, `PATCH` / `DELETE /api/access/groups/{id}`, `PUT` / `DELETE
/api/access/groups/{id}/members/{personId}`.
- Error codes: `not-allowed` (403), `last-owner` (409), `group-name-taken` (409), `invalid-group-name`,
  `role-not-assignable`.

No realtime messages.

## Privacy impact

Role assignments and group memberships are stored and visible to Owners and Admins. They are organisational data, not
presence (ADR-0012), and carry no times. Private channels stay nameless in the view (ADR-0026). Who changed what is
not recorded before M4c.

## UI / design

A full-screen Radix dialog with the tabs People and Groups. Tables on `surface-raised`, roles as text chips with their
scope. Errors inline. No world representation.

## Open questions

_None._ See ADR-0038.
