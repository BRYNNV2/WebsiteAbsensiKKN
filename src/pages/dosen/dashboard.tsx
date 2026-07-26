import { useEffect, useMemo, useState } from "react";
import {
  Users,
  QrCode,
  CalendarClock,
  TrendingUp,
  Loader2,
  ShieldAlert,
} from "lucide-react";

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
        .order("created_at", { ascending: false })
        .limit(5);
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
          .order("scanned_at", { ascending: false })
          .limit(8);
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesi Absen Terbaru</CardTitle>
            <CardDescription>
              Lima sesi yang baru saja Anda buat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyDescription>
                  Belum ada sesi absen. Mulai buat sesi pertama Anda.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const now = new Date();
                  const isActive =
                    new Date(s.starts_at) <= now &&
                    new Date(s.ends_at) >= now;
                  const isPast = new Date(s.ends_at) < now;
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
                          {formatDateTime(s.starts_at)} -{" "}
                          {new Date(s.ends_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <Badge
                        variant={
                          isActive
                            ? "default"
                            : isPast
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {isActive
                          ? "Aktif"
                          : isPast
                            ? "Selesai"
                            : "Terjadwal"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Absen Terkini</CardTitle>
            <CardDescription>
              Scan terbaru dari mahasiswa kelompok Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : records.length === 0 ? (
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
                    <TableHead>Waktu</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const student = students.find((s) => s.id === r.student_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {student?.full_name ?? "Mahasiswa"}
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
    </div>
  );
}
