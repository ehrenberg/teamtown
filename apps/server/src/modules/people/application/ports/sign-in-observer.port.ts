/** Told about every sign-in, so that Access can settle the town's first Owner (ADR-0036). */
export interface SignInObserver {
  signedIn(personId: string): Promise<void>;
}

export const SIGN_IN_OBSERVER = Symbol('SIGN_IN_OBSERVER');
