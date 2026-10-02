// Turns a routine as stored in the database back into the shape the schemas in
// routine.ts describe, and validates it. This is how the engine reads a routine:
// rows can be written directly from the browser, so they aren't trusted until
// they pass the same rules as onboarding.
import { type Commitment, type Onboarding, onboardingSchema } from "./routine";

// Rows as the database returns them. Declared here rather than imported from
// the generated Supabase types, because the engine mustn't depend on the
// database layer.
export type StoredProfile = {
  goal: string;
  experience: string;
  sessions_per_week: number;
  session_length_min: number;
  equipment: string[];
  avoid: string[];
  avoid_note: string | null;
  timezone: string;
};

export type StoredBusyBlock = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string | null;
  movable: boolean;
};

export type StoredWindow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type StoredRoutine = {
  profile: StoredProfile;
  busyBlocks: StoredBusyBlock[];
  windows: StoredWindow[];
};

export type StoredRoutineResult =
  | { ok: true; routine: Onboarding }
  | { ok: false; issues: { path: string; message: string }[] };

// The label is optional in the database but required by the schema.
const UNLABELLED = "Busy";

// Postgres returns "HH:MM:SS"; the schema uses "HH:MM".
function hhmm(time: string) {
  return time.slice(0, 5);
}

// Onboarding saves a commitment as one busy block per day. Rows with the same
// label, times and movable flag are put back together as one commitment, so a
// routine reads back the way the user entered it.
function toCommitments(blocks: StoredBusyBlock[]): Commitment[] {
  const byKey = new Map<string, Commitment>();
  for (const block of blocks) {
    const commitment: Commitment = {
      label: block.label ?? UNLABELLED,
      days: [],
      start: hhmm(block.start_time),
      end: hhmm(block.end_time),
      movable: block.movable,
    };
    const key = JSON.stringify([
      commitment.label,
      commitment.start,
      commitment.end,
      commitment.movable,
    ]);
    const existing = byKey.get(key) ?? commitment;
    // Two identical rows on the same day say the same thing once.
    if (!existing.days.includes(block.day_of_week)) {
      existing.days.push(block.day_of_week);
    }
    byKey.set(key, existing);
  }
  return [...byKey.values()].map((c) => ({
    ...c,
    days: [...c.days].sort((a, b) => a - b),
  }));
}

export function parseStoredRoutine({
  profile,
  busyBlocks,
  windows,
}: StoredRoutine): StoredRoutineResult {
  const result = onboardingSchema.safeParse({
    goal: profile.goal,
    experience: profile.experience,
    sessionsPerWeek: profile.sessions_per_week,
    sessionLengthMin: profile.session_length_min,
    commitments: toCommitments(busyBlocks),
    windows: windows.map((w) => ({
      day: w.day_of_week,
      start: hhmm(w.start_time),
      end: hhmm(w.end_time),
    })),
    equipment: profile.equipment,
    avoid: profile.avoid,
    avoidNote: profile.avoid_note ?? "",
    timezone: profile.timezone,
  });

  if (result.success) return { ok: true, routine: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
