export interface RoomDescriptor {
  readonly floorId: string;
  readonly roomId: string;
  readonly name: string;
}

/** Published rooms from the World context; no presence or occupancy data crosses this port. */
export interface RoomDirectory {
  listRooms(): Promise<RoomDescriptor[]>;
}

export const ROOM_DIRECTORY = Symbol('ROOM_DIRECTORY');
