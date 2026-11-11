import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Aurora } from "@/components/fx/Aurora";
import { GlowTracker } from "@/components/fx/GlowTracker";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Splash } from "@/components/layout/Splash";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { VaultProvider } from "@/vault/VaultProvider";
import CaseStudy from "./pages/CaseStudy";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Security from "./pages/Security";

// The public pages load first. Everything that needs a vault (SQLite, charts, the app shell) is fetched on demand.
const RequireVault = lazy(() => import("@/components/layout/RequireVault").then((m) => ({ default: m.RequireVault })));
const Budgets = lazy(() => import("./pages/Budgets"));
const Categories = lazy(() => import("./pages/Categories"));
const Create = lazy(() => import("./pages/Create"));
const Demo = lazy(() => import("./pages/Demo"));
const Entries = lazy(() => import("./pages/Entries"));
const Migrate = lazy(() => import("./pages/Migrate"));
const Overview = lazy(() => import("./pages/Overview"));
const Settings = lazy(() => import("./pages/Settings"));
const Unlock = lazy(() => import("./pages/Unlock"));

const App = () => (
  <ThemeProvider>
    <VaultProvider>
      <TooltipProvider>
        <Aurora />
        <GlowTracker />
        <Toaster />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<Splash message="Loading…" />}>
            <Routes>
              {/* Public pages */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/security" element={<Security />} />
                <Route path="/case-study" element={<CaseStudy />} />
                <Route path="/create" element={<Create />} />
                <Route path="/unlock" element={<Unlock />} />
                <Route path="/migrate" element={<Migrate />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* The app: nothing renders unless a vault is unlocked in memory */}
              <Route path="/app" element={<RequireVault />}>
                <Route index element={<Overview />} />
                <Route path="entries" element={<Entries />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="categories" element={<Categories />} />
                <Route path="settings/:tab?" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Links from earlier versions */}
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/about" element={<Navigate to="/case-study" replace />} />
              <Route path="/login" element={<Navigate to="/unlock" replace />} />
              <Route path="/ledger" element={<Navigate to="/app/entries" replace />} />
              <Route path="/budgets" element={<Navigate to="/app/budgets" replace />} />
              <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </VaultProvider>
  </ThemeProvider>
);

export default App;
