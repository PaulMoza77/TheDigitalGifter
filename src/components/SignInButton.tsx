import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

export default function SignInButton() {
  const { signIn } = useAuthActions();

  const handleSignIn = async () => {
    try {
      await signIn("google");
    } catch (error) {
      console.error("❌ Sign-in failed:", error);
      toast.error("Sign-in error. Check your Google auth setup.");
    }
  };

  return (
    <button
      onClick={handleSignIn}
      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
    >
      Sign In with Google
    </button>
  );
}
