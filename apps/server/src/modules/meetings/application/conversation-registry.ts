import type { IdGenerator } from '@teamtown/kernel';
import { FloorConversations, type Conversation } from '../domain/floor-conversations.ts';
import { FloorRoomCalls } from '../domain/room-calls.ts';
import type { FloorAcoustics, FloorAcousticsSource } from './ports/floor-acoustics.port.ts';

export interface RunningFloor {
  readonly acoustics: FloorAcoustics;
  readonly conversations: FloorConversations;
  readonly roomCalls: FloorRoomCalls;
}

export class ConversationRegistry {
  readonly #floors = new Map<string, RunningFloor>();

  constructor(
    private readonly source: FloorAcousticsSource,
    private readonly ids: IdGenerator,
  ) {}

  async open(floorId: string): Promise<RunningFloor | null> {
    const running = this.#floors.get(floorId);
    if (running) return running;
    const acoustics = await this.source.getFloor(floorId);
    if (!acoustics) return null;
    const floor = this.#floors.get(floorId) ?? {
      acoustics,
      conversations: new FloorConversations(floorId, acoustics.grid, () => this.ids.next()),
      roomCalls: new FloorRoomCalls(floorId),
    };
    this.#floors.set(floorId, floor);
    return floor;
  }

  get(floorId: string): RunningFloor | null {
    return this.#floors.get(floorId) ?? null;
  }

  runningFloorIds(): string[] {
    return [...this.#floors.keys()];
  }

  close(floorId: string): void {
    this.#floors.delete(floorId);
  }

  find(conversationId: string): { readonly floor: RunningFloor; readonly conversation: Conversation } | null {
    for (const floor of this.#floors.values()) {
      const conversation = floor.conversations.get(conversationId);
      if (conversation) return { floor, conversation };
    }
    return null;
  }
}
