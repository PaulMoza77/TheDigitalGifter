// src/contexts/AuthContext.tsx
// Single-source auth: re-export from lib/auth to avoid multiple contexts.

export { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
export type { AuthContextValue } from "@/lib/auth/AuthProvider";
