import { describe, expect, it } from "vitest";
import {
  commitmentSchema,
  goalStep,
  onboardingSchema,
  preferencesStep,
  sessionsStep,
  windowsStep,
} from "@/lib/scheduling/routine";

const valid = {
  goal: "strength",
  experience: "beginner",
  sessionsPerWeek: 3,
  sessionLengthMin: 45,
  commitments: [
    {
      label: "Work",
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "17:00",
      movable: false,
    },
  ],
  windows: [
    { day: 1, start: "18:00", end: "20:00" },
    { day: 3, start: "07:00", end: "08:30" },
  ],
  equipment: ["dumbbells"],
  avoid: [],
  avoidNote: "",
  timezone: "Europe/London",
};

function errorPaths(input: unknown) {
  const result = onboardingSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => issue.path.join("."));
}

describe("onboardingSchema", () => {
  it("accepts a complete, valid routine", () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts no commitments and no equipment", () => {
    const input = { ...valid, commitments: [], equipment: [] };
    expect(onboardingSchema.safeParse(input).success).toBe(true);
  });

  it("rejects unknown keys, so a client can't send its own user_id", () => {
    expect(errorPaths({ ...valid, user_id: "someone-else" })).toEqual([""]);
  });

  it("rejects an unknown timezone", () => {
    expect(errorPaths({ ...valid, timezone: "Mars/Olympus" })).toEqual([
      "timezone",
    ]);
  });

  it("requires at least one training window", () => {
    expect(errorPaths({ ...valid, windows: [] })).toEqual(["windows"]);
  });

  it("rejects overlapping windows on the same day", () => {
    const windows = [
      { day: 2, start: "18:00", end: "20:00" },
      { day: 2, start: "19:00", end: "21:00" },
    ];
    expect(errorPaths({ ...valid, windows })).toEqual(["windows"]);
  });

  it("allows back-to-back windows and same times on different days", () => {
    const windows = [
      { day: 2, start: "18:00", end: "19:00" },
      { day: 2, start: "19:00", end: "20:00" },
      { day: 3, start: "18:00", end: "20:00" },
    ];
    expect(onboardingSchema.safeParse({ ...valid, windows }).success).toBe(
      true,
    );
  });

  it("caps the number of commitments and windows", () => {
    const commitment = valid.commitments[0]!;
    const window = valid.windows[0]!;
    expect(
      errorPaths({ ...valid, commitments: Array(21).fill(commitment) }),
    ).toEqual(["commitments"]);
    const windows = Array.from({ length: 22 }, (_, i) => ({
      ...window,
      day: (i % 7) + 1,
      start: `0${i % 3}:00`,
      end: `0${i % 3}:30`,
    }));
    expect(errorPaths({ ...valid, windows })).toContain("windows");
  });
});

describe("commitmentSchema", () => {
  const work = valid.commitments[0]!;

  it("trims the label and requires one", () => {
    expect(commitmentSchema.parse({ ...work, label: "  Work " }).label).toBe(
      "Work",
    );
    expect(commitmentSchema.safeParse({ ...work, label: "  " }).success).toBe(
      false,
    );
  });

  it("rejects an end time that isn't after the start time", () => {
    const same = commitmentSchema.safeParse({ ...work, end: "09:00" });
    expect(same.error?.issues[0]?.path).toEqual(["end"]);
    const overnight = commitmentSchema.safeParse({
      ...work,
      start: "22:00",
      end: "06:00",
    });
    expect(overnight.success).toBe(false);
  });

  it("rejects badly formatted times", () => {
    for (const start of ["9:00", "24:00", "09:60", "09:00:00", "nine"]) {
      expect(commitmentSchema.safeParse({ ...work, start }).success).toBe(
        false,
      );
    }
  });

  it("requires at least one day, each 1-7 and not repeated", () => {
    for (const days of [[], [0], [8], [1.5], [1, 1]]) {
      expect(commitmentSchema.safeParse({ ...work, days }).success).toBe(false);
    }
  });
});

describe("step schemas", () => {
  it("validate only their own fields", () => {
    expect(
      goalStep.safeParse({ goal: "general", experience: "advanced" }).success,
    ).toBe(true);
    expect(
      goalStep.safeParse({ goal: "yoga", experience: "advanced" }).success,
    ).toBe(false);
  });

  it("bound sessions per week and session length", () => {
    const ok = { sessionsPerWeek: 7, sessionLengthMin: 180 };
    expect(sessionsStep.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, sessionsPerWeek: 0 },
      { ...ok, sessionsPerWeek: 8 },
      { ...ok, sessionsPerWeek: 2.5 },
      { ...ok, sessionLengthMin: 5 },
      { ...ok, sessionLengthMin: 185 },
      { ...ok, sessionLengthMin: 42 },
    ]) {
      expect(sessionsStep.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects a window whose end isn't after its start", () => {
    const windows = [{ day: 1, start: "20:00", end: "18:00" }];
    expect(windowsStep.safeParse({ windows }).success).toBe(false);
  });

  it("only allows known equipment and avoid tags, without repeats", () => {
    const ok = { equipment: [], avoid: ["running"], avoidNote: "" };
    expect(preferencesStep.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, equipment: ["spaceship"] },
      { ...ok, avoid: ["running", "running"] },
      { ...ok, avoidNote: "x".repeat(201) },
    ]) {
      expect(preferencesStep.safeParse(bad).success).toBe(false);
    }
  });
});
