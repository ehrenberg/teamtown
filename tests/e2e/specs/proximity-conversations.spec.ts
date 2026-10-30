import { expect, test, type Page } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { peopleList, signIn, walk } from './support/session.ts';

const AUDIO_TIMEOUT_MS = 30_000;
const yourConversation = (page: Page) => peopleList(page).getByRole('group', { name: /Conversation/ });
const privateConversation = (page: Page) => peopleList(page).getByRole('group', { name: 'Private conversation' });
/** The people list marks speakers with a visually hidden "(speaking)". */
const speaking = (page: Page, name: string) =>
  peopleList(page).getByRole('listitem').filter({ hasText: name }).filter({ hasText: 'speaking' });

test('people next to each other talk, can make it private, and find each other again', async () => {
  // Two software-rendered browsers joining LiveKit take a while.
  test.setTimeout(240_000);
  // Neighbouring spawn points: both start in one conversation.
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const annaSession = await signIn(browsers[0], 'demo', 'demo');
  const anna = annaSession.page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  await expect(yourConversation(anna)).toContainText('Second Demo');
  await expect(yourConversation(ben)).toContainText('Demo User');

  // Generous timeout: with two browsers rendering in software, the local LiveKit container can answer slowly.
  await expect(speaking(anna, 'Second Demo')).toBeVisible({ timeout: AUDIO_TIMEOUT_MS });
  await expect(speaking(ben, 'Demo User')).toBeVisible({ timeout: AUDIO_TIMEOUT_MS });
  await anna.screenshot({ path: 'test-results/conversation.png' });

  await anna.getByRole('button', { name: 'Make private' }).click();
  await expect(privateConversation(ben)).toBeVisible();
  await anna.getByRole('button', { name: 'Open up' }).click();
  await expect(privateConversation(ben)).toBeHidden();

  // Around the desks to tile (4,7), more than 6 tiles from Ben at (11,9).
  await walk(annaSession, ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowUp']);
  await expect(yourConversation(ben)).toBeHidden({ timeout: 10_000 });

  await peopleList(ben).getByRole('button', { name: 'Talk to Demo User' }).click();
  await expect(yourConversation(ben)).toContainText('Demo User', { timeout: 15_000 });
  await expect(yourConversation(anna)).toContainText('Second Demo');

  for (const browser of browsers) await browser.close();
});
