import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRedirect } from "@/lib/auth/routing";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Runs before matching page requests. It does two things:
// 1. Refreshes the Supabase session cookie. Server Components can't write
//    cookies, so without this an expired token would never be renewed.
// 2. Sends logged-out visitors on protected pages to /login. This is only a
//    fast first check from the cookie. The pages check again next to the data,
//    including whether the user has onboarded, which needs the database.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Update the request so the page sees the new token, and the response
        // so the browser stores it.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Stop CDNs caching a response that carries someone's session.
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // getClaims() verifies the token's signature, and refreshes it if expired.
  const { data } = await supabase.auth.getClaims();

  const target = decideRedirect({
    pathname: request.nextUrl.pathname,
    isLoggedIn: Boolean(data?.claims),
  });
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

export const config = {
  // Pages only: skip API routes (they verify the session themselves), Next's
  // static files and images, so they aren't slowed down or counted as invocations.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
