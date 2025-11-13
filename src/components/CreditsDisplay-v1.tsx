import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function CreditsDisplay() {
  const credits = useQuery(api.credits.getUserCredits);

  if (credits === undefined) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-purple-50 px-3 py-1 rounded-full">
      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
      <span className="text-sm font-medium text-purple-700">
        {credits} credits
      </span>
    </div>
  );
}
