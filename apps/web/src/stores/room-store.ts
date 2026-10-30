import type { KnockOutcome, ServerEvent } from '@teamtown/contracts';
import { create } from 'zustand';

export type DoorMode = 'open' | 'knock' | 'locked';

export interface Knock {
  readonly knockId: string;
  readonly roomId: string;
  readonly requester: string;
  /** Server time in ms since the epoch. */
  readonly expiresAt: number;
}

/** The last answer to a knock, kept for the status message and the screen-reader announcement. */
export interface KnockResult {
  readonly roomId: string;
  readonly requester: string;
  readonly outcome: KnockOutcome;
}

/** The logged meeting one is in (after consenting or as its host). */
export interface MyMeetingLog {
  readonly roomId: string;
  readonly meetingId: string;
  readonly title: string;
  readonly hostId: string;
}

/** A logged meeting asks for consent: from inside the room, or before walking in (`title` unknown outside). */
export interface ConsentRequest {
  readonly roomId: string;
  readonly title: string | null;
}

interface RoomState {
  readonly floorId: string | null;
  readonly doorModes: Readonly<Record<string, DoorMode>>;
  /** Participants per room call; rooms without a call are missing. */
  readonly roomCalls: Readonly<Record<string, readonly string[]>>;
  /** Open knocks this person can see: their own and those on the room they are in. */
  readonly knocks: Readonly<Record<string, Knock>>;
  readonly lastKnockResult: KnockResult | null;
  /** Rooms on this floor whose meeting is logged right now. */
  readonly loggedRooms: readonly string[];
  readonly myMeetingLog: MyMeetingLog | null;
  readonly consentRequest: ConsentRequest | null;
  readonly requestConsent: (request: ConsentRequest | null) => void;
  readonly applySnapshot: (
    floorId: string,
    doorModes: readonly { roomId: string; doorMode: DoorMode }[],
    roomCalls: readonly { roomId: string; participants: readonly string[] }[],
    loggedRooms: readonly string[],
  ) => void;
  readonly applyEvent: (event: ServerEvent) => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  floorId: null,
  doorModes: {},
  roomCalls: {},
  knocks: {},
  lastKnockResult: null,
  loggedRooms: [],
  myMeetingLog: null,
  consentRequest: null,
  requestConsent: (consentRequest) => {
    set({ consentRequest });
  },
  applySnapshot: (floorId, doorModes, roomCalls, loggedRooms) => {
    set({
      floorId,
      doorModes: Object.fromEntries(doorModes.map((room) => [room.roomId, room.doorMode])),
      roomCalls: Object.fromEntries(roomCalls.map((call) => [call.roomId, call.participants])),
      knocks: {},
      loggedRooms: [...loggedRooms],
    });
  },
  applyEvent: (event) => {
    set((state) => {
      switch (event.t) {
        case 'DoorModeChanged':
          return event.p.floorId === state.floorId
            ? { doorModes: { ...state.doorModes, [event.p.roomId]: event.p.doorMode } }
            : {};
        case 'RoomCallChanged': {
          if (event.p.floorId !== state.floorId) return {};
          const { roomId, participants } = event.p.roomCall;
          const roomCalls = Object.fromEntries(Object.entries(state.roomCalls).filter(([id]) => id !== roomId));
          return { roomCalls: participants.length > 0 ? { ...roomCalls, [roomId]: participants } : roomCalls };
        }
        case 'KnockRequested': {
          if (event.p.floorId !== state.floorId) return {};
          const { knockId, roomId, requester, expiresAt } = event.p;
          return { knocks: { ...state.knocks, [knockId]: { knockId, roomId, requester, expiresAt } } };
        }
        case 'KnockAnswered': {
          const knock = state.knocks[event.p.knockId];
          const knocks = Object.fromEntries(Object.entries(state.knocks).filter(([id]) => id !== event.p.knockId));
          return {
            knocks,
            lastKnockResult: knock
              ? { roomId: knock.roomId, requester: knock.requester, outcome: event.p.outcome }
              : state.lastKnockResult,
          };
        }
        case 'MeetingLogChanged': {
          if (event.p.floorId !== state.floorId) return {};
          const others = state.loggedRooms.filter((roomId) => roomId !== event.p.roomId);
          const ended = !event.p.active;
          return {
            loggedRooms: event.p.active ? [...others, event.p.roomId] : others,
            myMeetingLog: ended && state.myMeetingLog?.roomId === event.p.roomId ? null : state.myMeetingLog,
            consentRequest: ended && state.consentRequest?.roomId === event.p.roomId ? null : state.consentRequest,
          };
        }
        case 'MeetingLogDetails':
          return { myMeetingLog: event.p.details ? { roomId: event.p.roomId, ...event.p.details } : null };
        case 'MeetingLogConsentRequested':
          return { consentRequest: { roomId: event.p.roomId, title: event.p.title } };
        default:
          return {};
      }
    });
  },
}));

export const myKnock = (knocks: Readonly<Record<string, Knock>>, myPersonId: string | null): Knock | null =>
  Object.values(knocks).find((knock) => knock.requester === myPersonId) ?? null;

export const roomCallOf = (
  roomCalls: Readonly<Record<string, readonly string[]>>,
  personId: string | null,
): string | null =>
  personId
    ? (Object.entries(roomCalls).find(([, participants]) => participants.includes(personId))?.[0] ?? null)
    : null;
