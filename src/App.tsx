import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { Suspense, useEffect } from "react";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsPage } from "./pages/TermsPage";
import { RefundPolicyPage } from "./pages/RefundPolicyPage";
import { useAuthStateMonitor } from "./hooks/useAuthStateMonitor";
import { lazy } from "react";

const MainLayout = lazy(() => import("./layouts/MainLayouts"));
const HomePage = lazy(() => import("./pages/HomePage"));
const GeneratorPage = lazy(() => import("./pages/GeneratorPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
// const TheDigitalGifterDashboard = lazy(
//   () => import("./pages/TheDigitalGifterDashboard")
// );

export default function App() {
  // Monitor auth state changes and invalidate caches when user logs in/out
  useAuthStateMonitor();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      console.log("[App] Checkout success detected");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-black text-gray-900 flex flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-white/80">
              Loading magic...
            </div>
          }
        >
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/generator" element={<GeneratorPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refunds" element={<RefundPolicyPage />} />
            </Route>
            {/* <Route path="/dashboard" element={<TheDigitalGifterDashboard />} /> */}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Toaster position="top-right" />
      </div>
    </Router>
  );
}
