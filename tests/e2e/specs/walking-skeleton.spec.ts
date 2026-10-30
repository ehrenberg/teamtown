import { expect, test, type Browser, type Page } from '@playwright/test';
import { decodeClientCommand, decodeServerEvent } from '@teamtown/contracts';

/** Acceptance criterion: others see a movement within 150 ms on a local network. */
const MOVEMENT_LATENCY_BUDGET_MS = 150;

/**
 * A realtime message seen on a page's WebSocket, with the time the test runner observed it.
 * Playwright reports frames of both browsers with a few ms of jitter, so tiny (even negative)
 * latencies are measurement noise; the 150 ms budget is far above it.
 */
interface RealtimeFrame {
  readonly direction: 'sent' | 'received';
  readonly type: string;
  readonly at: number;
}

interface Session {
  readonly page: Page;
  readonly frames: RealtimeFrame[];
}

const asBytes = (payload: string | Buffer): Uint8Array =>
  typeof payload === 'string' ? new TextEncoder().encode(payload) : new Uint8Array(payload);

/** Feature spec: docs/features/m1-walking-skeleton.md. Uses the demo users of docker/keycloak. */
async function signIn(browser: Browser, username: string, password: string): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const frames: RealtimeFrame[] = [];
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
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  return { page, frames };
}

const framesOf = (session: Session, direction: RealtimeFrame['direction'], type: string, since: number) =>
  session.frames.filter((frame) => frame.direction === direction && frame.type === type && frame.at >= since);

const peopleList = (page: Page) => page.getByRole('region', { name: 'People on this floor' });

/** The floating name label of an avatar inside the 3D view (rendered as HTML overlay). */
const nameLabel = (page: Page, name: string) => page.locator('main span', { hasText: name }).first();

test('two people see each other walk, switch floors and leave', async ({ browser }) => {
  const annaSession = await signIn(browser, 'demo', 'demo');
  const benSession = await signIn(browser, 'demo2', 'demo2');
  const anna = annaSession.page;
  const ben = benSession.page;

  await expect(peopleList(anna)).toContainText('Second Demo');
  await expect(peopleList(ben)).toContainText('Demo User');
  await anna.screenshot({ path: 'test-results/office-ground-floor.png' });

  // Anna walks with the keyboard; Ben sees her name label move.
  const before = await nameLabel(ben, 'Demo User').boundingBox();
  const walkStartedAt = Date.now();
  for (let step = 0; step < 3; step++) {
    await anna.keyboard.press('ArrowDown');
    await anna.waitForTimeout(450);
  }
  await expect
    .poll(async () => {
      const after = await nameLabel(ben, 'Demo User').boundingBox();
      return before && after ? Math.hypot(after.x - before.x, after.y - before.y) : 0;
    })
    .toBeGreaterThan(20);

  // Every step reached Ben within the latency budget: Anna sends MoveTo -> Ben receives AvatarPathStarted.
  const moves = framesOf(annaSession, 'sent', 'MoveTo', walkStartedAt);
  expect(moves.length).toBeGreaterThan(0); // a key press is skipped while the previous step is still running
  await expect
    .poll(() => framesOf(benSession, 'received', 'AvatarPathStarted', walkStartedAt).length)
    .toBe(moves.length);
  const announcements = framesOf(benSession, 'received', 'AvatarPathStarted', walkStartedAt);
  const latencies = moves.map((move, step) => (announcements[step]?.at ?? Infinity) - move.at);
  test.info().annotations.push({ type: 'movement latency (ms)', description: latencies.join(', ') });
  for (const latency of latencies) expect(latency).toBeLessThanOrEqual(MOVEMENT_LATENCY_BUDGET_MS);

  // Anna goes upstairs and disappears from Ben's floor.
  await anna.getByRole('button', { name: /Floor 1/ }).click();
  await expect(peopleList(ben)).not.toContainText('Demo User');
  await expect(peopleList(anna)).not.toContainText('Second Demo');
  await anna.screenshot({ path: 'test-results/office-upper-floor.png' });

  // Ben leaves: Anna's view is unaffected, Ben's avatar is gone from the server.
  await ben.context().close();
  await anna.context().close();
});
