import { expect, test, type Page } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { peopleList, signIn } from './support/session.ts';

const AUDIO_TIMEOUT_MS = 30_000;
const callPanel = (page: Page) => page.getByRole('region', { name: /Your call|Calling/ });

test('people on different floors call each other, hear each other and hang up', async () => {
  // Two software-rendered browsers joining LiveKit take a while.
  test.setTimeout(240_000);
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const anna = (await signIn(browsers[0], 'demo', 'demo')).page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  await ben.getByRole('button', { name: /Floor 1/ }).click();
  await expect(peopleList(anna)).not.toContainText('Second Demo');

  await anna.getByRole('button', { name: 'Call someone' }).click();
  const dialog = anna.getByRole('dialog', { name: 'Call someone' });
  await dialog.getByRole('button', { name: 'Call Second Demo' }).click();
  await expect(callPanel(anna)).toContainText('Calling Second Demo');

  const incoming = ben.getByRole('dialog', { name: 'Incoming call' });
  await expect(incoming).toContainText('Demo User is calling you.');
  await incoming.getByRole('button', { name: 'Accept' }).click();

  await expect(callPanel(anna)).toContainText('Your call');
  await expect(callPanel(ben)).toContainText('Demo User');
  await expect(callPanel(anna).getByRole('listitem').filter({ hasText: 'speaking' })).toBeVisible({
    timeout: AUDIO_TIMEOUT_MS,
  });
  await expect(callPanel(ben).getByRole('listitem').filter({ hasText: 'speaking' })).toBeVisible({
    timeout: AUDIO_TIMEOUT_MS,
  });

  // People around Anna see that she is in a call, but not with whom.
  await expect(
    peopleList(anna).getByRole('listitem').filter({ hasText: 'Demo User' }).getByRole('img', { name: 'In a call' }),
  ).toBeVisible();
  await anna.screenshot({ path: 'test-results/direct-call.png' });

  await callPanel(anna).getByRole('button', { name: 'Hang up' }).click();
  await expect(callPanel(ben)).toBeHidden();
  await expect(callPanel(anna)).toBeHidden();

  for (const browser of browsers) await browser.close();
});
