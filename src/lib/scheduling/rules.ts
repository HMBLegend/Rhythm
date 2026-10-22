// The rules that define a legal plan. Each is an independent check that only
// reports problems; none of them places or moves anything. Thresholds and
// severities come from config, never from literals here.
import { RULE_IDS, sessionMix, type EngineConfig, type RuleId } from "./config";
import { dayName, parseMinutes, toMinutes } from "./time";
import type {
  Rule,
  RuleContext,
  Session,
  SessionType,
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
      // An actual overlap is no-busy-overlap's to report, so the user sees one
      // message for one problem. Sessions have no overlap rule of their own,
      // so the loop below still reports those.
      const g = gap(s, b);
      if (b.day === s.day && g >= 0 && g < config.bufferMin) {
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

// A day 1-7 and an "HH:MM" start strictly before an "HH:MM" end.
function isWellFormed(s: Session) {
  const start = parseMinutes(s.start);
  const end = parseMinutes(s.end);
  return (
    Number.isInteger(s.day) &&
    s.day >= 1 &&
    s.day <= 7 &&
    start !== null &&
    end !== null &&
    start < end
  );
}

// Whether the placement rules can compare this session: a day 1-7 and times
// that parse. Anything else is left for plan-matches-request to report.
function isComparable(s: Session) {
  return (
    Number.isInteger(s.day) &&
    s.day >= 1 &&
    s.day <= 7 &&
    parseMinutes(s.start) !== null &&
    parseMinutes(s.end) !== null
  );
}

function count<T>(items: T[]) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

// The plan as a whole against what was asked for: distinct ids, sensible days
// and times, the requested session length, and the sessions the goal calls
// for, with any that are missing listed as unmet. Placement rules can't see
// these, and an AI-proposed plan could get them wrong.
const planMatchesRequest: Check = (plan, { input, config, unmet = [] }) => {
  const findings: Finding[] = [];

  for (const [id, n] of count(plan.sessions.map((s) => s.id))) {
    if (n > 1) {
      findings.push({
        sessionIds: [id],
        message: `${n} sessions share the same id "${id}".`,
      });
    }
  }

  for (const s of plan.sessions.filter((s) => !isWellFormed(s))) {
    findings.push({
      sessionIds: [s.id],
      message: `Session "${s.id}" has a day or time that doesn't make sense (day ${s.day}, ${s.start}-${s.end}).`,
    });
  }

  for (const s of plan.sessions.filter(isWellFormed)) {
    const length = toMinutes(s.end) - toMinutes(s.start);
    if (length !== input.sessionLengthMin) {
      findings.push({
        sessionIds: [s.id],
        message: `${describe(s)} is ${length} min; your sessions are ${input.sessionLengthMin} min.`,
      });
    }
  }

  let wanted: SessionType[];
  try {
    wanted = sessionMix(input.goal, input.sessionsPerWeek, config);
  } catch {
    return findings; // The request itself is invalid; not the plan's fault.
  }
  const wantedCount = count(wanted);
  const plannedCount = count(plan.sessions.map((s) => s.type));
  const unmetCount = count(unmet.map((u) => u.type));
  for (const [type, planned] of plannedCount) {
    const surplus = planned - (wantedCount.get(type) ?? 0);
    if (surplus > 0) {
      findings.push({
        sessionIds: plan.sessions
          .filter((s) => s.type === type)
          .slice(-surplus)
          .map((s) => s.id),
        message: `${surplus} extra ${type} ${surplus === 1 ? "session" : "sessions"} planned; your goal doesn't call for ${surplus === 1 ? "it" : "them"}.`,
      });
    }
  }
  for (const [type, wantedN] of wantedCount) {
    const missing =
      wantedN - (plannedCount.get(type) ?? 0) - (unmetCount.get(type) ?? 0);
    if (missing > 0) {
      findings.push({
        sessionIds: [],
        message: `${missing} ${type} ${missing === 1 ? "session is" : "sessions are"} missing from the plan and not listed as unmet.`,
      });
    }
  }
  return findings;
};

const CHECKS: Record<RuleId, Check> = {
  "no-busy-overlap": noBusyOverlap,
  "fits-free-window-with-buffer": fitsFreeWindowWithBuffer,
  "max-consecutive-training-days": maxConsecutiveTrainingDays,
  "no-back-to-back-hard-sessions": noBackToBackHardSessions,
  "respect-preferred-times-and-days": respectPreferredTimesAndDays,
  "plan-matches-request": planMatchesRequest,
};

// Placement rules compare times, so they look only at sessions that have
// valid ones; plan-matches-request is what reports the rest.
function comparable(plan: WeeklyPlan): WeeklyPlan {
  return { sessions: plan.sessions.filter(isComparable) };
}

// The rule list, with each rule's severity taken from config.
export function createRules(config: EngineConfig): Rule[] {
  return RULE_IDS.map((id) => {
    const severity = config.severity[id];
    return {
      id,
      severity,
      check: (plan, ctx) =>
        CHECKS[id](
          id === "plan-matches-request" ? plan : comparable(plan),
          ctx,
        ).map((f) => ({ ruleId: id, severity, ...f })),
    };
  });
}
