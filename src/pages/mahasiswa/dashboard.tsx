import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  TrendingUp,
  ScanLine,
  Clock,
  QrCode as QrIcon,
} from "lucide-react";

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

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof CalendarCheck;
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

export function MahasiswaDashboardPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.group_id) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: sData }, { data: rData }] = await Promise.all([
        supabase
          .from("qr_sessions")
          .select(
            "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
          )
          .eq("group_id", profile.group_id)
          .order("starts_at", { ascending: false }),
        supabase
          .from("attendance_records")
          .select(
            "id, session_id, student_id, status, scanned_at, created_at"
          )
          .eq("student_id", profile.id)
          .order("scanned_at", { ascending: false }),
      ]);
      setSessions((sData as QrSession[]) ?? []);
      setRecords((rData as AttendanceRecord[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

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

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => new Date(s.ends_at) > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 3);
  }, [sessions]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan"
        description="Pantau kehadiran KKN Anda dalam satu tempat."
        action={
          <Button asChild>
            <Link to="/scan">
              <ScanLine className="size-4" />
              Pindai QR
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Hadir"
          value={presentCount}
          icon={CalendarCheck}
          hint="Sesi yang dihadiri tepat waktu"
          loading={loading}
        />
        <StatCard
          label="Terlambat"
          value={lateCount}
          icon={Clock}
          hint="Sesi dengan keterlambatan"
          loading={loading}
        />
        <StatCard
          label="Tingkat Kehadiran"
          value={`${attendanceRate}%`}
          icon={TrendingUp}
          hint="Dari seluruh sesi kelompok"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesi Mendatang</CardTitle>
            <CardDescription>
              Sesi yang akan atau sedang berlangsung.
            </CardDescription>
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
