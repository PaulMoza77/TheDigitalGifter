import React from "react";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Route-level recovery for Admin lazy/chunk failures.
 * Does NOT call window.location.reload() unconditionally — retry remounts children.
 */
export class AdminErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AdminErrorBoundary]", this.props.label || "admin", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-slate-300">
            This Admin view failed to load{this.props.label ? ` (${this.props.label})` : ""}.
          </p>
          <p className="max-w-md text-xs text-slate-500">
            {this.state.error.message || "Unknown error"}
          </p>
          <button
            type="button"
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white"
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
