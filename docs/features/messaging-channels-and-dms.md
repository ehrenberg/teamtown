# Feature: Channels and direct messages

- **Status:** Done (2026-11-01), except the command palette entries (see below)
- **Brainstorming ID:** M1 Channels with roles (without roles and announcement channels), M2 Direct & group messages
- **Bounded context(s):** Messaging (new), People, realtime gateway, REST
- **Milestone:** M3a (ADR-0033)

## Problem / user value

As a team member, I want to write in channels and send direct messages, so that conversations outlast a call and
reach people who aren't in the office right now.

## Behaviour

1. **Channels.** A channel is `public` or `private`. Anyone can create one with a name and becomes its **creator**
   (ADR-0033). Names are lowercase, 1–40 characters (letters, digits, `-`, `_`) and unique among channels
   (decided 2026-11-01).
   - **Public:** everyone can find it under "Browse channels", join and leave.
   - **Private:** only members see it. The creator invites people; members can leave. Town admins can't read it
     (ADR-0026).
   - **Creator rights until M4:** rename, archive and (private) invite. An archived channel stays readable but
     takes no new messages, moves to the bottom of the list and keeps its name; the creator can unarchive it
     (decided 2026-11-01).
2. **Seed channels.** `#general` and `#random` exist from the start. Everyone becomes a member on their first
   login (ADR-0033). `#general` can't be left, so it always reaches everyone; `#random` can (decided 2026-11-01).
3. **Direct messages.** A DM is a `direct` channel with 2 to 8 people (ADR-0033). DMs have no name; the list shows
   the other people's names. Members of a group DM can add people (up to 8) and leave it (decided 2026-11-01):
   - **1:1 DMs are fixed** _(proposal)_: nobody leaves them, and adding someone opens a new group DM with all three
     (the 1:1 history stays where it is). So there is exactly one 1:1 DM per pair.
   - **Opening a DM** with a set of people leads to the DM whose _current_ members are exactly those people, if
     there is one; otherwise a new one is created _(proposal)_.
   - Someone who left a group DM no longer sees it and gets no new messages.
4. **Messages.** Members post messages up to 4,000 characters (decided 2026-11-01) in a Markdown subset: bold, italic,
   inline code, code block, links and lists (ADR-0033). Raw HTML is never rendered. Authors can edit their own
   messages (marked "edited") and delete them (shown as "Message deleted"; the body is removed from the database).
5. **Unread.** Each membership keeps a **read marker**: the newest message the person has read. The list shows how
   many messages are unread (number **and** dot). Opening a channel and scrolling to the bottom moves the marker.
   Own messages never count as unread.
6. **Live.** New, edited and deleted messages and channel changes reach every member's open clients at once
   (WebSocket). After a reconnect the client reloads its channel list and the open channel.
7. **History.** A channel opens at the newest 50 messages; scrolling up loads older ones.

## Acceptance criteria

- [x] Given a person, when they create a public channel, then it appears in their list and everyone can find and
      join it under "Browse channels".
- [x] Given a private channel, then only its members see it and its messages; the creator can invite people;
      someone who isn't a member gets `404` from every endpoint of the channel (server-side check, integration test).
- [x] Given a member of a channel, when they post a message, then every other member's open client shows it within
      a second and their unread counter goes up.
- [x] Given an own message, when the author edits or deletes it, then all members see the change; nobody else can
      edit or delete it.
- [x] Given a DM with the same people, when someone opens a DM with them again, then the existing DM opens.
- [x] Given more than 8 people, when someone opens a DM with them or adds a ninth person to a group DM, then it is
      refused with a plain hint to use a private channel.
- [x] Given a group DM, when a member adds a person, then that person sees the DM with its history; when a member
      leaves, then they no longer see it. A 1:1 DM can't be left; adding someone to it opens a new group DM.
- [x] Given a message with `**bold**`, a list and `<script>`, then bold and the list render, the script tag shows
      as text.
- [x] Given a first login, then the person is a member of `#general` and `#random`.
- [x] Given unread messages, when the person opens the channel and reads to the bottom, then the counter clears,
      also in their other open clients.
- [ ] Non-spatial path: the chat works fully without the 3D view: sidebar list, chat panel and command palette
      entries "Go to channel", "New channel", "New message" (direct message). _(Sidebar, panel and dialogs work by
      keyboard; the command palette doesn't exist yet, its entries follow with it.)_
- [x] Accessibility: the message list is a labelled log (`role="log"`), new messages are announced politely, the
      composer is labelled; everything works by keyboard (Enter sends, Shift+Enter makes a new line, Escape closes
      the panel). _(Not yet checked with a screen reader.)_
- [x] i18n: all new strings in EN and DE.

## Permissions

The catalogue in `permissions.md` already has `channel.create.public`, `channel.create.private`, `channel.read`,
`channel.manage`, `message.post`, `message.edit.own`, `message.delete.own` and `dm.start`. Until M4 the Messaging
module decides with a simple local rule (ADR-0033), behind the same use-case checks M4 will route through the
`AccessPolicy` port:

| Action                                         | Allowed for                                      |
| ---------------------------------------------- | ------------------------------------------------ |
| Create a public or private channel, start a DM | every person                                     |
| Read and post                                  | members (public channels: anyone can join first) |
| Rename, archive, invite (private)              | the creator                                      |
| Add people to a group DM, leave a group DM     | its members                                      |
| Edit, delete a message                         | its author                                       |

Not being allowed to read a channel answers `404`, never `403`, so private channels don't leak their existence.

## Domain changes

- **New context Messaging** (`apps/server/src/modules/messaging`), persisted in its own schema:
  - `Channel` (root): `channelId`, `kind: public | private | direct`, `name?` (not for DMs), `creatorId`,
    `memberships[] { personId, joinedAt, readMarker? }`, `archivedAt?`, `pairKey?` (sorted member IDs, unique, for
    1:1 DMs). Invariants: DMs have at most 8 members; 1:1 DMs have exactly 2 fixed members; archived channels take
    no posts; names are unique.
  - `Message` (root, references `channelId`): `messageId`, `authorId`, `body`, `postedAt`, `editedAt?`,
    `deletedAt?`. Deleting clears the body.
- **Domain events:** `ChannelChanged` (also on creation), `ChannelLeft`, `ReadMarkerMoved`, `MessagePosted`, `MessageEdited`, `MessageDeleted`,
  written to a Messaging **outbox table** in the same transaction (ADR-0018). This is the first use of the outbox;
  the relay is added to the platform.
- **People:** a public query to list people (ID, display name, avatar colour) for picking DM members.
- **Seeds:** `#general` and `#random` (created by the migration, without a creator) and an automatic membership on
  the person's first login (decided 2026-11-01): the first channel list after login adds them, once per person, so
  someone who leaves `#random` stays out.

## API & realtime contracts

REST (writes and reads, overview §6.3, `world-and-realtime.md` §5), schemas in `packages/contracts/src/messaging/`:

- `GET /api/channels`: my channels and DMs with unread counts and the newest message time.
- `GET /api/channels/browse`: public channels I can join.
- `POST /api/channels` `{ kind: public | private, name }`, `PATCH /api/channels/{id}` `{ name?, archived? }`.
- `POST /api/channels/{id}/members` `{ personIds }` (join yourself, invite into a private channel, or add people to
  a group DM), `DELETE /api/channels/{id}/members/me` (leave).
- `POST /api/direct-messages` `{ personIds }`: opens or finds the DM.
- `GET /api/channels/{id}/messages?before={messageId}&limit=50`, `POST /api/channels/{id}/messages` `{ body }`,
  `PATCH /api/channels/{id}/messages/{messageId}` `{ body }`, `DELETE /api/channels/{id}/messages/{messageId}`.
- `PUT /api/channels/{id}/read-marker` `{ messageId }`.
- `GET /api/people`: everyone (ID, display name, avatar colour) for the DM picker.
- Error codes (stable, translated in the client): `channel-name-taken`, `invalid-channel-name`, `channel-archived`,
  `direct-message-too-large`, `cannot-leave-channel`, `not-channel-creator`, `not-message-author`,
  `invalid-message`.

Realtime events (push only, to the members' open connections):

- `MessagePosted { channelId, message }`, `MessageEdited { channelId, message }`,
  `MessageDeleted { channelId, messageId }`.
- `ChannelChanged { channel }` (created, renamed, archived, joined, members changed),
  `ChannelLeft { channelId }` (to the person who left).
- `ReadMarkerMoved { channelId, messageId }` (to the person's other clients).

## Privacy impact

- Messages are content the author chose to write; they are stored until deleted. Bodies are never written to logs
  or telemetry (counts only).
- The read marker holds only the last read message ID per membership, no reading times and no history.
- Nothing from presence is stored. Admins can't read private channels or DMs (ADR-0026).

## UI / design

- **Sidebar:** sections "Channels" and "Direct messages" below "People", each with a "+" button. Unread: bold name,
  count badge and dot.
- **Chat panel** (ADR-0033): collapsible panel to the right of the world, about 360 px wide (decided 2026-11-01).
  Header with name, members and a menu: rename, invite and archive for the creator; add people and leave in group
  DMs. Message list grouped by author and day,
  composer at the bottom.
- **Dialogs** (Radix): "New channel" (name, public/private), "Browse channels", "New message" (person picker, up
  to 7 others).
- **World:** nothing new in M3a (reactions above avatars come with M3b, room walls with M3c).

## Not yet covered by automated tests

- Archive, rename, invite and group-DM changes in the browser (covered by use-case and server integration tests).

## Open questions

- The two DM rules marked _(proposal)_: fixed 1:1 DMs, and finding a DM by its current members.
