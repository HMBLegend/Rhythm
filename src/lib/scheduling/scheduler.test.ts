import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG, type EngineConfig } from "@/lib/scheduling/config";
import { schedule } from "@/lib/scheduling/scheduler";
import { busy, session } from "@/lib/scheduling/test-helpers";
import { toMinutes } from "@/lib/scheduling/time";
import type {
  Availability,
  EngineInput,
  PlanResult,
  ScheduleOptions,
  Session,
  WeekPoint,
} from "@/lib/scheduling/types";
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

  it("fits every goal at every weekly count in an open week", () => {
    for (const goal of ["strength", "endurance", "general"] as const) {
      for (let n = 1; n <= 7; n++) {
        const result = schedule(input({ goal, sessionsPerWeek: n }));
        expect(result.status, `${goal} ${n}x`).toBe("ok");
      }
    }
  });

  it("finds a tight 7-session week rather than giving up early", () => {
    // Only the hard days have room for two sessions, and every other day's
    // window is a decoy that would put hard sessions back to back.
    const i = input(
      { goal: "strength", sessionsPerWeek: 7 },
      {
        windows: [
          ...[1, 3, 5, 7].map((day) => ({
            day,
            start: "06:00",
            end: "08:00",
          })),
          ...[2, 4, 6].map((day) => ({ day, start: "18:00", end: "18:45" })),
        ],
      },
    );
    const result = schedule(i);
    expect(result.status).toBe("ok");
    expect(hardViolations(i)).toEqual([]);
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

function startsAtOrAfter(s: Session, from: WeekPoint) {
  return (
    s.day > from.day ||
    (s.day === from.day && toMinutes(s.start) >= toMinutes(from.time))
  );
}

// Hard violations, plus the kept sessions coming back exactly as given and
// every new session starting at or after `from`.
function problemsWith(
  result: PlanResult,
  i: EngineInput,
  { keep = [], from }: ScheduleOptions,
) {
  const problems: string[] = validateResult(result, i, ENGINE_CONFIG)
    .filter((v) => v.severity === "hard")
    .map((v) => v.message);
  for (const k of keep) {
    if (
      !result.plan.sessions.some((s) => JSON.stringify(s) === JSON.stringify(k))
    ) {
      problems.push(`kept session ${k.id} changed or went missing`);
    }
  }
  const keptIds = new Set(keep.map((k) => k.id));
  for (const s of result.plan.sessions) {
    if (!keptIds.has(s.id) && from && !startsAtOrAfter(s, from)) {
      problems.push(`new session ${s.id} starts before the start point`);
    }
  }
  return problems;
}

describe("schedule the rest of a week", () => {
  it("plans the same week as before when starting from Monday 00:00", () => {
    const i = input(
      { goal: "strength", sessionsPerWeek: 4 },
      { busy: [busy(1, "09:00", "17:00")] },
    );
    expect(
      schedule(i, ENGINE_CONFIG, { from: { day: 1, time: "00:00" } }),
    ).toEqual(schedule(i));
  });

  it("places new sessions only from the start point onward", () => {
    const i = input({ sessionsPerWeek: 3 });
    const from = { day: 3, time: "12:00" };
    const result = schedule(i, ENGINE_CONFIG, { from });
    expect(result.status).toBe("ok");
    expect(result.plan.sessions).toHaveLength(3);
    expect(problemsWith(result, i, { from })).toEqual([]);
  });

  it("can start at the start point itself, mid-window", () => {
    const i = input({ sessionsPerWeek: 1 });
    const result = schedule(i, ENGINE_CONFIG, {
      from: { day: 7, time: "20:10" },
    });
    expect(result.plan.sessions).toMatchObject([
      { day: 7, start: "20:10", end: "20:55" },
    ]);
  });

  it("keeps kept sessions as they are and plans only what's left of the mix", () => {
    const i = input({ sessionsPerWeek: 3 });
    const done = { ...session("s1", 1, "07:00", "07:45"), reason: "Kept." };
    const options = { keep: [done], from: { day: 3, time: "00:00" } };
    const result = schedule(i, ENGINE_CONFIG, options);
    expect(result.status).toBe("ok");
    expect(result.plan.sessions.map((s) => s.type).sort()).toEqual([
      "cardio",
      "mobility",
      "strength",
    ]);
    expect(problemsWith(result, i, options)).toEqual([]);
    const ids = result.plan.sessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still applies the rules to new sessions next to kept ones", () => {
    // A kept strength session on Wed rules out cardio on Tue and Thu.
    const i = input({ sessionsPerWeek: 3 });
    const keep = [session("w", 3, "07:00", "07:45", "strength")];
    const options = { keep, from: { day: 2, time: "00:00" } };
    const result = schedule(i, ENGINE_CONFIG, options);
    const cardio = result.plan.sessions.find((s) => s.type === "cardio");
    expect(cardio && [2, 4].includes(cardio.day)).toBe(false);
    expect(problemsWith(result, i, options)).toEqual([]);
  });

  it("says which days are already past when the rest of the week can't fit", () => {
    const i = input({ sessionsPerWeek: 3 });
    const result = schedule(i, ENGINE_CONFIG, {
      from: { day: 7, time: "21:30" },
    });
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.plan.sessions).toEqual([]);
    for (const u of result.unmet) {
      expect(u.reason).toContain(
        "Mon, Tue, Wed, Thu, Fri, Sat are already past",
      );
    }
  });

  it("rejects kept sessions the week's mix doesn't call for", () => {
    const i = input({ sessionsPerWeek: 3 });
    const keep = [
      session("a", 1, "07:00", "07:45", "cardio"),
      session("b", 3, "07:00", "07:45", "cardio"),
    ];
    expect(() => schedule(i, ENGINE_CONFIG, { keep })).toThrow(/session mix/);
  });

  it("rejects a start point that isn't a day and HH:MM time", () => {
    for (const from of [
      { day: 0, time: "07:00" },
      { day: 8, time: "07:00" },
      { day: 2, time: "25:00" },
    ]) {
      expect(() => schedule(input(), ENGINE_CONFIG, { from })).toThrow();
    }
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

  it("re-plans the rest of 40 random weeks without moving what's kept", () => {
    const random = seeded(1021);
    const times = ["00:00", "07:00", "12:30", "18:00", "21:00"];
    for (let i = 0; i < 40; i++) {
      const week = randomWeek(random);
      const from = {
        day: 1 + Math.floor(random() * 7),
        time: times[Math.floor(random() * times.length)]!,
      };
      // Everything already planned before the start point is kept.
      const keep = schedule(week).plan.sessions.filter(
        (s) => !startsAtOrAfter(s, from),
      );
      const options = { keep, from };
      const result = schedule(week, ENGINE_CONFIG, options);
      expect(
        problemsWith(result, week, options),
        JSON.stringify({ week, from }),
      ).toEqual([]);
      expect(schedule(week, ENGINE_CONFIG, options)).toEqual(result);
    }
  });
});
