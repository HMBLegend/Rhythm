import { describe, expect, it } from "vitest";
import { toEngineInput } from "@/lib/scheduling/engine-input";
import type { Onboarding } from "@/lib/scheduling/routine";
import { schedule } from "@/lib/scheduling/scheduler";
import {
  parseStoredRoutine,
  type StoredRoutine,
} from "@/lib/scheduling/stored-routine";

function routine(overrides: Partial<Onboarding> = {}): Onboarding {
  return {
    goal: "endurance",
    experience: "intermediate",
    sessionsPerWeek: 3,
    sessionLengthMin: 45,
    commitments: [
      {
        label: "Work",
        days: [1, 2, 3],
        start: "09:00",
        end: "17:00",
        movable: false,
      },
      {
        label: "Football",
        days: [4],
        start: "19:00",
        end: "21:00",
        movable: true,
      },
    ],
    windows: [
      { day: 1, start: "06:00", end: "08:00" },
      { day: 4, start: "17:30", end: "22:00" },
    ],
    equipment: ["dumbbells"],
    avoid: ["running"],
    avoidNote: "",
    timezone: "Europe/London",
    ...overrides,
  };
}

describe("toEngineInput", () => {
  it("copies the goal, sessions and windows across", () => {
    const input = toEngineInput(routine());
    expect(input.goal).toBe("endurance");
    expect(input.sessionsPerWeek).toBe(3);
    expect(input.sessionLengthMin).toBe(45);
    expect(input.availability.windows).toEqual([
      { day: 1, start: "06:00", end: "08:00" },
      { day: 4, start: "17:30", end: "22:00" },
    ]);
  });

  it("turns each commitment into one busy block per day", () => {
    expect(toEngineInput(routine()).availability.busy).toEqual([
      { day: 1, start: "09:00", end: "17:00", label: "Work", movable: false },
      { day: 2, start: "09:00", end: "17:00", label: "Work", movable: false },
      { day: 3, start: "09:00", end: "17:00", label: "Work", movable: false },
      {
        day: 4,
        start: "19:00",
        end: "21:00",
        label: "Football",
        movable: true,
      },
    ]);
  });

  it("lists busy blocks and windows in day and time order", () => {
    const input = toEngineInput(
      routine({
        commitments: [
          {
            label: "Late",
            days: [2],
            start: "18:00",
            end: "19:00",
            movable: false,
          },
          {
            label: "Early",
            days: [2, 1],
            start: "07:00",
            end: "08:00",
            movable: false,
          },
        ],
        windows: [
          { day: 3, start: "06:00", end: "07:00" },
          { day: 1, start: "18:00", end: "19:00" },
        ],
      }),
    );
    expect(input.availability.busy.map((b) => `${b.day} ${b.label}`)).toEqual([
      "1 Early",
      "2 Early",
      "2 Late",
    ]);
    expect(input.availability.windows.map((w) => w.day)).toEqual([1, 3]);
  });

  it("does not share arrays with the routine it was given", () => {
    const r = routine();
    const input = toEngineInput(r);
    input.availability.windows.push({ day: 7, start: "06:00", end: "07:00" });
    expect(r.windows).toHaveLength(2);
  });
});

describe("stored rows to a plan", () => {
  it("plans a week from rows as the database returns them", () => {
    const stored: StoredRoutine = {
      profile: {
        goal: "general",
        experience: "beginner",
        sessions_per_week: 3,
        session_length_min: 45,
        equipment: [],
        avoid: [],
        avoid_note: null,
        timezone: "Europe/London",
      },
      busyBlocks: [1, 2, 3, 4, 5].map((day) => ({
        day_of_week: day,
        start_time: "09:00:00",
        end_time: "17:00:00",
        label: "Work",
        movable: false,
      })),
      windows: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
        day_of_week: day,
        start_time: "07:00:00",
        end_time: "20:00:00",
      })),
    };
    const parsed = parseStoredRoutine(stored);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = schedule(toEngineInput(parsed.routine));
    expect(result.status).toBe("ok");
    expect(result.plan.sessions).toHaveLength(3);
  });
});
