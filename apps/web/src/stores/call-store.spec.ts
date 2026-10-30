import { beforeEach, describe, expect, it } from 'vitest';
import { roleIn, useCallStore } from './call-store.ts';

const store = () => useCallStore.getState();
const call = {
  callId: 'call-1',
  participants: ['anna'],
  invitations: [{ personId: 'ben', invitedBy: 'anna', ringsUntil: 1 }],
};

describe('call store', () => {
  beforeEach(() => {
    useCallStore.setState({ call: null, lastNotice: null });
    store().applySnapshot('ground', ['carl']);
  });

  it('follows the own call until it ends', () => {
    store().applyEvent({ t: 'DirectCallChanged', p: { call } });
    expect(roleIn(store().call, 'anna')).toBe('participant');
    expect(roleIn(store().call, 'ben')).toBe('ringing');

    store().applyEvent({ t: 'CallInvitationAnswered', p: { callId: 'call-1', personId: 'ben', outcome: 'busy' } });
    expect(store().lastNotice).toEqual({ personId: 'ben', outcome: 'busy' });

    store().applyEvent({ t: 'DirectCallEnded', p: { callId: 'call-1' } });
    expect(store().call).toBeNull();
  });

  it('knows who on this floor is in a call', () => {
    store().applyEvent({ t: 'OnCallChanged', p: { floorId: 'ground', personId: 'dora', onCall: true } });
    store().applyEvent({ t: 'OnCallChanged', p: { floorId: 'ground', personId: 'carl', onCall: false } });
    store().applyEvent({ t: 'OnCallChanged', p: { floorId: 'upper', personId: 'eve', onCall: true } });

    expect(store().onCall).toEqual(['dora']);
  });
});
