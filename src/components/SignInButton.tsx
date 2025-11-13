import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

export function SignInButton() {
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
      className="rounded-full px-3 py-2 text-sm border border-white/20 bg-white/10 hover:bg-white/15 transition will-change-transform hover:scale-[1.04] text-white"
      onClick={() => {
        void handleGoogle();
      }}
    >
      Connect Google
    </button>
  );
}
