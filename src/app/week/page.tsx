import { guardPage } from "@/lib/auth/guard";
import {
  dayName,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  label,
} from "../onboarding/labels";
import { signOut } from "./actions";

// Placeholder home for onboarded users. The weekly plan replaces it in Phase 4.
export default async function WeekPage() {
  // Logged out -> /login, not onboarded yet -> /onboarding.
  const { supabase } = await guardPage("/week");

  // RLS limits every query to the logged-in user's own rows.
  const [profile, commitments, windows] = await Promise.all([
    supabase
      .from("profile")
      .select("goal, experience, sessions_per_week, session_length_min")
      .single(),
    supabase
      .from("busy_block")
      .select("day_of_week, start_time, end_time, label")
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("availability_window")
      .select("day_of_week, start_time, end_time")
      .order("day_of_week")
      .order("start_time"),
  ]);
  if (profile.error) throw profile.error;

  const hhmm = (time: string) => time.slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your week</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        You&apos;re set up. Your first plan is coming soon.
      </p>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Goal</h2>
        <p>
          {label(GOAL_LABELS, profile.data.goal)},{" "}
          {label(EXPERIENCE_LABELS, profile.data.experience).toLowerCase()}.{" "}
          {profile.data.sessions_per_week} × {profile.data.session_length_min}{" "}
          min a week.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Fixed commitments</h2>
        {commitments.data?.length ? (
          <ul>
            {commitments.data.map((c, i) => (
              <li key={i}>
                {dayName(c.day_of_week)} {hhmm(c.start_time)}–{hhmm(c.end_time)}{" "}
                {c.label}
              </li>
            ))}
          </ul>
        ) : (
          <p>None</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Times you could train</h2>
        <ul>
          {windows.data?.map((w, i) => (
            <li key={i}>
              {dayName(w.day_of_week)} {hhmm(w.start_time)}–{hhmm(w.end_time)}
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut} className="mt-auto">
        <button
          type="submit"
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 font-medium dark:border-zinc-700"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
