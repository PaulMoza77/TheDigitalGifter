import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Helper function to invalidate auth-related caches
export async function invalidateAuthCaches() {
  await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  await queryClient.invalidateQueries({ queryKey: ["credits"] });
  await queryClient.invalidateQueries({ queryKey: ["user"] });
  await queryClient.invalidateQueries({ queryKey: ["jobs"] });
  await queryClient.invalidateQueries({ queryKey: ["templates"] });
}

export * from "./queries";
export * from "./mutations";
