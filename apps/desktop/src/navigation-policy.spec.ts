import { describe, expect, it } from 'vitest';
import { decideNavigation } from './navigation-policy.ts';

const APP_ORIGIN = 'https://demo.teamtown.bastianswelt.de';

describe('decideNavigation', () => {
  it('allows navigation within the TeamTown origin', () => {
    expect(decideNavigation(`${APP_ORIGIN}/rooms/elbe`, APP_ORIGIN)).toBe('allow');
  });

  it('opens other web links in the system browser', () => {
    expect(decideNavigation('https://example.com/docs', APP_ORIGIN)).toBe('open-externally');
  });

  it('blocks look-alike origins and dangerous protocols', () => {
    expect(decideNavigation('https://demo.teamtown.bastianswelt.de.evil.example/', APP_ORIGIN)).toBe('open-externally');
    expect(decideNavigation('file:///C:/Windows/System32/calc.exe', APP_ORIGIN)).toBe('block');
    expect(decideNavigation('javascript:alert(1)', APP_ORIGIN)).toBe('block');
    expect(decideNavigation('not a url', APP_ORIGIN)).toBe('block');
  });
});
