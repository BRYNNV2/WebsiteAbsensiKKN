import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";

import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { DosenDashboardPage } from "@/pages/dosen/dashboard";
import { DosenStudentsPage } from "@/pages/dosen/students";
import { DosenSessionsPage } from "@/pages/dosen/sessions";
import { DosenRecapPage } from "@/pages/dosen/recap";
import { DosenProkerPage } from "@/pages/dosen/proker";
import { MahasiswaDashboardPage } from "@/pages/mahasiswa/dashboard";
import { MahasiswaScanPage } from "@/pages/mahasiswa/scan";
import { MahasiswaHistoryPage } from "@/pages/mahasiswa/history";
import { MahasiswaProkerPage } from "@/pages/mahasiswa/proker";
import { MahasiswaLogbookPage } from "@/pages/mahasiswa/logbook";
import { SettingsPage } from "@/pages/settings";
import { HelpSupportPage } from "@/pages/support";
import { FeedbackPage } from "@/pages/feedback";

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function RoleRoute({
  role,
  children,
}: {
  role: "dosen" | "mahasiswa";
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Profil pengguna belum dimuat. Silakan muat ulang halaman.
        </p>
      </div>
    );
  }
  if (profile.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function HomeRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Profil pengguna belum dimuat. Silakan muat ulang halaman.
        </p>
      </div>
    );
  }
  return profile.role === "dosen" ? <DosenDashboardPage /> : <MahasiswaDashboardPage />;
}

function ProkerRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!profile) return null;
  return profile.role === "dosen" ? <DosenProkerPage /> : <MahasiswaProkerPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeRoute />} />
        <Route path="/proker" element={<ProkerRoute />} />
        <Route
          path="/students"
          element={
            <RoleRoute role="dosen">
              <DosenStudentsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/sessions"
          element={
            <RoleRoute role="dosen">
              <DosenSessionsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/recap"
          element={
            <RoleRoute role="dosen">
              <DosenRecapPage />
            </RoleRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <RoleRoute role="mahasiswa">
              <MahasiswaScanPage />
            </RoleRoute>
          }
        />
        <Route
          path="/history"
          element={
            <RoleRoute role="mahasiswa">
              <MahasiswaHistoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="/logbook"
          element={
            <RoleRoute role="mahasiswa">
              <MahasiswaLogbookPage />
            </RoleRoute>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/support" element={<HelpSupportPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
