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
    mutations: { retry: 1 },
  },
});

export async function invalidateAuthCaches() {
  await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  await queryClient.invalidateQueries({ queryKey: ["credits"] });
  await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
  await queryClient.invalidateQueries({ queryKey: ["jobs"] });
  await queryClient.invalidateQueries({ queryKey: ["templates"] });
}

/**
 * ✅ QUERIES (hooks + keys) – exportate “flat”
 */
export * from "./queries";

/**
 * ✅ MUTATIONS – exportate explicit (ca să nu se bată cu keys din queries)
 * Aici se rezolvă fix erorile gen: “useCheckoutMutation is not exported by src/data/index.ts”
 */
export {
  useCheckoutMutation,
} from "./mutations/checkout";

export {
  useCreateJobMutation,
  useCreateVideoJobMutation,
} from "./mutations/jobs";

export {
  useGenerateUploadUrlMutation,
} from "./mutations/storage";

export {
  useEnsureUserProfileMutation,
} from "./mutations/users";

// (opțional) dacă ai și alte mutations și vrei acces “namespaced”:
// export * as mutations from "./mutations";