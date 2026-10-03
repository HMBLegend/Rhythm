// Times in the engine are local wall-clock "HH:MM" strings, the same format as
// routine.ts. Rules compare them as minutes after midnight.

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const MINUTES_PER_DAY = 24 * 60;

export function toMinutes(time: string): number {
  const match = HHMM.exec(time);
  if (!match) throw new Error(`Not an HH:MM time: "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function toTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new Error(`Not a minute within one day: ${minutes}`);
  }
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
