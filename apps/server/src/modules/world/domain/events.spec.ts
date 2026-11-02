import { describe, expect, it } from 'vitest';
import type { FloorPlanProps } from './floor-plan.ts';
import { roomLifecycleEvents } from './events.ts';

const plan = (rooms: FloorPlanProps['rooms']): FloorPlanProps => ({ floorId: 'ground', rooms }) as FloorPlanProps;
const room = (id: string, name: string): FloorPlanProps['rooms'][number] =>
  ({ id, name }) as FloorPlanProps['rooms'][number];

describe('roomLifecycleEvents', () => {
  it('describes creates, renames and deletes with no presence data', () => {
    expect(
      roomLifecycleEvents(
        plan([room('old', 'Old'), room('keep', 'Before')]),
        plan([room('keep', 'After'), room('new', 'New')]),
      ),
    ).toEqual([
      { type: 'RoomRenamed', floorId: 'ground', roomId: 'keep', name: 'After' },
      { type: 'RoomCreated', floorId: 'ground', roomId: 'new', name: 'New' },
      { type: 'RoomDeleted', floorId: 'ground', roomId: 'old' },
    ]);
  });
});
