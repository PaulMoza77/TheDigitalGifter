// src/App.tsx
import { Suspense, useEffect, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";

// Website core pages
import Index from "@/pages/website/HomePage";
import { PrivacyPolicyPage } from "@/pages/website/PrivacyPolicyPage";
import { TermsPage } from "@/pages/website/TermsPage";
import { RefundPolicyPage } from "@/pages/website/RefundPolicyPage";
import { UnsubscribePage } from "@/pages/website/UnsubscribePage";

import AuthCallback from "@/pages/AuthCallback";

import { useAuthStateMonitor } from "@/hooks/useAuthStateMonitor";
import { AdminRoute } from "@/components/AdminRoute";

// Layouts
import AdminLayout from "@/layouts/AdminLayout";

// Admin core
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Templates from "@/pages/admin/Templates";

// ✅ NEW — Orders page
const OrdersPage = lazy(() => import("@/pages/admin/Orders"));

// Funnel
import FunnelHomePage from "@/components/funnelVersion/FunnelHomePage";
import FunnelUploadPhoto from "@/components/funnelVersion/FunnelUploadPhoto";
import FunnelPayment from "@/components/funnelVersion/FunnelPayment";
import FunnelStyleSelect from "@/components/funnelVersion/FunnelStyleSelect";
import FunnelPreview from "@/components/funnelVersion/FunnelPreview";

// Provider
import { AuthProvider } from "@/contexts/AuthContext";

// Lazy website pages
const MainLayout = lazy(() => import("@/layouts/MainLayouts"));
const GeneratorPage = lazy(() => import("@/pages/website/GeneratorPage"));
const TemplatesPage = lazy(() => import("@/pages/website/TemplatesPage"));

// Occasion pages
const ChristmasPage = lazy(() => import("@/pages/website/ChristmasPage"));
const BirthdayPage = lazy(() => import("@/pages/website/BirthdayPage"));
const NewYearsEvePage = lazy(() => import("@/pages/website/NewYearsEvePage"));
const ThanksgivingPage = lazy(() => import("@/pages/website/ThanksgivingPage"));
const BabyRevealPage = lazy(() => import("@/pages/website/BabyRevealPage"));
const NewBornPage = lazy(() => import("@/pages/website/NewBornPage"));
const PregnancyPage = lazy(() => import("@/pages/website/PregnancyPage"));
const WeddingPage = lazy(() => import("@/pages/website/WeddingPage"));
const EasterPage = lazy(() => import("@/pages/website/EasterPage"));
const ValentinesDayPage = lazy(() => import("@/pages/website/ValentinesDayPage"));
const AnniversaryPage = lazy(() => import("@/pages/website/AnniversaryPage"));
const MothersDayPage = lazy(() => import("@/pages/website/MothersDayPage"));
const FathersDayPage = lazy(() => import("@/pages/website/FathersDayPage"));
const GraduationPage = lazy(() => import("@/pages/website/GraduationPage"));

// Admin extra
const CustomersPage = lazy(() => import("@/pages/admin/Customers"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppInner() {
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
      <ScrollToTop />

      <div className="min-h-screen bg-black text-gray-900 flex flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-white/80">
              Loading...
            </div>
          }
        >
          <Routes>

            {/* ================= WEBSITE ================= */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Index />} />

              {/* OAuth callback */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Occasion pages */}
              <Route path="/christmas" element={<ChristmasPage />} />
              <Route path="/birthday" element={<BirthdayPage />} />
              <Route path="/new-years-eve" element={<NewYearsEvePage />} />
              <Route path="/thanksgiving" element={<ThanksgivingPage />} />
              <Route path="/baby-reveal" element={<BabyRevealPage />} />
              <Route path="/new-born" element={<NewBornPage />} />
              <Route path="/pregnancy" element={<PregnancyPage />} />
              <Route path="/wedding" element={<WeddingPage />} />
              <Route path="/easter" element={<EasterPage />} />
              <Route path="/valentines-day" element={<ValentinesDayPage />} />
              <Route path="/anniversary" element={<AnniversaryPage />} />
              <Route path="/mothers-day" element={<MothersDayPage />} />
              <Route path="/fathers-day" element={<FathersDayPage />} />
              <Route path="/graduation" element={<GraduationPage />} />

              {/* Public templates */}
              <Route path="/templates" element={<TemplatesPage />} />

              {/* Generator */}
              <Route path="/generator" element={<GeneratorPage />} />

              {/* Legal */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refunds" element={<RefundPolicyPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* Funnel */}
              <Route path="/funnel/homepage" element={<FunnelHomePage />} />
              <Route path="/funnel/uploadPhoto" element={<FunnelUploadPhoto />} />
              <Route path="/funnel/styleSelect" element={<FunnelStyleSelect />} />
              <Route path="/funnel/preview" element={<FunnelPreview />} />
              <Route path="/funnel/payment" element={<FunnelPayment />} />

              {/* Redirects */}
              <Route path="/new_years_eve" element={<Navigate to="/new-years-eve" replace />} />
              <Route path="/valentines_day" element={<Navigate to="/valentines-day" replace />} />
              <Route path="/mothers_day" element={<Navigate to="/mothers-day" replace />} />
              <Route path="/fathers_day" element={<Navigate to="/fathers-day" replace />} />
              <Route path="/baby_reveal" element={<Navigate to="/baby-reveal" replace />} />
              <Route path="/new_born" element={<Navigate to="/new-born" replace />} />
            </Route>

            {/* ================= ADMIN ================= */}
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

              {/* ✅ NEW ORDERS ROUTE */}
              <Route
                path="/admin/orders"
                element={
                  <AdminRoute>
                    <OrdersPage />
                  </AdminRoute>
                }
              />

            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </Suspense>

        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}