import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG, RULE_IDS, sessionMix } from "@/lib/scheduling/config";
import { GOALS } from "@/lib/scheduling/routine";

describe("ENGINE_CONFIG", () => {
  it("has the agreed defaults", () => {
    expect(ENGINE_CONFIG.bufferMin).toBe(15);
    expect(ENGINE_CONFIG.maxConsecutiveTrainingDays).toBe(3);
    expect(ENGINE_CONFIG.hardSessionTypes).toEqual(["strength", "cardio"]);
  });

  it("lists the five starter rules, all hard for now", () => {
    expect(RULE_IDS).toEqual([
      "no-busy-overlap",
      "fits-free-window-with-buffer",
      "max-consecutive-training-days",
      "no-back-to-back-hard-sessions",
      "respect-preferred-times-and-days",
    ]);
    for (const id of RULE_IDS) {
      expect(ENGINE_CONFIG.severity[id]).toBe("hard");
    }
  });
});

describe("sessionMix", () => {
  it("returns exactly sessionsPerWeek sessions for every goal", () => {
    for (const goal of GOALS) {
      for (let n = 1; n <= 7; n++) {
        expect(sessionMix(goal, n)).toHaveLength(n);
      }
    }
  });

  it("leans towards the goal", () => {
    const count = (types: string[], type: string) =>
      types.filter((t) => t === type).length;
    const strength = sessionMix("strength", 4);
    expect(count(strength, "strength")).toBeGreaterThan(
      count(strength, "cardio"),
    );
    const endurance = sessionMix("endurance", 4);
    expect(count(endurance, "cardio")).toBeGreaterThan(
      count(endurance, "strength"),
    );
    expect(new Set(sessionMix("general", 3))).toEqual(
      new Set(["strength", "cardio", "mobility"]),
    );
  });

  it("gives the same answer every time", () => {
    expect(sessionMix("general", 5)).toEqual(sessionMix("general", 5));
  });

  it("rejects a count outside 1-7", () => {
    for (const bad of [0, 8, 2.5]) {
      expect(() => sessionMix("general", bad)).toThrow();
    }
  });
});
