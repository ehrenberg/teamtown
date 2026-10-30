import { app, BrowserWindow, ipcMain, safeStorage, shell, type IpcMainInvokeEvent } from 'electron';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DesktopAuthSession, type DesktopSession } from './auth/desktop-auth-session.ts';
import { NativeOidcClient } from './auth/native-oidc-client.ts';
import { EncryptedFileSecretStore } from './auth/secret-store.ts';
import { AUTH_CALLBACK_URL, findDeepLink, PROTOCOL } from './deep-link.ts';
import { IpcChannel } from './ipc-channels.ts';
import { decideNavigation } from './navigation-policy.ts';

const WEB_URL = process.env.TEAMTOWN_WEB_URL ?? 'http://localhost:5173';
const APP_ORIGIN = new URL(WEB_URL).origin;
const OIDC_ISSUER = process.env.TEAMTOWN_OIDC_ISSUER ?? 'http://localhost:8080/realms/teamtown';
const OIDC_CLIENT_ID = process.env.TEAMTOWN_OIDC_CLIENT_ID ?? 'teamtown-desktop';
const RETRY_DELAY_MS = 1000;
const SMOKE_TEST_SETTLE_MS = 3000;

/** `--smoke-test=<file>`: load the app, save a screenshot and quit (used to verify the shell in CI). */
const smokeTestOutput = process.argv.find((arg) => arg.startsWith('--smoke-test='))?.split('=')[1];

let mainWindow: BrowserWindow | null = null;

const auth = new DesktopAuthSession({
  oidc: new NativeOidcClient({
    issuer: OIDC_ISSUER,
    clientId: OIDC_CLIENT_ID,
    redirectUri: AUTH_CALLBACK_URL,
    scope: 'openid profile email',
  }),
  store: new EncryptedFileSecretStore(path.join(app.getPath('userData'), 'session.bin'), safeStorage, {
    read: (file) => readFile(file).catch(() => null),
    write: (file, data) => writeFile(file, data, { mode: 0o600 }),
    remove: (file) => rm(file, { force: true }),
  }),
  openExternal: (url) => shell.openExternal(url),
  onSessionChanged: (session: DesktopSession | null) => {
    mainWindow?.webContents.send(IpcChannel.sessionChanged, session);
  },
  now: Date.now,
  timers: {
    set: (callback, delayMs) => setTimeout(callback, delayMs),
    clear: (handle) => {
      clearTimeout(handle as NodeJS.Timeout);
    },
  },
});

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

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  void window.loadURL(WEB_URL);
  return window;
}

async function captureAndQuit(window: BrowserWindow, output: string): Promise<void> {
  const image = await window.webContents.capturePage();
  await writeFile(output, image.toPNG());
  console.warn(`Smoke test screenshot written to ${output}`);
  app.quit();
}

function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

async function openDeepLink(link: string): Promise<void> {
  focusMainWindow();
  try {
    await auth.handleCallback(link);
  } catch (error) {
    console.error('Desktop login could not be completed', error);
  }
}

/** Only the TeamTown web client inside the app window may use the auth bridge. */
function fromAppWindow(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  return url !== undefined && decideNavigation(url, APP_ORIGIN) === 'allow';
}

function registerAuthHandlers(): void {
  ipcMain.handle(IpcChannel.getSession, (event) => (fromAppWindow(event) ? auth.getSession() : null));
  ipcMain.handle(IpcChannel.signIn, (event) => (fromAppWindow(event) ? auth.signIn() : undefined));
  ipcMain.handle(IpcChannel.signOut, (event) => (fromAppWindow(event) ? auth.signOut() : undefined));
}

function registerProtocol(): void {
  // During development Electron runs as `electron .`; the OS must start it with the app path.
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

// One instance only: deep links on Windows and Linux start a second instance that hands over its argv.
if (!smokeTestOutput && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const link = findDeepLink(argv);
    if (link) void openDeepLink(link);
    else focusMainWindow();
  });

  // macOS delivers deep links as an event.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    void openDeepLink(url);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  void app.whenReady().then(() => {
    if (!smokeTestOutput) registerProtocol();
    registerAuthHandlers();
    void auth.restore();
    mainWindow = createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
    });
  });
}
