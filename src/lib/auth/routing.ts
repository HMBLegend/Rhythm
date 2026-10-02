// Who may see which page. A pure function, so the rules are tested in one place
// and the proxy and the pages can't disagree about them.

const PROTECTED = ["/onboarding", "/week"];

function isUnder(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isProtected(pathname: string) {
  return PROTECTED.some((route) => isUnder(pathname, route));
}

type RouteState = {
  pathname: string;
  isLoggedIn: boolean;
  // Undefined when it wasn't looked up. The proxy only reads the session
  // cookie and skips the database, so it leaves this out.
  isOnboarded?: boolean;
};

// Returns where to send the user, or null to let them through.
export function decideRedirect({
  pathname,
  isLoggedIn,
  isOnboarded,
}: RouteState): string | null {
  if (!isLoggedIn) {
    return isProtected(pathname)
      ? `/login?next=${encodeURIComponent(pathname)}`
      : null;
  }
  if (isOnboarded === undefined) return null;

  const home = isOnboarded ? "/week" : "/onboarding";
  if (isUnder(pathname, "/login")) return home;
  if (isOnboarded && isUnder(pathname, "/onboarding")) return "/week";
  if (!isOnboarded && isUnder(pathname, "/week")) return "/onboarding";
  return null;
}

// Where to go after logging in. Only known app pages are allowed: taking any
// URL from the query string would let a crafted link send users to another site.
export function safeNext(next: string | null | undefined): string {
  return next && isProtected(next) ? next : "/onboarding";
}
