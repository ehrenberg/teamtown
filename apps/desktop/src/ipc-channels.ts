/** IPC channels between the main process and the preload bridge. */
export const IpcChannel = {
  getSession: 'teamtown:auth:get-session',
  signIn: 'teamtown:auth:sign-in',
  signOut: 'teamtown:auth:sign-out',
  sessionChanged: 'teamtown:auth:session-changed',
} as const;
