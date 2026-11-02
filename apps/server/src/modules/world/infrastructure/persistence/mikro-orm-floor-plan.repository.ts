import type { MikroORM } from '@mikro-orm/postgresql';
import { unwrap } from '@teamtown/kernel';
import { appendToOutbox } from '../../../../platform/outbox/outbox.ts';
import type { FloorPlanRepository } from '../../application/ports/floor-plan-repository.port.ts';
import { roomLifecycleEvents } from '../../domain/events.ts';
import { FloorPlan } from '../../domain/floor-plan.ts';
import { FloorPlanRecord } from './floor-plan.entity.ts';

/**
 * Floor plans rarely change and are read on every floor join, so validated aggregates are cached in memory.
 * (Single server process, ADR-0017; a published version is immutable.)
 */
export class MikroOrmFloorPlanRepository implements FloorPlanRepository {
  readonly #cache = new Map<string, FloorPlan>();

  constructor(
    private readonly orm: MikroORM,
    private readonly eventsRecorded: () => void,
  ) {}

  async list(): Promise<FloorPlan[]> {
    const records = await this.orm.em.fork().findAll(FloorPlanRecord, { orderBy: { level: 'asc' } });
    return records.map((record) => this.#toDomain(record));
  }

  async findById(floorId: string): Promise<FloorPlan | null> {
    const cached = this.#cache.get(floorId);
    if (cached) return cached;
    const record = await this.orm.em.fork().findOne(FloorPlanRecord, { floorId });
    return record ? this.#toDomain(record) : null;
  }

  async exists(floorId: string): Promise<boolean> {
    return (await this.orm.em.fork().count(FloorPlanRecord, { floorId })) > 0;
  }

  async save(plan: FloorPlan): Promise<void> {
    const { props } = plan;
    const events = await this.orm.em.fork().transactional(async (em) => {
      const record = await em.findOne(FloorPlanRecord, { floorId: props.floorId });
      const recorded = roomLifecycleEvents(record?.plan ?? null, props);
      if (record) {
        Object.assign(record, { name: props.name, level: props.level, version: props.version, plan: props });
      } else {
        em.create(FloorPlanRecord, {
          floorId: props.floorId,
          name: props.name,
          level: props.level,
          version: props.version,
          plan: props,
        });
      }
      await em.flush();
      await appendToOutbox(em, 'world', recorded);
      return recorded;
    });
    this.#cache.set(props.floorId, plan);
    if (events.length > 0) this.eventsRecorded();
  }

  #toDomain(record: FloorPlanRecord): FloorPlan {
    const cached = this.#cache.get(record.floorId);
    if (cached?.props.version === record.version) return cached;
    // Stored plans were validated before saving; a failure here means corrupted data.
    const plan = unwrap(FloorPlan.create(record.plan));
    this.#cache.set(record.floorId, plan);
    return plan;
  }
}
