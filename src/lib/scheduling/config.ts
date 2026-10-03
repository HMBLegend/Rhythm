// Every threshold the engine uses lives here. Changing a rule's severity or a
// limit is a one-line change in this file; the rules read it, never a literal.
import type { Goal, SessionType, Severity } from "./types";

export const RULE_IDS = [
  "no-busy-overlap",
  "fits-free-window-with-buffer",
  "max-consecutive-training-days",
  "no-back-to-back-hard-sessions",
  "respect-preferred-times-and-days",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type EngineConfig = {
  // Minutes kept clear between a session and a busy block or another session.
  bufferMin: number;
  maxConsecutiveTrainingDays: number;
  // Types that may not fall on consecutive days.
  hardSessionTypes: readonly SessionType[];
  // What to plan for each goal, in priority order. The first N are used for N
  // sessions a week, so every list has 7 entries.
  goalMix: Readonly<Record<Goal, readonly SessionType[]>>;
  severity: Readonly<Record<RuleId, Severity>>;
};

export const ENGINE_CONFIG: EngineConfig = {
  bufferMin: 15,
  maxConsecutiveTrainingDays: 3,
  hardSessionTypes: ["strength", "cardio"],
  goalMix: {
    strength: [
      "strength",
      "strength",
      "mobility",
      "strength",
      "cardio",
      "strength",
      "mobility",
    ],
    endurance: [
      "cardio",
      "cardio",
      "strength",
      "cardio",
      "mobility",
      "cardio",
      "strength",
    ],
    general: [
      "strength",
      "cardio",
      "mobility",
      "strength",
      "cardio",
      "mobility",
      "strength",
    ],
  },
  severity: {
    "no-busy-overlap": "hard",
    "fits-free-window-with-buffer": "hard",
    "max-consecutive-training-days": "hard",
    "no-back-to-back-hard-sessions": "hard",
    "respect-preferred-times-and-days": "hard",
  },
};

// The session types to plan this week, in priority order.
export function sessionMix(
  goal: Goal,
  sessionsPerWeek: number,
  config: EngineConfig = ENGINE_CONFIG,
): SessionType[] {
  const mix = config.goalMix[goal];
  if (
    !Number.isInteger(sessionsPerWeek) ||
    sessionsPerWeek < 1 ||
    sessionsPerWeek > mix.length
  ) {
    throw new Error(`Can't plan ${sessionsPerWeek} sessions a week`);
  }
  return mix.slice(0, sessionsPerWeek);
}
