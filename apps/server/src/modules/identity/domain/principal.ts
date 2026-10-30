/** An authenticated caller as asserted by the identity provider (OIDC). TeamTown stores no passwords. */
export interface Principal {
  /** The OIDC `sub` claim: stable and unique per identity provider. */
  readonly subject: string;
  readonly displayName: string;
  readonly email: string | null;
  /** Token expiry (ms since the epoch); long-lived connections must re-authenticate before it. */
  readonly expiresAt: number;
}
