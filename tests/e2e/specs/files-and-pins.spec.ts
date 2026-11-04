import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/session.ts';

/** Feature spec: docs/features/messaging-files.md (M3d). */

const directMessages = (page: Page) => page.getByRole('region', { name: 'Direct messages' });
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat' });
const log = (page: Page) => chat(page).getByRole('log');
const composer = (page: Page) => chat(page).getByRole('combobox', { name: /^Message to/ });
const attach = (page: Page, name: string, mimeType: string, content: string | Buffer) =>
  chat(page)
    .getByTestId('attach-input')
    .last()
    .setInputFiles({ name, mimeType, buffer: Buffer.from(content) });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]/Contents 4 0 R>>endobj',
  // A red square in the lower left corner of a white page.
  '4 0 obj<</Length 30>>stream\n1 0 0 rg 0 0 100 100 re f\nendstream endobj',
  'trailer<</Root 1 0 R>>',
].join('\n');
/** The standard harmless antivirus test string, split so that scanners don't flag this file. */
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

/** What the thumbnail shows in the upper right corner of the page and inside the red square. */
function pagePixels(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  const pixel = (x: number, y: number) => [...(context?.getImageData(x, y, 1, 1).data ?? [])].slice(0, 3);
  return { paper: pixel(canvas.width - 2, 2), square: pixel(4, canvas.height - 4) };
}

async function openDirectMessage(anna: Page, ben: Page): Promise<void> {
  await directMessages(ben).getByRole('button', { name: 'New message' }).click();
  const picker = ben.getByRole('dialog', { name: 'New message' });
  await picker.getByRole('searchbox').fill('Demo User');
  await picker.getByText('Demo User', { exact: true }).click();
  await picker.getByRole('button', { name: 'Open conversation' }).click();
  await expect(composer(ben)).toBeVisible();
  const greeting = `Files, please ${String(Date.now())}`;
  await composer(ben).fill(greeting);
  await composer(ben).press('Enter');
  await directMessages(anna)
    .getByRole('button', { name: /^Second Demo/ })
    .click();
  await expect(log(anna)).toContainText(greeting);
}

test('people share files, also without text, and pin messages, live', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  await openDirectMessage(anna, ben);

  // A file needs no text (P-27); it uploads first, then Enter sends it.
  const image = `photo-${String(Date.now())}.png`;
  await attach(anna, image, 'image/png', PNG);
  const draft = chat(anna).getByRole('list', { name: 'Attached files' });
  await expect(draft.getByRole('button', { name: `Remove ${image}` })).toBeVisible();
  await expect(draft.getByRole('progressbar')).toBeHidden();
  await composer(anna).press('Enter');
  await expect(draft).toBeHidden();

  // Ben sees the image inline, without reloading (alt text from the file name).
  await expect(log(ben).getByRole('img', { name: image })).toBeVisible();
  await expect(log(ben).getByRole('button', { name: new RegExp(`^Download ${image} \\(PNG, `) })).toBeVisible();
  const download = ben.waitForEvent('download');
  await log(ben)
    .getByRole('button', { name: new RegExp(`^Download ${image}`) })
    .click();
  expect((await download).suggestedFilename()).toBe(image);

  // A PDF shows its first page; other files show a chip only.
  const stamp = String(Date.now());
  const pdf = `plan-${stamp}.pdf`;
  const csv = `notes-${stamp}.csv`;
  const caption = `The plan ${stamp}`;
  await attach(anna, pdf, 'application/pdf', PDF);
  await attach(anna, csv, 'text/csv', 'a,b\n1,2\n');
  await expect(chat(anna).getByRole('button', { name: `Remove ${csv}` })).toBeVisible();
  await expect(chat(anna).getByRole('progressbar')).toHaveCount(0);
  await composer(anna).fill(caption);
  await composer(anna).press('Enter');
  const message = log(ben).getByRole('article').filter({ hasText: caption });
  const thumbnail = message.getByRole('button', { name: `Open ${pdf}` }).locator('canvas');
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate(pagePixels)).toEqual({ paper: [255, 255, 255], square: [255, 0, 0] });
  await expect(message.getByRole('button', { name: new RegExp(`^Download ${csv}`) })).toBeVisible();
  await ben.screenshot({ path: 'test-results/chat-attachments.png' });

  // Pinning is live, and the pinned view leads back to the message (P-24, P-26).
  await message.hover();
  await message.getByRole('button', { name: 'Pin message' }).click();
  const annaHeader = chat(anna).getByRole('button', { name: 'Pinned, 1 message' });
  await expect(annaHeader).toBeVisible();
  await annaHeader.click();
  const pinned = chat(anna).getByRole('list', { name: 'Pinned' });
  await expect(pinned).toContainText(caption);
  await anna.screenshot({ path: 'test-results/chat-pinned.png' });
  await pinned.getByRole('button', { name: new RegExp(caption) }).click();
  await expect(log(anna).getByRole('article').filter({ hasText: caption })).toBeFocused();

  // Deleting a message removes its pin and its files for everyone (P-21).
  const own = log(anna).getByRole('article').filter({ hasText: caption });
  await own.hover();
  await own.getByRole('button', { name: 'Delete' }).click();
  await expect(chat(ben).getByRole('button', { name: 'Pinned, 0 messages' })).toBeVisible();
  await expect(log(ben).getByRole('button', { name: new RegExp(`^Download ${csv}`) })).toBeHidden();

  await ben.context().close();
  await anna.context().close();
});

test('files that may not be shared are refused in plain words', async ({ browser }) => {
  const anna = (await signIn(browser, 'demo', 'demo')).page;
  const ben = (await signIn(browser, 'demo2', 'demo2')).page;
  await openDirectMessage(anna, ben);
  const alert = chat(anna).getByRole('alert');

  // By the composer, before anything is uploaded.
  await attach(anna, 'setup.exe', 'application/x-msdownload', 'MZ');
  await expect(alert).toHaveText("setup.exe: This file type can't be shared here.");
  await expect(chat(anna).getByRole('list', { name: 'Attached files' })).toBeHidden();

  // By the server, which reads the bytes instead of trusting the name (P-20).
  await attach(anna, 'fake.png', 'image/png', 'MZ this is not an image');
  await expect(alert).toHaveText("fake.png: This file type can't be shared here.");

  // By the malware scan (ADR-0035).
  await attach(anna, 'eicar.txt', 'text/plain', EICAR);
  await expect(alert).toContainText('flagged as malware');

  await ben.context().close();
  await anna.context().close();
});
