// The engine's data shapes. Plain data only, so a plan can be stored, compared,
// explained, and (in Phase 6) proposed by an LLM and checked by the validator.
import type { EngineConfig, RuleId } from "./config";
import type { Onboarding } from "./routine";

export const SESSION_TYPES = ["strength", "cardio", "mobility"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type Goal = Onboarding["goal"];

// ISO weekday (1 = Monday ... 7 = Sunday) and local "HH:MM" times, as in routine.ts.
export type TimeRange = { day: number; start: string; end: string };

// A fixed commitment on one day. All are hard for now; `movable` is kept so a
// later phase can relax movable ones through config.
export type BusyBlock = TimeRange & { label: string; movable: boolean };

export type Availability = {
  // When the user could train. Sessions must sit inside one of these.
  windows: TimeRange[];
  // When the user can't. Sessions never overlap these.
  busy: BusyBlock[];
};

export type EngineInput = {
  goal: Goal;
  sessionsPerWeek: number;
  sessionLengthMin: number;
  availability: Availability;
};

export type Session = TimeRange & {
  // Stable within a plan, so violations and changes can point at a session.
  id: string;
  type: SessionType;
  // One human-readable line on why it's here (the audit trail).
  reason: string;
};

export type WeeklyPlan = { sessions: Session[] };

export type Severity = "hard" | "soft";

export type Violation = {
  ruleId: RuleId;
  severity: Severity;
  // The sessions involved, so the UI and the scheduler know what to move.
  sessionIds: string[];
  message: string;
};

// A session the week couldn't fit, and why in one line.
export type UnmetReason = { type: SessionType; reason: string };

export type PlanResult =
  | { status: "ok"; plan: WeeklyPlan }
  | { status: "partial"; plan: WeeklyPlan; unmet: UnmetReason[] };

export type RuleContext = {
  input: EngineInput;
  config: EngineConfig;
  // Sessions the plan is known to be missing, with reasons. Without it, every
  // session the request calls for must be in the plan.
  unmet?: UnmetReason[];
};

export type Rule = {
  id: RuleId;
  severity: Severity;
  check: (plan: WeeklyPlan, ctx: RuleContext) => Violation[];
};
