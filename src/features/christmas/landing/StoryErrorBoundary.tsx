import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps later /christmas story scenes on screen if one section throws. */
export class StoryErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Christmas story section failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
