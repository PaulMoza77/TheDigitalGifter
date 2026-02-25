import { Suspense, useEffect, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";

// ================= WEBSITE CORE =================
import Index from "@/pages/website/HomePage";
import { PrivacyPolicyPage } from "@/pages/website/PrivacyPolicyPage";
import { TermsPage } from "@/pages/website/TermsPage";
import { RefundPolicyPage } from "@/pages/website/RefundPolicyPage";
import { UnsubscribePage } from "@/pages/website/UnsubscribePage";
import AuthCallback from "@/pages/AuthCallback";

// ================= AUTH =================
import { useAuthStateMonitor } from "@/hooks/useAuthStateMonitor";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider } from "@/contexts/AuthContext";

// ================= LAYOUTS =================
import AdminLayout from "@/layouts/AdminLayout";
const MainLayout = lazy(() => import("@/layouts/MainLayouts"));

// ================= ADMIN CORE =================
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Templates from "@/pages/admin/Templates";
const OrdersPage = lazy(() => import("@/pages/admin/Orders"));
const CustomersPage = lazy(() => import("@/pages/admin/Customers"));
const CreditsPage = lazy(() => import("@/pages/admin/Credits"));

// ================= WEBSITE PAGES =================
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
const ValentinesDayPage = lazy(
  () => import("@/pages/website/ValentinesDayPage")
);
const AnniversaryPage = lazy(() => import("@/pages/website/AnniversaryPage"));
const MothersDayPage = lazy(() => import("@/pages/website/MothersDayPage"));
const FathersDayPage = lazy(() => import("@/pages/website/FathersDayPage"));
const GraduationPage = lazy(() => import("@/pages/website/GraduationPage"));

// ================= FUNNEL =================
import FunnelHomePage from "@/components/funnelVersion/FunnelHomePage";
import FunnelUploadPhoto from "@/components/funnelVersion/FunnelUploadPhoto";
import FunnelStyleSelect from "@/components/funnelVersion/FunnelStyleSelect";
import FunnelPreview from "@/components/funnelVersion/FunnelPreview";
import FunnelPayment from "@/components/funnelVersion/FunnelPayment";
const FunnelEmailCapture = lazy(
  () => import("@/components/funnelVersion/FunnelEmailCapture")
);

// ✅ RESULT (after payment)
// Corect: importă direct componenta ResultPage din folderul corect
import FunnelResultPage from "@/components/funnelVersion/ResultPage";

// ================= HELPERS =================
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppInner() {
  useAuthStateMonitor();

  // Cură vechiul query param ?checkout=success dacă există
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "success") {
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  return (
    <BrowserRouter>
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

              {/* Public */}
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/generator" element={<GeneratorPage />} />

              {/* Legal */}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refunds" element={<RefundPolicyPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* ================= FUNNEL FLOW (ORDER) ================= */}
              <Route path="/funnel/homepage" element={<FunnelHomePage />} />

              {/* Start alias -> upload */}
              <Route
                path="/funnel"
                element={<Navigate to="/funnel/uploadPhoto" replace />}
              />

              {/* 1) Upload Photo */}
              <Route path="/funnel/uploadPhoto" element={<FunnelUploadPhoto />} />

              {/* 2) Select Style */}
              <Route path="/funnel/styleSelect" element={<FunnelStyleSelect />} />

              {/* 3) Preview */}
              <Route path="/funnel/preview" element={<FunnelPreview />} />

              {/* 4) Email */}
              <Route path="/funnel/email" element={<FunnelEmailCapture />} />

              {/* 5) Payment */}
              <Route path="/funnel/payment" element={<FunnelPayment />} />

              {/* 6) Result (Stripe success_url -> /funnel/result?session_id=...) */}
              <Route path="/funnel/result" element={<FunnelResultPage />} />

              {/* Redirect aliases */}
              <Route
                path="/new_years_eve"
                element={<Navigate to="/new-years-eve" replace />}
              />
              <Route
                path="/valentines_day"
                element={<Navigate to="/valentines-day" replace />}
              />
              <Route
                path="/mothers_day"
                element={<Navigate to="/mothers-day" replace />}
              />
              <Route
                path="/fathers_day"
                element={<Navigate to="/fathers-day" replace />}
              />
              <Route
                path="/baby_reveal"
                element={<Navigate to="/baby-reveal" replace />}
              />
              <Route
                path="/new_born"
                element={<Navigate to="/new-born" replace />}
              />
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

              <Route
                path="/admin/orders"
                element={
                  <AdminRoute>
                    <OrdersPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/credits"
                element={
                  <AdminRoute>
                    <CreditsPage />
                  </AdminRoute>
                }
              />
            </Route>

            {/* ================= FALLBACK ================= */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Toaster position="top-right" />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}