# ADR-0031: Talk milestone (M2): slicing, proximity rules, door modes before roles

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Product owner

## Context

M2 adds audio and video (ADR-0008, ADR-0022). Several details in [audio-video.md](../audio-video.md) were
proposals, and door modes need an access rule before roles and room policies exist (M4).

## Decision

- **Slicing:** M2a proximity conversations → M2b room calls, door modes, knock → M2c camera, screen share,
  direct call → M2d logged meetings.
- **Proximity:** a conversation forms at a distance ≤ 4 tiles and dissolves at > 6 tiles (hysteresis).
  Groups are **transitive** (connected components), which gives the visible conversation bubble. **Every wall
  blocks sound**, glass included; doors are openings.
- **Volume:** full volume up to 2 tiles, silence at 6 tiles, plus **stereo panning** (WebAudio `PannerNode`)
  by the speaker's position on screen.
- **Private bubble:** people in a conversation can lock it in M2a. Newcomers see the lock and hear nothing.
  Someone who left comes back in automatically within a 30-second grace period.
- **Non-spatial path:** "Talk to" in the people list walks you next to the person.
- **Audio isolation per room:** the floor-plan format gets `audioIsolated` per room. Isolated rooms have their
  own room call (M2b); everywhere else proximity applies. Seeds: meeting and focus rooms are isolated.
- **Microphone permission:** asked when entering the office, with a short audio check (level meter, speaker
  test). The microphone default stays per person, initially on.
- **Camera:** off by default, opt-in per conversation. Video bubbles above avatars in proximity, a grid in room calls.
- **Door modes until M4:** anyone inside a room may switch its mode. `locked`: nobody else enters, knocking
  included. `knock`: someone inside admits the requester. M4 replaces this with room policies.

## Alternatives considered

| Option                               | Why not                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| Room calls before proximity          | Delays the core experience (walk up and talk)           |
| Pairwise (non-transitive) groups     | No unambiguous bubble; overlapping groups are confusing |
| Glass walls let sound through        | Not how real offices sound; weakens privacy             |
| Ask for the microphone at first talk | Rejected in favour of an upfront audio check            |
| Volume only, no panning              | Rejected in favour of more immersion                    |
| Isolation derived from the room kind | Not adjustable per room                                 |
| Door modes shown but not enforced    | Knock and lock are part of the M2 experience            |
| Fixed member lists in the seeds      | Anticipates M4 and is hard to maintain                  |
| No way back into a locked bubble     | Rejected in favour of a short grace period              |
| Direct call as the non-spatial path  | Only arrives in M2c                                     |

## Consequences

- The audio check sits between login and the office; the showcase goal (walk and talk within 60 s) must still hold.
- Proximity privacy depends on correct server-side subscription grants and is covered by dedicated tests (ADR-0022).
- _Proposal:_ a per-person setting to switch stereo panning off (accessibility, hearing on one ear).
