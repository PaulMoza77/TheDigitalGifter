import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChristmasFeatureShell } from "./components/ChristmasFeatureShell";
import { shellForPath } from "./routes";
import { Navigate } from "react-router-dom";

/** Sets robots noindex via document head for unfinished shells. */
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

  return <ChristmasFeatureShell shell={shell} />;
}
