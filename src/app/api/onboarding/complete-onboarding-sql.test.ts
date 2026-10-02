import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  commitmentSchema,
  onboardingSchema,
  windowSchema,
} from "@/lib/scheduling/routine";

// public.complete_onboarding reads the payload by field name, repeating the
// names in routine.ts. Nothing runs that SQL in tests, so this checks the
// names in the newest migration that defines it still match the schema.
// A rename on one side only would otherwise save nulls or fail at runtime.

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

function latestFunctionSql() {
  const file = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .reverse()
    .find((name) =>
      readFileSync(join(MIGRATIONS, name), "utf8").includes(
        "function public.complete_onboarding(",
      ),
    );
  if (!file) throw new Error("No migration defines complete_onboarding");
  return readFileSync(join(MIGRATIONS, file), "utf8");
}

// Field names read from each JSON variable, e.g. payload ->> 'goal'.
function fieldsReadFrom(sql: string, variable: string) {
  const pattern = new RegExp(`\\b${variable}\\s*->>?\\s*'(\\w+)'`, "g");
  return new Set([...sql.matchAll(pattern)].map((match) => match[1]!));
}

const sorted = (keys: Iterable<string>) => [...keys].sort();

describe("complete_onboarding SQL", () => {
  const sql = latestFunctionSql();

  it("reads every top-level field of the routine, and no others", () => {
    expect(sorted(fieldsReadFrom(sql, "payload"))).toEqual(
      sorted(Object.keys(onboardingSchema.shape)),
    );
  });

  it("reads every commitment field, and no others", () => {
    expect(sorted(fieldsReadFrom(sql, "commitment"))).toEqual(
      sorted(Object.keys(commitmentSchema.shape)),
    );
  });

  it("reads every window field, and no others", () => {
    expect(sorted(fieldsReadFrom(sql, "window_"))).toEqual(
      sorted(Object.keys(windowSchema.shape)),
    );
  });
});
