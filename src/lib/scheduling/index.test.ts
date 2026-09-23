import { describe, expect, it } from "vitest";
import { DAYS_PER_WEEK } from "@/lib/scheduling";

describe("scheduling engine", () => {
  it("is wired into the test harness", () => {
    expect(DAYS_PER_WEEK).toBe(7);
  });
});
