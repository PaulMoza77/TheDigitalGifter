import { Component, type ErrorInfo, type ReactNode, useState } from "react";

/**
 * Admin SPA load reliability: lazy chunk / render failures must terminate as
 * explicit error + retry — never an infinite spinner. No window.location.reload().
 */
export class AdminRouteErrorBoundary extends Component<
  { children: ReactNode; routeKey: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdminRouteErrorBoundary]", this.props.routeKey, error, info.componentStack);
  }

  componentDidUpdate(prevProps: { routeKey: string }) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm font-medium text-slate-200">This admin page failed to load.</p>
          <p className="max-w-md text-xs text-slate-400">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminOutletSuspense({ children }: { children: ReactNode }) {
  const [retry, setRetry] = useState(0);
  return (
    <AdminRouteErrorBoundary key={retry} routeKey={`suspense-${retry}`}>
      <div>
        {children}
        {/* Hidden retry hook for chunk remount if parent resets */}
        <span className="sr-only" data-admin-retry={retry} />
        <button type="button" className="hidden" onClick={() => setRetry((n) => n + 1)} aria-hidden />
      </div>
    </AdminRouteErrorBoundary>
  );
}
