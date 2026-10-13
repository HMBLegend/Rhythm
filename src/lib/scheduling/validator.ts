// The single source of truth for what a legal plan is. The scheduler, re-plan
// and (in Phase 6) AI-proposed changes all ask this module, and it only loops
// over the rule list: it has no rule logic of its own.
import { createRules } from "./rules";
import type {
  Rule,
  RuleContext,
  Session,
  Violation,
  WeeklyPlan,
} from "./types";

export function validate(
  plan: WeeklyPlan,
  ctx: RuleContext,
  rules: Rule[] = createRules(ctx.config),
): Violation[] {
  return rules.flatMap((rule) => rule.check(plan, ctx));
}

export function isLegal(
  plan: WeeklyPlan,
  ctx: RuleContext,
  rules?: Rule[],
): boolean {
  return validate(plan, ctx, rules).every((v) => v.severity !== "hard");
}

export type PlacementCheck =
  { ok: true } | { ok: false; violations: Violation[] };

// Whether `candidate` can be added to `plan`. Only hard violations involving
// the candidate count, so a problem already in the plan doesn't block it.
export function canPlace(
  plan: WeeklyPlan,
  candidate: Session,
  ctx: RuleContext,
  rules?: Rule[],
): PlacementCheck {
  const next: WeeklyPlan = { sessions: [...plan.sessions, candidate] };
  const violations = validate(next, ctx, rules).filter(
    (v) => v.severity === "hard" && v.sessionIds.includes(candidate.id),
  );
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
