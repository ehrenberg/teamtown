import { expect, test, type Locator } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { peopleList, signIn, walk } from './support/session.ts';

const VIDEO_TIMEOUT_MS = 30_000;
/** Whether a video element really shows frames. */
const isPlaying = (video: Locator) =>
  video.evaluate((element) => element instanceof HTMLVideoElement && element.videoWidth > 0);

test('cameras show only to the own conversation or call and go off when leaving it', async () => {
  // Two software-rendered browsers joining LiveKit take a while.
  test.setTimeout(240_000);
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const annaSession = await signIn(browsers[0], 'demo', 'demo');
  const anna = annaSession.page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  // Neighbouring spawn points: both start in one conversation. Anna switches her camera on.
  await anna.getByRole('button', { name: 'Camera off' }).click();
  await expect(anna.getByRole('button', { name: 'Camera on' })).toHaveAttribute('aria-pressed', 'true');

  const bubble = ben.locator('video[aria-label="Video of Demo User"]');
  await expect.poll(() => isPlaying(bubble), { timeout: VIDEO_TIMEOUT_MS }).toBe(true);
  await expect(
    peopleList(ben).getByRole('listitem').filter({ hasText: 'Demo User' }).getByRole('img', { name: 'Camera on' }),
  ).toBeVisible();
  await ben.screenshot({ path: 'test-results/video-bubble.png' });

  // Anna walks away: the conversation ends and her camera goes off.
  await walk(annaSession, ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowUp']);
  await expect(anna.getByRole('button', { name: /^Camera (on|off)$/ })).toBeHidden({ timeout: 15_000 });
  await expect(bubble).toBeHidden();

  // In a direct call, cameras show in the grid.
  await peopleList(anna).getByRole('button', { name: 'Call Second Demo' }).click();
  await ben.getByRole('dialog', { name: 'Incoming call' }).getByRole('button', { name: 'Accept' }).click();
  await expect(anna.getByRole('button', { name: 'Camera off' })).toBeVisible({ timeout: 15_000 });
  await anna.getByRole('button', { name: 'Camera off' }).click();

  const grid = ben.getByRole('region', { name: 'Video' });
  await expect.poll(() => isPlaying(grid.getByLabel('Video of Demo User')), { timeout: VIDEO_TIMEOUT_MS }).toBe(true);
  await grid.getByRole('button', { name: 'Hide video' }).click();
  await expect(grid.getByRole('button', { name: 'Show video' })).toHaveAttribute('aria-expanded', 'false');
  await ben.screenshot({ path: 'test-results/video-grid.png' });

  for (const browser of browsers) await browser.close();
});
