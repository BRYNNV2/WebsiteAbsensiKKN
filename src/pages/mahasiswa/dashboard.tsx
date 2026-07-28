import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  TrendingUp,
  ScanLine,
  Clock,
  QrCode as QrIcon,
  CheckCircle2,
  BarChart3,
  Activity,
  UserCheck,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase, type AttendanceRecord, type QrSession } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CampusEmailModal } from "@/components/campus-email-modal";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MiniSparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const points = data.length > 2 ? data : [6, 12, 10, 18, 15, 24, 20, 28];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 88;
  const height = 38;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 10) - 5;
    return { x, y };
  });

  const linePath = coords
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CustomMahasiswaTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  // Carikan payload aktif yang memiliki nilai > 0 (Hadir/Telat/Izin/Sakit/Absen) untuk bar sesi yang di-hover
  const activeEntry = payload.find((p: any) => p && p.value > 0) || payload[0];
  const itemData = activeEntry?.payload;

  const sessionTitle = itemData?.fullTitle || label || "Detail Sesi Absensi";
  const statusKey = itemData?.statusKey || "absen";
  const dateStr = itemData?.dateStr || "";

  const badgeStyles: Record<string, { bg: string; text: string }> = {
    hadir: { bg: "bg-emerald-600 text-white", text: "Hadir Tepat Waktu" },
    terlambat: { bg: "bg-purple-600 text-white", text: "Terlambat" },
    izin: { bg: "bg-blue-600 text-white", text: "Izin (Ada Keterangan)" },
    sakit: { bg: "bg-amber-600 text-white", text: "Sakit" },
    absen: { bg: "bg-rose-600 text-white", text: "Belum Absen / Alpha" },
  };

  const badge = badgeStyles[statusKey] || badgeStyles.absen;

  return (
    <div className="rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[220px] z-50 text-xs space-y-2 pointer-events-none animate-in fade-in-50 zoom-in-95">
      <p className="font-bold text-foreground border-b pb-1.5 text-xs tracking-tight">{sessionTitle}</p>
      {dateStr && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarCheck className="size-3 text-muted-foreground" />
          <span>{dateStr}</span>
        </p>
      )}
      <div className="pt-1 flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-medium">Status Presensi:</span>
        <Badge className={cn("text-[11px] font-semibold px-2 py-0.5 shadow-xs", badge.bg)}>
          {badge.text}
        </Badge>
      </div>
    </div>
  );
}

export function MahasiswaDashboardPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [loading, setLoading] = useState(true);

  const groupId = profile?.group_id;
  const studentId = profile?.id;

  useEffect(() => {
    if (!groupId || !studentId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    (async () => {
      if (sessions.length === 0 && records.length === 0) {
        setLoading(true);
      }
      try {
        const [{ data: sData }, { data: rData }] = await Promise.all([
          supabase
            .from("qr_sessions")
            .select(
              "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
            )
            .eq("group_id", groupId)
            .order("starts_at", { ascending: false }),
          supabase
            .from("attendance_records")
            .select(
              "id, session_id, student_id, status, scanned_at, created_at"
            )
            .eq("student_id", studentId)
            .order("scanned_at", { ascending: false }),
        ]);

        if (isMounted) {
          setSessions((sData as QrSession[]) ?? []);
          setRecords((rData as AttendanceRecord[]) ?? []);
        }
      } catch (err) {
        console.error("Error loading mahasiswa dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [groupId, studentId]);

  const presentCount = useMemo(
    () => records.filter((r) => r.status === "hadir").length,
    [records]
  );
  const lateCount = useMemo(
    () => records.filter((r) => r.status === "terlambat").length,
    [records]
  );
  const attendanceRate = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round(((presentCount + lateCount) / sessions.length) * 100);
  }, [presentCount, lateCount, sessions]);

  const chartData = useMemo(() => {
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
    return sorted.map((s, idx) => {
      const rec = records.find((r) => r.session_id === s.id);
      const status = rec?.status ?? "absen";
      const startDate = new Date(s.starts_at);
      const dateStr = startDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Bersihkan awalan berulang tanpa memotong nomor di bagian akhir
      let cleanName = s.title.replace(/^(Absensi\s*(KKN\d*\s*[-_]?\s*)?)/i, "").trim();
      if (!cleanName) {
        cleanName = s.title || `Sesi ${idx + 1}`;
      }

      return {
        id: s.id,
        name: cleanName,
        fullTitle: s.title,
        dateStr,
        statusKey: status,
        hadir: status === "hadir" ? 1 : 0,
        terlambat: status === "terlambat" ? 1 : 0,
        izin: status === "izin" ? 1 : 0,
        sakit: status === "sakit" ? 1 : 0,
        absen: status === "absen" ? 1 : 0,
      };
    });
  }, [sessions, records]);

  const donutData = useMemo(() => {
    const total = sessions.length || 1;
    const hadir = presentCount;
    const terlambat = lateCount;
    const izin = records.filter((r) => r.status === "izin").length;
    const sakit = records.filter((r) => r.status === "sakit").length;
    const recordedCount = records.length;
    const belumAbsen = Math.max(0, total - recordedCount);

    if (sessions.length === 0) {
      return [{ name: "Belum Ada Sesi", value: 1, color: "#94a3b8" }];
    }

    return [
      { name: "Hadir Tepat Waktu", value: hadir, color: "#10B981" },
      { name: "Terlambat", value: terlambat, color: "#A855F7" },
      { name: "Izin", value: izin, color: "#3B82F6" },
      { name: "Sakit", value: sakit, color: "#F59E0B" },
      { name: "Belum Absen / Alpha", value: belumAbsen, color: "#F43F5E" },
    ].filter((item) => item.value > 0);
  }, [sessions, records, presentCount, lateCount]);

  const upcomingSessionsAll = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => new Date(s.ends_at) > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [sessions]);

  const upcomingSessions = useMemo(() => {
    return upcomingSessionsAll.slice(0, 5);
  }, [upcomingSessionsAll]);

  const recentRecords = records.slice(0, 5);

  if (!profile?.group_id && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ringkasan"
          description="Selamat datang di dashboard mahasiswa."
        />
        <Empty className="border">
          <EmptyMedia variant="icon">
            <ScanLine />
          </EmptyMedia>
          <EmptyTitle>Belum terdaftar dalam kelompok</EmptyTitle>
          <EmptyDescription>
            Akun Anda belum terhubung ke kelompok KKN. Hubungi dosen
            pembimbing untuk didaftarkan.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const studentName = profile?.full_name ?? "Mahasiswa";
  const studentNIM = profile?.student_id;

  return (
    <div className="space-y-6">
      <CampusEmailModal />

      {/* Kravio Top Header & Greeting for Mahasiswa */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Halo, {studentName} 👋
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Berikut ringkasan statistik &amp; riwayat presensi Anda {studentNIM ? `(NIM: ${studentNIM})` : ""}. Pantau kehadiran KKN Anda dalam satu tempat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="shadow-xs">
            <Link to="/scan">
              <ScanLine className="size-4" />
              Pindai QR Absen
            </Link>
          </Button>
        </div>
      </div>

      {/* 3 Stat Cards with Sparkline Graphics */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Hadir Tepat Waktu */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Hadir Tepat Waktu
              </span>
              <CalendarCheck className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : presentCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>{sessions.length > 0 ? `${Math.round((presentCount / sessions.length) * 100)}% dari Total Sesi` : "0% dari Total Sesi"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={presentCount > 0 ? [2, 4, 3, 6, 5, 8, 7, 10] : [1, 1, 2, 2, 3, 3]}
                  color="#10b981"
                  id="sparklineMhs1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Terlambat / Izin */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Terlambat / Izin
              </span>
              <Clock className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : lateCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                  <Activity className="size-3.5" />
                  <span>{lateCount > 0 ? `${lateCount} Sesi Terlambat` : "Tidak Ada Keterlambatan"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={lateCount > 0 ? [5, 3, 6, 4, 8, 5, 9] : [1, 2, 1, 2, 1, 3]}
                  color="#0284c7"
                  id="sparklineMhs2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Tingkat Kehadiran KKN */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tingkat Kehadiran KKN
              </span>
              <TrendingUp className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : `${attendanceRate}%`}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <UserCheck className="size-3.5" />
                  <span>{records.length} / {sessions.length} Sesi Terabsen</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={[20, 40, 35, 60, 55, 80, 75, 95]}
                  color="#a855f7"
                  id="sparklineMhs3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2-Column Grid: Left 70% BarChart, Right 30% Donut & Breakdown Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 70% (lg:col-span-2): Grafik Presensi Sesi KKN Saya */}
        <Card className="border border-border/60 shadow-2xs lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                <span>Grafik Presensi Sesi KKN Saya</span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Visualisasi tren dan status kehadiran Anda pada tiap sesi kegiatan KKN.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Hadir
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                <span className="size-2.5 rounded-full bg-purple-500" />
                Terlambat
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="size-2.5 rounded-full bg-rose-500" />
                Alpha / Belum
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-full w-full rounded-lg" />
              </div>
            ) : chartData.length === 0 ? (
              <Empty className="py-12 border-0">
                <EmptyMedia variant="icon">
                  <BarChart3 />
                </EmptyMedia>
                <EmptyTitle>Belum Ada Data Grafik</EmptyTitle>
                <EmptyDescription>
                  Grafik kehadiran akan muncul setelah dosen pembimbing membuat sesi KKN.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      className="text-muted-foreground"
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      allowDecimals={false}
                      domain={[0, 1]}
                      ticks={[0, 1]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => (val === 1 ? "Hadir" : "Belum")}
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      className="text-muted-foreground"
                    />
                    <Tooltip content={<CustomMahasiswaTooltip />} />
                    <Bar dataKey="hadir" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="terlambat" stackId="a" fill="#A855F7" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="izin" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="sakit" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="absen" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 30% (lg:col-span-1): Ringkasan Komposisi Presensi & Donut Chart */}
        <Card className="border border-border/60 shadow-2xs lg:col-span-1 flex flex-col justify-between">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" />
              <span>Komposisi Presensi</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Ringkasan rasio persentase kehadiran Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col justify-between gap-4">
            {/* Donut Chart */}
            <div className="h-[170px] w-full flex items-center justify-center relative my-auto">
              {loading ? (
                <Skeleton className="size-36 rounded-full" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            return (
                              <div className="rounded-lg border bg-popover p-2.5 shadow-xl text-xs space-y-1 z-50">
                                <p className="font-bold text-popover-foreground">{data.name}</p>
                                <p className="text-muted-foreground font-mono">
                                  {data.value} Sesi ({sessions.length > 0 ? Math.round(((data.value as number) / sessions.length) * 100) : 0}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                      {attendanceRate}%
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Kehadiran
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Status Breakdown Bar Lists */}
            <div className="space-y-2.5 pt-3 border-t text-xs">
              {/* Item 1: Hadir Tepat Waktu */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Hadir Tepat Waktu
                  </span>
                  <span className="font-mono text-muted-foreground font-bold">
                    {presentCount} / {sessions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${sessions.length > 0 ? (presentCount / sessions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Item 2: Terlambat */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className="size-2 rounded-full bg-purple-500" />
                    Terlambat
                  </span>
                  <span className="font-mono text-muted-foreground font-bold">
                    {lateCount} / {sessions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${sessions.length > 0 ? (lateCount / sessions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Item 3: Belum Absen / Alpha */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span className="size-2 rounded-full bg-rose-500" />
                    Belum Absen / Alpha
                  </span>
                  <span className="font-mono text-muted-foreground font-bold">
                    {Math.max(0, sessions.length - records.length)} / {sessions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${sessions.length > 0 ? (Math.max(0, sessions.length - records.length) / sessions.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Sesi Mendatang</CardTitle>
              <CardDescription className="mt-1">
                Sesi yang akan atau sedang berlangsung.
              </CardDescription>
            </div>
            {upcomingSessionsAll.length > 0 && (
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-semibold">
                <Link to="/history">
                  Lihat Semua ({upcomingSessionsAll.length})
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Tidak ada sesi yang dijadwalkan.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((s) => {
                  const now = new Date();
                  const isActive =
                    new Date(s.starts_at) <= now && new Date(s.ends_at) >= now;
                  const already = records.some((r) => r.session_id === s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {s.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(s.starts_at)}
                        </span>
                      </div>
                      {already ? (
                        <Badge variant="secondary">Sudah Absen</Badge>
                      ) : isActive ? (
                        <Button size="xs" asChild>
                          <Link to="/scan">Absen</Link>
                        </Button>
                      ) : (
                        <Badge variant="outline">Terjadwal</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Absen Terakhir</CardTitle>
                <CardDescription>Lima absen terkini Anda.</CardDescription>
              </div>
              <QrIcon className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentRecords.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Anda belum pernah melakukan absen. Mulai dengan memindai QR
                  dosen.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-2">
                {recentRecords.map((r) => {
                  const session = sessions.find((s) => s.id === r.session_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {session?.title ?? "Sesi"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(r.scanned_at)}
                        </span>
                      </div>
                      <Badge
                        variant={
                          r.status === "hadir"
                            ? "default"
                            : r.status === "terlambat"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          r.status === "hadir" &&
                            "bg-emerald-600 text-white dark:bg-emerald-600/80"
                        )}
                      >
                        {r.status === "hadir"
                          ? "Hadir"
                          : r.status === "terlambat"
                            ? "Terlambat"
                            : "Absen"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
