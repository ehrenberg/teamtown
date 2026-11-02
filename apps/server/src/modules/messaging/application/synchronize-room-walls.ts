import type { Clock, IdGenerator } from '@teamtown/kernel';
import { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { PeopleDirectory } from './ports/people-directory.port.ts';
import type { RoomDescriptor, RoomDirectory } from './ports/room-directory.port.ts';

const roomKey = ({ floorId, roomId }: Pick<RoomDescriptor, 'floorId' | 'roomId'>): string =>
  `${floorId}\u0000${roomId}`;

/** Idempotently aligns room walls with published World rooms (M3c, P-18). */
export class SynchronizeRoomWalls {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly rooms: RoomDirectory,
    private readonly people: PeopleDirectory,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(): Promise<void> {
    const desired = await this.rooms.listRooms();
    const memberIds = await this.people.allIds();
    const desiredKeys = new Set(desired.map(roomKey));
    const existing = await this.channels.listRoomWalls();
    const byRoom = new Map(existing.flatMap((wall) => (wall.roomLink ? [[roomKey(wall.roomLink), wall]] : [])));

    for (const room of desired) {
      const key = roomKey(room);
      let wall = byRoom.get(key);
      if (!wall) {
        wall = Channel.createRoomWall({ channelId: this.ids.next(), ...room, now: this.clock.now() });
      } else {
        wall.syncRoomWall({ name: room.name, archived: false, now: this.clock.now() });
      }
      for (const personId of memberIds) wall.joinRoomWall(personId, this.clock.now());
      const saved = await this.channels.save(wall);
      if (!saved.ok) {
        const concurrent = await this.channels.findRoomWall(room.floorId, room.roomId);
        if (!concurrent) throw new Error(`Room wall conflict without a stored wall for ${room.floorId}/${room.roomId}`);
        concurrent.syncRoomWall({ name: room.name, archived: false, now: this.clock.now() });
        await this.channels.save(concurrent);
      }
    }

    for (const wall of existing) {
      if (!wall.roomLink || desiredKeys.has(roomKey(wall.roomLink))) continue;
      wall.syncRoomWall({ name: wall.props.name ?? '', archived: true, now: this.clock.now() });
      await this.channels.save(wall);
    }
  }
}
