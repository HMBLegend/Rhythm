// Turns an EngineInput into a weekly plan. The scheduler only decides where to
// try sessions; whether a placement is allowed is always the validator's call,
// so this file holds no rule logic of its own.
import { ENGINE_CONFIG, sessionMix, type EngineConfig } from "./config";
import { explainPlacement, explainUnmet } from "./explain";
import { createRules } from "./rules";
import { startTimes, WEEK } from "./slots";
import { toMinutes, toTime } from "./time";
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
  if (all) return { status: "ok", plan: toPlan(all, ctx) };

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
  const plan = toPlan(kept, ctx);
  const unmet: UnmetReason[] = unmetTypes.map((type) => ({
    type,
    reason: explainUnmet(type, plan, ctx, rules),
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
    // Filled in by toPlan once the whole week is settled.
    reason: "",
  };
}

// Sessions in day and time order, so a plan always reads the same way, each
// with its reason. Reasons are written last because they mention neighbouring
// sessions, which only exist once the whole week is placed.
function toPlan(sessions: Session[], ctx: RuleContext): WeeklyPlan {
  const plan = {
    sessions: [...sessions].sort(
      (a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start),
    ),
  };
  return {
    sessions: plan.sessions.map((s) => ({
      ...s,
      reason: explainPlacement(s, plan, ctx),
    })),
  };
}
