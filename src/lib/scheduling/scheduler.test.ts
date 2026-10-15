import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG, type EngineConfig } from "@/lib/scheduling/config";
import { schedule } from "@/lib/scheduling/scheduler";
import { busy } from "@/lib/scheduling/test-helpers";
import { toMinutes } from "@/lib/scheduling/time";
import type { Availability, EngineInput } from "@/lib/scheduling/types";
import { validateResult } from "@/lib/scheduling/validator";

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

function input(
  overrides: Partial<Omit<EngineInput, "availability">> = {},
  availability: Partial<Availability> = {},
): EngineInput {
  return {
    goal: "general",
    sessionsPerWeek: 3,
    sessionLengthMin: 45,
    ...overrides,
    availability: {
      windows: EVERY_DAY.map((day) => ({ day, start: "06:00", end: "22:00" })),
      busy: [],
      ...availability,
    },
  };
}

function hardViolations(i: EngineInput, config: EngineConfig = ENGINE_CONFIG) {
  const result = schedule(i, config);
  return validateResult(result, i, config).filter((v) => v.severity === "hard");
}

describe("schedule", () => {
  it("places every session in an open week", () => {
    const result = schedule(input());
    expect(result.status).toBe("ok");
    expect(result.plan.sessions.map((s) => s.type).sort()).toEqual([
      "cardio",
      "mobility",
      "strength",
    ]);
  });

  it("gives every session the requested length", () => {
    for (const s of schedule(input({ sessionLengthMin: 60 })).plan.sessions) {
      expect(toMinutes(s.end) - toMinutes(s.start)).toBe(60);
    }
  });

  it("returns the same plan for the same input", () => {
    const i = input(
      { goal: "strength", sessionsPerWeek: 4 },
      { busy: [busy(1, "09:00", "17:00"), busy(3, "06:00", "12:00")] },
    );
    expect(schedule(i)).toEqual(schedule(i));
  });

  it("never returns a plan the validator rejects", () => {
    const cases = [
      input(),
      input({ goal: "strength", sessionsPerWeek: 5 }),
      input({ goal: "endurance", sessionsPerWeek: 6 }),
      input(
        { sessionsPerWeek: 4, sessionLengthMin: 60 },
        {
          busy: EVERY_DAY.map((day) => busy(day, "07:00", "19:00")),
        },
      ),
    ];
    for (const i of cases) expect(hardViolations(i)).toEqual([]);
  });

  it("keeps clear of busy blocks and their buffer", () => {
    const i = input(
      {},
      {
        windows: EVERY_DAY.map((day) => ({
          day,
          start: "06:00",
          end: "09:00",
        })),
        busy: EVERY_DAY.map((day) => busy(day, "06:00", "07:30")),
      },
    );
    const result = schedule(i);
    expect(result.status).toBe("ok");
    for (const s of result.plan.sessions) {
      expect(s.start >= "07:45").toBe(true);
    }
  });

  it("uses a window that is exactly the session length", () => {
    const i = input(
      { sessionsPerWeek: 1 },
      { windows: [{ day: 2, start: "18:00", end: "18:45" }] },
    );
    const result = schedule(i);
    expect(result.status).toBe("ok");
    expect(result.plan.sessions).toMatchObject([
      { day: 2, start: "18:00", end: "18:45", type: "strength" },
    ]);
  });

  it("spaces hard sessions even when the first choices would box it in", () => {
    // Four hard sessions only fit as Mon, Wed, Fri, Sun.
    const config: EngineConfig = {
      ...ENGINE_CONFIG,
      goalMix: {
        ...ENGINE_CONFIG.goalMix,
        strength: Array(7).fill("strength"),
      },
    };
    const i = input({ goal: "strength", sessionsPerWeek: 4 });
    const result = schedule(i, config);
    expect(result.status).toBe("ok");
    expect(result.plan.sessions.map((s) => s.day).sort()).toEqual([1, 3, 5, 7]);
    expect(hardViolations(i, config)).toEqual([]);
  });

  it("returns a partial plan with reasons when the week can't fit", () => {
    // One free slot all week: only the top-priority session fits.
    const i = input(
      { sessionsPerWeek: 3 },
      { windows: [{ day: 4, start: "07:00", end: "08:00" }] },
    );
    const result = schedule(i);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.plan.sessions).toMatchObject([{ day: 4, type: "strength" }]);
    expect(result.unmet.map((u) => u.type)).toEqual(["cardio", "mobility"]);
    for (const u of result.unmet) expect(u.reason).not.toBe("");
  });

  it("drops everything, with a reason, when there are no windows", () => {
    const result = schedule(input({}, { windows: [] }));
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.plan.sessions).toEqual([]);
    expect(result.unmet).toHaveLength(3);
  });

  it("says why when no window is long enough", () => {
    const i = input(
      { sessionsPerWeek: 1, sessionLengthMin: 90 },
      { windows: [{ day: 1, start: "07:00", end: "08:00" }] },
    );
    const result = schedule(i);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.unmet[0]?.reason).toMatch(/90 min/);
  });

  it("gives every placed session a one-line reason", () => {
    for (const s of schedule(input()).plan.sessions) {
      expect(s.reason).not.toBe("");
      expect(s.reason).not.toContain("\n");
    }
  });

  it("rejects a session length that isn't a positive whole number", () => {
    expect(() => schedule(input({ sessionLengthMin: 0 }))).toThrow();
    expect(() => schedule(input({ sessionLengthMin: 30.5 }))).toThrow();
  });
});

// A small seeded generator, so the weeks below are random-looking but the same
// every run.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function randomWeek(random: () => number): EngineInput {
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(random() * items.length)] as T;
  const windows = EVERY_DAY.flatMap((day) =>
    random() < 0.3
      ? []
      : [
          {
            day,
            start: pick(["06:00", "07:30", "12:00", "17:00"]),
            end: pick(["09:00", "13:30", "19:00", "21:30"]),
          },
        ],
  ).filter((w) => w.start < w.end);
  const busyBlocks = EVERY_DAY.filter(() => random() < 0.5).map((day) =>
    busy(day, pick(["08:00", "09:00"]), pick(["12:00", "17:00"])),
  );
  return {
    goal: pick(["strength", "endurance", "general"] as const),
    sessionsPerWeek: 1 + Math.floor(random() * 7),
    sessionLengthMin: pick([30, 45, 60, 90]),
    availability: { windows, busy: busyBlocks },
  };
}

describe("schedule against the validator", () => {
  it("returns a plan the validator accepts, the same one every time, for 40 random weeks", () => {
    const random = seeded(2026);
    for (let i = 0; i < 40; i++) {
      const week = randomWeek(random);
      const result = schedule(week);
      const hard = validateResult(result, week, ENGINE_CONFIG).filter(
        (v) => v.severity === "hard",
      );
      expect(hard, JSON.stringify(week)).toEqual([]);
      expect(schedule(week)).toEqual(result);
    }
  });
});
