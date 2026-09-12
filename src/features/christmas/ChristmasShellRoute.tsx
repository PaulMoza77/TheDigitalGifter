import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ChristmasFeatureShell } from "./components/ChristmasFeatureShell";
import ChristmasKidsPage from "./ChristmasKidsPage";
import { shellForPath } from "./routes";

/** Sets robots noindex via document head for unfinished shells only. */
function useNoIndex(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let robots = document.querySelector('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    const previous = robots.getAttribute("content");
    robots.setAttribute("content", "noindex,nofollow");
    return () => {
      if (created && robots?.parentNode) {
        robots.parentNode.removeChild(robots);
      } else if (robots && previous != null) {
        robots.setAttribute("content", previous);
      }
    };
  }, [enabled]);
}

export function ChristmasShellRoute() {
  const { pathname } = useLocation();
  const shell = shellForPath(pathname);
  useNoIndex(Boolean(shell?.noindex));

  if (!shell) {
    return <Navigate to="/christmas" replace />;
  }

  if (shell.productKey === "christmas_kids" && shell.status === "live_hub") {
    return <ChristmasKidsPage />;
  }

  return <ChristmasFeatureShell shell={shell} />;
}
