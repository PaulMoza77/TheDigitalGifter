import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAccountWithEmailPassword, signInWithEmailPassword } from "./emailPassword";

function fakeClient(handlers: {
  signIn?: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
  signUp?: (args: { email: string; password: string }) => Promise<{
    data: { session: { access_token: string } | null };
    error: { message: string } | null;
  }>;
}) {
  return {
    auth: {
      signInWithPassword: handlers.signIn ?? (async () => ({ error: null })),
      signUp: handlers.signUp ?? (async () => ({ data: { session: { access_token: "t" } }, error: null })),
    },
  } as never;
}

describe("email password auth", () => {
  it("does not create an account when sign-in fails", async () => {
    let signedUp = false;
    const client = fakeClient({
      signIn: async () => ({ error: { message: "Invalid login credentials" } }),
      signUp: async () => {
        signedUp = true;
        return { data: { session: null }, error: null };
      },
    });
    const result = await signInWithEmailPassword(client, "A@B.com", "wrong");
    expect(result).toEqual({ ok: false, error: "Invalid login credentials" });
    expect(signedUp).toBe(false);
  });

  it("creates an account only through signUp", async () => {
    const result = await createAccountWithEmailPassword(
      fakeClient({
        signUp: async ({ email }) => {
          expect(email).toBe("a@b.com");
          return { data: { session: null }, error: null };
        },
      }),
      "A@B.com",
      "secret1",
    );
    expect(result).toEqual({ ok: true, needsConfirmation: true });
  });

  it("keeps planner and welcome gates on separate sign-in vs create-account actions", () => {
    const gate = readFileSync(resolve(process.cwd(), "src/features/christmas/planner/ChristmasAuthScreen.tsx"), "utf8");
    const welcome = readFileSync(
      resolve(process.cwd(), "src/features/christmas/planner/ChristmasAuthScreen.tsx"),
      "utf8",
    );
    expect(gate).toContain("signInWithEmailPassword");
    expect(gate).toContain("createAccountWithEmailPassword");
    expect(gate).toContain("Create account");
    expect(gate).toContain("Sign in");
    expect(gate).not.toMatch(/signInWithPassword[\s\S]{0,200}signUp/);
    expect(welcome).toContain("signInWithEmailPassword");
    expect(welcome).toContain("createAccountWithEmailPassword");
    expect(welcome).not.toMatch(/signInWithPassword[\s\S]{0,200}signUp/);
  });
});
