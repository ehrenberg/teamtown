# Feature: Logged meetings

- **Status:** Ready
- **Brainstorming ID:** — (MVP scope "Meetings": opt-in logged meetings, `mvp-scope.md`)
- **Bounded context(s):** Meetings, Presence, realtime gateway, REST
- **Milestone:** M2d (ADR-0026, ADR-0027, ADR-0031)

## Problem / user value

As someone running a meeting, I want to keep a record of who attended and when, so that I can refer to it later.
As a participant, I want to know before I join that I will appear in that record, and be able to say no.

## Behaviour

1. **Nothing is stored by default.** A room call stays unlogged unless someone starts a logged meeting
   (ADR-0026).
2. **Starting.** Until M4, anyone inside a room with a room call can start a logged meeting from the header; they
   become its **host** (decided 2026-10-30). The host gives a title (default "Meeting in {room}") and starts it;
   starting counts as the host's consent.
3. **Visible.** While a meeting is logged, the room's door sign shows "Logged meeting" (icon **and** text), and the
   call shows the title and a "Logged" badge. People outside see that the room is logged, not the title.
4. **Consent.** Everyone else must agree before being logged (ADR-0027): a dialog explains what is stored ("the
   title, who took part, start and end time") with **Join** and **Don't join**. Only after **Join** is the person
   in the call and in the log; the consent (person, time) is stored with it.
   - **Already inside when it starts:** they get the dialog at once and are out of the call until they answer.
     **Don't join** walks them out of the room (decided 2026-10-30).
   - **Coming in:** walking into the room (by click, "Go there" or after a knock) shows the dialog first; the
     avatar only enters after **Join**. Joining is never automatic (ADR-0027). If the room asks to knock, the
     knock comes first and the dialog after being let in.
5. **Ending.** The host ends the logged meeting at any time; otherwise it ends when the room becomes empty. If the
   host leaves, it goes on (decided 2026-10-30). The room call itself continues unlogged after an end.
6. **My meetings.** A "My meetings" dialog lists the logged meetings one took part in (title, room, start, end,
   participants). The host can delete a log early. Admins cannot see logs (ADR-0026, decided 2026-10-30).
7. **Retention.** Logs are deleted automatically after the retention period, default **90 days** (ADR-0027). Until
   the admin settings arrive with M4, the period is a server setting (`MEETING_LOG_RETENTION_DAYS`, proposal).

## Acceptance criteria

- [ ] Given a room call, when nobody starts a logged meeting, then nothing about the call is stored.
- [ ] Given someone inside a room with a room call, when they start a logged meeting with a title, then a log with
      title, host, start time and the host's consent is stored, and the door sign shows "Logged meeting".
- [ ] Given a person already in the room, when the meeting is logged, then they are out of the call until they
      answer; **Join** puts them back in and in the log, **Don't join** walks them out of the room.
- [ ] Given a logged meeting, when someone walks into the room, then they see the consent dialog first and only
      enter after **Join**; a modified client cannot walk in without consenting (server-side check).
- [ ] Given a logged meeting, when the host ends it or the room becomes empty, then the end time is stored.
- [ ] Given past logged meetings, then "My meetings" lists those one took part in; the host can delete a log;
      nobody else (no admin either) can read it.
- [ ] Given a log older than the retention period, then it is deleted automatically.
- [ ] Non-spatial path: starting, consenting, ending and "My meetings" work without the 3D view, by keyboard.
- [ ] Accessibility: the consent dialog is a labelled dialog (Radix) with focus on **Join**; the logged state has
      text, not just colour.
- [ ] i18n: all new strings in EN and DE.

## Permissions

`meeting.log.start` (room scope, Room Host) exists in the catalogue (`permissions.md`). Until M4, every occupant
of a room with a room call may start a logged meeting; ending and deleting are reserved to its host. Reading a
log requires having taken part in it (or being its host); there is no admin permission to read logs (ADR-0026).

## Domain changes

- **Meetings:** `MeetingLog` (persisted, the only persisted Meetings aggregate): `meetingId`, `floorId`, `roomId`,
  `title`, `hostId`, `consents[] { personId, consentedAt }`, `startedAt`, `endedAt?`, `expiresAt`. Invariants: only
  people with a recorded consent are participants; only the host ends or deletes it.
- **Meetings (in memory):** the active logged meeting per room and who still has to answer the consent dialog.
  People who haven't consented are left out of that room's call.
- **Presence:** entering a room with an active logged meeting needs consent; Meetings grants an entry pass after
  **Join** (as after a knock) through Presence's public API.

## API & realtime contracts

- Realtime commands: `StartMeetingLog { title }`, `EndMeetingLog {}`, `AnswerMeetingLog { roomId, join }`.
- Realtime events: `MeetingLogChanged { floorId, roomId, active }` to the floor (no title);
  `MeetingLogDetails { roomId, meetingId, title, hostId } | null` and `MeetingLogConsentRequested { roomId, title }`
  to the people concerned.
- `MoveTo` into a room with an active logged meeting without consent: Nack `consent-required`.
- REST: `GET /api/meeting-logs` (logs one took part in), `DELETE /api/meeting-logs/{meetingId}` (host only).
- Nack codes: `consent-required`, `no-room-call`, `meeting-log-active`, `not-meeting-host`.

## Privacy impact

- This is the one place where Meetings stores personal data, and only after explicit consent (ADR-0026/0027):
  title, host, consented participants with consent time, start and end. Positions, audio and who merely walked by
  are never stored.
- Logs are deleted after the retention period and can be deleted earlier by the host. They are never logged to
  the application log or telemetry (counts only).
- Only participants and the host can read a log.

## UI / design

- Header (inside a room with a room call): "Log meeting" opens a small dialog (title, explanation, Start); while
  logged: "Logged: {title}" badge and, for the host, "End log".
- Consent dialog (Radix): what is stored, **Join** / **Don't join**.
- Door sign: a "Logged meeting" marker (icon and text) next to the door mode.
- "My meetings" dialog from the header: list with title, room, times, participants; "Delete" for the host.

## Open questions

- None at the moment.
