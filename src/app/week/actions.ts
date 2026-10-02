"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // The flag only shows a notice on the login page; it grants nothing.
  redirect("/login?logged-out=1");
}
