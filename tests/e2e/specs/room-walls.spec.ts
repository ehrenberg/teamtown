import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/messaging-room-walls.md (M3c). */

const rooms = (page: Page) => page.getByRole('region', { name: 'Rooms on this floor' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const composer = (page: Page) => chat(page).getByRole('combobox', { name: /^Message to/ });

test('room walls work from the non-spatial room list and keep unread messages', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  const text = `Room note ${String(Date.now())}`;

  await rooms(anna).getByRole('button', { name: 'Open the room wall of Elbe' }).click();
  await expect(chat(anna)).toContainText('Elbe');
  await expect(chat(anna)).toContainText('Room wall');
  await composer(anna).fill(text);
  await composer(anna).press('Enter');

  const benWall = rooms(ben).getByRole('button', { name: 'Open the room wall of Elbe' });
  await expect(benWall.locator('..')).toContainText(/unread message/);
  await benWall.click();
  await expect(chat(ben).getByRole('log')).toContainText(text);
  await expect(benWall.locator('..')).not.toContainText(/unread message/);

  await ben.context().close();
  await anna.context().close();
});
