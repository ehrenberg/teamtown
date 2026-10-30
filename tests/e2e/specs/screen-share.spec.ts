import { expect, test, type Locator, type Page } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { signIn } from './support/session.ts';

const VIDEO_TIMEOUT_MS = 30_000;
const WALK_TIMEOUT_MS = 20_000;
const isPlaying = (video: Locator) =>
  video.evaluate((element) => element instanceof HTMLVideoElement && element.videoWidth > 0);
const goTo = async (page: Page, room: string) => {
  const rooms = page.getByRole('region', { name: 'Rooms on this floor' });
  await rooms.getByRole('button', { name: `Go to ${room}` }).click();
  await expect(rooms.getByRole('listitem').filter({ hasText: room })).toContainText('(you)', {
    timeout: WALK_TIMEOUT_MS,
  });
};

test('people in a room call share their screen, one at a time', async () => {
  // Two software-rendered browsers joining LiveKit take a while.
  test.setTimeout(240_000);
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const anna = (await signIn(browsers[0], 'demo', 'demo')).page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  // Alster is open and audio-isolated: both walk in and are in its room call.
  await goTo(anna, 'Alster');
  await goTo(ben, 'Alster');
  await expect(anna.getByRole('button', { name: 'Make private' })).toBeHidden();

  await anna.getByRole('button', { name: 'Share screen' }).click();
  await expect(anna.getByRole('button', { name: 'Stop sharing' })).toHaveAttribute('aria-pressed', 'true');
  const share = ben.getByRole('region', { name: 'Video' }).getByLabel('Screen of Demo User').first();
  await expect.poll(() => isPlaying(share), { timeout: VIDEO_TIMEOUT_MS }).toBe(true);
  await ben.screenshot({ path: 'test-results/screen-share.png' });
  // The wall screen in Alster shows it too, for the people in the call.
  await ben.getByRole('button', { name: 'Hide video' }).click();
  await ben.screenshot({ path: 'test-results/screen-share-wall.png' });
  await ben.getByRole('button', { name: 'Show video' }).click();

  // Ben takes over: Anna's share stops and she is told.
  await ben.getByRole('button', { name: 'Share screen' }).click();
  await expect(anna.getByRole('status').filter({ hasText: 'Second Demo is sharing now' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(anna.getByRole('button', { name: 'Share screen' })).toHaveAttribute('aria-pressed', 'false');
  const bensShare = anna.getByRole('region', { name: 'Video' }).getByLabel('Screen of Second Demo').first();
  await expect.poll(() => isPlaying(bensShare), { timeout: VIDEO_TIMEOUT_MS }).toBe(true);

  for (const browser of browsers) await browser.close();
});
