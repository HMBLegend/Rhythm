import { describe, expect, it } from "vitest";
import {
  parseStoredRoutine,
  type StoredRoutine,
} from "@/lib/scheduling/stored-routine";

function stored(overrides: Partial<StoredRoutine> = {}): StoredRoutine {
  return {
    profile: {
      goal: "strength",
      experience: "beginner",
      sessions_per_week: 3,
      session_length_min: 45,
      equipment: ["dumbbells"],
      avoid: [],
      avoid_note: null,
      timezone: "Europe/London",
    },
    busyBlocks: [
      {
        day_of_week: 1,
        start_time: "09:00:00",
        end_time: "17:00:00",
        label: "Work",
        movable: false,
      },
      {
        day_of_week: 2,
        start_time: "09:00:00",
        end_time: "17:00:00",
        label: "Work",
        movable: false,
      },
    ],
    windows: [{ day_of_week: 1, start_time: "18:00:00", end_time: "19:00:00" }],
    ...overrides,
  };
}

function block(day: number, label: string | null = "Work") {
  return {
    day_of_week: day,
    start_time: "09:00:00",
    end_time: "17:00:00",
    label,
    movable: false,
  };
}

describe("parseStoredRoutine", () => {
  it("reads valid rows back into the onboarding shape", () => {
    const result = parseStoredRoutine(stored());
    expect(result).toEqual({
      ok: true,
      routine: {
        goal: "strength",
        experience: "beginner",
        sessionsPerWeek: 3,
        sessionLengthMin: 45,
        commitments: [
          {
            label: "Work",
            days: [1, 2],
            start: "09:00",
            end: "17:00",
            movable: false,
          },
        ],
        windows: [{ day: 1, start: "18:00", end: "19:00" }],
        equipment: ["dumbbells"],
        avoid: [],
        avoidNote: "",
        timezone: "Europe/London",
      },
    });
  });

  it("keeps commitments apart when their label, times or flag differ", () => {
    const result = parseStoredRoutine(
      stored({
        busyBlocks: [
          block(1),
          block(2, "School run"),
          { ...block(3), movable: true },
          { ...block(4), end_time: "16:00:00" },
        ],
      }),
    );
    expect(result.ok && result.routine.commitments).toHaveLength(4);
  });

  it("isn't limited by the per-commitment cap when rows are one per day", () => {
    // 20 commitments every day is 140 rows, which onboarding allows.
    const busyBlocks = Array.from({ length: 20 }, (_, i) =>
      [1, 2, 3, 4, 5, 6, 7].map((day) => block(day, `Thing ${i}`)),
    ).flat();
    const result = parseStoredRoutine(stored({ busyBlocks }));
    expect(result.ok).toBe(true);
  });

  it("reads a duplicated row once, and names an unlabelled block", () => {
    const result = parseStoredRoutine(
      stored({ busyBlocks: [block(5, null), block(5, null)] }),
    );
    expect(result.ok && result.routine.commitments).toEqual([
      {
        label: "Busy",
        days: [5],
        start: "09:00",
        end: "17:00",
        movable: false,
      },
    ]);
  });

  it("rejects an unknown time zone", () => {
    const result = parseStoredRoutine(
      stored({ profile: { ...stored().profile, timezone: "Mars/Olympus" } }),
    );
    expect(result).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "timezone" })],
    });
  });

  it("rejects overlapping windows", () => {
    const result = parseStoredRoutine(
      stored({
        windows: [
          { day_of_week: 2, start_time: "07:00:00", end_time: "08:00:00" },
          { day_of_week: 2, start_time: "07:30:00", end_time: "09:00:00" },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "windows" })],
    });
  });

  it("rejects a routine with no windows", () => {
    const result = parseStoredRoutine(stored({ windows: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects values the schema doesn't know", () => {
    const result = parseStoredRoutine(
      stored({ profile: { ...stored().profile, goal: "bulk" } }),
    );
    expect(result).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "goal" })],
    });
  });
});
