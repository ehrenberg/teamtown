/** Lets an admitted person into a room (Presence grants an entry pass and walks them in). */
export interface RoomAdmission {
  admit(personId: string, floorId: string, roomId: string): void;
}

export const ROOM_ADMISSION = Symbol('ROOM_ADMISSION');
