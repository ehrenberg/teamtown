# Feature: Direct calls

- **Status:** Ready
- **Brainstorming ID:** C8 (call someone who's far away)
- **Bounded context(s):** Meetings, Presence, People, realtime gateway
- **Milestone:** M2c, part 1 of 3 (direct call → camera → screen share; ADR-0031)

## Problem / user value

As a team member, I want to call a colleague who is far away or on another floor, so that a quick question
doesn't need a walk across the office. As someone in a call, I want to bring in another colleague, so that we can
settle things together.

## Behaviour

1. **Who can be called.** Anyone who is online, on any floor. The "People on this floor" list gets a "Call"
   action, and a "Call someone" dialog lists everyone online (name and floor), searchable by name.
2. **Ringing.** The caller starts a call; the callee sees and hears it ringing, with "Accept" and "Decline". After
   **30 seconds** without an answer the caller is told "Not reached". Someone who is already in a call or being
   rung is **busy**; the caller is told so at once.
3. **Connected.** When the callee accepts, both join the LiveKit room `direct:{callId}` and hear each other at full
   volume, without panning. Only participants get a token; the server removes whoever leaves and reconciles the
   room, as for conversations and room calls (ADR-0032).
4. **The call replaces the surroundings.** While in a call, a person is not part of any proximity conversation or
   room call: they hear only the call, and people around them don't hear them. They can still walk around; the
   call goes with them. Entering closed rooms still needs a knock.
5. **Group calls.** Any participant may invite another online person; the invitee is rung the same way. A call
   has at most **8 people**, counting those being rung.
6. **Leaving and ending.** Anyone can hang up. A call ends when fewer than two participants are left; open
   invitations end with it. If the caller hangs up while it is still ringing, the call is cancelled. Going offline
   or closing the app leaves the call.
7. **Visible from outside.** Everyone on the floor sees a phone icon at the avatar and "In a call" in the people
   list. Who is in the call with whom is visible only to the participants.
8. **Microphone.** The microphone toggle (button and `M`) works in calls as everywhere else.
9. **Reconnect.** After a dropped connection, the client asks for a fresh token for its call.

## Acceptance criteria

- [ ] Given two people on different floors, when one calls the other and the other accepts, then both hear each
      other within 1 s, and nobody else hears them.
- [ ] Given a ringing call, when 30 s pass without an answer, then the caller is told "Not reached" and the callee
      stops ringing; when the callee declines, the caller is told at once.
- [ ] Given a person already in a call, when someone calls them, then the caller is told they are busy.
- [ ] Given a person in a call standing next to others in a conversation or inside a room with a room call, then
      they are part of neither: they don't hear them and aren't heard.
- [ ] Given a call of two, when one invites a third person who accepts, then all three hear each other; a ninth
      invitation is rejected.
- [ ] Given a call of three, when two hang up, then the call ends for the last one.
- [ ] Given a modified client that joins `direct:{callId}` without being a participant (or stays after leaving),
      then the server removes it (privacy test against a real LiveKit server).
- [ ] People on the floor see "In a call" and a phone icon for participants, but not who they are talking to.
- [ ] Non-spatial path: calling, answering, inviting and hanging up work from the people list, the "Call someone"
      dialog and the call panel, all by keyboard.
- [ ] Accessibility: the incoming call is a dialog with a label (Radix), focus goes to it, and the ringing has a
      visible counterpart; joining and leaving are announced politely (`aria-live`).
- [ ] i18n: all new strings in EN and DE.

## Permissions

`call.direct` (town scope) exists in the catalogue (`permissions.md`). Roles arrive in M4; until then every
authenticated person may call and be called, and any participant may invite. No new permissions.

## Domain changes

- **Meetings (in memory):** `DirectCall` (`callId`, `participants[]`, `invitations[] { personId, invitedBy,
ringsUntil }`, max 8 people). Invariants: a person is in at most one call or invitation; a call with fewer than
  two participants ends. Events: `DirectCallChanged`, `DirectCallEnded`, `CallInvitationAnswered` (outcome
  `accepted | declined | no-answer | busy | cancelled`).
- **Meetings (conversations and room calls):** people in a direct call are left out of proximity conversations and
  room calls, like people in an audio-isolated room.
- **Presence / People:** a query for everyone online with their floor (for the "Call someone" dialog).

## API & realtime contracts

- Commands: `StartCall { personId }`, `InviteToCall { callId, personId }`, `AnswerCall { callId, accept }`,
  `LeaveCall { callId }`, `RequestDirectCallToken { callId }`, `ListOnlinePeople {}`.
- Events to the invitee only: `CallRinging { callId, invitedBy, participants, ringsUntil }`.
- Events to participants and invitees: `DirectCallChanged { callId, participants, invited }`,
  `DirectCallEnded { callId }`, `CallInvitationAnswered { callId, personId, outcome }`.
- Event to a participant only: `DirectCallAccessGranted { callId, url, token }`.
- Event to the requester only: `OnlinePeople { people: [{ personId, displayName, avatarColor, floorId }] }`.
- Events to everyone on the floor: `OnCallChanged { floorId, personId, onCall }`; `FloorSnapshot` gains `onCall`.
- Nack codes: `person-not-online`, `busy`, `call-not-found`, `not-in-call`, `call-full`, `cannot-call-yourself`.

## Privacy impact

- Calls, invitations and who called whom exist **only in memory** and in transit (ADR-0012). No call history is
  stored or logged; telemetry counts active calls only (ADR-0019, ADR-0030).
- Outside the call, people only learn _that_ someone is in a call, not with whom.
- Audio passes through LiveKit only; nothing is recorded.

## UI / design

- People list: "Call" per person; "In a call" with a phone icon (colour **and** shape).
- Toolbar: "Call someone" opens a dialog (Radix) with a searchable list of everyone online.
- Incoming call: a dialog with the caller's name (and other participants), "Accept" / "Decline", a soft ring tone.
- Call panel (sidebar, while in a call): participants, "Add someone", "Hang up"; ringing invitees shown as such.
- World: a small phone icon in the name label of people in a call.
- Reduced motion: no pulsing ring animation.

## Open questions

- None at the moment.
