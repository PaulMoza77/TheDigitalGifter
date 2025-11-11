"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();

  async function handleGoogle() {
    try {
      await signIn("google");
    } catch (e) {
      console.error("Google sign-in failed:", e);
      toast.error(
        [
          "Sign-in error. Verifică:",
          "1) Redirect URI: https://giddy-swan-737.convex.app/auth/callback/google",
          "2) Origin: https://app.thedigitalgifter.com",
          "3) Test users pe OAuth consent screen",
          "4) GOOGLE_CLIENT_ID / SECRET în Convex",
        ].join("\n")
      );
    }
  }

  return (
    <button
      type="button"
      className="auth-button bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
      onClick={handleGoogle}
    >
      Sign in with Google
    </button>
  );
}
