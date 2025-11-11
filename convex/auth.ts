// convex/auth.ts
import Google from "@auth/core/providers/google";
import { getAuthUserId } from "@convex-dev/auth/server";
import { convexAuth } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

const authConfig = convexAuth({
  providers: [
    Google({
      clientId:
        process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ??
        process.env.AUTH_GOOGLE_SECRET ??
        "",
    }),
  ],
});

export const { auth, signIn, signOut, store, isAuthenticated } = authConfig;
export default auth;

export const loggedInUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return (await ctx.db.get(userId)) ?? null;
  },
});
