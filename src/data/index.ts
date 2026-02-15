// src/data/index.ts
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

export async function invalidateAuthCaches() {
  await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  await queryClient.invalidateQueries({ queryKey: ["credits"] });
  await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
  await queryClient.invalidateQueries({ queryKey: ["jobs"] });
  await queryClient.invalidateQueries({ queryKey: ["templates"] });
}

// ✅ Queries (flat)
export * from "./queries";

// ✅ Mutations (namespaced) => import { mutations } from "@/data"
export * as mutations from "./mutations";