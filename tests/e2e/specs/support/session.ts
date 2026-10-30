import { expect, type Browser, type Page } from '@playwright/test';
import { decodeClientCommand, decodeServerEvent } from '@teamtown/contracts';

/**
 * A realtime message seen on a page's WebSocket, with the time the test runner observed it.
 * Playwright reports frames of both browsers with a few ms of jitter, so tiny (even negative)
 * latencies are measurement noise.
 */
export interface RealtimeFrame {
  readonly direction: 'sent' | 'received';
  readonly type: string;
  readonly at: number;
}

export interface Session {
  readonly page: Page;
  readonly frames: RealtimeFrame[];
}

const asBytes = (payload: string | Buffer): Uint8Array =>
  typeof payload === 'string' ? new TextEncoder().encode(payload) : new Uint8Array(payload);

export async function signIn(browser: Browser, username: string, password: string): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const frames: RealtimeFrame[] = [];
  // E2E_BROWSER_LOGS=1 forwards warnings and errors of the page (e.g. from LiveKit) for debugging.
  if (process.env.E2E_BROWSER_LOGS) {
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type()))
        console.warn(`${new Date().toISOString().slice(11, 23)} [${username}] ${message.type()}: ${message.text()}`);
    });
  }
  page.on('websocket', (socket) => {
    socket.on('framesent', ({ payload }) => {
      const command = decodeClientCommand(asBytes(payload));
      if (command.ok) frames.push({ direction: 'sent', type: command.value.t, at: Date.now() });
    });
    socket.on('framereceived', ({ payload }) => {
      const event = decodeServerEvent(asBytes(payload));
      if (event.ok) frames.push({ direction: 'received', type: event.value.t, at: Date.now() });
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await page.getByRole('button', { name: 'Allow microphone' }).click();
  await expect(page.getByRole('meter', { name: 'Microphone level' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter the office' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  // The own avatar is on the floor: walking and calling work from here on.
  await expect(page.getByRole('region', { name: 'People on this floor' })).toContainText('(you)');
  return { page, frames };
}

export const framesOf = (session: Session, direction: RealtimeFrame['direction'], type: string, since: number) =>
  session.frames.filter((frame) => frame.direction === direction && frame.type === type && frame.at >= since);

export type WalkKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Walks a sequence of single steps with the keyboard (keys move diagonally on the grid, see keyboard-steps.ts).
 * A key press is ignored while the previous step is still running, and in software-rendered test browsers that
 * takes a variable time, so each step presses until the client really sent a MoveTo.
 */
export async function walk(session: Session, keys: readonly WalkKey[]) {
  for (const key of keys) {
    const sent = framesOf(session, 'sent', 'MoveTo', 0).length;
    await expect
      .poll(
        async () => {
          await session.page.keyboard.press(key);
          await session.page.waitForTimeout(250);
          return framesOf(session, 'sent', 'MoveTo', 0).length;
        },
        { timeout: 15_000, intervals: [0] },
      )
      .toBeGreaterThan(sent);
  }
}

export const peopleList = (page: Page) => page.getByRole('region', { name: 'People on this floor' });

/** The floating name label of an avatar inside the 3D view (rendered as HTML overlay). */
export const nameLabel = (page: Page, name: string) => page.locator('main span', { hasText: name }).first();
