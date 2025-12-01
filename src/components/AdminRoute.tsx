import { useAdminAuth } from "@/hooks/useAdminAuth";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route protection component for admin-only pages
 * Shows loading state while checking auth, redirects non-admins to home
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, isLoading } = useAdminAuth(true);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
          <p className="text-sm text-slate-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not admin (redirect happens in useAdminAuth hook)
  if (!isAdmin) {
    return null;
  }

  // User is admin, render the protected content
  return <>{children}</>;
}
