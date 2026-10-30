/**
 * Build-time configuration (Vite env). Defaults match the local development stack (docker/README.md).
 */
export const appConfig = {
  oidcIssuer: import.meta.env.VITE_OIDC_ISSUER ?? 'http://localhost:8080/realms/teamtown',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'teamtown-web',
} as const;
