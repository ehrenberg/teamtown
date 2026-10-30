import { unwrap } from '@teamtown/kernel';
import { FloorGrid } from '@teamtown/world-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { FloorConversations, LOCKED_CONVERSATION_GRACE_MS, type ConversationEvent } from './floor-conversations.ts';

const NOW = 1_800_000_000_000;

/** 30 × 10 floor; a wall separates columns 19 and 20 completely. */
function grid(): FloorGrid {
  const builder = unwrap(FloorGrid.builder(30, 10));
  for (let y = 0; y < 10; y++) builder.addWall({ x: 19, y }, 'east');
  return builder.build();
}

describe('FloorConversations', () => {
  let floor: FloorConversations;
  let ids: number;
  const at = (positions: Record<string, [number, number]>, now = NOW) => {
    floor.update(
      Object.entries(positions).map(([personId, [x, y]]) => ({ personId, position: { x, y } })),
      now,
    );
    return floor.pullEvents();
  };
  const groups = () => floor.all().map((c) => [...c.participants]);

  beforeEach(() => {
    ids = 0;
    floor = new FloorConversations('ground-floor', grid(), () => `c${++ids}`);
  });

  it('forms a conversation between two people within 4 tiles and line of sight', () => {
    const events = at({ anna: [2, 2], ben: [5, 2] });
    expect(groups()).toEqual([['anna', 'ben']]);
    expect(events).toEqual<ConversationEvent[]>([
      {
        type: 'ConversationFormed',
        floorId: 'ground-floor',
        conversation: { conversationId: 'c1', participants: ['anna', 'ben'], locked: false },
      },
    ]);
  });

  it('does not form a conversation beyond 4 tiles', () => {
    at({ anna: [2, 2], ben: [7, 2] });
    expect(groups()).toEqual([]);
  });

  it('never forms a conversation through a wall', () => {
    at({ anna: [18, 2], ben: [21, 2] });
    expect(groups()).toEqual([]);
  });

  it('keeps a conversation up to 6 tiles (hysteresis) and ends it beyond', () => {
    at({ anna: [2, 2], ben: [5, 2] });
    at({ anna: [2, 2], ben: [8, 2] });
    expect(groups()).toEqual([['anna', 'ben']]);

    const events = at({ anna: [2, 2], ben: [8.5, 2] });
    expect(groups()).toEqual([]);
    expect(events).toEqual([
      { type: 'ConversationDissolved', floorId: 'ground-floor', conversationId: 'c1', left: ['anna', 'ben'] },
    ]);
  });

  it('groups transitively: A near B and B near C hear each other', () => {
    at({ anna: [2, 2], ben: [5, 2], carl: [8, 2] });
    expect(groups()).toEqual([['anna', 'ben', 'carl']]);
  });

  it('reports who joined and left an existing conversation', () => {
    at({ anna: [2, 2], ben: [5, 2] });
    const joined = at({ anna: [2, 2], ben: [5, 2], carl: [2, 5] });
    expect(joined).toEqual([
      {
        type: 'ConversationChanged',
        floorId: 'ground-floor',
        conversation: { conversationId: 'c1', participants: ['anna', 'ben', 'carl'], locked: false },
        joined: ['carl'],
        left: [],
      },
    ]);
    const left = at({ anna: [2, 2], ben: [5, 2] });
    expect(left[0]).toMatchObject({ type: 'ConversationChanged', joined: [], left: ['carl'] });
  });

  it('keeps the identity of the larger conversation when two merge', () => {
    at({ anna: [2, 2], ben: [4, 2], carl: [3, 4], dora: [12, 2], emil: [14, 2] });
    expect(floor.all().map((c) => c.conversationId)).toEqual(['c1', 'c2']);

    const events = at({ anna: [2, 2], ben: [4, 2], carl: [3, 4], dora: [7, 2], emil: [9, 2] });
    expect(floor.all()).toEqual([
      { conversationId: 'c1', participants: ['anna', 'ben', 'carl', 'dora', 'emil'], locked: false },
    ]);
    expect(events.map((e) => e.type).sort()).toEqual(['ConversationChanged', 'ConversationDissolved']);
  });

  it('keeps the identity for the larger part when a conversation splits', () => {
    at({ anna: [2, 2], ben: [4, 2], carl: [6, 2], dora: [9, 2] });
    at({ anna: [2, 2], ben: [4, 2], carl: [6, 2], dora: [16, 2], emil: [17, 3] });
    expect(floor.all()).toEqual([
      { conversationId: 'c1', participants: ['anna', 'ben', 'carl'], locked: false },
      { conversationId: 'c2', participants: ['dora', 'emil'], locked: false },
    ]);
  });

  it('ignores people who are not given (e.g. inside an audio-isolated room)', () => {
    at({ anna: [2, 2], ben: [5, 2] });
    const events = at({ anna: [2, 2] });
    expect(groups()).toEqual([]);
    expect(events[0]).toMatchObject({ type: 'ConversationDissolved' });
  });

  describe('locked conversations', () => {
    beforeEach(() => {
      at({ anna: [2, 2], ben: [4, 2] });
      expect(floor.lock('c1', 'anna')).toEqual({ ok: true, value: undefined });
      floor.pullEvents();
    });

    it('announces the lock to everyone on the floor', () => {
      floor.unlock('c1', 'ben');
      expect(floor.lock('c1', 'ben').ok).toBe(true);
      expect(floor.pullEvents().at(-1)).toMatchObject({
        type: 'ConversationChanged',
        conversation: { locked: true },
        joined: [],
        left: [],
      });
    });

    it('does not take in a newcomer, who also does not hear them', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [3, 3] });
      expect(groups()).toEqual([['anna', 'ben']]);
      expect(floor.conversationOf('carl')).toBeNull();
    });

    it('does not let a newcomer bridge the locked conversation with others', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [7, 2], dora: [10, 2] });
      expect(groups()).toEqual([
        ['anna', 'ben'],
        ['carl', 'dora'],
      ]);
    });

    it('rejects locking by someone who is not a participant', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [12, 2] });
      expect(floor.lock('c1', 'carl')).toEqual({ ok: false, error: 'not-in-conversation' });
      expect(floor.lock('nope', 'anna')).toEqual({ ok: false, error: 'conversation-not-found' });
    });
  });

  describe('grace period of a locked conversation', () => {
    beforeEach(() => {
      at({ anna: [2, 2], ben: [4, 2], carl: [3, 4] });
      floor.lock('c1', 'carl');
      floor.pullEvents();
    });

    it('takes back someone who returns within 30 s', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [12, 4] }, NOW + 1_000);
      expect(groups()).toEqual([['anna', 'ben']]);
      at({ anna: [2, 2], ben: [4, 2], carl: [3, 4] }, NOW + LOCKED_CONVERSATION_GRACE_MS);
      expect(groups()).toEqual([['anna', 'ben', 'carl']]);
    });

    it('keeps out someone who returns later', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [12, 4] }, NOW + 1_000);
      at({ anna: [2, 2], ben: [4, 2], carl: [3, 4] }, NOW + 1_000 + LOCKED_CONVERSATION_GRACE_MS + 1);
      expect(groups()).toEqual([['anna', 'ben']]);
    });

    it('forgets the grace period once the conversation is unlocked', () => {
      at({ anna: [2, 2], ben: [4, 2], carl: [12, 4] }, NOW + 1_000);
      floor.unlock('c1', 'anna');
      at({ anna: [2, 2], ben: [4, 2], carl: [3, 4] }, NOW + 60_000);
      expect(groups()).toEqual([['anna', 'ben', 'carl']]);
    });
  });
});
