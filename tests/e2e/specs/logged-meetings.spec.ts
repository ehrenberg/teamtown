import { expect, test, type Page } from '@playwright/test';
import { browserWithVoice } from './support/fake-voice.ts';
import { signIn } from './support/session.ts';

const WALK_TIMEOUT_MS = 20_000;
const roomsList = (page: Page) => page.getByRole('region', { name: 'Rooms on this floor' });
const alsterRow = (page: Page) => roomsList(page).getByRole('listitem').filter({ hasText: 'Alster' });
const consentDialog = (page: Page) => page.getByRole('dialog', { name: 'This meeting is logged' });

test('a meeting is logged only with consent and shows up in "My meetings"', async () => {
  // Logs stay in the database for 90 days: a unique title keeps runs apart.
  const title = `Sprint review ${String(Date.now())}`;
  // Two software-rendered browsers joining LiveKit take a while.
  test.setTimeout(240_000);
  const browsers = [await browserWithVoice(220), await browserWithVoice(330)] as const;
  const anna = (await signIn(browsers[0], 'demo', 'demo')).page;
  const ben = (await signIn(browsers[1], 'demo2', 'demo2')).page;

  for (const page of [anna, ben]) {
    await roomsList(page).getByRole('button', { name: 'Go to Alster' }).click();
    await expect(alsterRow(page)).toContainText('(you)', { timeout: WALK_TIMEOUT_MS });
  }

  // Anna logs the meeting; she is its host.
  await anna.getByRole('button', { name: 'Log meeting' }).click();
  const start = anna.getByRole('dialog', { name: 'Log this meeting' });
  await start.getByRole('textbox', { name: 'Title' }).fill(title);
  await start.getByRole('button', { name: 'Start logging' }).click();
  await expect(anna.getByText(`Logged: ${title}`)).toBeVisible();

  // Ben is asked; declining walks him out of the room.
  await expect(consentDialog(ben)).toContainText(`“${title}” is logged.`);
  await consentDialog(ben).getByRole('button', { name: "Don't join" }).click();
  await expect(alsterRow(ben)).not.toContainText('(you)', { timeout: WALK_TIMEOUT_MS });
  await expect(alsterRow(ben)).toContainText('Logged meeting');

  // Walking back in asks again; joining lets him in and into the log.
  await roomsList(ben).getByRole('button', { name: 'Go to Alster' }).click();
  await consentDialog(ben).getByRole('button', { name: 'Join', exact: true }).click();
  await expect(alsterRow(ben)).toContainText('(you)', { timeout: WALK_TIMEOUT_MS });
  await expect(ben.getByText(`Logged: ${title}`)).toBeVisible();

  await anna.getByRole('button', { name: 'End log' }).click();
  await expect(anna.getByText(`Logged: ${title}`)).toBeHidden();

  await ben.getByRole('button', { name: 'My meetings' }).click();
  const benMeetings = ben.getByRole('dialog', { name: 'My meetings' });
  await expect(benMeetings).toContainText(title);
  await expect(benMeetings).toContainText('With Demo User, Second Demo');
  await expect(benMeetings.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  await ben.screenshot({ path: 'test-results/my-meetings.png' });

  await anna.getByRole('button', { name: 'My meetings' }).click();
  const annaMeetings = anna.getByRole('dialog', { name: 'My meetings' });
  await annaMeetings.getByRole('button', { name: `Delete the log of “${title}”` }).click();
  await expect(annaMeetings).not.toContainText(title);

  for (const browser of browsers) await browser.close();
});
