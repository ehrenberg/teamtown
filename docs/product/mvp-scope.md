# MVP Scope

## Decided (2026-10-29)

The MVP covers **all four** product areas:

1. **World, avatars, presence**: see the office, move, see who is where with which status
2. **Audio/video & meetings**: proximity conversations, room meetings (public and private), screen sharing
3. **Channels & direct messages**: persistent chat with threads, mentions and files
4. **Rights, roles & admin**: role management, private rooms and channels, guest access, audit log

Further fixed constraints that shape the MVP:

- Platforms: **Web and Electron desktop app** from day one
- The office is a **replica of the real office**, built with an **in-app tile-grid editor**
- Avatars: **stylised low-poly figures**, customisable
- Presence privacy: **live position, no history**
- UI languages: **English + German** (i18n)
- Target size: **50–500 people** per instance, **single tenant**, self-hosted

## Feature cut (decided 2026-10-29)

IDs refer to [brainstorming.md](brainstorming.md).

### Must

| Area           | Features                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World          | **Multiple floors** with a floor switcher (S5), click-to-walk + WASD (S2), go-to (S3), door states (S1), status body language (P1), minimap (S7)                                                                                   |
| Editor         | Tile grid: floors (several per office), walls, doors, rooms, furniture catalogue (~30 items), tracing image (A1)                                                                                                                   |
| A/V            | Proximity audio with walls (C1), conversation bubbles (C2), room meetings (C3), knock (C4), screen share (C5), direct call (C8), camera on/off, mic on/off (default per person, initially on)                                      |
| Meetings       | Opt-in **logged meetings** started by the room host (ADR-0026)                                                                                                                                                                     |
| Messaging      | Public and private channels (M1), DMs and group DMs (M2), threads, mentions, reactions (M3), room walls (M4), file upload (M7), search with PostgreSQL full-text search (M8)                                                       |
| Admin & access | Setup wizard (A7), predefined + custom roles (A3), room policies (A2), guest link to one room (A4; guests can only _reply_ to DMs), audit log (A5), OIDC login via Keycloak (A6, without SCIM). Admins can't read private content. |
| Privacy & a11y | Focus mode (P2), ghost mode (P3), privacy transparency page (P4), list mode (X1), command palette (X2), reduced motion (X3), colour-blind-safe status (X4)                                                                         |
| Showcase       | Demo mode: guest login with a generated avatar, **demo bot colleagues** that walk around and greet visitors, nightly data reset                                                                                                    |

### Explicitly out of MVP

Calendar integration, recording/AI notes, town hall stage, integration bots/NPCs (I1; the demo bots are
a showcase feature, not the integration platform), plugin SDK, mobile app, SCIM, emotes beyond a basic
set, theming beyond logo and accent colour.

## MVP acceptance

- 50 people on one floor at the same time: 60 fps on a mid-range laptop (integrated GPU),
  movement visible to others in < 150 ms (same region) _(proposal)_
- A proximity conversation starts in < 1 s after approaching _(proposal)_
- Showcase: a visitor walks and talks within **60 seconds** of opening the demo _(decided)_
- A new contributor runs the stack locally in **< 15 minutes** _(decided)_
- A fresh self-hosted installation via `docker compose up` plus setup wizard in < 15 min _(proposal)_
