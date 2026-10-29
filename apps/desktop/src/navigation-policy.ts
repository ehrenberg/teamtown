/**
 * Security policy for the desktop shell (docs/architecture/privacy-and-security.md §3):
 * only the TeamTown origin may be loaded in the app window; http(s) links open in the system browser.
 */
export type NavigationDecision = 'allow' | 'open-externally' | 'block';

export function decideNavigation(targetUrl: string, appOrigin: string): NavigationDecision {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return 'block';
  }
  if (target.origin === appOrigin) {
    return 'allow';
  }
  return target.protocol === 'https:' || target.protocol === 'http:' ? 'open-externally' : 'block';
}
