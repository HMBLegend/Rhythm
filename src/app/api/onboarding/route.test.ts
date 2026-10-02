import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Stand-in for the Supabase server client: each test sets who is logged in
// and what the database function returns.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

const valid = {
  goal: "endurance",
  experience: "intermediate",
  sessionsPerWeek: 4,
  sessionLengthMin: 30,
  commitments: [
    {
      label: " Work ",
      days: [1, 2],
      start: "09:00",
      end: "17:00",
      movable: false,
    },
  ],
  windows: [{ day: 1, start: "18:00", end: "19:00" }],
  equipment: [],
  avoid: [],
  avoidNote: "",
  timezone: "Europe/London",
};

function post(body: unknown, contentType = "application/json") {
  return POST(
    new Request("http://localhost/api/onboarding", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("POST /api/onboarding", () => {
  it("returns 401 when there is no verified session, before reading the body", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    });
    const response = await post(valid);
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const response = await post("{not json");
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 unless the content type is JSON", async () => {
    const response = await post(JSON.stringify(valid), "text/plain");
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 with the failing fields for invalid input", async () => {
    const response = await post({ ...valid, sessionsPerWeek: 9 });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues).toEqual([
      expect.objectContaining({ path: "sessionsPerWeek" }),
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a user_id in the body instead of trusting it", async () => {
    const response = await post({ ...valid, user_id: "someone-else" });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("saves the validated routine with one database call and returns 201", async () => {
    const response = await post(valid);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0]!;
    expect(fn).toBe("complete_onboarding");
    // The parsed value is sent (label trimmed), and it carries no user id:
    // the database takes that from the session.
    expect(args.payload.commitments[0].label).toBe("Work");
    expect(args.payload).not.toHaveProperty("user_id");
  });

  it.each(["PT409", "23505"])(
    "returns 409 when the user has already onboarded (%s)",
    async (code) => {
      rpc.mockResolvedValue({
        data: null,
        error: { code, message: "Already onboarded" },
      });
      const response = await post(valid);
      expect(response.status).toBe(409);
    },
  );

  it.each(["23514", "23P01", "22023"])(
    "returns 400 when the database rejects the answers (%s)",
    async (code) => {
      rpc.mockResolvedValue({
        data: null,
        error: { code, message: "violates constraint secret_name" },
      });
      const response = await post(valid);
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("secret_name");
    },
  );

  it("returns 500 without leaking database details", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "relation secret_table is broken" },
    });
    const response = await post(valid);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret_table");
  });
});
