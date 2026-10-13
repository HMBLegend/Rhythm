import { describe, expect, it } from "vitest";
import {
  explainMove,
  explainPlacement,
  explainUnmet,
} from "@/lib/scheduling/explain";
import { schedule } from "@/lib/scheduling/scheduler";
import { busy, context, plan, session } from "@/lib/scheduling/test-helpers";

function window(day: number, start: string, end: string) {
  return { day, start, end };
}

describe("explainPlacement", () => {
  it("says a session starts at the start of its window", () => {
    const s = session("a", 1, "06:00", "06:45");
    expect(explainPlacement(s, plan(s), context())).toBe(
      "Strength on Mon 06:00-06:45: at the start of your Mon window; your only session this week.",
    );
  });

  it("names the busy block a session follows, and the buffer", () => {
    const ctx = context({ busy: [busy(2, "06:00", "17:00")] });
    const s = session("a", 2, "17:15", "18:00", "cardio");
    expect(explainPlacement(s, plan(s), ctx)).toContain(
      "right after Work ends at 17:00, with a 15 min buffer",
    );
  });

  it("names the session it follows on the same day", () => {
    const first = session("a", 3, "06:00", "06:45", "strength");
    const second = session("b", 3, "07:00", "07:45", "mobility");
    expect(explainPlacement(second, plan(first, second), context())).toBe(
      "Mobility on Wed 07:00-07:45: right after your strength session, with a 15 min buffer; same day as your strength session.",
    );
  });

  it("says how far it is from the nearest other session", () => {
    const mon = session("a", 1, "06:00", "06:45");
    const thu = session("b", 4, "06:00", "06:45", "cardio");
    expect(explainPlacement(thu, plan(mon, thu), context())).toContain(
      "3 days from your nearest other session",
    );
    const tue = session("c", 2, "06:00", "06:45", "mobility");
    expect(explainPlacement(tue, plan(mon, tue), context())).toContain(
      "1 day from your nearest other session",
    );
  });

  it("is always one line", () => {
    const result = schedule(context().input);
    for (const s of result.plan.sessions) {
      expect(s.reason).toBe(explainPlacement(s, result.plan, context()));
      expect(s.reason).not.toContain("\n");
    }
  });
});

describe("explainUnmet", () => {
  it("says when there are no training windows", () => {
    const ctx = context({ windows: [] });
    expect(explainUnmet("cardio", plan(), ctx)).toBe(
      "Couldn't fit a cardio session: you have no training windows this week.",
    );
  });

  it("says when no window is long enough", () => {
    const ctx = context(
      { windows: [window(1, "07:00", "07:30")] },
      {},
      { sessionLengthMin: 45 },
    );
    expect(explainUnmet("strength", plan(), ctx)).toBe(
      "Couldn't fit a strength session: none of your training windows is long enough for 45 min.",
    );
  });

  it("gives the reason for each day, grouping days with the same one", () => {
    // Hard sessions on Mon and Fri; the only other windows are Tue and Thu.
    const s = [1, 5].map((day) =>
      session(`s${day}`, day, "06:00", "06:45", "strength"),
    );
    const ctx = context({
      windows: [1, 2, 4, 5].map((day) => window(day, "06:00", "07:00")),
    });
    expect(explainUnmet("cardio", plan(...s), ctx)).toBe(
      "Couldn't fit a cardio session: Mon, Fri have no free time left; Tue, Thu are too close to a hard session; Wed, Sat, Sun have no training window.",
    );
  });

  it("calls out a run of training days that would be too long", () => {
    // Mon-Wed already train; Thu would be a fourth day in a row.
    const s = [1, 2, 3].map((day) =>
      session(`s${day}`, day, "06:00", "06:45", "mobility"),
    );
    const ctx = context({
      windows: [1, 2, 3, 4].map((day) => window(day, "06:00", "07:00")),
    });
    expect(explainUnmet("mobility", plan(...s), ctx)).toBe(
      "Couldn't fit a mobility session: Mon, Tue, Wed have no free time left; Thu would make too many training days in a row; Fri, Sat, Sun have no training window.",
    );
  });
});

describe("explainMove", () => {
  it("says where a session moved from and why the new spot works", () => {
    const from = session("a", 2, "18:00", "18:45");
    const to = session("a", 3, "06:00", "06:45");
    expect(explainMove(from, to, plan(to), context())).toBe(
      "Moved strength from Tue 18:00 to Wed 06:00: at the start of your Wed window; your only session this week.",
    );
  });

  it("says when a session stays put", () => {
    const s = session("a", 2, "06:00", "06:45");
    expect(explainMove(s, s, plan(s), context())).toBe(
      "Kept strength on Tue 06:00: at the start of your Tue window; your only session this week.",
    );
  });
});

describe("schedule reasons", () => {
  it("explains every dropped session with the day-by-day reason", () => {
    const ctx = context(
      { windows: [window(4, "07:00", "08:00")] },
      {},
      { sessionsPerWeek: 2 },
    );
    const result = schedule(ctx.input);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") return;
    expect(result.unmet).toEqual([
      {
        type: "cardio",
        reason: explainUnmet("cardio", result.plan, ctx),
      },
    ]);
  });
});
