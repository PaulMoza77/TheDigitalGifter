import { useLocation } from "react-router-dom";
import { ChristmasFeatureShell } from "./components/ChristmasFeatureShell";
import { shellForPath } from "./routes";
import { Navigate } from "react-router-dom";

export function ChristmasShellRoute() {
  const { pathname } = useLocation();
  const shell = shellForPath(pathname);

  if (!shell) {
    return <Navigate to="/christmas" replace />;
  }

  return <ChristmasFeatureShell shell={shell} />;
}
