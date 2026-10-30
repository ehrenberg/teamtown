import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { KNOCK_TIMEOUT_MS, Knocks } from './knocks.ts';

const NOW = 1_000_000;

function aKnockBoard(): Knocks {
  let next = 0;
  return new Knocks(() => `k-${++next}`);
}

const lenaAtElbe = { floorId: 'ground', roomId: 'elbe', requester: 'lena' };

describe('Knocks', () => {
  it('opens a knock that expires after a minute', () => {
    expect(aKnockBoard().request(lenaAtElbe, NOW)).toEqual({
      ok: true,
      value: { knockId: 'k-1', ...lenaAtElbe, expiresAt: NOW + KNOCK_TIMEOUT_MS },
    });
  });

  it('allows one open knock per person', () => {
    const knocks = aKnockBoard();
    knocks.request(lenaAtElbe, NOW);

    expect(knocks.request({ ...lenaAtElbe, roomId: 'alster' }, NOW)).toEqual({ ok: false, error: 'knock-pending' });
  });

  it('counts only the first answer', () => {
    const knocks = aKnockBoard();
    const knock = unwrap(knocks.request(lenaAtElbe, NOW));

    expect(knocks.close(knock.knockId).ok).toBe(true);
    expect(knocks.close(knock.knockId)).toEqual({ ok: false, error: 'knock-not-found' });
    expect(knocks.request(lenaAtElbe, NOW).ok).toBe(true);
  });

  it('expires unanswered knocks', () => {
    const knocks = aKnockBoard();
    const knock = unwrap(knocks.request(lenaAtElbe, NOW));

    expect(knocks.expire(NOW + KNOCK_TIMEOUT_MS)).toEqual([]);
    expect(knocks.expire(NOW + KNOCK_TIMEOUT_MS + 1)).toEqual([knock]);
    expect(knocks.all()).toEqual([]);
  });
});
