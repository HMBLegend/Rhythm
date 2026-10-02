import { guardPage } from "@/lib/auth/guard";
import { dayName, EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/routine/labels";
import { loadRoutine } from "@/lib/routine/load";
import type { Onboarding } from "@/lib/scheduling/routine";
import { signOut } from "./actions";

// Placeholder home for onboarded users. The weekly plan replaces it in Phase 4.
export default async function WeekPage() {
  // Logged out -> /login, not onboarded yet -> /onboarding.
  const { supabase } = await guardPage("/week");
  const result = await loadRoutine(supabase);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your week</h1>

      {result.ok ? (
        <Routine routine={result.routine} />
      ) : (
        <InvalidRoutine issues={result.issues} />
      )}

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

function Routine({ routine }: { routine: Onboarding }) {
  return (
    <>
      <p className="text-zinc-600 dark:text-zinc-400">
        You&apos;re set up. Your first plan is coming soon.
      </p>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Goal</h2>
        <p>
          {GOAL_LABELS[routine.goal]},{" "}
          {EXPERIENCE_LABELS[routine.experience].toLowerCase()}.{" "}
          {routine.sessionsPerWeek} × {routine.sessionLengthMin} min a week.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Fixed commitments</h2>
        {routine.commitments.length ? (
          <ul>
            {routine.commitments.map((c, i) => (
              <li key={i}>
                {c.label}: {c.days.map(dayName).join(", ")} {c.start}–{c.end}
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
          {routine.windows.map((w, i) => (
            <li key={i}>
              {dayName(w.day)} {w.start}–{w.end}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// Only reachable if rows were written around onboarding. Show what's wrong
// rather than a broken page; editing the routine comes in Phase 5.
function InvalidRoutine({ issues }: { issues: { message: string }[] }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <p className="font-medium">
        Something&apos;s wrong with your saved routine.
      </p>
      <ul className="list-disc pl-5">
        {issues.map((issue, i) => (
          <li key={i}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
