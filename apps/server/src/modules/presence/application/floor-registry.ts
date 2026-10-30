import { FloorInstance } from '../domain/floor-instance.ts';
import type { FloorSource } from './ports/floor-source.port.ts';

/** Keeps the running floors and remembers which floor each person is on. In memory only. */
export class FloorRegistry {
  readonly #floors = new Map<string, FloorInstance>();
  readonly #floorOfPerson = new Map<string, string>();

  constructor(private readonly source: FloorSource) {}

  async open(floorId: string): Promise<FloorInstance | null> {
    const running = this.#floors.get(floorId);
    if (running) return running;
    const definition = await this.source.getFloor(floorId);
    if (!definition) return null;
    // Another join may have opened the floor while the definition was loading.
    const instance =
      this.#floors.get(floorId) ??
      new FloorInstance(definition.floorId, definition.grid, definition.spawnPoints, definition.rooms);
    this.#floors.set(floorId, instance);
    return instance;
  }

  running(floorId: string): FloorInstance | null {
    return this.#floors.get(floorId) ?? null;
  }

  runningFloorIds(): string[] {
    return [...this.#floors.keys()];
  }

  floorOf(personId: string): FloorInstance | null {
    const floorId = this.#floorOfPerson.get(personId);
    return floorId ? (this.#floors.get(floorId) ?? null) : null;
  }

  assign(personId: string, floor: FloorInstance): void {
    this.#floorOfPerson.set(personId, floor.floorId);
  }

  unassign(personId: string): void {
    this.#floorOfPerson.delete(personId);
  }

  /** Frees memory of floors nobody is on. */
  closeIfEmpty(floor: FloorInstance): void {
    if (floor.isEmpty) this.#floors.delete(floor.floorId);
  }
}
