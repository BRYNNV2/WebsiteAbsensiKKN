import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, Download, Filter } from "lucide-react";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    month: "short",
    year: "numeric",
  });
}

export function DosenRecapPage() {
  const { group, students, loading } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string>("all");

  useEffect(() => {
    if (!group) {
      setDataLoading(false);
      return;
    }
    (async () => {
      setDataLoading(true);
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase
          .from("qr_sessions")
          .select(
            "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
          )
          .eq("group_id", group.id)
          .order("starts_at", { ascending: false }),
        supabase
          .from("attendance_records")
          .select(
            "id, session_id, student_id, status, scanned_at, created_at"
          ),
      ]);
      const sessionIds = (s as QrSession[])?.map((x) => x.id) ?? [];
      const filteredRecords = ((r as AttendanceRecord[]) ?? []).filter((rec) =>
        sessionIds.includes(rec.session_id)
      );
      setSessions((s as QrSession[]) ?? []);
      setRecords(filteredRecords);
      setDataLoading(false);
    })();
  }, [group]);

  const filteredSessions = useMemo(() => {
    if (selectedSession === "all") return sessions;
    return sessions.filter((s) => s.id === selectedSession);
  }, [sessions, selectedSession]);

  const matrix = useMemo(() => {
    return students.map((student) => {
      const row = {
        student,
        attendances: filteredSessions.map((session) => {
          const rec = records.find(
            (r) => r.session_id === session.id && r.student_id === student.id
          );
          return { session, record: rec ?? null };
        }),
        present: 0,
        late: 0,
        absent: 0,
      };
      row.attendances.forEach(({ record }) => {
        if (record?.status === "hadir") row.present += 1;
        else if (record?.status === "terlambat") row.late += 1;
        else row.absent += 1;
      });
      return row;
    });
  }, [students, filteredSessions, records]);

  function handleExportCsv() {
    if (matrix.length === 0 || filteredSessions.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }
    const headers = [
      "Nama",
      "NIM",
      "Email",
      ...filteredSessions.map((s) => s.title),
      "Hadir",
      "Terlambat",
      "Absen",
    ];
    const rows = matrix.map((r) => [
      r.student.full_name,
      r.student.student_id ?? "",
      r.student.email,
      ...r.attendances.map((a) => a.record?.status ?? "absen"),
      String(r.present),
      String(r.late),
      String(r.absent),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-absensi-${group?.name ?? "kkn"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rekap berhasil diunduh sebagai CSV.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Rekap Kehadiran"
          description="Rekapitulasi kehadiran seluruh mahasiswa."
        />
        <Empty className="border">
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Kelompok KKN belum siap</EmptyTitle>
          <EmptyDescription>
            Rekap kehadiran tersedia setelah kelompok dan sesi absen terbentuk.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kehadiran"
        description="Rekapitulasi kehadiran mahasiswa untuk setiap sesi absen."
        action={
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="size-4" />
            Ekspor CSV
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Matrix Kehadiran</CardTitle>
              <CardDescription>
                {students.length} mahasiswa - {filteredSessions.length} sesi
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select
                value={selectedSession}
                onValueChange={setSelectedSession}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Pilih sesi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sesi</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : matrix.length === 0 || filteredSessions.length === 0 ? (
            <Empty className="border">
              <EmptyTitle>Belum ada data rekap</EmptyTitle>
              <EmptyDescription>
                Tambahkan mahasiswa dan buat sesi absen untuk melihat
                rekapitulasi kehadiran di sini.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">
                      Mahasiswa
                    </TableHead>
                    {filteredSessions.map((s) => (
                      <TableHead key={s.id} className="text-center">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{s.title}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDate(s.starts_at)}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Telat</TableHead>
                    <TableHead className="text-center">Absen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map((row) => (
                    <TableRow key={row.student.id}>
                      <TableCell className="sticky left-0 bg-background">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {row.student.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.student.student_id}
                          </span>
                        </div>
                      </TableCell>
                      {row.attendances.map((a) => (
                        <TableCell key={a.session.id} className="text-center">
                          <Badge
                            variant={
                              a.record?.status === "hadir"
                                ? "default"
                                : a.record?.status === "terlambat"
                                  ? "secondary"
                                  : "outline"
                            }
                            className={cn(
                              a.record?.status === "hadir" &&
                                "bg-emerald-600 text-white dark:bg-emerald-600/80",
                              a.record?.status === "absen" &&
                                "text-muted-foreground"
                            )}
                          >
                            {a.record?.status === "hadir"
                              ? "Hadir"
                              : a.record?.status === "terlambat"
                                ? "Telat"
                                : "Absen"}
                          </Badge>
                        </TableCell>
                      ))}
                      <TableCell className="text-center tabular-nums">
                        {row.present}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.late}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">
                        {row.absent}
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
