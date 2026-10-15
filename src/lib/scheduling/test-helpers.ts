// Small builders for engine tests. Not exported from index.ts.
import { ENGINE_CONFIG, type EngineConfig } from "./config";
import type {
  Availability,
  EngineInput,
  RuleContext,
  Session,
  SessionType,
  WeeklyPlan,
} from "./types";

export function session(
  id: string,
  day: number,
  start: string,
  end: string,
  type: SessionType = "strength",
): Session {
  return { id, day, start, end, type, reason: "test" };
}

export function plan(...sessions: Session[]): WeeklyPlan {
  return { sessions };
}

// Every day 06:00-22:00 free, nothing busy, unless overridden.
export function context(
  availability: Partial<Availability> = {},
  config: Partial<EngineConfig> = {},
  input: Partial<Omit<EngineInput, "availability">> = {},
): RuleContext {
  return {
    input: {
      goal: "general",
      sessionsPerWeek: 3,
      sessionLengthMin: 45,
      ...input,
      availability: {
        windows: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
          day,
          start: "06:00",
          end: "22:00",
        })),
        busy: [],
        ...availability,
      },
    },
    config: { ...ENGINE_CONFIG, ...config },
  };
}

export function busy(day: number, start: string, end: string) {
  return { day, start, end, label: "Work", movable: false };
}
