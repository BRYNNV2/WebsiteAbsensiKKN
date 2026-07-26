import { useEffect, useState } from "react";
import { Loader2, History, Calendar } from "lucide-react";

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

export function MahasiswaHistoryPage() {
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
        <Card>
          <CardHeader>
            <CardDescription>Hadir</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
              {loading ? <Skeleton className="h-8 w-12" /> : presentCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Terlambat</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? <Skeleton className="h-8 w-12" /> : lateCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Belum Absen</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-muted-foreground">
              {loading ? <Skeleton className="h-8 w-12" /> : absentCount}
            </CardTitle>
          </CardHeader>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
