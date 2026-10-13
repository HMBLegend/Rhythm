// Turns an EngineInput into a weekly plan. The scheduler only decides where to
// try sessions; whether a placement is allowed is always the validator's call,
// so this file holds no rule logic of its own.
import {
  ENGINE_CONFIG,
  sessionMix,
  type EngineConfig,
  type RuleId,
} from "./config";
import { createRules } from "./rules";
import { dayName, toMinutes, toTime } from "./time";
import type {
  EngineInput,
  PlanResult,
  Rule,
  RuleContext,
  Session,
  SessionType,
  UnmetReason,
  WeeklyPlan,
} from "./types";
import { canPlace } from "./validator";

// ISO weekdays, Monday first.
const WEEK = [1, 2, 3, 4, 5, 6, 7];

type Wanted = { id: string; type: SessionType };

type Search = {
  ctx: RuleContext;
  rules: Rule[];
  // Shared across one search, so an impossible week can't run forever.
  nodesLeft: number;
};

export function schedule(
  input: EngineInput,
  config: EngineConfig = ENGINE_CONFIG,
): PlanResult {
  const { sessionLengthMin } = input;
  if (!Number.isInteger(sessionLengthMin) || sessionLengthMin < 1) {
    throw new Error(`Can't plan ${sessionLengthMin} min sessions`);
  }
  const wanted: Wanted[] = sessionMix(
    input.goal,
    input.sessionsPerWeek,
    config,
  ).map((type, i) => ({ id: `s${i + 1}`, type }));
  const ctx: RuleContext = { input, config };
  const rules = createRules(config);

  const all = place(wanted, ctx, rules);
  if (all) return { status: "ok", plan: toPlan(all) };

  // The whole week doesn't fit. Keep sessions in priority order, adding each
  // one only if the plan can still be completed with it.
  let kept: Session[] = [];
  const unmetTypes: SessionType[] = [];
  const keptWanted: Wanted[] = [];
  for (const w of wanted) {
    const attempt = place([...keptWanted, w], ctx, rules);
    if (attempt) {
      keptWanted.push(w);
      kept = attempt;
    } else {
      unmetTypes.push(w.type);
    }
  }
  const plan = toPlan(kept);
  const unmet: UnmetReason[] = unmetTypes.map((type) => ({
    type,
    reason: whyUnmet(type, plan, ctx, rules),
  }));
  return { status: "partial", plan, unmet };
}

// Depth-first search: place sessions one at a time, undoing a choice when it
// leaves no legal spot for a later session. Returns null if nothing works.
function place(
  wanted: Wanted[],
  ctx: RuleContext,
  rules: Rule[],
): Session[] | null {
  const search: Search = { ctx, rules, nodesLeft: ctx.config.searchNodeLimit };
  return extend([], wanted, search);
}

function extend(
  placed: Session[],
  remaining: Wanted[],
  search: Search,
): Session[] | null {
  const [next, ...rest] = remaining;
  if (!next) return placed;
  if (--search.nodesLeft < 0) return null;
  // Sessions of the same type are interchangeable, so only try each one after
  // the previous one of its type. Otherwise the search revisits the same week
  // in every order.
  const previous = placed.findLast((s) => s.type === next.type);
  for (const candidate of candidates(next, placed, search)) {
    if (previous && !isAfter(candidate, previous)) continue;
    const found = extend([...placed, candidate], rest, search);
    if (found) return found;
  }
  return null;
}

function isAfter(a: Session, b: Session) {
  return (a.day - b.day || toMinutes(a.start) - toMinutes(b.start)) > 0;
}

// At most one candidate per day: the earliest legal start that day. Days are
// tried furthest from existing sessions first, so the week spreads out, then
// earliest day first so the order is always the same.
function candidates(
  w: Wanted,
  placed: Session[],
  { ctx, rules }: Search,
): Session[] {
  const plan = { sessions: placed };
  const usedDays = placed.map((s) => s.day);
  const spread = (day: number) =>
    usedDays.length === 0
      ? 0
      : Math.min(...usedDays.map((d) => Math.abs(d - day)));
  const days = [...WEEK].sort((a, b) => spread(b) - spread(a) || a - b);
  const found: Session[] = [];
  for (const day of days) {
    for (const start of startTimes(day, placed, ctx)) {
      const candidate = session(w, day, start, ctx.input.sessionLengthMin);
      if (canPlace(plan, candidate, ctx, rules).ok) {
        found.push(candidate);
        break;
      }
    }
  }
  return found;
}

// Start times worth trying on one day, earliest first. With interval rules
// like ours, the earliest legal start is always either the start of a window
// or the first minute after a busy block or session plus the buffer, so those
// are the only times tried. A future rule about clock times (say, "not before
// 07:00") would need its own anchor here.
function startTimes(
  day: number,
  placed: Session[],
  { input, config }: RuleContext,
) {
  const length = input.sessionLengthMin;
  const after = [
    ...input.availability.busy.filter((b) => b.day === day),
    ...placed.filter((s) => s.day === day),
  ].map((r) => toMinutes(r.end) + config.bufferMin);
  const times = new Set<number>();
  for (const w of input.availability.windows.filter((w) => w.day === day)) {
    const from = toMinutes(w.start);
    const lastStart = toMinutes(w.end) - length;
    for (const t of [from, ...after]) {
      if (t >= from && t <= lastStart) times.add(t);
    }
  }
  return [...times].sort((a, b) => a - b);
}

function session(
  w: Wanted,
  day: number,
  start: number,
  length: number,
): Session {
  const range = { day, start: toTime(start), end: toTime(start + length) };
  return {
    ...w,
    ...range,
    reason: `${capitalise(w.type)} on ${dayName(day)} ${range.start}-${range.end}: the earliest time that day that fits your windows and keeps every rule.`,
  };
}

// Sessions in day and time order, so a plan always reads the same way.
function toPlan(sessions: Session[]): WeeklyPlan {
  return {
    sessions: [...sessions].sort(
      (a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start),
    ),
  };
}

const RULE_PHRASES: Record<RuleId, string> = {
  "no-busy-overlap": "your busy times",
  "fits-free-window-with-buffer": "the buffer between commitments",
  "max-consecutive-training-days": "the limit on training days in a row",
  "no-back-to-back-hard-sessions": "the rest day between hard sessions",
  "respect-preferred-times-and-days": "your training windows",
};

// One line on why a session couldn't go anywhere in the final plan.
function whyUnmet(
  type: SessionType,
  plan: WeeklyPlan,
  ctx: RuleContext,
  rules: Rule[],
): string {
  const { windows } = ctx.input.availability;
  const length = ctx.input.sessionLengthMin;
  if (windows.length === 0) {
    return `No ${type} session: you have no training windows this week.`;
  }
  if (windows.every((w) => toMinutes(w.end) - toMinutes(w.start) < length)) {
    return `No ${type} session: none of your training windows is long enough for ${length} min.`;
  }
  const blocking = new Set<RuleId>();
  const probe: Wanted = { id: "unmet", type };
  for (const day of WEEK) {
    for (const start of startTimes(day, plan.sessions, ctx)) {
      const check = canPlace(
        plan,
        session(probe, day, start, length),
        ctx,
        rules,
      );
      if (!check.ok) for (const v of check.violations) blocking.add(v.ruleId);
    }
  }
  const reasons = [...blocking].sort().map((id) => RULE_PHRASES[id]);
  return reasons.length === 0
    ? `No ${type} session: there's no free time left in your windows this week.`
    : `No ${type} session: every free time left clashes with ${listOr(reasons)}.`;
}

function listOr(items: string[]) {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
