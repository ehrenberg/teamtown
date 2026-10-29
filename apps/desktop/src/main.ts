import { app, BrowserWindow, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decideNavigation } from './navigation-policy.ts';

const WEB_URL = process.env.TEAMTOWN_WEB_URL ?? 'http://localhost:5173';
const APP_ORIGIN = new URL(WEB_URL).origin;
const RETRY_DELAY_MS = 1000;
const SMOKE_TEST_SETTLE_MS = 3000;

/** `--smoke-test=<file>`: load the app, save a screenshot and quit (used to verify the shell in CI). */
const smokeTestOutput = process.argv.find((arg) => arg.startsWith('--smoke-test='))?.split('=')[1];

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'TeamTown',
    backgroundColor: '#FBF6EE',
    show: !smokeTestOutput,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--teamtown-version=${app.getVersion()}`],
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (decideNavigation(url, APP_ORIGIN) === 'open-externally') {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const decision = decideNavigation(url, APP_ORIGIN);
    if (decision === 'allow') return;
    event.preventDefault();
    if (decision === 'open-externally') void shell.openExternal(url);
  });

  // In development the web dev server may still be starting; retry until it answers.
  window.webContents.on('did-fail-load', () => {
    setTimeout(() => void window.loadURL(WEB_URL), RETRY_DELAY_MS);
  });

  if (smokeTestOutput) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => void captureAndQuit(window, smokeTestOutput), SMOKE_TEST_SETTLE_MS);
    });
  }

  void window.loadURL(WEB_URL);
  return window;
}

async function captureAndQuit(window: BrowserWindow, output: string): Promise<void> {
  const image = await window.webContents.capturePage();
  await writeFile(output, image.toPNG());
  console.warn(`Smoke test screenshot written to ${output}`);
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

void app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
