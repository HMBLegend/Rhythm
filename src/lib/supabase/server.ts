import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// For Server Components, Server Actions and Route Handlers. Create one per request.
export async function createClient() {
  // Read cookies first: it marks the page as dynamic, so the build doesn't try
  // to prerender it (and fail) where the Supabase env vars aren't set, e.g. CI.
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. Session refresh will be
          // handled in the proxy (middleware) when auth is added.
        }
      },
    },
  });
}
