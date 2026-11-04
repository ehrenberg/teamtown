# Feature: Access core

- **Status:** Done (2026-11-04)
- **Brainstorming ID:** A3 Custom roles (groundwork), M1 Channels with roles
- **Bounded context(s):** Access (new), People, Messaging, Presence, Meetings, web client
- **Milestone:** M4a (ADR-0011, ADR-0036)

## Problem / user value

As the person responsible for a town, I want one explainable rights model instead of per-feature rules, so that
somebody is in charge of an instance from the first day, and later slices can add roles and policies in one place.
As a member, I want nothing I can do today to stop working.

## Behaviour

1. **First Owner (ADR-0036).** The first person to sign in becomes the town's Owner, also when two people sign in at
   the same moment. On an instance that already has people, it is the first sign-in after this slice is deployed.
2. **Member by default.** Everyone who signs in holds the Member role at town scope without an assignment. M4d's guests
   will be the exception.
3. **Channel moderators.** A channel's creator becomes its Channel Moderator, for new channels when they are created
   and for existing ones once when the server starts (ADR-0033). The creator stays recorded, but being the creator
   no longer grants anything by itself.
4. **What moderators do.** Whoever holds `channel.manage` renames, archives and unarchives a channel and invites into a
   private one; `message.pin` pins; `message.delete.any` deletes other people's messages, with their attachments
   (P-34). Owner and Admin hold all of these at town scope, so they moderate every public channel. Admins don't read
   private content (ADR-0026): they only reach a private channel if they are members of it.
5. **Seed channels (P-35).** `#general` and `#random` can be renamed and moderated by Owner and Admin, but never
   archived.
6. **DMs and room walls keep their rules.** Any member pins in them (P-26). Nobody deletes other people's messages in a
   DM, whatever their role. Room walls can be moderated by Owner and Admin.
7. **Rooms keep today's behaviour (ADR-0036).** Member holds `room.lock`, `room.admit` and `meeting.log.start`, so
   anyone inside a room can do what they can do today. Being inside the room stays a requirement.
8. **Evaluation.** A permission holds if a role assigned to the person, directly or through a group, at the resource's
   scope or a parent scope contains it (`permissions.md` §1). Private resources stop only the inheritance of `*.read`
   and `room.enter`. Reading itself still goes through memberships in this slice: it changes nothing for anyone today,
   and M4d moves it to `AccessPolicy` when guests need it.

M4a has no administration UI. Assigning roles, managing groups, custom roles and policies are M4b.

## Acceptance criteria

- [x] Given a town nobody has signed in to, when two people sign in at the same moment, then exactly one is Owner.
- [x] Given a member who created a channel, then they can rename, archive and pin as before, and delete others' messages.
- [x] Given a channel created before this slice, when the server starts, then its creator is its Channel Moderator, and
      a later restart doesn't assign it again.
- [x] Given the Owner, then they can rename `#general` and pin in it, and archiving it is refused.
- [x] Given a member who isn't a moderator, when they try to rename, pin or delete someone else's message in a channel
      through the API, then the request is rejected (`403`).
- [x] Given the Owner who isn't a member of a private channel, then it answers `404`, as for anyone else.
- [x] Given a DM, then nobody can delete the other person's message.
- [x] Given someone inside a room, then they switch its door, answer knocks and start a logged meeting as before.
- [x] Non-spatial path: unchanged; the chat's actions follow `canManage`, `canArchive`, `canPin` and `canDeleteAny`.
- [x] Accessibility: no new UI patterns; actions a person may not use stay hidden as today.
- [x] i18n: changed and new error strings exist in English and German, using German **du**.

## Permissions

The catalogue in `docs/architecture/permissions.md` is decided (P-33), and Member also holds
`channel.create.private`, `room.admit`, `room.lock` and `meeting.log.start`. This slice **checks**:

| Permission                                        | Where                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| `channel.create.public`, `channel.create.private` | Creating a channel                             |
| `channel.manage`                                  | Rename, archive, invite into a private channel |
| `message.pin`                                     | Pinning in public and private channels         |
| `message.delete.any`                              | Deleting someone else's message                |
| `room.lock`, `room.admit`, `meeting.log.start`    | Doors, knocks, starting a logged meeting       |

Other permissions exist in the catalogue, but only matter once somebody can lack them: M4b (policies) and M4d (guests)
add their checks.

## Domain changes

- New **Access** context (`modules/access/`), listed in the domain model: `Permission`, `ScopeRef`, built-in `Role`s in
  code, `RoleAssignment`, groups in the model. Custom roles and their tables come with M4b.
- `Channel`: its moderation methods take whether the actor may moderate, decided by the use case through
  `AccessPolicy`, since domain objects stay pure. `creatorId` stays as a record.
- `Message.delete` takes whether the actor may delete any message.
- People calls a `SignInObserver` port on every sign-in; Access implements it to claim the first Owner.
- Domain events for role changes (`RoleAssigned`, …) arrive with M4b, where roles first change on request.

## API & realtime contracts

- `ChannelSummarySchema` gains `canManage`, `canArchive`, `canPin` and `canDeleteAny`, for the person asking.
- The error code `not-channel-creator` becomes `not-channel-moderator`; a new code `cannot-archive-channel`.
- New realtime error `not-allowed` for `SetDoorMode` and `AnswerKnock`, and `StartMeetingLog` likewise.
- No new endpoints: roles are managed in M4b.

## Privacy impact

Role assignments and group memberships are stored; they say who may do what, not where anyone is or was. No presence
data is persisted or logged (ADR-0012): `AccessPolicy` gets a room as a resource to check, never a position, and keeps
no record of checks. Admins still can't read private content (ADR-0026): no role grants it, and reading goes through
memberships in this slice.

## UI / design

The channel header and message actions use the new flags instead of comparing with the creator. No world
representation, no new screens.

## Open questions

_None._ P-33 to P-35 were decided on 2026-11-04.
