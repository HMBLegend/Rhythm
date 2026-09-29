import "server-only";
import { redirect } from "next/navigation";
import { decideRedirect } from "@/lib/auth/routing";
import { createClient } from "@/lib/supabase/server";

// The real access check for a page, run on the server next to the data.
// Redirects if the user shouldn't be here, otherwise returns the client and user.
export async function guardPage(pathname: string) {
  const supabase = await createClient();
  // getUser() verifies the session with Supabase Auth rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOnboarded: boolean | undefined;
  if (user) {
    const { data, error } = await supabase
      .from("profile")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    isOnboarded = Boolean(data?.onboarded_at);
  }

  const target = decideRedirect({
    pathname,
    isLoggedIn: Boolean(user),
    isOnboarded,
  });
  if (target) redirect(target);

  return { supabase, user };
}
