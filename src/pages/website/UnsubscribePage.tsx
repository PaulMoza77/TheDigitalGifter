import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  const unsubscribe = useMutation(api.emailPreferences.unsubscribe);

  useEffect(() => {
    if (userId) {
      unsubscribe({ userId })
        .then(() => setStatus("success"))
        .catch(() => setStatus("error"));
    } else {
      setStatus("error");
    }
  }, [userId, unsubscribe]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
        {status === "loading" && (
          <>
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-50 mb-2">
              Unsubscribing...
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-slate-50 mb-3">
              You've been unsubscribed
            </h1>
            <p className="text-slate-400 mb-6">
              You won't receive any more marketing emails from us. We're sorry
              to see you go!
            </p>
            <p className="text-sm text-slate-500 mb-6">
              You can resubscribe anytime from your account settings.
            </p>
            <a
              href="/"
              className="inline-block bg-indigo-500 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-400 transition-colors"
            >
              Return to Home
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-slate-50 mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-400 mb-6">
              We couldn't process your unsubscribe request. Please try again or
              contact support.
            </p>
            <a
              href="/"
              className="inline-block bg-indigo-500 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-400 transition-colors"
            >
              Return to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}
