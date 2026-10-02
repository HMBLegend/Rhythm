import "server-only";
import { parseStoredRoutine } from "@/lib/scheduling/stored-routine";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Loads the logged-in user's routine and checks it against the onboarding rules.
// RLS limits every query to their own rows. A failed query throws rather than
// passing an empty list on, which would look like a routine with nothing in it.
export async function loadRoutine(supabase: Client) {
  const [profile, busyBlocks, windows] = await Promise.all([
    supabase
      .from("profile")
      .select(
        "goal, experience, sessions_per_week, session_length_min, equipment, avoid, avoid_note, timezone",
      )
      .single(),
    supabase
      .from("busy_block")
      .select("day_of_week, start_time, end_time, label, movable")
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("availability_window")
      .select("day_of_week, start_time, end_time")
      .order("day_of_week")
      .order("start_time"),
  ]);
  if (profile.error) throw profile.error;
  if (busyBlocks.error) throw busyBlocks.error;
  if (windows.error) throw windows.error;

  return parseStoredRoutine({
    profile: profile.data,
    busyBlocks: busyBlocks.data,
    windows: windows.data,
  });
}
