import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect } from "react";
import MainLayout from "./layouts/MainLayouts";
import HomePage from "./pages/HomePage";
import GeneratorPage from "./pages/GeneratorPage";
import TemplatesPage from "./pages/TemplatesPage";

export default function App() {
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
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/generator" element={<GeneratorPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  );
}
