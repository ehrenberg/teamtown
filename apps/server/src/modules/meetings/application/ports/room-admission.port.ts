/** Entering and leaving rooms on behalf of Meetings (knocks, logged meetings); Presence does the walking. */
export interface RoomAdmission {
  /** Grants an entry pass and walks the person in. */
  admit(personId: string, floorId: string, roomId: string): void;
  /** While a meeting is logged, nobody walks in without consenting first (ADR-0027). */
  requireConsent(floorId: string, roomId: string, required: boolean): void;
  /** Walks the person out of the room, e.g. after declining a logged meeting. */
  walkOut(personId: string, floorId: string, roomId: string): void;
}

export const ROOM_ADMISSION = Symbol('ROOM_ADMISSION');
