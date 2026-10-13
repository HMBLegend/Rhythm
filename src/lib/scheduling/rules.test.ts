import { describe, expect, it } from "vitest";
import { RULE_IDS, type RuleId } from "@/lib/scheduling/config";
import { createRules } from "@/lib/scheduling/rules";
import { busy, context, plan, session } from "@/lib/scheduling/test-helpers";
import type { RuleContext, WeeklyPlan } from "@/lib/scheduling/types";

function check(id: RuleId, p: WeeklyPlan, ctx: RuleContext = context()) {
  const rule = createRules(ctx.config).find((r) => r.id === id)!;
  return rule.check(p, ctx);
}

function flagged(id: RuleId, p: WeeklyPlan, ctx?: RuleContext) {
  return check(id, p, ctx).map((v) => v.sessionIds);
}

describe("createRules", () => {
  it("builds one rule per id, in order, with severity from config", () => {
    const rules = createRules(context().config);
    expect(rules.map((r) => r.id)).toEqual(RULE_IDS);
    expect(rules.every((r) => r.severity === "hard")).toBe(true);
  });

  it("makes a rule soft with a one-line config change", () => {
    const config = {
      ...context().config,
      severity: {
        ...context().config.severity,
        "max-consecutive-training-days": "soft" as const,
      },
    };
    const rule = createRules(config).find(
      (r) => r.id === "max-consecutive-training-days",
    )!;
    expect(rule.severity).toBe("soft");
  });

  it("finds nothing wrong with an empty plan", () => {
    for (const rule of createRules(context().config)) {
      expect(rule.check(plan(), context())).toEqual([]);
    }
  });
});

describe("no-busy-overlap", () => {
  const ctx = context({ busy: [busy(1, "09:00", "17:00")] });

  it("flags a session inside, across, or covering a busy block", () => {
    for (const [start, end] of [
      ["10:00", "11:00"],
      ["08:30", "09:30"],
      ["16:30", "17:30"],
      ["08:00", "18:00"],
    ]) {
      const v = check(
        "no-busy-overlap",
        plan(session("a", 1, start!, end!)),
        ctx,
      );
      expect(v).toHaveLength(1);
      expect(v[0]).toMatchObject({
        ruleId: "no-busy-overlap",
        severity: "hard",
        sessionIds: ["a"],
      });
      expect(v[0]!.message).toContain("Work");
    }
  });

  it("allows touching edges and other days", () => {
    const p = plan(
      session("a", 1, "08:00", "09:00"),
      session("b", 1, "17:00", "18:00"),
      session("c", 2, "10:00", "11:00"),
    );
    expect(check("no-busy-overlap", p, ctx)).toEqual([]);
  });

  it("treats movable blocks as busy too", () => {
    const movable = context({
      busy: [{ ...busy(1, "09:00", "17:00"), movable: true }],
    });
    expect(
      flagged(
        "no-busy-overlap",
        plan(session("a", 1, "10:00", "11:00")),
        movable,
      ),
    ).toEqual([["a"]]);
  });
});

describe("fits-free-window-with-buffer", () => {
  const ctx = context({ busy: [busy(1, "09:00", "17:00")] });
  const id = "fits-free-window-with-buffer";

  it("allows exactly the buffer before and after a busy block", () => {
    const p = plan(
      session("a", 1, "07:45", "08:45"),
      session("b", 1, "17:15", "18:00"),
    );
    expect(check(id, p, ctx)).toEqual([]);
  });

  it("flags one minute inside the buffer on either side", () => {
    expect(flagged(id, plan(session("a", 1, "07:46", "08:46")), ctx)).toEqual([
      ["a"],
    ]);
    expect(flagged(id, plan(session("b", 1, "17:14", "18:00")), ctx)).toEqual([
      ["b"],
    ]);
  });

  it("keeps the buffer between two sessions on the same day", () => {
    const tight = plan(
      session("a", 3, "07:00", "08:00", "mobility"),
      session("b", 3, "08:10", "09:00", "mobility"),
    );
    expect(flagged(id, tight)).toEqual([["a", "b"]]);
    const ok = plan(
      session("a", 3, "07:00", "08:00", "mobility"),
      session("b", 3, "08:15", "09:00", "mobility"),
    );
    expect(check(id, ok)).toEqual([]);
  });

  it("flags two sessions that overlap each other", () => {
    const p = plan(
      session("a", 3, "07:00", "08:00"),
      session("b", 3, "07:30", "08:30"),
    );
    expect(flagged(id, p)).toEqual([["a", "b"]]);
  });

  it("does not apply the buffer to window edges", () => {
    const exact = context({
      windows: [{ day: 2, start: "18:00", end: "18:45" }],
    });
    expect(check(id, plan(session("a", 2, "18:00", "18:45")), exact)).toEqual(
      [],
    );
  });

  it("reads the buffer from config", () => {
    const noBuffer = context(
      { busy: [busy(1, "09:00", "17:00")] },
      { bufferMin: 0 },
    );
    expect(
      check(id, plan(session("a", 1, "08:00", "09:00")), noBuffer),
    ).toEqual([]);
  });
});

describe("max-consecutive-training-days", () => {
  const id = "max-consecutive-training-days";
  const on = (...days: number[]) =>
    plan(...days.map((d) => session(`d${d}`, d, "07:00", "07:45", "mobility")));

  it("allows three days in a row", () => {
    expect(check(id, on(1, 2, 3, 5, 6, 7))).toEqual([]);
  });

  it("flags a fourth day in a row, naming every session in the run", () => {
    expect(flagged(id, on(1, 2, 3, 4))).toEqual([["d1", "d2", "d3", "d4"]]);
  });

  it("counts a day once however many sessions it has", () => {
    const p = plan(
      session("a", 1, "07:00", "07:30", "mobility"),
      session("b", 1, "19:00", "19:30", "mobility"),
      session("c", 2, "07:00", "07:30", "mobility"),
      session("d", 3, "07:00", "07:30", "mobility"),
    );
    expect(check(id, p)).toEqual([]);
  });

  it("looks at this week only, so Sunday and Monday aren't joined", () => {
    expect(check(id, on(6, 7, 1, 2))).toEqual([]);
  });

  it("reads the limit from config", () => {
    const ctx = context({}, { maxConsecutiveTrainingDays: 2 });
    expect(flagged(id, on(1, 2, 3), ctx)).toEqual([["d1", "d2", "d3"]]);
  });
});

describe("no-back-to-back-hard-sessions", () => {
  const id = "no-back-to-back-hard-sessions";

  it("flags hard sessions on consecutive days", () => {
    const p = plan(
      session("a", 1, "07:00", "08:00", "strength"),
      session("b", 2, "07:00", "08:00", "cardio"),
    );
    expect(flagged(id, p)).toEqual([["a", "b"]]);
  });

  it("flags two hard sessions on the same day", () => {
    const p = plan(
      session("a", 1, "07:00", "08:00", "strength"),
      session("b", 1, "18:00", "19:00", "cardio"),
    );
    expect(flagged(id, p)).toEqual([["a", "b"]]);
  });

  it("allows a rest day or an easy session in between", () => {
    const p = plan(
      session("a", 1, "07:00", "08:00", "strength"),
      session("b", 2, "07:00", "08:00", "mobility"),
      session("c", 3, "07:00", "08:00", "strength"),
      session("d", 5, "07:00", "08:00", "cardio"),
    );
    expect(check(id, p)).toEqual([]);
  });

  it("reads which types are hard from config", () => {
    const ctx = context({}, { hardSessionTypes: ["strength"] });
    const p = plan(
      session("a", 1, "07:00", "08:00", "strength"),
      session("b", 2, "07:00", "08:00", "cardio"),
    );
    expect(check(id, p, ctx)).toEqual([]);
  });
});

describe("respect-preferred-times-and-days", () => {
  const id = "respect-preferred-times-and-days";
  const ctx = context({ windows: [{ day: 2, start: "18:00", end: "19:00" }] });

  it("allows a session that exactly fills a window", () => {
    expect(check(id, plan(session("a", 2, "18:00", "19:00")), ctx)).toEqual([]);
  });

  it("flags a session that spills out of its window", () => {
    expect(flagged(id, plan(session("a", 2, "17:59", "18:45")), ctx)).toEqual([
      ["a"],
    ]);
    expect(flagged(id, plan(session("a", 2, "18:30", "19:01")), ctx)).toEqual([
      ["a"],
    ]);
  });

  it("flags a session on a day with no window", () => {
    expect(flagged(id, plan(session("a", 3, "18:00", "19:00")), ctx)).toEqual([
      ["a"],
    ]);
  });

  it("doesn't join two back-to-back windows into one", () => {
    const split = context({
      windows: [
        { day: 2, start: "18:00", end: "18:30" },
        { day: 2, start: "18:30", end: "19:00" },
      ],
    });
    expect(flagged(id, plan(session("a", 2, "18:15", "18:45")), split)).toEqual(
      [["a"]],
    );
  });

  it("flags a session whose end isn't after its start", () => {
    expect(flagged(id, plan(session("a", 2, "18:30", "18:30")), ctx)).toEqual([
      ["a"],
    ]);
  });
});
