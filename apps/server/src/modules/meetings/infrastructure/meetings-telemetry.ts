import type { OnApplicationBootstrap } from '@nestjs/common';
import { metrics, type Meter } from '@opentelemetry/api';
import type { ConversationRegistry } from '../application/conversation-registry.ts';
import type { Knocks } from '../domain/knocks.ts';

/**
 * Instance-wide counts of conversations, room calls and open knocks (ADR-0019). Counts only: never people, rooms
 * or floors as attributes (ADR-0012).
 */
export class MeetingsTelemetry implements OnApplicationBootstrap {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly knocks: Knocks,
    private readonly meter: Meter = metrics.getMeter('teamtown-server'),
  ) {}

  onApplicationBootstrap(): void {
    const { registry, knocks, meter } = this;
    const count = (of: (floorId: string) => number) =>
      registry.runningFloorIds().reduce((sum, floorId) => sum + of(floorId), 0);

    meter
      .createObservableGauge('teamtown.meetings.conversations', {
        description: 'Active proximity conversations',
        unit: '{conversation}',
      })
      .addCallback((result) => {
        result.observe(count((floorId) => registry.get(floorId)?.conversations.all().length ?? 0));
      });
    meter
      .createObservableGauge('teamtown.meetings.room_calls', {
        description: 'Active room calls',
        unit: '{call}',
      })
      .addCallback((result) => {
        result.observe(count((floorId) => registry.get(floorId)?.roomCalls.all().length ?? 0));
      });
    meter
      .createObservableGauge('teamtown.meetings.knocks', { description: 'Open knocks', unit: '{knock}' })
      .addCallback((result) => {
        result.observe(knocks.all().length);
      });
  }
}
