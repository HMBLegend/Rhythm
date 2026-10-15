// Where in the week the scheduler looks, shared by the scheduler and the
// explanations so both reason about the same candidate times.
import { toMinutes } from "./time";
import type { RuleContext, Session } from "./types";

// ISO weekdays, Monday first.
export const WEEK = [1, 2, 3, 4, 5, 6, 7];

// Start times worth trying on one day, earliest first. With interval rules
// like ours, the earliest legal start is always either the start of a window
// or the first minute after a busy block or session plus the buffer, so those
// are the only times tried. A future rule about clock times (say, "not before
// 07:00") would need its own anchor here.
export function startTimes(
  day: number,
  placed: Session[],
  { input, config }: RuleContext,
) {
  const length = input.sessionLengthMin;
  const after = [
    ...input.availability.busy.filter((b) => b.day === day),
    ...placed.filter((s) => s.day === day),
  ].map((r) => toMinutes(r.end) + config.bufferMin);
  const times = new Set<number>();
  for (const w of input.availability.windows.filter((w) => w.day === day)) {
    const from = toMinutes(w.start);
    const lastStart = toMinutes(w.end) - length;
    for (const t of [from, ...after]) {
      if (t >= from && t <= lastStart) times.add(t);
    }
  }
  return [...times].sort((a, b) => a - b);
}
