import { describe, expect, it, vi } from "vitest";
import {
  TDG_SUPABASE_PROJECT_REF,
  warnIfPublicSupabaseConfigLooksBroken,
} from "./env";

function makeAnonJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("warnIfPublicSupabaseConfigLooksBroken", () => {
  it("warns when URL uses the custom supabase subdomain", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    warnIfPublicSupabaseConfigLooksBroken({
      url: "https://supabase.thedigitalgifter.com",
      anon: makeAnonJwt({
        iss: "supabase",
        ref: TDG_SUPABASE_PROJECT_REF,
        role: "anon",
      }),
    });

    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0] || "")).toMatch(
      /supabase\.thedigitalgifter\.com/,
    );
    expect(error).not.toHaveBeenCalled();

    warn.mockRestore();
    error.mockRestore();
  });

  it("errors when anon JWT is missing project ref", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    warnIfPublicSupabaseConfigLooksBroken({
      url: `https://${TDG_SUPABASE_PROJECT_REF}.supabase.co`,
      anon: makeAnonJwt({ iss: "supabase", role: "anon" }),
    });

    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0] || "")).toMatch(/missing role\/ref/i);

    warn.mockRestore();
    error.mockRestore();
  });
});
