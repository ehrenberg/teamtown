# Brainstorming — Idea Catalogue

> **Status: all ideas here are proposals.** Nothing in this document is decided. Ideas move into
> [mvp-scope.md](mvp-scope.md) or the [roadmap](roadmap.md) only after an explicit decision by the
> product owner. Ideas that need a decision are tracked in [open-questions.md](open-questions.md).

Rating legend: **Impact** (value for users) and **Effort** each from ● (low) to ●●● (high).
`MVP?` marks ideas that relate to an MVP area already chosen (world, A/V & meetings, channels, roles & admin).

---

## 1. Space & movement

| #   | Idea                                                                                   | Description                                                                                                                                                             | Impact | Effort | MVP? |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- |
| S1  | **Door states as availability** → [spec](../features/meetings-room-calls-and-knock.md) | Every room door shows its mode: _open_ (walk in), _knock_ (request entry, occupants accept), _locked_ (members/invitees only). Availability becomes physically visible. | ●●●    | ●●     | ✔    |
| S2  | **Click-to-walk + WASD**                                                               | Click a tile and the avatar walks there by pathfinding; keyboard for fine control. Double-click a colleague and you walk up to them.                                    | ●●●    | ●●     | ✔    |
| S3  | **"Go to" / teleport**                                                                 | Command palette: `go Lena`, `go Room Elbe`. You walk there with a short fast-travel animation and don't need to navigate.                                               | ●●●    | ●      | ✔    |
| S4  | **Own desk as home base**                                                              | Each person can claim a desk. After login you spawn there. The desk shows your name plate and an optional plant or mug (personalization).                               | ●●     | ●      |      |
| S5  | **Floor switcher (stairs/elevator)**                                                   | Multiple floors, switch via elevator UI or walking to the stairs.                                                                                                       | ●●     | ●●     |      |
| S6  | **Follow mode**                                                                        | "Follow Lena": your avatar follows hers. Useful for onboarding tours and "come with me to Room X".                                                                      | ●●     | ●      |      |
| S7  | **Minimap & people finder**                                                            | A small 2D floor plan with dots for occupied rooms; search for a person to highlight them.                                                                              | ●●●    | ●      |      |
| S8  | **Ambient time of day**                                                                | The light follows the real local time (morning sun, evening lamps). Colleagues in other time zones get a small moon badge.                                              | ●      | ●●     |      |
| S9  | **Frosted glass for private rooms**                                                    | Locked meetings show only silhouettes or initials through frosted glass. You know the room is busy, but not who is inside (configurable).                               | ●●     | ●      | ✔    |

## 2. Synchronous communication (audio, video, meetings)

| #   | Idea                                                                                  | Description                                                                                                                                                                    | Impact | Effort | MVP? |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ | ---- |
| C1  | **Proximity conversations** → [spec](../features/meetings-proximity-conversations.md) | Walk near someone and their audio fades in (spatial audio, attenuated by distance). Walls block sound.                                                                         | ●●●    | ●●●    | ✔    |
| C2  | **Conversation bubble** → [spec](../features/meetings-proximity-conversations.md)     | People in an ad-hoc conversation get a visible soft bubble. Others can see the conversation and politely "join" by walking in. A lock icon on the bubble means "private chat". | ●●●    | ●●     | ✔    |
| C3  | **Room meetings** → [spec](../features/meetings-room-calls-and-knock.md)              | Entering a meeting room joins its call automatically. Leaving the room leaves the call. No links, no lobbies.                                                                  | ●●●    | ●●     | ✔    |
| C4  | **Knock knock** → [spec](../features/meetings-room-calls-and-knock.md)                | Knocking on a _knock_-mode room sends an entry request to the occupants, with an audible knock sound.                                                                          | ●●●    | ●      | ✔    |
| C5  | **Screen on the wall**                                                                | A screen share appears on the room's TV/wall in the world as a live thumbnail. Click it to open full-screen.                                                                   | ●●     | ●●     | ✔    |
| C6  | **Town hall / stage**                                                                 | A stage area: speakers on stage are audible to everyone, the audience is muted by default, with hand-raise to come on stage.                                                   | ●●●    | ●●     |      |
| C7  | **Megaphone (announcement)**                                                          | Admins can briefly speak to the whole floor ("Pizza is here!"). Strongly rate-limited and permission-gated.                                                                    | ●      | ●      |      |
| C8  | **Call someone who's far away** → [spec](../features/meetings-direct-calls.md)        | Ring a colleague directly (like a phone call). If accepted, both get a temporary private bubble, wherever they are.                                                            | ●●●    | ●●     | ✔    |
| C9  | **Scheduled meetings = booked rooms**                                                 | Calendar invites book a room. The room's door sign shows "Busy 14:00–15:00 · Sprint Review". At start time, participants get a "walk there" prompt.                            | ●●●    | ●●●    |      |
| C10 | **Pop-up rooms**                                                                      | Need a room but all are full? Spawn a temporary private room that exists only during the meeting.                                                                              | ●●     | ●●     |      |
| C11 | **Meeting recording & AI notes**                                                      | Optional recording (only with consent of all present) with transcript and summary pinned to the room's chat.                                                                   | ●●     | ●●●    |      |

## 3. Asynchronous communication (channels & messages)

| #   | Idea                                | Description                                                                                                                   | Impact | Effort | MVP? |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- |
| M1  | **Channels with roles**             | Public, private and announcement channels (read-only except for publishers), with per-channel roles.                          | ●●●    | ●●     | ✔    |
| M2  | **Direct & group messages**         | 1:1 and small group DMs.                                                                                                      | ●●●    | ●●     | ✔    |
| M3  | **Threads, mentions, reactions**    | The standard set; reactions also show briefly as an emote above the avatar if the author is visible.                          | ●●●    | ●●     | ✔    |
| M4  | **Room wall (room-linked channel)** | Each room has a persistent chat/pinboard. Meeting chat and shared links stay with the room.                                   | ●●●    | ●      | ✔    |
| M5  | **Sticky note on a door or desk**   | Leave an async note at someone's desk ("Call me when you're back"). It shows as a post-it in the world and as a notification. | ●●     | ●      |      |
| M6  | **Pigeonhole inbox**                | A central "mail slot": mentions, knocks you missed, notes left for you. The world metaphor for notifications.                 | ●●     | ●●     |      |
| M7  | **Files & previews**                | Upload files, image and PDF previews, pin to a channel or room.                                                               | ●●●    | ●●     | ✔    |
| M8  | **Full-text search**                | Search messages, channels and people from the command palette.                                                                | ●●●    | ●●     | ✔    |
| M9  | **Message → meeting**               | A button in a thread: "Let's talk". Everyone in the thread gets a knock invitation to a pop-up room.                          | ●●     | ●      |      |

## 4. Presence, focus & wellbeing

| #   | Idea                        | Description                                                                                                                                                                 | Impact | Effort | MVP? |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- |
| P1  | **Status as body language** | Available (normal), in a meeting (seated, headset), focus (headphones and a desk lamp), away (chair empty, jacket on the chair), lunch (coffee cup). Readable without text. | ●●●    | ●●     | ✔    |
| P2  | **Focus mode**              | No proximity audio, only urgent DMs and knocks get through. The avatar wears headphones. Others see "please don't disturb".                                                 | ●●●    | ●      | ✔    |
| P3  | **Ghost mode**              | You're online but invisible in the world (privacy principle).                                                                                                               | ●●     | ●      | ✔    |
| P4  | **Do-not-track promise**    | No movement or attendance history, no per-person statistics. Shown transparently in the UI under "What TeamTown stores about you".                                          | ●●●    | ●      | ✔    |
| P5  | **Gentle end of day**       | Optional reminder: "It's 18:30, your desk lamp is still on 🌙".                                                                                                             | ●      | ●      |      |

## 5. Culture & serendipity

| #   | Idea                               | Description                                                                                             | Impact | Effort | MVP? |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- |
| K1  | **Coffee roulette**                | Opt in at the kitchen and get matched with a random colleague for 10 minutes.                           | ●●     | ●      |      |
| K2  | **Emotes**                         | Wave, thumbs up, celebrate, applause, as short avatar animations. Great for town halls.                 | ●●     | ●●     |      |
| K3  | **Welcome ritual for new hires**   | New employees spawn in the lobby, the team gets notified and a "welcome balloon" appears at their desk. | ●●     | ●      |      |
| K4  | **Company theming**                | Logo in the lobby, company colors on accent walls, photos on the walls.                                 | ●●     | ●●     |      |
| K5  | **Birthday & anniversary details** | Small, opt-in decorations at the desk.                                                                  | ●      | ●      |      |
| K6  | **Seasonal office**                | Optional seasonal decoration (admin toggle).                                                            | ●      | ●      |      |

## 6. Admin, enterprise & self-hosting

| #   | Idea                          | Description                                                                                                                                                   | Impact | Effort | MVP?     |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- |
| A1  | **Office editor (tile grid)** | Draw walls, rooms and doors on the iso grid, place furniture from a catalogue, with the real floor plan image as a tracing layer. _(Decided: in-app editor.)_ | ●●●    | ●●●    | ✔        |
| A2  | **Room policies**             | Per room: access mode, who may enter or lock, audio isolation, capacity, room wall on/off.                                                                    | ●●●    | ●●     | ✔        |
| A3  | **Custom roles**              | Admins compose roles from permission sets (e.g. "Team Lead" = can lock rooms + moderate channels).                                                            | ●●●    | ●●     | ✔        |
| A4  | **Guest access**              | A link to exactly one room or meeting. The guest lands in the lobby or at reception and sees only what is shared.                                             | ●●●    | ●●     | ✔        |
| A5  | **Audit log**                 | Admin actions are logged (role changes, deletions, policy changes), _not_ user movements.                                                                     | ●●●    | ●      | ✔        |
| A6  | **SSO & user provisioning**   | OIDC via Keycloak federating Entra ID or Google. SCIM sync of users and groups.                                                                               | ●●●    | ●●     | (partly) |
| A7  | **Setup wizard**              | First start: create admin → pick office size → draw or skip floor plan → invite people.                                                                       | ●●●    | ●●     | ✔        |
| A8  | **Data export**               | Export all data (GDPR Art. 20) and anonymize leavers.                                                                                                         | ●●     | ●●     |          |
| A9  | **Retention policies**        | Delete messages after X days per channel.                                                                                                                     | ●●     | ●      |          |

## 7. Integrations & extensibility

| #   | Idea                                     | Description                                                                                                                                     | Impact | Effort | MVP? |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---- |
| I1  | **Bots as NPCs**                         | Integrations appear as small robot avatars in a room. For example, the CI bot stands in the dev room and posts build results to its room wall.  | ●●     | ●●     |      |
| I2  | **Webhooks in/out**                      | Incoming webhooks post to channels; outgoing events for automation.                                                                             | ●●●    | ●      |      |
| I3  | **Calendar sync (CalDAV, M365, Google)** | Status and room booking from the calendar.                                                                                                      | ●●●    | ●●●    |      |
| I4  | **Interactive objects**                  | Objects in the world open tools: a whiteboard (tldraw/Excalidraw embed), a kanban board on the wall, the coffee machine starts coffee roulette. | ●●     | ●●     |      |
| I5  | **Plugin SDK**                           | Third-party furniture and objects with behaviour, in a sandbox.                                                                                 | ●●     | ●●●    |      |

## 8. Accessibility & reach

| #   | Idea                                  | Description                                                                                                                    | Impact | Effort | MVP?          |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ | ------------- |
| X1  | **List mode**                         | A complete 2D/list alternative: rooms as cards with occupants, "join" buttons. Screen-reader friendly, works on weak hardware. | ●●●    | ●●     | ✔ (principle) |
| X2  | **Command palette**                   | `Ctrl/⌘+K` for everything: go to, call, DM, set status, search.                                                                | ●●●    | ●      | ✔             |
| X3  | **Reduced motion & performance mode** | No animations, lower render resolution, 30 fps cap.                                                                            | ●●     | ●      | ✔             |
| X4  | **Colour-blind safe status**          | Status is shown by colour **and** shape or icon.                                                                               | ●●●    | ●      | ✔             |
| X5  | **Live captions**                     | Speech-to-text subtitles in meetings.                                                                                          | ●●     | ●●●    |               |
| X6  | **Mobile companion**                  | Chat, calls and status without the 3D world.                                                                                   | ●●●    | ●●●    |               |

## 9. "Spinner" ideas (bold, for later or never)

- **Window to the real office:** A webcam in the physical office kitchen appears as a "window" in the digital kitchen (hybrid bridge).
- **Desk booking bridge:** Book a physical desk for tomorrow by clicking it in the digital office.
- **Sound design:** Subtle ambient office sound (keyboard clicks, coffee machine), off by default.
- **Office "replay" of the day as anonymised heatmap** — ❌ _rejected by principle_ (privacy).
  Kept here as a reminder of what we deliberately **don't** build.
- **AI receptionist:** A bot in the lobby answers "Where is Lena?" or "Who is responsible for invoices?".

---

## Differentiation (proposal)

|                                  | Teams / Slack | Gather / Kumospace / Teamflow | **TeamTown**                                            |
| -------------------------------- | ------------- | ----------------------------- | ------------------------------------------------------- |
| Async channels with roles        | ✔ strong      | ◐ weak                        | ✔ first-class                                           |
| Spatial presence                 | ✘             | ✔                             | ✔                                                       |
| Look                             | Corporate     | 2D pixel art / generic        | **Soft low-poly isometric 3D replica of _your_ office** |
| Open source / self-host          | ✘             | ✘                             | ✔ AGPL-3.0, one-command self-hosting                    |
| Privacy (works-council friendly) | ◐             | ◐                             | ✔ no history by design                                  |
| Non-spatial accessibility mode   | n/a           | ◐                             | ✔ principle                                             |

## Risks to keep in mind

| Risk                                                       | Mitigation idea                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Gimmick trap:** people use it twice and go back to Teams | Daily-driver features first (chat quality, reliable calls, notifications); spatial adds value instead of friction |
| **Performance on office laptops**                          | Low-poly budget, instancing, performance mode, list mode                                                          |
| **Audio/video quality**                                    | Proven SFU (LiveKit), TURN, no in-house media stack                                                               |
| **Seen as surveillance**                                   | Privacy principles, transparency page, no history, ghost mode                                                     |
| **Scope explosion**                                        | Strict MVP, ideas stay in this catalogue until decided                                                            |
| **Self-hosting complexity** (Keycloak, LiveKit, TURN)      | One compose file, setup wizard, good docs                                                                         |
