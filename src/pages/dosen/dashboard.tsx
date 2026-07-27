import { useEffect, useMemo, useState } from "react";
import {
  Users,
  QrCode,
  CalendarClock,
  TrendingUp,
  Loader2,
  ShieldAlert,
  UserPlus,
  Clock,
  Mail,
  Calendar,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase, type QrSession, type AttendanceRecord } from "@/lib/supabase";
import { useDosenData } from "@/hooks/use-dosen-data";
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
import { Link } from "react-router-dom";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

function formatRelative(iso: string) {
  const now = new Date();
  const past = new Date(iso);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 30) return `${diffDay} hari lalu`;
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

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-3xl tabular-nums">
          {loading ? <Skeleton className="h-9 w-16" /> : value}
        </CardTitle>
        {hint && (
          <CardDescription className="pt-0">{hint}</CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

export function DosenDashboardPage() {
  const { group, students, loading, error } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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
          .select(
            "id, session_id, student_id, status, scanned_at, created_at"
          )
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

  // Stacked Bar chart: status kehadiran per sesi (hadir, terlambat, izin, sakit, alpha)
  const barChartData = useMemo(() => {
    return sessions.map((s) => {
      const sessionRecords = records.filter((r) => r.session_id === s.id);
      const hadirCount = sessionRecords.filter((r) => r.status === "hadir").length;
      const terlambatCount = sessionRecords.filter((r) => r.status === "terlambat").length;
      const izinCount = sessionRecords.filter((r) => r.status === "izin").length;
      const sakitCount = sessionRecords.filter((r) => r.status === "sakit").length;
      const recordedTotal = hadirCount + terlambatCount + izinCount + sakitCount;
      const alphaCount = students.length > 0 ? Math.max(0, students.length - recordedTotal) : 0;

      return {
        name: s.title.length > 12 ? s.title.slice(0, 12) + "…" : s.title,
        fullTitle: s.title,
        hadir: hadirCount,
        terlambat: terlambatCount,
        izin: izinCount,
        sakit: sakitCount,
        absen: alphaCount,
      };
    });
  }, [sessions, records, students]);

  function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
    if (!active || !payload || !payload.length) return null;
    const sessionTitle = payload[0]?.payload?.fullTitle || label;

    const labelsMap: Record<string, { name: string; color: string }> = {
      hadir: { name: "Hadir", color: "#10b981" },
      terlambat: { name: "Terlambat", color: "#a855f7" },
      izin: { name: "Izin", color: "#3b82f6" },
      sakit: { name: "Sakit", color: "#f59e0b" },
      absen: { name: "Alpha", color: "#f43f5e" },
    };

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-xl min-w-[180px] z-50 text-xs">
        <p className="font-bold text-foreground border-b pb-1.5 mb-2 text-sm">{sessionTitle}</p>
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
                  {val} mhs
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Area chart: cumulative student registration growth over time
  const areaChartData = useMemo(() => {
    const sortedStudents = [...students].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let cumulative = 0;
    const dataPoints = sortedStudents.map((s) => {
      cumulative += 1;
      return {
        date: formatDateShort(s.created_at),
        total: cumulative,
      };
    });
    if (dataPoints.length === 0) return [];
    if (dataPoints.length === 1) {
      return [
        { date: formatDateShort(new Date(Date.now() - 86400000).toISOString()), total: 0 },
        ...dataPoints,
      ];
    }
    return dataPoints;
  }, [students]);

  // Recent student registrations (sorted by newest first)
  const recentStudents = useMemo(() => {
    return [...students]
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5);
  }, [students]);

  // Recent attendance records (limited to 6)
  const recentRecords = useMemo(() => records.slice(0, 6), [records]);

  const recentSessions = useMemo(() => sessions.slice(-5).reverse(), [sessions]);

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
        <p className="text-sm text-muted-foreground">
          Gagal memuat data: {error}
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ringkasan"
          description="Selamat datang di dashboard dosen pembimbing."
        />
        <Empty className="border">
          <EmptyTitle>Kelompok KKN belum dibuat</EmptyTitle>
          <EmptyDescription>
            Saat mendaftar, kelompok KKN Anda seharusnya dibuat otomatis.
            Jika pesan ini muncul, hubungi administrator untuk membuat
            kelompok secara manual.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan"
        description={`${group.name} - ${group.location ?? "Lokasi belum diisi"}`}
        action={
          <Button asChild>
            <Link to="/sessions">
              <QrCode className="size-4" />
              Buat Sesi Absen
            </Link>
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mahasiswa Terdaftar"
          value={students.length}
          icon={Users}
          hint="Anggota kelompok KKN"
          loading={loading}
        />
        <StatCard
          label="Sesi Absen Aktif"
          value={activeSessions.length}
          icon={CalendarClock}
          hint="Sedang berlangsung sekarang"
          loading={dataLoading}
        />
        <StatCard
          label="Absen Hari Ini"
          value={todayCount}
          icon={TrendingUp}
          hint="Total scan pada hari ini"
          loading={dataLoading}
        />
        <StatCard
          label="Tingkat Kehadiran"
          value={`${attendanceRate}%`}
          icon={QrCode}
          hint="Rata-rata seluruh sesi"
          loading={dataLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Distribusi Kehadiran per Sesi</CardTitle>
              <CardDescription>
                Rincian mahasiswa Hadir, Terlambat, Izin, Sakit, dan Alpha tiap sesi.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : barChartData.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Belum ada sesi absen. Grafik akan muncul setelah sesi pertama dibuat.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ left: 10, right: 10, top: 12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="barHadir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barTelat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barIzin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barSakit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#b45309" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barAbsen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#be123c" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs font-medium"
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} className="text-xs" />
                    <Tooltip
                      wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                      cursor={{ fill: "rgba(0, 0, 0, 0.06)" }}
                      content={<CustomBarTooltip />}
                    />
                    <Bar dataKey="hadir" stackId="a" fill="url(#barHadir)" />
                    <Bar dataKey="terlambat" stackId="a" fill="url(#barTelat)" />
                    <Bar dataKey="izin" stackId="a" fill="url(#barIzin)" />
                    <Bar dataKey="sakit" stackId="a" fill="url(#barSakit)" />
                    <Bar dataKey="absen" stackId="a" fill="url(#barAbsen)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pertumbuhan Mahasiswa Terdaftar</CardTitle>
            <CardDescription>
              Akumulasi jumlah mahasiswa yang didaftarkan dari waktu ke waktu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : areaChartData.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Belum ada mahasiswa terdaftar. Grafik akan muncul setelah
                  mahasiswa pertama ditambahkan.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaChartData} margin={{ left: 12, right: 12, top: 12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs font-medium"
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} className="text-xs" />
                    <Tooltip
                      wrapperStyle={{ zIndex: 1000, pointerEvents: "none" }}
                      cursor={{ stroke: "#0284c7", strokeWidth: 1 }}
                    />
                    <Area
                      dataKey="total"
                      name="Mahasiswa"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      fill="url(#fillTotal)"
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent registrations + attendance activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mahasiswa Terdaftar Terbaru</CardTitle>
                <CardDescription>
                  Mahasiswa yang baru saja ditambahkan ke kelompok.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/students">
                  <Users className="size-4" />
                  Lihat Semua
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentStudents.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Belum ada mahasiswa terdaftar. Tambahkan mahasiswa binaan
                  Anda dari menu Mahasiswa.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-3">
                {recentStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Avatar size="sm">
                      <AvatarFallback>{initials(s.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {s.full_name}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" />
                          <span className="truncate">{s.email}</span>
                        </span>
                        {s.student_id && (
                          <span className="inline-flex items-center gap-1">
                            <UserPlus className="size-3" />
                            {s.student_id}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className="font-mono">
                        {s.student_id ?? "—"}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatRelative(s.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Absen Terkini</CardTitle>
            <CardDescription>
              Scan QR terbaru dari mahasiswa kelompok Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentRecords.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Belum ada aktivitas absen dari mahasiswa.
                </EmptyDescription>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mahasiswa</TableHead>
                    <TableHead>Sesi</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map((r) => {
                    const student = students.find((s) => s.id === r.student_id);
                    const session = sessions.find((s) => s.id === r.session_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {student?.full_name ?? "Mahasiswa"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {session?.title ?? "Sesi"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(r.scanned_at)}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sesi Absen Terbaru</CardTitle>
              <CardDescription>
                Sesi yang baru saja dibuat atau sedang berlangsung.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/sessions">
                <QrCode className="size-4" />
                Kelola Sesi
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyDescription>
                Belum ada sesi absen. Mulai buat sesi pertama Anda.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentSessions.map((s) => {
                const now = new Date();
                const isActive =
                  new Date(s.starts_at) <= now && new Date(s.ends_at) >= now;
                const isPast = new Date(s.ends_at) < now;
                const sessionRecs = records.filter((r) => r.session_id === s.id);
                const presentCount = sessionRecs.filter((r) => r.status === "hadir" || r.status === "terlambat").length;
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {s.title}
                      </span>
                      <Badge
                        variant={
                          isActive
                            ? "default"
                            : isPast
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          isActive &&
                            "bg-emerald-600 text-white dark:bg-emerald-600/80"
                        )}
                      >
                        {isActive ? "Aktif" : isPast ? "Selesai" : "Terjadwal"}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDateShort(s.starts_at)} •{" "}
                        {new Date(s.starts_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {s.location && (
                        <span className="truncate">{s.location}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground">Kehadiran</span>
                      <span className="font-medium tabular-nums">
                        {presentCount} / {students.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
