import { Suspense, useEffect, useState, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { Toaster } from "sonner";

// ================= WEBSITE CORE =================
import Index from "@/pages/website/HomePage";
import { PrivacyPolicyPage } from "@/pages/website/PrivacyPolicyPage";
import { TermsPage } from "@/pages/website/TermsPage";
import { RefundPolicyPage } from "@/pages/website/RefundPolicyPage";
import { UnsubscribePage } from "@/pages/website/UnsubscribePage";
import AuthCallback from "@/pages/AuthCallback";

// ================= WEBSITE UI =================
import WebsiteHeader from "@/components/Header";
import WebsiteFooter from "@/components/Footer";
import { PricingModal } from "@/components/PricingModal";
import SupportTicketWidget from "@/components/SupportTicketWidget";

// ================= AUTH =================
import { useAuthStateMonitor } from "@/hooks/useAuthStateMonitor";
import { AdminRoute } from "@/components/AdminRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedClientRoute from "@/routes/ProtectedClientRoute";
import { CreditsFunnelProvider } from "@/contexts/CreditsFunnelContext";

// ================= LAYOUTS =================
import AdminLayout from "@/layouts/AdminLayout";
import ClientLayout from "@/layouts/ClientLayout";

// ================= ADMIN CORE =================
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Templates from "@/pages/admin/Templates";

const PricingPage = lazy(() => import("@/pages/admin/PricingPage"));
const OrdersPage = lazy(() => import("@/pages/admin/Orders"));
const CustomersPage = lazy(() => import("@/pages/admin/Customers"));
const CreditsPage = lazy(() => import("@/pages/admin/Credits"));
const SupportTicketsPage = lazy(
  () => import("@/domains/admin/pages/SupportTicketsPage")
);

// ================= ADMIN EMAIL =================
import AdminEmailLayoutPage from "@/pages/admin/email/Index";
import AdminEmailTemplatesPage from "@/pages/admin/email/Templates";
import AdminEmailOffersPage from "@/pages/admin/email/Offers";
import AdminEmailCampaignsPage from "@/pages/admin/email/Campaigns";

// ================= ADMIN FUNNEL =================
const AdminFunnelPage = lazy(
  () => import("@/pages/admin/funnel/AdminFunnelPage")
);

// ================= WEBSITE PAGES =================
const GeneratorPage = lazy(() => import("@/pages/website/GeneratorPage"));
const TemplatesPage = lazy(() => import("@/pages/website/TemplatesPage"));

const OccasionsCategoryPage = lazy(
  () => import("@/pages/website/OccasionsCategoryPage")
);
const PersonalCategoryPage = lazy(
  () => import("@/pages/website/PersonalCategoryPage")
);
const SpiritualCategoryPage = lazy(
  () => import("@/pages/website/SpiritualCategoryPage")
);
const PetsCategoryPage = lazy(() => import("@/pages/website/PetsCategoryPage"));

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
const SorryPage = lazy(() => import("@/pages/website/SorryPage"));

// ================= CLIENT ACCOUNT =================
import AccountDashboard from "@/pages/account/AccountDashboard";
import AccountAffiliate from "@/pages/account/AccountAffiliate";
import AccountGeneratorRedirect from "@/pages/account/AccountGeneratorRedirect";

// ================= FUNNEL =================
import FunnelHomePage from "@/components/funnelVersion/FunnelHomePage";
import FunnelUploadPhoto from "@/components/funnelVersion/FunnelUploadPhoto";
import FunnelStyleSelect from "@/components/funnelVersion/FunnelStyleSelect";
import FunnelPreview from "@/components/funnelVersion/FunnelPreview";
import FunnelPayment from "@/components/funnelVersion/FunnelPayment";

const FunnelEmailCapture = lazy(
  () => import("@/components/funnelVersion/FunnelEmailCapture")
);

import FunnelResultPage from "@/components/funnelVersion/ResultPage";

// ================= SUPABASE =================
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function GtagPageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.gtag) return;

    window.gtag("config", "G-6FVX69WYFG", {
      page_path: `${location.pathname}${location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return null;
}

function WebsiteLayout() {
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <WebsiteHeader onBuyCredits={() => setShowPricing(true)} />

      <main className="flex-1">
        <Outlet />
      </main>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />

      <WebsiteFooter />
    </div>
  );
}

function FunnelLayout() {
  return (
    <div className="min-h-screen w-full bg-black text-white">
      <Outlet />
    </div>
  );
}

function AppInner() {
  useAuthStateMonitor();

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get("checkout") === "success") {
      url.searchParams.delete("checkout");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function trackAffiliateRefFromUrl() {
      try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");

        if (!ref) return;

        const cleanRef = ref.trim().toLowerCase();
        if (!cleanRef) return;

        localStorage.setItem("affiliate_ref", cleanRef);

        const existingVisitorId = localStorage.getItem("affiliate_visitor_id");
        const visitorId =
          existingVisitorId ||
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

        localStorage.setItem("affiliate_visitor_id", visitorId);

        const lastTrackedRef = localStorage.getItem(
          "affiliate_last_tracked_ref"
        );
        const lastTrackedAt = localStorage.getItem(
          "affiliate_last_tracked_at"
        );
        const now = Date.now();

        const shouldSkip =
          lastTrackedRef === cleanRef &&
          lastTrackedAt &&
          now - Number(lastTrackedAt) < 1000 * 60 * 30;

        if (shouldSkip) return;

        const { error } = await supabase.from("affiliate_clicks").insert({
          code: cleanRef,
          visitor_id: visitorId,
        });

        if (error) {
          console.error("[App] affiliate click tracking error:", error);
          return;
        }

        if (!cancelled) {
          localStorage.setItem("affiliate_last_tracked_ref", cleanRef);
          localStorage.setItem("affiliate_last_tracked_at", String(now));
        }
      } catch (error) {
        console.error("[App] affiliate ref tracking fatal:", error);
      }
    }

    void trackAffiliateRefFromUrl();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function attachAffiliateConversionToAuthenticatedUser() {
      try {
        const savedRef = localStorage.getItem("affiliate_ref");
        if (!savedRef) return;

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user || cancelled) return;

        const conversionKey = `affiliate_conversion_recorded_${user.id}_${savedRef}`;

        if (localStorage.getItem(conversionKey) === "1") return;

        const { data: existingConversion, error: existingError } =
          await supabase
            .from("affiliate_conversions")
            .select("id")
            .eq("user_id", user.id)
            .eq("code", savedRef)
            .maybeSingle<{ id: string }>();

        if (existingError) throw existingError;

        if (!existingConversion) {
          const { error: insertError } = await supabase
            .from("affiliate_conversions")
            .insert({
              code: savedRef,
              user_id: user.id,
              amount: 0,
            });

          if (insertError) throw insertError;
        }

        if (!cancelled) {
          localStorage.setItem(conversionKey, "1");
        }
      } catch (error) {
        console.error("[App] affiliate conversion attach error:", error);
      }
    }

    void attachAffiliateConversionToAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <GtagPageViewTracker />
      <ScrollToTop />

      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-black text-white/80">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route element={<WebsiteLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/generator" element={<GeneratorPage />} />

            <Route
              path="/categories/occasions"
              element={<OccasionsCategoryPage />}
            />
            <Route
              path="/categories/personal"
              element={<PersonalCategoryPage />}
            />
            <Route
              path="/categories/spiritual"
              element={<SpiritualCategoryPage />}
            />
            <Route path="/categories/pets" element={<PetsCategoryPage />} />

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
            <Route path="/sorry" element={<SorryPage />} />

            <Route
              path="/name-cards"
              element={<Navigate to="/templates?category=personal" replace />}
            />
            <Route
              path="/kids"
              element={<Navigate to="/templates?category=personal" replace />}
            />
            <Route
              path="/bible-verses"
              element={<Navigate to="/templates?category=spiritual" replace />}
            />
            <Route
              path="/prayer"
              element={<Navigate to="/templates?category=spiritual" replace />}
            />
            <Route
              path="/dogs"
              element={<Navigate to="/templates?category=pets" replace />}
            />
            <Route
              path="/cats"
              element={<Navigate to="/templates?category=pets" replace />}
            />
            <Route
              path="/pet-loss"
              element={<Navigate to="/templates?category=pets" replace />}
            />

            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/refunds" element={<RefundPolicyPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            <Route
              path="/new_years_eve"
              element={<Navigate to="/new-years-eve" replace />}
            />
            <Route
              path="/valentines_day"
              element={<Navigate to="/valentines-day" replace />}
            />
            <Route
              path="/valentines"
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

          <Route element={<ProtectedClientRoute />}>
            <Route path="/account" element={<ClientLayout />}>
              <Route
                index
                element={<Navigate to="/account/dashboard" replace />}
              />
              <Route path="dashboard" element={<AccountDashboard />} />
              <Route path="affiliate" element={<AccountAffiliate />} />
              <Route path="generator" element={<AccountGeneratorRedirect />} />
            </Route>
          </Route>

          <Route element={<FunnelLayout />}>
            <Route
              path="/funnel"
              element={<Navigate to="/funnel/homepage/christmas" replace />}
            />
            <Route
              path="/funnel/homepage"
              element={<Navigate to="/funnel/homepage/christmas" replace />}
            />
            <Route
              path="/funnel/homepage/:occasion"
              element={<FunnelHomePage />}
            />
            <Route path="/funnel/uploadPhoto" element={<FunnelUploadPhoto />} />
            <Route path="/funnel/styleSelect" element={<FunnelStyleSelect />} />
            <Route path="/funnel/preview" element={<FunnelPreview />} />
            <Route path="/funnel/email" element={<FunnelEmailCapture />} />
            <Route path="/funnel/payment" element={<FunnelPayment />} />
            <Route path="/funnel/result" element={<FunnelResultPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="funnel" element={<AdminFunnelPage />} />
            <Route path="templates" element={<Templates />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="support-tickets" element={<SupportTicketsPage />} />

            <Route path="email" element={<AdminEmailLayoutPage />}>
              <Route
                index
                element={<Navigate to="/admin/email/templates" replace />}
              />
              <Route path="templates" element={<AdminEmailTemplatesPage />} />
              <Route path="offers" element={<AdminEmailOffersPage />} />
              <Route path="campaigns" element={<AdminEmailCampaignsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <SupportTicketWidget />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CreditsFunnelProvider>
        <AppInner />
      </CreditsFunnelProvider>
    </AuthProvider>
  );
}