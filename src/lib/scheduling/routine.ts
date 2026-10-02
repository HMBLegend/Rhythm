// A user's weekly routine: the input the scheduling engine plans around.
// These schemas are the single source of truth for what valid input looks like.
// The onboarding form (browser), the API (server) and, later, AI-proposed changes
// all validate with them, so no path can store something the engine would reject.
import { z } from "zod";

export const GOALS = ["strength", "endurance", "general"] as const;
export const EXPERIENCE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
] as const;
// No equipment is an empty list.
export const EQUIPMENT = [
  "dumbbells",
  "kettlebells",
  "barbell",
  "resistance_bands",
  "pull_up_bar",
  "bench",
  "cardio_machine",
  "gym_machines",
] as const;
export const AVOID = [
  "running",
  "jumping",
  "overhead",
  "kneeling",
  "floor_work",
  "heavy_lifting",
] as const;

export const MAX_COMMITMENTS = 20;
export const MAX_WINDOWS = 21;

function isUnique(values: readonly unknown[]) {
  return new Set(values).size === values.length;
}

// ISO weekday: 1 = Monday ... 7 = Sunday, matching the database.
const day = z.number().int().min(1).max(7);

// 24-hour "HH:MM". Zero-padded, so comparing the strings compares the times.
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30");

const endAfterStart = {
  check: (value: { start: string; end: string }) => value.end > value.start,
  params: {
    message: "End must be after start. Split overnight times in two.",
    path: ["end"],
  },
};

export const commitmentSchema = z
  .strictObject({
    label: z.string().trim().min(1, "Give it a name").max(50),
    days: z
      .array(day)
      .min(1, "Pick at least one day")
      .max(7)
      .refine(isUnique, "Each day only once"),
    start: time,
    end: time,
    // Whether the user could shift it if a workout needed the slot.
    movable: z.boolean(),
  })
  .refine(endAfterStart.check, endAfterStart.params);

export const windowSchema = z
  .strictObject({ day, start: time, end: time })
  .refine(endAfterStart.check, endAfterStart.params);

function hasOverlap(windows: z.infer<typeof windowSchema>[]) {
  const sorted = [...windows].sort(
    (a, b) => a.day - b.day || a.start.localeCompare(b.start),
  );
  return sorted.some((current, i) => {
    const next = sorted[i + 1];
    return (
      next !== undefined && next.day === current.day && next.start < current.end
    );
  });
}

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// One schema per onboarding screen, so each screen can be checked on its own.
export const goalStep = z.strictObject({
  goal: z.enum(GOALS, "Pick a goal"),
  experience: z.enum(EXPERIENCE_LEVELS, "Pick your experience"),
});

export const sessionsStep = z.strictObject({
  sessionsPerWeek: z.number().int().min(1).max(7),
  sessionLengthMin: z.number().int().min(10).max(180).multipleOf(5),
});

export const commitmentsStep = z.strictObject({
  commitments: z.array(commitmentSchema).max(MAX_COMMITMENTS),
});

export const windowsStep = z.strictObject({
  windows: z
    .array(windowSchema)
    .min(1, "Add at least one time you could train")
    .max(MAX_WINDOWS)
    .refine(
      (windows) => !hasOverlap(windows),
      "Windows on the same day overlap",
    ),
});

export const preferencesStep = z.strictObject({
  equipment: z.array(z.enum(EQUIPMENT)).refine(isUnique),
  avoid: z.array(z.enum(AVOID)).refine(isUnique),
  avoidNote: z.string().trim().max(200),
});

// The whole routine. Strict, so unexpected keys (such as a user_id) are rejected.
export const onboardingSchema = z.strictObject({
  ...goalStep.shape,
  ...sessionsStep.shape,
  ...commitmentsStep.shape,
  ...windowsStep.shape,
  ...preferencesStep.shape,
  // IANA name, e.g. "Europe/London". Plan times are local to this zone.
  timezone: z.string().refine(isTimeZone, "Unknown time zone"),
});

export type Commitment = z.infer<typeof commitmentSchema>;
export type TrainingWindow = z.infer<typeof windowSchema>;
export type Onboarding = z.infer<typeof onboardingSchema>;
export type OnboardingInput = z.input<typeof onboardingSchema>;
