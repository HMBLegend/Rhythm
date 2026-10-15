// Maps a validated routine (from onboarding, or read back from the database by
// parseStoredRoutine) into what the scheduler takes. Read-only: it changes
// nothing and calls nothing. Experience, equipment, things to avoid and the
// time zone aren't used by the engine yet, so they aren't passed on.
import type { Onboarding } from "./routine";
import type { BusyBlock, EngineInput, TimeRange } from "./types";

function inOrder<T extends TimeRange>(ranges: T[]): T[] {
  return ranges.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

export function toEngineInput(routine: Onboarding): EngineInput {
  // Onboarding stores a commitment once with several days; the engine wants
  // one busy block per day.
  const busy: BusyBlock[] = routine.commitments.flatMap((c) =>
    c.days.map((day) => ({
      day,
      start: c.start,
      end: c.end,
      label: c.label,
      movable: c.movable,
    })),
  );
  return {
    goal: routine.goal,
    sessionsPerWeek: routine.sessionsPerWeek,
    sessionLengthMin: routine.sessionLengthMin,
    availability: {
      windows: inOrder(routine.windows.map((w) => ({ ...w }))),
      busy: inOrder(busy),
    },
  };
}
