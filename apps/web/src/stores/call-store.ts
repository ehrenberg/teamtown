import type { DirectCallContract, InvitationOutcome, OnlinePerson, ServerEvent } from '@teamtown/contracts';
import { create } from 'zustand';

/** The latest answer to an invitation in one's own call, for the status line and the announcement. */
export interface CallNotice {
  readonly personId: string;
  readonly outcome: InvitationOutcome;
}

interface CallState {
  /** The call one is in, or being rung for. Only participants and invitees ever learn its members. */
  readonly call: DirectCallContract | null;
  readonly lastNotice: CallNotice | null;
  /** People on the current floor who are in a call (not with whom). */
  readonly onCall: readonly string[];
  readonly onCallFloorId: string | null;
  /** Everyone online, from the last `OnlinePeople`; also resolves names of call members on other floors. */
  readonly online: readonly OnlinePerson[];
  readonly applySnapshot: (floorId: string, onCall: readonly string[]) => void;
  readonly applyEvent: (event: ServerEvent) => void;
  /** For answers the server gives as a Nack, e.g. calling someone who is busy. */
  readonly notify: (notice: CallNotice) => void;
}

export const useCallStore = create<CallState>()((set) => ({
  call: null,
  lastNotice: null,
  onCall: [],
  onCallFloorId: null,
  online: [],
  notify: (lastNotice) => {
    set({ lastNotice });
  },
  applySnapshot: (floorId, onCall) => {
    set({ onCallFloorId: floorId, onCall: [...onCall] });
  },
  applyEvent: (event) => {
    set((state) => {
      switch (event.t) {
        case 'DirectCallChanged':
          return { call: event.p.call };
        case 'DirectCallEnded':
          return state.call?.callId === event.p.callId ? { call: null } : {};
        case 'CallInvitationAnswered':
          return state.call?.callId === event.p.callId
            ? { lastNotice: { personId: event.p.personId, outcome: event.p.outcome } }
            : {};
        case 'OnCallChanged': {
          if (event.p.floorId !== state.onCallFloorId) return {};
          const others = state.onCall.filter((id) => id !== event.p.personId);
          return { onCall: event.p.onCall ? [...others, event.p.personId] : others };
        }
        case 'OnlinePeople':
          return { online: event.p.people };
        default:
          return {};
      }
    });
  },
}));

export type CallRole = 'participant' | 'ringing' | null;

export const roleIn = (call: DirectCallContract | null, personId: string | null): CallRole => {
  if (!call || !personId) return null;
  if (call.participants.includes(personId)) return 'participant';
  return call.invitations.some((invitation) => invitation.personId === personId) ? 'ringing' : null;
};
