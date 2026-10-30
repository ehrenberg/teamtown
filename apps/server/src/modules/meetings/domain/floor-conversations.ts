import { err, ok, type Result } from '@teamtown/kernel';
import {
  CONVERSATION_DISSOLVE_DISTANCE,
  CONVERSATION_FORM_DISTANCE,
  hasLineOfSight,
  tileDistance,
  type FloorGrid,
  type Point,
} from '@teamtown/world-core';

export interface Listener {
  readonly personId: string;
  readonly position: Point;
}

export interface Conversation {
  readonly conversationId: string;
  /** Sorted person IDs. */
  readonly participants: readonly string[];
  readonly locked: boolean;
}

export type ConversationEvent =
  | { readonly type: 'ConversationFormed'; readonly floorId: string; readonly conversation: Conversation }
  | {
      readonly type: 'ConversationChanged';
      readonly floorId: string;
      readonly conversation: Conversation;
      readonly joined: readonly string[];
      readonly left: readonly string[];
    }
  | {
      readonly type: 'ConversationDissolved';
      readonly floorId: string;
      readonly conversationId: string;
      readonly left: readonly string[];
    };

export type LockError = 'conversation-not-found' | 'not-in-conversation';

export const LOCKED_CONVERSATION_GRACE_MS = 30_000;

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Two people are connected when they are close enough and no wall lies between them, with hysteresis (form at
 * ≤ 4 tiles, break beyond 6). A conversation is a connected group of at least two people. A locked conversation
 * takes in nobody new, except participants who return within the grace period.
 */
export class FloorConversations {
  /** Physical connections of the last update, needed for the hysteresis. */
  #connections = new Set<string>();
  #conversations = new Map<string, Conversation>();
  readonly #graces = new Map<string, { readonly conversationId: string; readonly until: number }>();
  #events: ConversationEvent[] = [];

  constructor(
    readonly floorId: string,
    private readonly grid: FloorGrid,
    private readonly newId: () => string,
  ) {}

  update(listeners: readonly Listener[], now: number): void {
    const people = [...listeners].sort((a, b) => a.personId.localeCompare(b.personId));
    this.#connections = this.#physicalConnections(people);
    const groups = this.#groups(people, this.#respectLocks(people, this.#connections, now));
    this.#apply(groups, now);
  }

  lock(conversationId: string, personId: string): Result<void, LockError> {
    return this.#setLocked(conversationId, personId, true);
  }

  unlock(conversationId: string, personId: string): Result<void, LockError> {
    return this.#setLocked(conversationId, personId, false);
  }

  conversationOf(personId: string): Conversation | null {
    return [...this.#conversations.values()].find((c) => c.participants.includes(personId)) ?? null;
  }

  get(conversationId: string): Conversation | null {
    return this.#conversations.get(conversationId) ?? null;
  }

  all(): Conversation[] {
    return [...this.#conversations.values()].sort((a, b) => a.conversationId.localeCompare(b.conversationId));
  }

  pullEvents(): readonly ConversationEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #physicalConnections(people: readonly Listener[]): Set<string> {
    const connections = new Set<string>();
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i];
        const b = people[j];
        if (!a || !b) continue;
        const key = pairKey(a.personId, b.personId);
        const reach = this.#connections.has(key) ? CONVERSATION_DISSOLVE_DISTANCE : CONVERSATION_FORM_DISTANCE;
        if (tileDistance(a.position, b.position) <= reach && hasLineOfSight(this.grid, a.position, b.position)) {
          connections.add(key);
        }
      }
    }
    return connections;
  }

  /**
   * A locked conversation admits only its participants and those returning within the grace period (if they are
   * connected to a participant). Every connection between that circle and anyone else is cut, so nobody can
   * listen in or bridge the conversation with others.
   */
  #respectLocks(people: readonly Listener[], connections: ReadonlySet<string>, now: number): Set<string> {
    const present = new Set(people.map((p) => p.personId));
    const kept = new Set(connections);
    for (const conversation of this.all().filter((c) => c.locked)) {
      const members = conversation.participants.filter((id) => present.has(id));
      const returning = [...this.#graces.entries()]
        .filter(([, grace]) => grace.conversationId === conversation.conversationId && grace.until >= now)
        .map(([id]) => id)
        .filter((id) => present.has(id) && members.some((m) => kept.has(pairKey(id, m))));
      const circle = new Set([...members, ...returning]);
      for (const key of [...kept]) {
        const [a = '', b = ''] = key.split('|');
        if (circle.has(a) !== circle.has(b)) kept.delete(key);
      }
    }
    return kept;
  }

  #groups(people: readonly Listener[], connections: ReadonlySet<string>): string[][] {
    const seen = new Set<string>();
    const groups: string[][] = [];
    for (const { personId } of people) {
      if (seen.has(personId)) continue;
      const group: string[] = [];
      const queue = [personId];
      seen.add(personId);
      while (queue.length > 0) {
        const current = queue.shift() ?? '';
        group.push(current);
        for (const other of people) {
          if (!seen.has(other.personId) && connections.has(pairKey(current, other.personId))) {
            seen.add(other.personId);
            queue.push(other.personId);
          }
        }
      }
      if (group.length >= 2) groups.push(group.sort());
    }
    return groups;
  }

  /**
   * Gives each group a conversation identity and records the changes. Larger previous conversations choose first,
   * so on a merge the larger one keeps its identity, and on a split the part with the most of its people does.
   */
  #apply(groups: readonly string[][], now: number): void {
    const previous = [...this.#conversations.values()].sort(
      (a, b) => b.participants.length - a.participants.length || a.conversationId.localeCompare(b.conversationId),
    );
    const assigned = new Map<number, Conversation>();
    for (const conversation of previous) {
      let best = -1;
      let bestOverlap = 0;
      groups.forEach((group, index) => {
        if (assigned.has(index)) return;
        const overlap = group.filter((id) => conversation.participants.includes(id)).length;
        const better =
          overlap > bestOverlap ||
          (overlap === bestOverlap && overlap > 0 && group.length > (groups[best]?.length ?? 0));
        if (better) {
          best = index;
          bestOverlap = overlap;
        }
      });
      if (best >= 0) assigned.set(best, conversation);
    }

    const next = new Map<string, Conversation>();
    groups.forEach((participants, index) => {
      const before = assigned.get(index);
      const conversation: Conversation = {
        conversationId: before?.conversationId ?? this.newId(),
        participants,
        locked: before?.locked ?? false,
      };
      next.set(conversation.conversationId, conversation);
      if (!before) {
        this.#events.push({ type: 'ConversationFormed', floorId: this.floorId, conversation });
        return;
      }
      const joined = participants.filter((id) => !before.participants.includes(id));
      const left = before.participants.filter((id) => !participants.includes(id));
      if (joined.length > 0 || left.length > 0) {
        this.#events.push({ type: 'ConversationChanged', floorId: this.floorId, conversation, joined, left });
      }
      if (conversation.locked) this.#rememberLeavers(conversation.conversationId, left, now);
      for (const id of joined) this.#graces.delete(id);
    });

    for (const conversation of previous) {
      if (!next.has(conversation.conversationId)) {
        this.#events.push({
          type: 'ConversationDissolved',
          floorId: this.floorId,
          conversationId: conversation.conversationId,
          left: conversation.participants,
        });
        this.#forgetGraces(conversation.conversationId);
      }
    }
    this.#conversations = next;
  }

  #rememberLeavers(conversationId: string, leavers: readonly string[], now: number): void {
    for (const id of leavers) this.#graces.set(id, { conversationId, until: now + LOCKED_CONVERSATION_GRACE_MS });
  }

  #forgetGraces(conversationId: string): void {
    for (const [id, grace] of [...this.#graces.entries()]) {
      if (grace.conversationId === conversationId) this.#graces.delete(id);
    }
  }

  #setLocked(conversationId: string, personId: string, locked: boolean): Result<void, LockError> {
    const conversation = this.#conversations.get(conversationId);
    if (!conversation) return err('conversation-not-found');
    if (!conversation.participants.includes(personId)) return err('not-in-conversation');
    if (conversation.locked === locked) return ok(undefined);

    const updated = { ...conversation, locked };
    this.#conversations.set(conversationId, updated);
    if (!locked) this.#forgetGraces(conversationId);
    this.#events.push({
      type: 'ConversationChanged',
      floorId: this.floorId,
      conversation: updated,
      joined: [],
      left: [],
    });
    return ok(undefined);
  }
}
