import { useEffect, useState } from "react";
import {
  Loader2,
  History,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  XCircle,
  CalendarCheck,
} from "lucide-react";

import { supabase, type AttendanceRecord, type QrSession } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
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
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
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

export function MahasiswaHistoryPage() {
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
        console.error("Error loading mahasiswa history data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [groupId, studentId]);

  const allRows = sessions.map((s) => {
    const rec = records.find((r) => r.session_id === s.id);
    return { session: s, record: rec ?? null };
  });

  const presentCount = records.filter((r) => r.status === "hadir").length;
  const lateCount = records.filter((r) => r.status === "terlambat").length;
  const absentCount = allRows.filter((r) => !r.record).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Absen"
        description="Catatan kehadiran Anda pada setiap sesi absen kelompok."
      />

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
                  <span>{sessions.length > 0 ? `${Math.round((presentCount / sessions.length) * 100)}% Presensi Hadir` : "0% Presensi Hadir"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={presentCount > 0 ? [2, 4, 3, 6, 5, 8, 7, 10] : [1, 1, 2, 2, 3, 3]}
                  color="#10b981"
                  id="sparklineHistory1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Terlambat */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Terlambat
              </span>
              <Clock className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : lateCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <Activity className="size-3.5" />
                  <span>{lateCount > 0 ? `${lateCount} Sesi Terlambat` : "Tidak Ada Keterlambatan"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={lateCount > 0 ? [5, 3, 6, 4, 8, 5, 9] : [1, 2, 1, 2, 1, 3]}
                  color="#a855f7"
                  id="sparklineHistory2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Belum Absen / Alpha */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Belum Absen / Alpha
              </span>
              <AlertCircle className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : absentCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <XCircle className="size-3.5" />
                  <span>{absentCount > 0 ? `${absentCount} Sesi Belum Dipindai` : "Seluruh Sesi Terabsen"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={absentCount > 0 ? [8, 7, 6, 5, 4, 3, 2, 1] : [0, 0, 0, 0, 0, 0]}
                  color="#f43f5e"
                  id="sparklineHistory3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Lengkap</CardTitle>
          <CardDescription>
            {allRows.length} sesi terdaftar untuk kelompok Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : allRows.length === 0 ? (
            <Empty className="border">
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>Belum ada sesi absen</EmptyTitle>
              <EmptyDescription>
                Riwayat Anda akan muncul di sini setelah dosen membuat sesi
                absen.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sesi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Waktu Scan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRows.map(({ session, record }) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.title}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="size-3.5" />
                        {formatDate(session.starts_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(session.starts_at)} -{" "}
                      {formatTime(session.ends_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record ? formatTime(record.scanned_at) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record?.status === "hadir"
                            ? "default"
                            : record?.status === "terlambat"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          record?.status === "hadir" &&
                            "bg-emerald-600 text-white dark:bg-emerald-600/80",
                          !record && "text-muted-foreground"
                        )}
                      >
                        {record?.status === "hadir"
                          ? "Hadir"
                          : record?.status === "terlambat"
                            ? "Terlambat"
                            : "Belum Absen"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
