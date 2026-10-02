import { describe, expect, it } from "vitest";
import { decideRedirect, safeNext } from "@/lib/auth/routing";

describe("decideRedirect", () => {
  it("sends logged-out users on protected pages to login, remembering the page", () => {
    for (const pathname of ["/onboarding", "/week", "/week/extra"]) {
      expect(decideRedirect({ pathname, isLoggedIn: false })).toBe(
        `/login?next=${encodeURIComponent(pathname)}`,
      );
    }
  });

  it("leaves public pages alone", () => {
    for (const isLoggedIn of [true, false]) {
      expect(decideRedirect({ pathname: "/", isLoggedIn })).toBeNull();
      expect(decideRedirect({ pathname: "/weekly", isLoggedIn })).toBeNull();
    }
    expect(
      decideRedirect({ pathname: "/login", isLoggedIn: false }),
    ).toBeNull();
  });

  it("sends users who haven't onboarded to onboarding", () => {
    expect(
      decideRedirect({
        pathname: "/week",
        isLoggedIn: true,
        isOnboarded: false,
      }),
    ).toBe("/onboarding");
    expect(
      decideRedirect({
        pathname: "/login",
        isLoggedIn: true,
        isOnboarded: false,
      }),
    ).toBe("/onboarding");
    expect(
      decideRedirect({
        pathname: "/onboarding",
        isLoggedIn: true,
        isOnboarded: false,
      }),
    ).toBeNull();
  });

  it("sends onboarded users away from onboarding and login", () => {
    for (const pathname of ["/onboarding", "/login"]) {
      expect(
        decideRedirect({ pathname, isLoggedIn: true, isOnboarded: true }),
      ).toBe("/week");
    }
    expect(
      decideRedirect({
        pathname: "/week",
        isLoggedIn: true,
        isOnboarded: true,
      }),
    ).toBeNull();
  });

  it("only applies login rules when onboarding status is unknown (the proxy)", () => {
    for (const pathname of ["/onboarding", "/week", "/login"]) {
      expect(decideRedirect({ pathname, isLoggedIn: true })).toBeNull();
    }
  });
});

describe("safeNext", () => {
  it("keeps internal app paths", () => {
    expect(safeNext("/week")).toBe("/week");
    expect(safeNext("/onboarding")).toBe("/onboarding");
  });

  it("falls back to /onboarding for anything else, so login can't redirect off-site", () => {
    for (const next of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "week",
      "/api/onboarding",
    ]) {
      expect(safeNext(next)).toBe("/onboarding");
    }
  });
});
