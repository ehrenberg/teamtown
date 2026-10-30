import { unwrap } from '@teamtown/kernel';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { FloorGrid } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { ConversationRegistry } from '../application/conversation-registry.ts';
import { Knocks } from '../domain/knocks.ts';
import { MeetingsTelemetry } from './meetings-telemetry.ts';

class TestMetricReader extends MetricReader {
  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

describe('MeetingsTelemetry', () => {
  it('reports counts without any attributes', async () => {
    const registry = new ConversationRegistry(
      {
        getFloor: (floorId) =>
          Promise.resolve({
            floorId,
            grid: unwrap(FloorGrid.builder(10, 10)).build(),
            isolatedRoomIds: ['elbe'],
            isIsolated: () => false,
          }),
      },
      { next: () => 'c1' },
    );
    const floor = await registry.open('ground');
    floor?.conversations.update(
      [
        { personId: 'anna', position: { x: 1, y: 1 } },
        { personId: 'ben', position: { x: 2, y: 1 } },
      ],
      0,
    );
    floor?.roomCalls.update(new Map([['elbe', ['carl']]]));
    const knocks = new Knocks(() => 'k1');
    knocks.request({ floorId: 'ground', roomId: 'elbe', requester: 'dora' }, 0);

    const reader = new TestMetricReader();
    new MeetingsTelemetry(
      registry,
      knocks,
      new MeterProvider({ readers: [reader] }).getMeter('test'),
    ).onApplicationBootstrap();
    const { resourceMetrics } = await reader.collect();
    const points = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .map((metric) => [metric.descriptor.name, metric.dataPoints.map((p) => [p.value, p.attributes])]);

    expect(points).toEqual([
      ['teamtown.meetings.conversations', [[1, {}]]],
      ['teamtown.meetings.room_calls', [[1, {}]]],
      ['teamtown.meetings.knocks', [[1, {}]]],
    ]);
  });
});
