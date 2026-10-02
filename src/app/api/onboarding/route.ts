import { onboardingSchema } from "@/lib/scheduling/routine";
import { createClient } from "@/lib/supabase/server";

// Error codes from public.complete_onboarding: PT409 when a profile exists,
// 23505 if two saves race and the second hits the profile's primary key.
const ALREADY_ONBOARDED = new Set(["PT409", "23505"]);
// The database's own rules turning the answers down: a check constraint (e.g.
// an unknown time zone), overlapping windows (exclusion constraint), or a
// payload check in the function. The schema should catch these first.
const REJECTED_BY_DATABASE = new Set(["23514", "23P01", "22023"]);

function error(status: number, message: string, extra?: object) {
  return Response.json({ error: message, ...extra }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // getUser() asks Supabase Auth to verify the session token, so a forged or
  // expired cookie is rejected. The user id is never read from the body.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error(401, "You need to be logged in.");

  // Only JSON is accepted. A cross-site HTML form can't send it, which is part
  // of the protection against another site submitting this on a user's behalf.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return error(400, "Send the answers as JSON.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "The request body isn't valid JSON.");
  }

  const result = onboardingSchema.safeParse(body);
  if (!result.success) {
    return error(400, "Some answers are invalid.", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // One call, one transaction: everything is saved or nothing is.
  // The database takes the owner from the session via auth.uid().
  const { error: dbError } = await supabase.rpc("complete_onboarding", {
    payload: result.data,
  });
  if (dbError) {
    if (ALREADY_ONBOARDED.has(dbError.code)) {
      return error(409, "You've already completed onboarding.");
    }
    if (REJECTED_BY_DATABASE.has(dbError.code)) {
      return error(400, "Some answers are invalid.");
    }
    // Log the details for debugging, but don't show database internals to the client.
    console.error("complete_onboarding failed", dbError);
    return error(500, "Couldn't save your answers. Please try again.");
  }

  return Response.json({ ok: true }, { status: 201 });
}
