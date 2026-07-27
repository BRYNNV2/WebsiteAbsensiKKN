import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, Download, Filter, UserCheck, CheckCircle2, Clock, FileText, Stethoscope, XCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase, type QrSession, type AttendanceRecord, type AttendanceStatus } from "@/lib/supabase";
import { useDosenData } from "@/hooks/use-dosen-data";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const statusBadges: Record<AttendanceStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  hadir: {
    label: "Hadir",
    icon: CheckCircle2,
    className: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600/80",
  },
  terlambat: {
    label: "Telat",
    icon: Clock,
    className: "bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600/80",
  },
  izin: {
    label: "Izin",
    icon: FileText,
    className: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600/80",
  },
  sakit: {
    label: "Sakit",
    icon: Stethoscope,
    className: "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600/80",
  },
  absen: {
    label: "Alpha",
    icon: XCircle,
    className: "bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-600/80",
  },
};

export function DosenRecapPage() {
  const { group, students, loading } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);

  // Modal Manual Dialog state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualStudentId, setManualStudentId] = useState<string>("");
  const [manualSessionId, setManualSessionId] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>("hadir");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const loadData = async () => {
    if (!group) {
      setDataLoading(false);
      return;
    }
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
        .select("id, session_id, student_id, status, scanned_at, created_at"),
    ]);
    const sessionIds = (s as QrSession[])?.map((x) => x.id) ?? [];
    const filteredRecords = ((r as AttendanceRecord[]) ?? []).filter((rec) =>
      sessionIds.includes(rec.session_id)
    );
    setSessions((s as QrSession[]) ?? []);
    setRecords(filteredRecords);
    setDataLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [group]);

  const filteredSessions = useMemo(() => {
    if (selectedSession === "all") return sessions;
    if (selectedSession === "latest10") return sessions.slice(0, 10);
    if (selectedSession === "latest7") return sessions.slice(0, 7);
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
        permission: 0,
        sick: 0,
        absent: 0,
      };
      row.attendances.forEach(({ record }) => {
        const st = record?.status;
        if (st === "hadir") row.present += 1;
        else if (st === "terlambat") row.late += 1;
        else if (st === "izin") row.permission += 1;
        else if (st === "sakit") row.sick += 1;
        else row.absent += 1;
      });
      return row;
    });
  }, [students, filteredSessions, records]);

  async function handleSetStatus(sessionId: string, studentId: string, newStatus: AttendanceStatus) {
    const cellKey = `${sessionId}_${studentId}`;
    setUpdatingCell(cellKey);
    try {
      const { error } = await supabase.rpc("set_manual_attendance", {
        p_session_id: sessionId,
        p_student_id: studentId,
        p_status: newStatus,
      });

      if (error) {
        if (newStatus === "absen") {
          await supabase
            .from("attendance_records")
            .delete()
            .eq("session_id", sessionId)
            .eq("student_id", studentId);
        } else {
          await supabase.from("attendance_records").upsert(
            {
              session_id: sessionId,
              student_id: studentId,
              status: newStatus,
              scanned_at: new Date().toISOString(),
            },
            { onConflict: "session_id,student_id" }
          );
        }
      }

      toast.success(`Status absensi diperbarui menjadi ${statusBadges[newStatus].label}.`);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message ?? "Gagal memperbarui status absensi.");
    } finally {
      setUpdatingCell(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualStudentId || !manualSessionId) {
      toast.error("Harap pilih Mahasiswa dan Sesi pertemuan.");
      return;
    }
    setManualSubmitting(true);
    try {
      await handleSetStatus(manualSessionId, manualStudentId, manualStatus);
      setManualDialogOpen(false);
      setManualStudentId("");
      setManualSessionId("");
    } finally {
      setManualSubmitting(false);
    }
  }

  function handleExportCsv() {
    if (matrix.length === 0 || filteredSessions.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }
    const filterSuffix =
      selectedSession === "latest7"
        ? "-1minggu"
        : selectedSession === "latest10"
          ? "-10sesi"
          : selectedSession !== "all"
            ? "-sesi-spesifik"
            : "-semua-sesi";

    const headers = [
      "Nama Mahasiswa",
      "NIM",
      "Email",
      ...filteredSessions.map((s) => s.title),
      "Hadir",
      "Terlambat",
      "Izin",
      "Sakit",
      "Alpha",
    ];
    const rows = matrix.map((r) => [
      r.student.full_name,
      r.student.student_id ?? "",
      r.student.email,
      ...r.attendances.map((a) => a.record?.status ?? "absen"),
      String(r.present),
      String(r.late),
      String(r.permission),
      String(r.sick),
      String(r.absent),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-absensi-${group?.name ?? "kkn"}${filterSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rekap CSV berhasil diunduh.");
  }

  function handleExportPdf() {
    if (matrix.length === 0 || filteredSessions.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }

    const filterText =
      selectedSession === "latest7"
        ? "Laporan 1 Minggu (7 Sesi Terbaru)"
        : selectedSession === "latest10"
          ? "Laporan 10 Sesi Terbaru"
          : selectedSession !== "all"
            ? `Sesi: ${sessions.find((s) => s.id === selectedSession)?.title ?? "Spesifik"}`
            : "Seluruh Sesi KKN";

    const filterSuffix =
      selectedSession === "latest7"
        ? "-1minggu"
        : selectedSession === "latest10"
          ? "-10sesi"
          : selectedSession !== "all"
            ? "-sesi-spesifik"
            : "-semua-sesi";

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Header Laporan Resmi
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text("REKAPITULASI KEHADIRAN MAHASISWA KKN", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Kelompok: ${group?.name ?? "-"} | ${filterText} | Lokasi: ${group?.location ?? "-"}`, 14, 21);
      doc.text(`Dicetak pada: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 14, 26);

      const tableHeaders = [
        "No",
        "Nama Mahasiswa",
        "NIM",
        ...filteredSessions.map((s) => s.title),
        "Hadir",
        "Telat",
        "Izin",
        "Sakit",
        "Alpha",
      ];

      const statusMap: Record<string, string> = {
        hadir: "Hadir",
        terlambat: "Telat",
        izin: "Izin",
        sakit: "Sakit",
        absen: "Alpha",
      };

      const tableData = matrix.map((r, idx) => [
        String(idx + 1),
        r.student.full_name,
        r.student.student_id ?? "-",
        ...r.attendances.map((a) => statusMap[a.record?.status ?? "absen"] || "Alpha"),
        String(r.present),
        String(r.late),
        String(r.permission),
        String(r.sick),
        String(r.absent),
      ]);

      autoTable(doc, {
        startY: 30,
        head: [tableHeaders],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 45 },
          2: { halign: "center", cellWidth: 28 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      doc.save(`rekap-absensi-${group?.name ?? "kkn"}${filterSuffix}.pdf`);
      toast.success("Laporan Rekap PDF berhasil diunduh.");
    } catch (err) {
      toast.error("Gagal mengunduh PDF: " + (err as Error).message);
    }
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
        description="Rekapitulasi dan pengisian absensi manual (Hadir, Izin, Sakit, Terlambat, Absen)."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setManualDialogOpen(true)}>
              <UserCheck className="size-4" />
              Absen Manual
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <FileText className="size-4 text-rose-600 dark:text-rose-400" />
              Ekspor PDF
            </Button>
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
              Ekspor CSV
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Matrix Kehadiran</CardTitle>
              <CardDescription>
                {students.length} mahasiswa - {filteredSessions.length} sesi (Klik status untuk mengubah manual)
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
                  <SelectItem value="all">Semua Sesi ({sessions.length})</SelectItem>
                  {sessions.length > 7 && (
                    <SelectItem value="latest7">7 Sesi Terbaru (1 Minggu)</SelectItem>
                  )}
                  {sessions.length > 10 && (
                    <SelectItem value="latest10">10 Sesi Terbaru</SelectItem>
                  )}
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
                      <TableHead key={s.id} className="text-center min-w-[120px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{s.title}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {formatDate(s.starts_at)}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Hadir</TableHead>
                    <TableHead className="text-center font-bold">Telat</TableHead>
                    <TableHead className="text-center font-bold text-blue-600 dark:text-blue-400">Izin</TableHead>
                    <TableHead className="text-center font-bold text-amber-600 dark:text-amber-400">Sakit</TableHead>
                    <TableHead className="text-center font-bold text-rose-600 dark:text-rose-400">Alpha</TableHead>
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
                          <span className="text-xs text-muted-foreground font-mono">
                            {row.student.student_id}
                          </span>
                        </div>
                      </TableCell>
                      {row.attendances.map((a) => {
                        const currentStatus: AttendanceStatus = a.record?.status ?? "absen";
                        const cellKey = `${a.session.id}_${row.student.id}`;
                        const isUpdating = updatingCell === cellKey;
                        const badgeInfo = statusBadges[currentStatus];

                        return (
                          <TableCell key={a.session.id} className="text-center p-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  className={cn(
                                    "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs transition-all hover:scale-105 cursor-pointer disabled:opacity-50 mx-auto",
                                    badgeInfo.className
                                  )}
                                >
                                  {isUpdating ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <>
                                      <span>{badgeInfo.label}</span>
                                      <ChevronDown className="size-3 opacity-80" />
                                    </>
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-[180px]">
                                <DropdownMenuItem
                                  className="cursor-pointer font-medium text-emerald-600 dark:text-emerald-400"
                                  onClick={() => handleSetStatus(a.session.id, row.student.id, "hadir")}
                                >
                                  Hadir (Tepat Waktu)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer font-medium text-purple-600 dark:text-purple-400"
                                  onClick={() => handleSetStatus(a.session.id, row.student.id, "terlambat")}
                                >
                                  Terlambat
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer font-medium text-blue-600 dark:text-blue-400"
                                  onClick={() => handleSetStatus(a.session.id, row.student.id, "izin")}
                                >
                                  Izin
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer font-medium text-amber-600 dark:text-amber-400"
                                  onClick={() => handleSetStatus(a.session.id, row.student.id, "sakit")}
                                >
                                  Sakit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer font-medium text-rose-600 dark:text-rose-400"
                                  onClick={() => handleSetStatus(a.session.id, row.student.id, "absen")}
                                >
                                  Alpha
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center tabular-nums font-bold text-emerald-600">
                        {row.present}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-bold text-purple-600">
                        {row.late}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-bold text-blue-600">
                        {row.permission}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-bold text-amber-600">
                        {row.sick}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-bold text-rose-600 dark:text-rose-400">
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

      {/* Dialog Form Input Absen Manual */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              Input Absensi Manual
            </DialogTitle>
            <DialogDescription>
              Catat atau ubah status absensi mahasiswa (misal: kendala jaringan, Izin, atau Sakit).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="m_student">Pilih Mahasiswa *</FieldLabel>
              <Select value={manualStudentId} onValueChange={setManualStudentId}>
                <SelectTrigger id="m_student">
                  <SelectValue placeholder="Pilih nama mahasiswa" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.full_name} ({st.student_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="m_session">Pilih Sesi Pertemuan *</FieldLabel>
              <Select value={manualSessionId} onValueChange={setManualSessionId}>
                <SelectTrigger id="m_session">
                  <SelectValue placeholder="Pilih sesi absensi" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((se) => (
                    <SelectItem key={se.id} value={se.id}>
                      {se.title} ({formatDate(se.starts_at)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="m_status">Status Kehadiran *</FieldLabel>
              <Select
                value={manualStatus}
                onValueChange={(val) => setManualStatus(val as AttendanceStatus)}
              >
                <SelectTrigger id="m_status">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hadir">Hadir (Tepat Waktu)</SelectItem>
                  <SelectItem value="terlambat">Terlambat</SelectItem>
                  <SelectItem value="izin">Izin (Ada Keterangan)</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="absen">Alpha (Tidak Hadir)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualDialogOpen(false)}
                disabled={manualSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={manualSubmitting}>
                {manualSubmitting && <Loader2 className="size-4 animate-spin" />}
                Simpan Absensi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
