import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2, Wrench, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

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

/**
 * TOGGLE PEMELIHARAAN SISTEM (MAINTENANCE MODE)
 * Ubah menjadi `true` untuk mematikan akses pengguna saat perbaikan,
 * atau `false` untuk mengaktifkan kembali website.
 */
const IS_MAINTENANCE_MODE = true;

function MaintenancePage() {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="size-20 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto text-amber-500 shadow-inner animate-pulse">
          <Wrench className="size-10" />
        </div>

        <div className="space-y-2">
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 px-3 py-1 text-xs rounded-full font-semibold">
            🔴 Maintenance Mode Active
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-2">
            Sistem Dalam Pemeliharaan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Sistem Absensi &amp; Logbook KKN sedang dinonaktifkan sementara untuk perbaikan server dan pemeliharaan oleh tim developer. Harap coba lagi beberapa saat lagi.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 text-xs text-slate-400 text-left space-y-2 font-mono">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-amber-400" />
              <span>Status Server Vercel</span>
            </span>
            <span className="text-amber-400 font-bold">PEMELIHARAAN</span>
          </div>
          <p>• Seluruh fungsi login &amp; entri data dikunci sementara.</p>
          <p>• Sistem akan diaktifkan kembali setelah perbaikan selesai.</p>
        </div>

        <p className="text-[11px] text-slate-500 pt-2">
          &copy; {new Date().getFullYear()} Website Absensi &amp; Logbook KKN
        </p>
      </div>
    </div>
  );
}

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
  if (IS_MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }

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
