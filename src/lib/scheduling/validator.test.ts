import { describe, expect, it } from "vitest";
import { schedule } from "@/lib/scheduling/scheduler";
import {
  canPlace,
  isLegal,
  validate,
  validateResult,
} from "@/lib/scheduling/validator";
import { busy, context, plan, session } from "@/lib/scheduling/test-helpers";
import type { Rule } from "@/lib/scheduling/types";

describe("validate", () => {
  it("accepts an empty week when every session is listed as unmet", () => {
    const ctx = {
      ...context(),
      unmet: [
        { type: "strength" as const, reason: "No spot." },
        { type: "cardio" as const, reason: "No spot." },
        { type: "mobility" as const, reason: "No spot." },
      ],
    };
    expect(validate(plan(), ctx)).toEqual([]);
    expect(isLegal(plan(), ctx)).toBe(true);
  });

  it("collects violations from every rule", () => {
    const ctx = context(
      {
        windows: [{ day: 1, start: "08:00", end: "09:15" }],
        busy: [busy(1, "09:00", "17:00")],
      },
      {},
      { sessionsPerWeek: 1, sessionLengthMin: 60 },
    );
    const ids = validate(plan(session("a", 1, "08:30", "09:30")), ctx).map(
      (v) => v.ruleId,
    );
    expect(ids).toEqual([
      "no-busy-overlap",
      "respect-preferred-times-and-days",
    ]);
  });

  it("returns violations in a stable order", () => {
    const p = plan(
      session("b", 2, "07:00", "08:00"),
      session("a", 1, "07:00", "08:00"),
    );
    expect(validate(p, context())).toEqual(validate(p, context()));
  });

  it("loops over whatever rules it is given", () => {
    const always: Rule = {
      id: "no-busy-overlap",
      severity: "soft",
      check: (p) =>
        p.sessions.map((s) => ({
          ruleId: "no-busy-overlap",
          severity: "soft",
          sessionIds: [s.id],
          message: "always",
        })),
    };
    const p = plan(session("a", 1, "07:00", "08:00"));
    expect(validate(p, context(), [always])).toHaveLength(1);
    // Soft violations don't make a plan illegal.
    expect(isLegal(p, context(), [always])).toBe(true);
  });
});

describe("canPlace", () => {
  it("says no in a fully booked week, with the reasons", () => {
    const ctx = context({
      busy: [1, 2, 3, 4, 5, 6, 7].map((d) => busy(d, "06:00", "22:00")),
    });
    const result = canPlace(plan(), session("a", 4, "07:00", "08:00"), ctx);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.violations.map((v) => v.ruleId)).toContain(
      "no-busy-overlap",
    );
  });

  it("says no when there are no windows at all", () => {
    const ctx = context({ windows: [] });
    expect(canPlace(plan(), session("a", 1, "07:00", "08:00"), ctx).ok).toBe(
      false,
    );
  });

  it("allows the one free slot, and only that", () => {
    const ctx = context(
      {
        windows: [{ day: 3, start: "18:00", end: "19:00" }],
        busy: [busy(3, "09:00", "17:45")],
      },
      {},
      { sessionLengthMin: 60 },
    );
    expect(canPlace(plan(), session("a", 3, "18:00", "19:00"), ctx)).toEqual({
      ok: true,
    });
    expect(canPlace(plan(), session("a", 4, "18:00", "19:00"), ctx).ok).toBe(
      false,
    );
  });

  it("rejects a hard session right after another", () => {
    const ctx = context({}, {}, { sessionLengthMin: 60 });
    const existing = plan(session("a", 1, "07:00", "08:00", "strength"));
    const result = canPlace(
      existing,
      session("b", 2, "07:00", "08:00", "cardio"),
      ctx,
    );
    expect(!result.ok && result.violations.map((v) => v.ruleId)).toEqual([
      "no-back-to-back-hard-sessions",
    ]);
    expect(
      canPlace(existing, session("b", 2, "07:00", "08:00", "mobility"), ctx),
    ).toEqual({ ok: true });
  });

  it("ignores problems the new session isn't part of", () => {
    // Already four days in a row: that isn't the candidate's fault. The request
    // is five mobility sessions of 60 min, so the sessions themselves are fine.
    const ctx = context(
      {},
      {
        goalMix: {
          strength: [],
          endurance: [],
          general: Array(7).fill("mobility"),
        },
      },
      { sessionsPerWeek: 5, sessionLengthMin: 60 },
    );
    const existing = plan(
      ...[1, 2, 3, 4].map((d) =>
        session(`d${d}`, d, "07:00", "08:00", "mobility"),
      ),
    );
    expect(
      canPlace(existing, session("x", 6, "07:00", "08:00", "mobility"), ctx),
    ).toEqual({ ok: true });
  });

  it("doesn't change the plan it was given", () => {
    const existing = plan(session("a", 1, "07:00", "08:00"));
    const before = structuredClone(existing);
    canPlace(existing, session("b", 3, "07:00", "08:00"), context());
    expect(existing).toEqual(before);
  });
});

describe("validate with malformed sessions", () => {
  it("reports a bad time as a violation instead of throwing", () => {
    const bad = plan(session("a", 1, "25:00", "25:45"));
    expect(() => validate(bad, context())).not.toThrow();
    const found = validate(bad, context());
    expect(found.some((v) => v.ruleId === "plan-matches-request")).toBe(true);
    expect(isLegal(bad, context())).toBe(false);
  });

  it("rejects a plan with one of three sessions and no unmet reason", () => {
    const short = plan(session("a", 1, "06:00", "06:45"));
    expect(isLegal(short, context())).toBe(false);
    expect(
      isLegal(short, {
        ...context(),
        unmet: [
          { type: "cardio", reason: "x" },
          { type: "mobility", reason: "x" },
        ],
      }),
    ).toBe(true);
  });
});

describe("validateResult", () => {
  it("passes the unmet list of a partial result to the rules", () => {
    const ctx = context({
      windows: [{ day: 4, start: "07:00", end: "08:00" }],
    });
    const result = schedule(ctx.input);
    expect(result.status).toBe("partial");
    expect(validateResult(result, ctx.input, ctx.config)).toEqual([]);
  });
});
