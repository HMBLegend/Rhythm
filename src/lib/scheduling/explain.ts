// One-line, human-readable reasons for every placement, move and drop. This is
// the audit trail the Phase 6 approval flow shows the user. Explanations only
// describe a plan; they never change one, and they ask the validator rather
// than repeating rule logic.
import { RULE_IDS, type RuleId } from "./config";
import { createRules } from "./rules";
import { startTimes, WEEK } from "./slots";
import { dayName, toMinutes, toTime } from "./time";
import type {
  Rule,
  RuleContext,
  Session,
  SessionType,
  WeeklyPlan,
} from "./types";
import { canPlace } from "./validator";

// Why a placed session is where it is, e.g. "Strength on Mon 06:00-06:45: at
// the start of your Mon window; your only session this week."
export function explainPlacement(
  session: Session,
  plan: WeeklyPlan,
  ctx: RuleContext,
): string {
  return `${capitalise(session.type)} on ${dayName(session.day)} ${session.start}-${session.end}: ${why(session, plan, ctx)}`;
}

// Why a session moved (or stayed) during a re-plan. `plan` is the plan after
// the move.
export function explainMove(
  from: Session,
  to: Session,
  plan: WeeklyPlan,
  ctx: RuleContext,
): string {
  const stayed = from.day === to.day && from.start === to.start;
  const what = stayed
    ? `Kept ${to.type} on ${dayName(to.day)} ${to.start}`
    : `Moved ${to.type} from ${dayName(from.day)} ${from.start} to ${dayName(to.day)} ${to.start}`;
  return `${what}: ${why(to, plan, ctx)}`;
}

// Why a session of `type` couldn't go anywhere in `plan`, day by day, with
// days that share a reason grouped together.
export function explainUnmet(
  type: SessionType,
  plan: WeeklyPlan,
  ctx: RuleContext,
  rules: Rule[] = createRules(ctx.config),
): string {
  const lead = `Couldn't fit a ${type} session`;
  const { windows } = ctx.input.availability;
  const length = ctx.input.sessionLengthMin;
  if (windows.length === 0) {
    return `${lead}: you have no training windows this week.`;
  }
  if (windows.every((w) => toMinutes(w.end) - toMinutes(w.start) < length)) {
    return `${lead}: none of your training windows is long enough for ${length} min.`;
  }

  const groups = new Map<DayReason, number[]>();
  for (const day of WEEK) {
    const reason = dayReason(day, type, plan, ctx, rules);
    if (reason) groups.set(reason, [...(groups.get(reason) ?? []), day]);
  }
  if (groups.size === 0) {
    return `${lead}: no spot was found that keeps every rule.`;
  }
  const parts = [...groups].map(([reason, days]) => {
    const many = days.length > 1;
    return `${days.map(dayName).join(", ")} ${DAY_PHRASES[reason](many)}`;
  });
  return `${lead}: ${parts.join("; ")}.`;
}

// The time of day, then how the day sits in the week.
function why(session: Session, plan: WeeklyPlan, ctx: RuleContext) {
  return `${timeReason(session, plan, ctx)}; ${spacingReason(session, plan)}.`;
}

function timeReason(
  session: Session,
  plan: WeeklyPlan,
  { input, config }: RuleContext,
) {
  const start = toMinutes(session.start);
  const sameDay = (r: { day: number }) => r.day === session.day;
  if (
    input.availability.windows.some(
      (w) => sameDay(w) && toMinutes(w.start) === start,
    )
  ) {
    return `at the start of your ${dayName(session.day)} window`;
  }
  const endsBefore = (r: { end: string }) =>
    toMinutes(r.end) + config.bufferMin === start;
  const block = input.availability.busy.find(
    (b) => sameDay(b) && endsBefore(b),
  );
  if (block) {
    return `right after ${block.label} ends at ${block.end}, with a ${config.bufferMin} min buffer`;
  }
  const before = plan.sessions.find(
    (s) => s.id !== session.id && sameDay(s) && endsBefore(s),
  );
  if (before) {
    return `right after your ${before.type} session, with a ${config.bufferMin} min buffer`;
  }
  return `inside your ${dayName(session.day)} window`;
}

function spacingReason(session: Session, plan: WeeklyPlan) {
  const others = plan.sessions.filter((s) => s.id !== session.id);
  const sameDay = others.find((s) => s.day === session.day);
  if (sameDay) return `same day as your ${sameDay.type} session`;
  if (others.length === 0) return "your only session this week";
  const days = Math.min(...others.map((s) => Math.abs(s.day - session.day)));
  return `${days} ${days === 1 ? "day" : "days"} from your nearest other session`;
}

type DayReason =
  "no-window" | "no-time" | "in-a-row" | "next-to-hard" | "outside";

const DAY_PHRASES: Record<DayReason, (many: boolean) => string> = {
  "no-window": (many) => `${many ? "have" : "has"} no training window`,
  "no-time": (many) => `${many ? "have" : "has"} no free time left`,
  "in-a-row": () => "would make too many training days in a row",
  "next-to-hard": (many) =>
    `${many ? "are" : "is"} too close to a hard session`,
  outside: (many) => `${many ? "are" : "is"} outside your training windows`,
};

const RULE_TO_DAY_REASON: Record<RuleId, DayReason> = {
  "no-busy-overlap": "no-time",
  "fits-free-window-with-buffer": "no-time",
  "max-consecutive-training-days": "in-a-row",
  "no-back-to-back-hard-sessions": "next-to-hard",
  "respect-preferred-times-and-days": "outside",
  // About the plan as a whole, never one day; kept only so the table is total.
  "plan-matches-request": "no-time",
};

// Why `type` can't go on `day`, or null if it can. When every start time that
// day breaks the same rule, that rule is the reason; rules are tried in the
// config's order, so the answer is the same every time.
function dayReason(
  day: number,
  type: SessionType,
  plan: WeeklyPlan,
  ctx: RuleContext,
  rules: Rule[],
): DayReason | null {
  if (!ctx.input.availability.windows.some((w) => w.day === day)) {
    return "no-window";
  }
  const starts = startTimes(day, plan.sessions, ctx);
  if (starts.length === 0) return "no-time";
  const broken: Set<RuleId>[] = [];
  for (const start of starts) {
    const probe: Session = {
      id: "unmet",
      type,
      day,
      start: toTime(start),
      end: toTime(start + ctx.input.sessionLengthMin),
      reason: "",
    };
    const check = canPlace(plan, probe, ctx, rules);
    if (check.ok) return null;
    broken.push(new Set(check.violations.map((v) => v.ruleId)));
  }
  const everywhere = RULE_IDS.find((id) => broken.every((set) => set.has(id)));
  const first = everywhere ?? RULE_IDS.find((id) => broken[0]?.has(id));
  return first ? RULE_TO_DAY_REASON[first] : "no-time";
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
