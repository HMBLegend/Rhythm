import { describe, expect, it } from "vitest";
import { toMinutes, toTime } from "@/lib/scheduling/time";

describe("toMinutes", () => {
  it("turns HH:MM into minutes after midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("07:30")).toBe(450);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("rejects anything that isn't a 24-hour HH:MM time", () => {
    for (const bad of ["7:30", "24:00", "09:60", "09:00:00", ""]) {
      expect(() => toMinutes(bad)).toThrow();
    }
  });
});

describe("toTime", () => {
  it("turns minutes after midnight back into HH:MM", () => {
    expect(toTime(0)).toBe("00:00");
    expect(toTime(450)).toBe("07:30");
    expect(toTime(1439)).toBe("23:59");
  });

  it("round-trips with toMinutes", () => {
    for (let m = 0; m < 24 * 60; m += 7) {
      expect(toMinutes(toTime(m))).toBe(m);
    }
  });

  it("rejects minutes outside one day or not whole", () => {
    for (const bad of [-1, 1440, 7.5]) {
      expect(() => toTime(bad)).toThrow();
    }
  });
});
