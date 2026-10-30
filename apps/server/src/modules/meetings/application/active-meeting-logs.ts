import type { MeetingLog } from '../domain/meeting-log.ts';

interface ActiveLog {
  readonly log: MeetingLog;
  /** People inside the room who still have to answer the consent dialog. */
  readonly pending: Set<string>;
  /** People who declined and are walking out; they are not asked again before they have left. */
  readonly declined: Set<string>;
}

const key = (floorId: string, roomId: string): string => `${floorId}:${roomId}`;

/** The logged meetings running right now, by room. The logs themselves are persisted; this is the live view. */
export class ActiveMeetingLogs {
  readonly #byRoom = new Map<string, ActiveLog>();

  get(floorId: string, roomId: string): ActiveLog | null {
    return this.#byRoom.get(key(floorId, roomId)) ?? null;
  }

  add(log: MeetingLog): void {
    this.#byRoom.set(key(log.props.floorId, log.props.roomId), { log, pending: new Set(), declined: new Set() });
  }

  remove(floorId: string, roomId: string): void {
    this.#byRoom.delete(key(floorId, roomId));
  }

  all(): ActiveLog[] {
    return [...this.#byRoom.values()];
  }

  /** Only people who consented take part in the call of a room whose meeting is logged (ADR-0027). */
  mayBeInCall(floorId: string, roomId: string, personId: string): boolean {
    const active = this.get(floorId, roomId);
    return !active || active.log.isParticipant(personId);
  }

  loggedRoomsOn(floorId: string): string[] {
    return this.all()
      .filter(({ log }) => log.props.floorId === floorId)
      .map(({ log }) => log.props.roomId);
  }
}
