import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { Suspense, useEffect, lazy } from "react";

import Index from "@/pages/website/HomePage";
import { PrivacyPolicyPage } from "@/pages/website/PrivacyPolicyPage";
import { TermsPage } from "@/pages/website/TermsPage";
import { RefundPolicyPage } from "@/pages/website/RefundPolicyPage";
import { UnsubscribePage } from "@/pages/website/UnsubscribePage";

import { useAuthStateMonitor } from "@/hooks/useAuthStateMonitor";
import { AdminRoute } from "@/components/AdminRoute";

import AdminLayout from "@/layouts/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Templates from "@/pages/admin/Templates";

import FunnelHomePage from "@/components/funnelVersion/FunnelHomePage";
import FunnelUploadPhoto from "@/components/funnelVersion/FunnelUploadPhoto";
import FunnelPayment from "@/components/funnelVersion/FunnelPayment";
import FunnelStyleSelect from "@/components/funnelVersion/FunnelStyleSelect";
import FunnelPreview from "@/components/funnelVersion/FunnelPreview";

const MainLayout = lazy(() => import("@/layouts/MainLayouts"));
const ChristmasPage = lazy(() => import("@/pages/website/ChristmasPage"));
const BirthdayPage = lazy(() => import("@/pages/website/BirthdayPage"));
const GeneratorPage = lazy(() => import("@/pages/website/GeneratorPage"));
const TemplatesPage = lazy(() => import("@/pages/website/TemplatesPage"));
const CustomersPage = lazy(() => import("@/pages/admin/Customers"));

// Component to handle scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  // Monitor auth state changes and invalidate caches when user logs in/out
  useAuthStateMonitor();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      console.log("[App] Checkout success detected");
      // remove ?checkout=success from URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <Router>
      <ScrollToTop />

      <div className="min-h-screen bg-black text-gray-900 flex flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-white/80">
              Loading magic...
            </div>
          }
        >
          <Routes>
            {/* WEBSITE */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Index />} />

              <Route path="/christmas" element={<ChristmasPage />} />
              <Route path="/birthday" element={<BirthdayPage />} />

              {/* (optional) generator page if you still use it */}
              <Route path="/generator" element={<GeneratorPage />} />

              {/* public templates page */}
              <Route path="/templates" element={<TemplatesPage />} />

              {/* legal */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refunds" element={<RefundPolicyPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* FUNNEL */}
              <Route path="/funnel/homepage" element={<FunnelHomePage />} />
              <Route path="/funnel/uploadPhoto" element={<FunnelUploadPhoto />} />
              <Route path="/funnel/styleSelect" element={<FunnelStyleSelect />} />
              <Route path="/funnel/preview" element={<FunnelPreview />} />
              <Route path="/funnel/payment" element={<FunnelPayment />} />
            </Route>

            {/* ADMIN */}
            <Route element={<AdminLayout />}>
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/templates"
                element={
                  <AdminRoute>
                    <Templates />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/customers"
                element={
                  <AdminRoute>
                    <CustomersPage />
                  </AdminRoute>
                }
              />
            </Route>

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Toaster position="top-right" />
      </div>
    </Router>
  );
}
