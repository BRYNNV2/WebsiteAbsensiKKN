import { useEffect, useMemo, useState } from "react";
import {
  Users,
  QrCode,
  CalendarClock,
  TrendingUp,
  Loader2,
  ShieldAlert,
  Search,
  CheckCircle2,
  BarChart3,
  Activity,
  ArrowUpRight,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { supabase, type QrSession, type AttendanceRecord } from "@/lib/supabase";
import { useDosenData } from "@/hooks/use-dosen-data";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

function formatRelative(iso: string) {
  const now = new Date();
  const past = new Date(iso);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffHour < 24) return `${diffHour}j lalu`;
  if (diffDay < 30) return `${diffDay}d lalu`;
  return past.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function MiniSparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const points = data.length > 2 ? data : [12, 18, 14, 24, 19, 28, 24, 32];
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

// Stable Custom Bar Tooltip Component for Recharts BarChart
function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const sessionTitle = payload[0]?.payload?.fullTitle || label;

  const labelsMap: Record<string, { name: string; color: string }> = {
    hadir: { name: "Hadir", color: "#10b981" },
    terlambat: { name: "Terlambat", color: "#a855f7" },
    izin: { name: "Izin", color: "#3b82f6" },
    sakit: { name: "Sakit", color: "#f59e0b" },
    absen: { name: "Alpha / Belum Scan", color: "#94a3b8" },
  };

  return (
    <div className="rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[210px] z-50 text-xs space-y-2 pointer-events-none animate-in fade-in-50 zoom-in-95">
      <p className="font-bold text-foreground border-b pb-1.5 text-xs tracking-tight">{sessionTitle}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => {
          const key = entry.dataKey as string;
          const info = labelsMap[key] || { name: key, color: entry.fill };
          const val = entry.value ?? 0;

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-muted-foreground font-medium">{info.name}</span>
              </div>
              <span className="font-mono font-bold text-foreground tabular-nums">
                {val} Mahasiswa
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DosenDashboardPage() {
  const { profile } = useAuth();
  const { group, students, loading, error } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters & Tabs
  const [chartRange, setChartRange] = useState<"Minggu Ini" | "Bulan Ini" | "Seluruh Sesi">("Seluruh Sesi");
  const [activityTab, setActivityTab] = useState<"Hari Ini" | "Semua">("Hari Ini");
  const [activitySearch, setActivitySearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!group) {
      setDataLoading(false);
      return;
    }
    (async () => {
      setDataLoading(true);
      const { data: s } = await supabase
        .from("qr_sessions")
        .select(
          "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
        )
        .eq("group_id", group.id)
        .order("starts_at", { ascending: true });
      const sessionList = (s as QrSession[]) ?? [];
      setSessions(sessionList);

      let recordList: AttendanceRecord[] = [];
      if (sessionList.length > 0) {
        const { data: r } = await supabase
          .from("attendance_records")
          .select("id, session_id, student_id, status, scanned_at, created_at")
          .in(
            "session_id",
            sessionList.map((x) => x.id)
          )
          .order("scanned_at", { ascending: false });
        recordList = (r as AttendanceRecord[]) ?? [];
      }
      setRecords(recordList);
      setDataLoading(false);
    })();
  }, [group]);

  const activeSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const now = new Date();
        return new Date(s.starts_at) <= now && new Date(s.ends_at) >= now;
      }),
    [sessions]
  );

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return records.filter(
      (r) => new Date(r.scanned_at).toDateString() === today
    ).length;
  }, [records]);

  const attendanceRate = useMemo(() => {
    if (students.length === 0 || sessions.length === 0) return 0;
    const expected = students.length * sessions.length;
    if (expected === 0) return 0;
    return Math.round((records.length / expected) * 100);
  }, [students, sessions, records]);

  // Filtered Sessions based on Chart Range
  const filteredSessionsForChart = useMemo(() => {
    if (chartRange === "Minggu Ini") return sessions.slice(-7);
    if (chartRange === "Bulan Ini") return sessions.slice(-30);
    return sessions;
  }, [sessions, chartRange]);

  // Stacked Bar chart data
  const barChartData = useMemo(() => {
    return filteredSessionsForChart.map((s, idx) => {
      const sessionRecords = records.filter((r) => r.session_id === s.id);
      const hadirCount = sessionRecords.filter((r) => r.status === "hadir").length;
      const terlambatCount = sessionRecords.filter((r) => r.status === "terlambat").length;
      const izinCount = sessionRecords.filter((r) => r.status === "izin").length;
      const sakitCount = sessionRecords.filter((r) => r.status === "sakit").length;
      const recordedTotal = hadirCount + terlambatCount + izinCount + sakitCount;
      const alphaCount = students.length > 0 ? Math.max(0, students.length - recordedTotal) : 0;

      // Pembersihan nama pendek XAxis (menghapus awalan berulang seperti "Absensi KKN62- ")
      let cleanName = s.title.replace(/^(Absensi\s*(KKN\d*\s*[-_]?\s*)?)/i, "").trim();
      if (!cleanName) {
        cleanName = s.title;
      }
      const displayName = cleanName.length > 14 ? cleanName.slice(0, 14) + "…" : cleanName;

      return {
        // ID Unik Sesi sebagai Key Recharts
        chartKey: s.id || `session-${idx}`,
        name: displayName,
        fullTitle: s.title,
        hadir: hadirCount,
        terlambat: terlambatCount,
        izin: izinCount,
        sakit: sakitCount,
        absen: alphaCount,
      };
    });
  }, [filteredSessionsForChart, records, students]);

  // Filtered Activity feed
  const filteredRecentRecords = useMemo(() => {
    const today = new Date().toDateString();
    let list = records;
    if (activityTab === "Hari Ini") {
      list = list.filter((r) => new Date(r.scanned_at).toDateString() === today);
    }
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      list = list.filter((r) => {
        const student = students.find((s) => s.id === r.student_id);
        const session = sessions.find((s) => s.id === r.session_id);
        return (
          student?.full_name.toLowerCase().includes(q) ||
          student?.student_id?.toLowerCase().includes(q) ||
          session?.title.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [records, activityTab, activitySearch, students, sessions]);

  // Students Table Metrics calculation
  const studentsPerformance = useMemo(() => {
    return students.map((st) => {
      const studentRecords = records.filter((r) => r.student_id === st.id);
      const totalSessions = sessions.length || 1;
      const presentCount = studentRecords.filter(
        (r) => r.status === "hadir" || r.status === "terlambat"
      ).length;
      const rate = Math.round((presentCount / totalSessions) * 100);
      const lastRecord = studentRecords[0] ?? null;
      const lastSession = lastRecord
        ? sessions.find((s) => s.id === lastRecord.session_id)
        : null;

      return {
        student: st,
        rate,
        presentCount,
        lastRecord,
        lastSession,
      };
    });
  }, [students, records, sessions]);

  // Filtered Students Table
  const filteredStudents = useMemo(() => {
    return studentsPerformance.filter((item) => {
      const q = tableSearch.toLowerCase();
      const nameMatch =
        item.student.full_name.toLowerCase().includes(q) ||
        (item.student.student_id ?? "").toLowerCase().includes(q);

      if (!nameMatch) return false;

      if (statusFilter === "high") return item.rate >= 90;
      if (statusFilter === "warning") return item.rate < 75;
      return true;
    });
  }, [studentsPerformance, tableSearch, statusFilter]);

  // Table Pagination State (6 mahasiswa per halaman)
  const TABLE_ITEMS_PER_PAGE = 6;
  const [tablePage, setTablePage] = useState(1);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, statusFilter]);

  const tableTotalPages = Math.ceil(filteredStudents.length / TABLE_ITEMS_PER_PAGE) || 1;

  const paginatedStudents = useMemo(() => {
    const start = (tablePage - 1) * TABLE_ITEMS_PER_PAGE;
    return filteredStudents.slice(start, start + TABLE_ITEMS_PER_PAGE);
  }, [filteredStudents, tablePage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Gagal memuat data: {error}</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <Empty className="border">
          <EmptyTitle>Kelompok KKN belum dibuat</EmptyTitle>
          <EmptyDescription>
            Saat mendaftar, kelompok KKN Anda seharusnya dibuat otomatis. Hubungi administrator untuk membuat kelompok secara manual.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const dosenName = profile?.full_name ?? "Dosen Pembimbing";

  return (
    <div className="space-y-6 pb-8">
      {/* Kravio Top Header & Greeting */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Halo, {dosenName} 👋
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Berikut ringkasan statistik & aktivitas kehadiran mahasiswa <span className="font-semibold text-foreground">{group?.name}</span> ({group?.location ?? "Lokasi KKN"}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="shadow-xs">
            <Link to="/sessions">
              <QrCode className="size-4" />
              Buat Sesi Absen
            </Link>
          </Button>
        </div>
      </div>

      {/* Kravio Top Metric Cards (3 Cards Grid with Mini Sparklines) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Total Mahasiswa */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Mahasiswa Binaan
              </span>
              <Users className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {students.length}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>100% Terverifikasi</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={students.length > 0 ? [5, 10, 8, 14, 11, 18, 15, 20] : [2, 4, 3, 6, 5, 8, 7, 10]}
                  color="#10b981"
                  id="sparkline1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Sesi Absen */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sesi Absen Terlaksana
              </span>
              <CalendarClock className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {dataLoading ? <Skeleton className="h-9 w-16" /> : sessions.length}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                  <Activity className="size-3.5" />
                  <span>{activeSessions.length} Sesi Aktif</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={sessions.length > 0 ? [2, 4, 3, 6, 5, 8, 6, 12] : [1, 2, 2, 4, 3, 5, 4, 6]}
                  color="#0284c7"
                  id="sparkline2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Rata-Rata Kehadiran */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Rata-Rata Kehadiran
              </span>
              <TrendingUp className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {dataLoading ? <Skeleton className="h-9 w-16" /> : `${attendanceRate}%`}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <UserCheck className="size-3.5" />
                  <span>{todayCount} Scan Hari Ini</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={[40, 65, 55, 80, 72, 88, 82, 95]}
                  color="#a855f7"
                  id="sparkline3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kravio Main Content 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Bar Chart Panel (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border border-border/60 shadow-2xs p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <BarChart3 className="size-4" />
                  <span>Volume Tren Absensi & Kehadiran</span>
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {records.length} Total Scan
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="size-3" />
                    +{attendanceRate}% Tingkat Kehadiran
                  </span>
                </div>
              </div>

              {/* Range Filter Pills */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-medium">
                {(["Minggu Ini", "Bulan Ini", "Seluruh Sesi"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={cn(
                      "px-3 py-1.5 rounded-md transition-all cursor-pointer",
                      chartRange === range
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Bar Chart Component */}
            <div className="pt-6 h-[320px] w-full">
              {dataLoading ? (
                <Skeleton className="h-full w-full" />
              ) : barChartData.length === 0 ? (
                <Empty className="border-0 p-0">
                  <EmptyDescription>
                    Belum ada sesi absen. Grafik akan muncul setelah sesi pertama dibuat.
                  </EmptyDescription>
                </Empty>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    maxBarSize={38}
                    barCategoryGap="25%"
                    margin={{ left: 0, right: 0, top: 10, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="barHadir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barTelat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barIzin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barSakit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#b45309" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barAbsen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} />
                    <XAxis
                      dataKey="chartKey"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(val) => {
                        const item = barChartData.find((b) => b.chartKey === val);
                        return item ? item.name : val;
                      }}
                      className="text-xs font-medium fill-muted-foreground"
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                      className="text-xs font-medium fill-muted-foreground"
                    />
                    <Tooltip
                      wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                      cursor={{ fill: "rgba(15, 23, 42, 0.06)", radius: 6 }}
                      content={<CustomBarTooltip />}
                      isAnimationActive={false}
                      useTranslate3d={true}
                      allowEscapeViewBox={{ x: true, y: true }}
                    />
                    <Bar dataKey="hadir" stackId="a" fill="url(#barHadir)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="terlambat" stackId="a" fill="url(#barTelat)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="izin" stackId="a" fill="url(#barIzin)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="sakit" stackId="a" fill="url(#barSakit)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="absen" stackId="a" fill="url(#barAbsen)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Kravio Chart Legend Footer */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t pt-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span>Hadir</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-purple-500" />
                <span>Terlambat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-blue-500" />
                <span>Izin</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span>Sakit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span>Alpha</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Activity Panel (4 Columns - Kravio Activity Feed style) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-border/60 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Aktivitas Terkini</h3>
              </div>

              {/* Date Filter Tabs */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md text-[11px] font-medium">
                {(["Hari Ini", "Semua"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActivityTab(tab)}
                    className={cn(
                      "px-2.5 py-1 rounded-xs transition-all cursor-pointer",
                      activityTab === tab
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari aktivitas mahasiswa..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="pl-8 text-xs h-8 bg-muted/30"
              />
            </div>

            <div className="text-xs font-semibold text-muted-foreground tracking-tight">
              {filteredRecentRecords.length} aktivitas scan & absensi
            </div>

            {/* Vertical Activity List */}
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {dataLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))
              ) : filteredRecentRecords.length === 0 ? (
                <Empty className="border-0 p-4">
                  <EmptyDescription className="text-xs">
                    Belum ada aktivitas scan {activityTab === "Hari Ini" ? "hari ini" : ""}.
                  </EmptyDescription>
                </Empty>
              ) : (
                filteredRecentRecords.map((r) => {
                  const student = students.find((s) => s.id === r.student_id);
                  const session = sessions.find((s) => s.id === r.session_id);
                  const statusLabel =
                    r.status === "hadir"
                      ? "Hadir"
                      : r.status === "terlambat"
                        ? "Terlambat"
                        : r.status === "izin"
                          ? "Izin"
                          : r.status === "sakit"
                            ? "Sakit"
                            : "Alpha";

                  const badgeColor =
                    r.status === "hadir"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : r.status === "terlambat"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        : r.status === "izin"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : r.status === "sakit"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

                  return (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3 transition-all hover:bg-muted/40"
                    >
                      <Avatar className="size-8 mt-0.5 border">
                        <AvatarFallback className="text-[10px] font-bold">
                          {initials(student?.full_name ?? "MH")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {student?.full_name ?? "Mahasiswa"}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                            {formatRelative(r.scanned_at)}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {session?.title ?? "Sesi Absensi"}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                              badgeColor
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Kravio Bottom Full-Width Table ("Monitoring Kehadiran Mahasiswa") */}
      <Card className="border border-border/60 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <h3 className="font-semibold text-base text-foreground">
              Monitoring Kehadiran Mahasiswa
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pantau performa absensi & tingkat kehadiran seluruh mahasiswa kelompok {group?.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Mahasiswa Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIM..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-medium">
              {[
                { id: "all", label: "Semua" },
                { id: "high", label: "Hadir > 90%" },
                { id: "warning", label: "Butuh Perhatian" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                    statusFilter === f.id
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/recap">Lihat Rekap Matrix</Link>
            </Button>
          </div>
        </div>

        {/* Monitoring Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Mahasiswa</TableHead>
                <TableHead>NIM</TableHead>
                <TableHead>Performa Kehadiran</TableHead>
                <TableHead>Status Terakhir</TableHead>
                <TableHead>Sesi Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Empty className="border-0 p-0">
                      <EmptyTitle className="text-sm">Mahasiswa tidak ditemukan</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        Coba kata kunci pencarian atau filter lain.
                      </EmptyDescription>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStudents.map((item) => {
                  const { student: st, rate, lastRecord, lastSession } = item;
                  const statusLabel = lastRecord
                    ? lastRecord.status === "hadir"
                      ? "Hadir"
                      : lastRecord.status === "terlambat"
                        ? "Terlambat"
                        : lastRecord.status === "izin"
                          ? "Izin"
                          : lastRecord.status === "sakit"
                            ? "Sakit"
                            : "Alpha"
                    : "Belum Absen";

                  return (
                    <TableRow key={st.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 border">
                            <AvatarFallback className="text-xs font-bold">
                              {initials(st.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">
                              {st.full_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {st.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {st.student_id ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 w-40">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                rate >= 90
                                  ? "bg-emerald-500"
                                  : rate >= 75
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              )}
                              style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs tabular-nums text-foreground">
                            {rate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-semibold text-[11px]",
                            lastRecord?.status === "hadir" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            lastRecord?.status === "terlambat" &&
                              "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                            lastRecord?.status === "izin" &&
                              "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                            lastRecord?.status === "sakit" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            (!lastRecord || lastRecord.status === "absen") &&
                              "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}
                        >
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastSession ? lastSession.title : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                          <Link to="/recap">
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Pagination Controls */}
        {filteredStudents.length > TABLE_ITEMS_PER_PAGE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-xs">
            <div className="text-muted-foreground font-medium">
              Menampilkan{" "}
              <span className="font-bold text-foreground">
                {(tablePage - 1) * TABLE_ITEMS_PER_PAGE + 1}
              </span>{" "}
              -{" "}
              <span className="font-bold text-foreground">
                {Math.min(tablePage * TABLE_ITEMS_PER_PAGE, filteredStudents.length)}
              </span>{" "}
              dari <span className="font-bold text-foreground">{filteredStudents.length}</span> Mahasiswa
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="h-8 gap-1 text-xs cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>Sebelumnya</span>
              </Button>

              <div className="flex items-center gap-1 px-2 font-medium text-xs text-muted-foreground">
                Halaman <span className="font-bold text-foreground">{tablePage}</span> dari{" "}
                <span className="font-bold text-foreground">{tableTotalPages}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setTablePage((p) => Math.min(tableTotalPages, p + 1))}
                disabled={tablePage === tableTotalPages}
                className="h-8 gap-1 text-xs cursor-pointer"
              >
                <span>Selanjutnya</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
