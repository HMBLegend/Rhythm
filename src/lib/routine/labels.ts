import type {
  AVOID,
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
} from "@/lib/scheduling/routine";

// Display text for the stored values. Kept apart from the schema so wording
// can change without touching validation or the database.

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dayName(day: number) {
  return DAY_NAMES[day - 1] ?? "?";
}

export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  strength: "Get stronger",
  endurance: "Build endurance",
  general: "General fitness",
};

export const EXPERIENCE_LABELS: Record<
  (typeof EXPERIENCE_LEVELS)[number],
  string
> = {
  beginner: "New to training",
  intermediate: "Train now and then",
  advanced: "Train regularly",
};

export const EQUIPMENT_LABELS: Record<(typeof EQUIPMENT)[number], string> = {
  dumbbells: "Dumbbells",
  kettlebells: "Kettlebells",
  barbell: "Barbell",
  resistance_bands: "Resistance bands",
  pull_up_bar: "Pull-up bar",
  bench: "Bench",
  cardio_machine: "Cardio machine",
  gym_machines: "Gym machines",
};

export const AVOID_LABELS: Record<(typeof AVOID)[number], string> = {
  running: "Running",
  jumping: "Jumping",
  overhead: "Overhead lifts",
  kneeling: "Kneeling",
  floor_work: "Floor work",
  heavy_lifting: "Heavy lifting",
};

export function label(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}
