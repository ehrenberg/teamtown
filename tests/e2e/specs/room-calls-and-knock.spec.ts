import { expect, test, type Page } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { peopleList, signIn } from './support/session.ts';

const AUDIO_TIMEOUT_MS = 30_000;
const WALK_TIMEOUT_MS = 20_000;
const roomsList = (page: Page) => page.getByRole('region', { name: 'Rooms on this floor' });
const roomRow = (page: Page, room: string) => roomsList(page).getByRole('listitem').filter({ hasText: room });
const speaking = (page: Page, name: string) =>
  peopleList(page).getByRole('listitem').filter({ hasText: name }).filter({ hasText: 'speaking' });

test('people knock on a meeting room, get let in and talk in its room call', async () => {
  // Two software-rendered browsers walking across the floor and joining LiveKit take a while.
  test.setTimeout(240_000);
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const anna = (await signIn(browsers[0], 'demo', 'demo')).page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  // Elbe asks people to knock, but nobody is inside yet: Anna walks right in.
  await roomsList(anna).getByRole('button', { name: 'Go to Elbe' }).click();
  await expect(roomRow(anna, 'Elbe')).toContainText('(you)', { timeout: WALK_TIMEOUT_MS });
  await expect(anna.getByRole('group', { name: 'Door of Elbe' })).toBeVisible();

  // Ben may not walk in; the notice offers to knock.
  await roomsList(ben).getByRole('button', { name: 'Go to Elbe' }).click();
  const notice = ben.getByRole('status').filter({ hasText: 'Elbe asks you to knock first.' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Knock' }).click();
  await expect(roomsList(ben)).toContainText('You knocked on Elbe. Waiting for an answer…');

  await anna.getByRole('button', { name: 'Let Second Demo in', exact: true }).click();
  await expect(roomsList(ben)).toContainText('You may come in. Walking in…');
  await expect(roomRow(ben, 'Elbe')).toContainText('(you)', { timeout: WALK_TIMEOUT_MS });

  // Both are in Elbe's room call and hear each other.
  await expect(speaking(anna, 'Second Demo')).toBeVisible({ timeout: AUDIO_TIMEOUT_MS });
  await expect(speaking(ben, 'Demo User')).toBeVisible({ timeout: AUDIO_TIMEOUT_MS });

  // Anna closes the door; Ben sees it from inside.
  await anna.getByRole('group', { name: 'Door of Elbe' }).getByRole('button', { name: 'Closed' }).click();
  await expect(
    ben.getByRole('group', { name: 'Door of Elbe' }).getByRole('button', { name: 'Closed' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await anna.screenshot({ path: 'test-results/room-call.png' });

  for (const browser of browsers) await browser.close();
});
