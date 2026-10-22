// Turns an EngineInput into a weekly plan. The scheduler only decides where to
// try sessions; whether a placement is allowed is always the validator's call,
// so this file holds no rule logic of its own.
import { ENGINE_CONFIG, sessionMix, type EngineConfig } from "./config";
import { explainPlacement, explainUnmet } from "./explain";
import { createRules } from "./rules";
import { startTimesFrom, WEEK } from "./slots";
import { parseMinutes, toMinutes, toTime } from "./time";
import type {
  EngineInput,
  PlanResult,
  Rule,
  RuleContext,
  ScheduleOptions,
  Session,
  SessionType,
  UnmetReason,
  WeekPoint,
  WeeklyPlan,
} from "./types";
import { canPlace } from "./validator";

type Wanted = { id: string; type: SessionType };

type Search = {
  ctx: RuleContext;
  rules: Rule[];
  // Kept sessions are fixed, so they never take part in the same-type ordering.
  keptIds: Set<string>;
  from?: WeekPoint;
  // Shared across one search, so an impossible week can't run forever.
  nodesLeft: number;
};

// Plans a week. With options, plans only what's left of it: `keep` sessions
// stay as they are and count towards the mix, and new sessions start at or
// after `from`. Used for a first plan made mid-week and for "rebuild this week".
export function schedule(
  input: EngineInput,
  config: EngineConfig = ENGINE_CONFIG,
  { keep = [], from }: ScheduleOptions = {},
): PlanResult {
  const { sessionLengthMin } = input;
  if (!Number.isInteger(sessionLengthMin) || sessionLengthMin < 1) {
    throw new Error(`Can't plan ${sessionLengthMin} min sessions`);
  }
  if (
    from &&
    !(
      Number.isInteger(from.day) &&
      from.day >= 1 &&
      from.day <= 7 &&
      parseMinutes(from.time) !== null
    )
  ) {
    throw new Error(`Can't plan from day ${from.day} ${from.time}`);
  }
  const wanted = stillWanted(
    sessionMix(input.goal, input.sessionsPerWeek, config),
    keep,
  );
  const ctx: RuleContext = { input, config };
  const rules = createRules(config);
  const keptIds = new Set(keep.map((s) => s.id));
  const place = (w: Wanted[]) =>
    extend([...keep], w, {
      ctx,
      rules,
      keptIds,
      from,
      nodesLeft: config.searchNodeLimit,
    });

  const all = place(wanted);
  if (all) return { status: "ok", plan: toPlan(all, keptIds, ctx) };

  // The whole week doesn't fit. Keep sessions in priority order, adding each
  // one only if the plan can still be completed with it.
  let placed: Session[] = [...keep];
  const unmetTypes: SessionType[] = [];
  const keptWanted: Wanted[] = [];
  for (const w of wanted) {
    const attempt = place([...keptWanted, w]);
    if (attempt) {
      keptWanted.push(w);
      placed = attempt;
    } else {
      unmetTypes.push(w.type);
    }
  }
  const plan = toPlan(placed, keptIds, ctx);
  const unmet: UnmetReason[] = unmetTypes.map((type) => ({
    type,
    reason: explainUnmet(type, plan, ctx, rules, from),
  }));
  return { status: "partial", plan, unmet };
}

// The week's mix minus what the kept sessions already cover, in priority
// order, with ids that don't clash with the kept ones.
function stillWanted(mix: SessionType[], keep: Session[]): Wanted[] {
  const remaining = [...mix];
  for (const s of keep) {
    const i = remaining.indexOf(s.type);
    if (i === -1) {
      throw new Error(
        `Kept ${s.type} session "${s.id}" isn't in this week's session mix`,
      );
    }
    remaining.splice(i, 1);
  }
  const taken = new Set(keep.map((s) => s.id));
  let n = 0;
  return remaining.map((type) => {
    let id: string;
    do id = `s${++n}`;
    while (taken.has(id));
    return { id, type };
  });
}

// Depth-first search: place sessions one at a time, undoing a choice when it
// leaves no legal spot for a later session. Returns null if nothing works.
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
  const previous = placed.findLast(
    (s) => s.type === next.type && !search.keptIds.has(s.id),
  );
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
  { ctx, rules, from }: Search,
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
    for (const start of startTimesFrom(day, placed, ctx, from)) {
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
// new one with its reason. Reasons are written last because they mention
// neighbouring sessions, which only exist once the whole week is placed. Kept
// sessions keep the reason they already have.
function toPlan(
  sessions: Session[],
  keptIds: Set<string>,
  ctx: RuleContext,
): WeeklyPlan {
  const plan = {
    sessions: [...sessions].sort(
      (a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start),
    ),
  };
  return {
    sessions: plan.sessions.map((s) =>
      keptIds.has(s.id) ? s : { ...s, reason: explainPlacement(s, plan, ctx) },
    ),
  };
}
