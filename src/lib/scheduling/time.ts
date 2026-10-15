// Times in the engine are local wall-clock "HH:MM" strings, the same format as
// routine.ts. Rules compare them as minutes after midnight.

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const MINUTES_PER_DAY = 24 * 60;

// Minutes after midnight, or null if it isn't a valid "HH:MM". For input that
// hasn't been checked yet, such as a plan an LLM proposed.
export function parseMinutes(time: string): number | null {
  const match = HHMM.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function toMinutes(time: string): number {
  const minutes = parseMinutes(time);
  if (minutes === null) throw new Error(`Not an HH:MM time: "${time}"`);
  return minutes;
}

export function toTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new Error(`Not a minute within one day: ${minutes}`);
  }
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ISO weekday to a short name, for reasons and violation messages.
export function dayName(day: number): string {
  return DAY_NAMES[day - 1] ?? `day ${day}`;
}
