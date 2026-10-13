// The rules that define a legal plan. Each is an independent check that only
// reports problems; none of them places or moves anything. Thresholds and
// severities come from config, never from literals here.
import { RULE_IDS, type EngineConfig, type RuleId } from "./config";
import { dayName, toMinutes } from "./time";
import type {
  Rule,
  RuleContext,
  Session,
  TimeRange,
  WeeklyPlan,
} from "./types";

type Finding = { sessionIds: string[]; message: string };
type Check = (plan: WeeklyPlan, ctx: RuleContext) => Finding[];

function compareIds(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Day, then start time, then id, so findings come out in the same order every time.
function inOrder(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) =>
      a.day - b.day ||
      toMinutes(a.start) - toMinutes(b.start) ||
      compareIds(a.id, b.id),
  );
}

// Minutes between two ranges on the same day. Negative means they overlap.
function gap(a: TimeRange, b: TimeRange) {
  return (
    Math.max(toMinutes(a.start), toMinutes(b.start)) -
    Math.min(toMinutes(a.end), toMinutes(b.end))
  );
}

function describe(range: TimeRange) {
  return `${dayName(range.day)} ${range.start}-${range.end}`;
}

const noBusyOverlap: Check = (plan, { input }) =>
  inOrder(plan.sessions).flatMap((s) =>
    input.availability.busy
      .filter((b) => b.day === s.day && gap(s, b) < 0)
      .map((b) => ({
        sessionIds: [s.id],
        message: `${describe(s)} overlaps ${b.label} (${b.start}-${b.end}).`,
      })),
  );

const fitsFreeWindowWithBuffer: Check = (plan, { input, config }) => {
  const sessions = inOrder(plan.sessions);
  const findings: Finding[] = [];
  for (const [i, s] of sessions.entries()) {
    for (const b of input.availability.busy) {
      if (b.day === s.day && gap(s, b) < config.bufferMin) {
        findings.push({
          sessionIds: [s.id],
          message: `${describe(s)} is less than ${config.bufferMin} min from ${b.label} (${b.start}-${b.end}).`,
        });
      }
    }
    for (const other of sessions.slice(i + 1)) {
      if (other.day === s.day && gap(s, other) < config.bufferMin) {
        findings.push({
          sessionIds: [s.id, other.id],
          message: `${describe(s)} and ${describe(other)} are less than ${config.bufferMin} min apart.`,
        });
      }
    }
  }
  return findings;
};

// Runs of training days within this week (Mon-Sun, no wrap-around).
const maxConsecutiveTrainingDays: Check = (plan, { config }) => {
  const sessions = inOrder(plan.sessions);
  const trainingDays = new Set(sessions.map((s) => s.day));
  const findings: Finding[] = [];
  let runStart = 0;
  for (let day = 1; day <= 8; day++) {
    if (trainingDays.has(day)) {
      if (runStart === 0) runStart = day;
      continue;
    }
    if (runStart !== 0) {
      const length = day - runStart;
      if (length > config.maxConsecutiveTrainingDays) {
        findings.push({
          sessionIds: sessions
            .filter((s) => s.day >= runStart && s.day < day)
            .map((s) => s.id),
          message: `${dayName(runStart)}-${dayName(day - 1)} is ${length} training days in a row (max ${config.maxConsecutiveTrainingDays}).`,
        });
      }
      runStart = 0;
    }
  }
  return findings;
};

// Two hard sessions on the same day or on consecutive days.
const noBackToBackHardSessions: Check = (plan, { config }) => {
  const hard = inOrder(plan.sessions).filter((s) =>
    config.hardSessionTypes.includes(s.type),
  );
  const findings: Finding[] = [];
  for (const [i, a] of hard.entries()) {
    for (const b of hard.slice(i + 1)) {
      if (b.day - a.day <= 1) {
        findings.push({
          sessionIds: [a.id, b.id],
          message: `${a.type} on ${dayName(a.day)} and ${b.type} on ${dayName(b.day)} are back to back with no easier day between.`,
        });
      }
    }
  }
  return findings;
};

// Preferred times are the availability windows: a session sits inside one.
const respectPreferredTimesAndDays: Check = (plan, { input }) =>
  inOrder(plan.sessions)
    .filter(
      (s) =>
        toMinutes(s.end) <= toMinutes(s.start) ||
        !input.availability.windows.some(
          (w) =>
            w.day === s.day &&
            toMinutes(w.start) <= toMinutes(s.start) &&
            toMinutes(s.end) <= toMinutes(w.end),
        ),
    )
    .map((s) => ({
      sessionIds: [s.id],
      message: `${describe(s)} isn't inside one of your training windows.`,
    }));

const CHECKS: Record<RuleId, Check> = {
  "no-busy-overlap": noBusyOverlap,
  "fits-free-window-with-buffer": fitsFreeWindowWithBuffer,
  "max-consecutive-training-days": maxConsecutiveTrainingDays,
  "no-back-to-back-hard-sessions": noBackToBackHardSessions,
  "respect-preferred-times-and-days": respectPreferredTimesAndDays,
};

// The rule list, with each rule's severity taken from config.
export function createRules(config: EngineConfig): Rule[] {
  return RULE_IDS.map((id) => {
    const severity = config.severity[id];
    return {
      id,
      severity,
      check: (plan, ctx) =>
        CHECKS[id](plan, ctx).map((f) => ({ ruleId: id, severity, ...f })),
    };
  });
}
