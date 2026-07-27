import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldAlert, Download, Filter, UserCheck, CheckCircle2, Clock, FileText, Stethoscope, XCircle, ChevronDown, Search, ChevronLeft, ChevronRight, X, Check, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
import { Input } from "@/components/ui/input";
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
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20",
  },
  terlambat: {
    label: "Telat",
    icon: Clock,
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 hover:bg-purple-500/20",
  },
  izin: {
    label: "Izin",
    icon: FileText,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20",
  },
  sakit: {
    label: "Sakit",
    icon: Stethoscope,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20",
  },
  absen: {
    label: "Alpha",
    icon: XCircle,
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20",
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
    if (selectedSession === "latest30") return sessions.slice(0, 30);
    if (selectedSession === "latest15") return sessions.slice(0, 15);
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

  // Search & Pagination State for Recap Matrix Table
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const RECAP_PER_PAGE = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSession]);

  const filteredMatrix = useMemo(() => {
    if (!searchQuery.trim()) return matrix;
    const q = searchQuery.toLowerCase().trim();
    return matrix.filter(
      (m) =>
        m.student.full_name.toLowerCase().includes(q) ||
        (m.student.student_id && m.student.student_id.toLowerCase().includes(q))
    );
  }, [matrix, searchQuery]);

  const totalPages = Math.ceil(filteredMatrix.length / RECAP_PER_PAGE) || 1;

  const paginatedMatrix = useMemo(() => {
    const start = (currentPage - 1) * RECAP_PER_PAGE;
    return filteredMatrix.slice(start, start + RECAP_PER_PAGE);
  }, [filteredMatrix, currentPage]);

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

  function handleExportExcel() {
    if (matrix.length === 0 || filteredSessions.length === 0) {
      toast.error("Tidak ada data untuk diekspor.");
      return;
    }

    const filterSuffix =
      selectedSession === "latest7"
        ? "-1minggu"
        : selectedSession === "latest10"
          ? "-10sesi"
          : selectedSession === "latest15"
            ? "-15sesi"
            : selectedSession === "latest30"
              ? "-1bulan"
              : selectedSession !== "all"
                ? "-sesi-spesifik"
                : "-semua-sesi";

    const headers = [
      "No",
      "Nama Mahasiswa",
      "NIM (ID)",
      "Email Terdaftar",
      ...filteredSessions.map((s) => s.title),
      "Total Hadir",
      "Total Telat",
      "Total Izin",
      "Total Sakit",
      "Total Alpha",
    ];

    const statusLabelMap: Record<string, string> = {
      hadir: "Hadir",
      terlambat: "Telat",
      izin: "Izin",
      sakit: "Sakit",
      absen: "Alpha",
    };

    const rows = matrix.map((r, idx) => [
      idx + 1,
      r.student.full_name,
      r.student.student_id ?? "—",
      r.student.email,
      ...r.attendances.map((a) => statusLabelMap[a.record?.status ?? "absen"] || "Alpha"),
      r.present,
      r.late,
      r.permission,
      r.sick,
      r.absent,
    ]);

    // Create Worksheet with SheetJS
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Calculate auto column widths
    const colWidths = headers.map((h, colIdx) => {
      let maxLen = h.length;
      rows.forEach((row) => {
        const cellValue = String(row[colIdx] ?? "");
        if (cellValue.length > maxLen) maxLen = cellValue.length;
      });
      return { wch: Math.min(maxLen + 4, 45) };
    });
    worksheet["!cols"] = colWidths;

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Presensi KKN");

    // Export File .xlsx
    const fileName = `rekap-absensi-${group?.name ?? "kkn"}${filterSuffix}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("File Excel (.xlsx) rapi berhasil diunduh.");
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
          : selectedSession === "latest15"
            ? "-15sesi"
            : selectedSession === "latest30"
              ? "-1bulan"
              : selectedSession !== "all"
                ? "-sesi-spesifik"
                : "-semua-sesi";

    const headers = [
      "No",
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

    const statusLabelMap: Record<string, string> = {
      hadir: "Hadir",
      terlambat: "Telat",
      izin: "Izin",
      sakit: "Sakit",
      absen: "Alpha",
    };

    const rows = matrix.map((r, idx) => [
      idx + 1,
      r.student.full_name,
      r.student.student_id ?? "-",
      r.student.email,
      ...r.attendances.map((a) => statusLabelMap[a.record?.status ?? "absen"] || "Alpha"),
      r.present,
      r.late,
      r.permission,
      r.sick,
      r.absent,
    ]);

    // Use sep=;\n line + Semicolon ';' delimiter + UTF-8 BOM '\uFEFF'
    // This forces Microsoft Excel on Windows to split columns A, B, C, D, E... automatically without cramming!
    const csvLines = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const csvContent = "sep=;\r\n" + csvLines;
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-absensi-${group?.name ?? "kkn"}${filterSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rekap CSV rapi terpisah kolom berhasil diunduh.");
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
            <Button variant="outline" onClick={handleExportExcel} className="font-semibold border-emerald-500/40 hover:bg-emerald-500/10">
              <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
              Ekspor Excel (.xlsx)
            </Button>
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
              Ekspor CSV
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <FileText className="size-4 text-rose-600 dark:text-rose-400" />
              Ekspor PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 border-b">
          {/* Header Title */}
          <div>
            <CardTitle className="text-base font-bold">Matrix Rekapitulasi Presensi</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {students.length} mahasiswa • {filteredSessions.length} sesi ditampilkan (Klik status untuk ubah manual)
            </CardDescription>
          </div>

          {/* Toolbar Rata Kanan-Kiri: Search (Kiri) & Filter Sesi (Kanan) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Search Input (Sisi Kiri) */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIM mahasiswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9 bg-background/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Filter Sesi Dropdown (Sisi Kanan) */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Filter className="size-3.5" />
                <span>Tampilkan Sesi:</span>
              </span>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="w-full sm:w-[220px] text-xs h-9">
                  <SelectValue placeholder="Pilih rentang sesi" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all" className="text-xs">Semua Sesi ({sessions.length})</SelectItem>
                  {sessions.length > 30 && (
                    <SelectItem value="latest30" className="text-xs">30 Sesi Terbaru (1 Bulan)</SelectItem>
                  )}
                  {sessions.length > 15 && (
                    <SelectItem value="latest15" className="text-xs">15 Sesi Terbaru (2 Minggu)</SelectItem>
                  )}
                  {sessions.length > 10 && (
                    <SelectItem value="latest10" className="text-xs">10 Sesi Terbaru</SelectItem>
                  )}
                  {sessions.length > 7 && (
                    <SelectItem value="latest7" className="text-xs">7 Sesi Terbaru (1 Minggu)</SelectItem>
                  )}
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
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
                Tambahkan mahasiswa dan buat sesi absen untuk melihat rekapitulasi kehadiran di sini.
              </EmptyDescription>
            </Empty>
          ) : filteredMatrix.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <Search className="size-8 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Tidak ditemukan hasil pencarian</p>
              <p>Tidak ada mahasiswa yang cocok dengan kata kunci "{searchQuery}".</p>
              <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="mt-2 text-xs">
                Bersihkan Pencarian
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Responsive Horizontal Scroll Container with Solid Borders */}
              <div className="overflow-x-auto relative rounded-lg border border-border/80 shadow-2xs bg-background">
                <Table className="w-full border-collapse text-xs">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      {/* Sticky Left Column Header */}
                      <TableHead className="sticky left-0 z-30 bg-background/95 backdrop-blur-xs min-w-[220px] max-w-[220px] border-r border-border/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] py-3">
                        Nama Mahasiswa &amp; NIM
                      </TableHead>

                      {/* Session Headers */}
                      {filteredSessions.map((s) => (
                        <TableHead
                          key={s.id}
                          className="text-center min-w-[130px] max-w-[130px] px-3 py-2.5 border-r border-border/40"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-semibold text-foreground truncate" title={s.title}>
                              {s.title}
                            </span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {formatDate(s.starts_at)}
                            </span>
                          </div>
                        </TableHead>
                      ))}

                      {/* Total Summary Headers */}
                      <TableHead className="text-center font-bold min-w-[65px] border-r border-border/40 text-foreground bg-muted/30">
                        Hadir
                      </TableHead>
                      <TableHead className="text-center font-bold min-w-[65px] border-r border-border/40 text-foreground bg-muted/30">
                        Telat
                      </TableHead>
                      <TableHead className="text-center font-bold min-w-[65px] border-r border-border/40 text-foreground bg-muted/30">
                        Izin
                      </TableHead>
                      <TableHead className="text-center font-bold min-w-[65px] border-r border-border/40 text-foreground bg-muted/30">
                        Sakit
                      </TableHead>
                      <TableHead className="text-center font-bold min-w-[65px] text-foreground bg-muted/30">
                        Alpha
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedMatrix.map((row) => (
                      <TableRow key={row.student.id} className="group hover:bg-muted/40 transition-colors">
                        {/* Sticky Left Column Body Cell */}
                        <TableCell className="sticky left-0 z-20 bg-background group-hover:bg-muted/50 transition-colors min-w-[220px] max-w-[220px] border-r border-border/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] py-2.5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">
                              {row.student.full_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono font-medium">
                              {row.student.student_id ?? "—"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Interactive Session Cells */}
                        {row.attendances.map((a) => {
                          const currentStatus: AttendanceStatus = a.record?.status ?? "absen";
                          const cellKey = `${a.session.id}_${row.student.id}`;
                          const isUpdating = updatingCell === cellKey;
                          const badgeInfo = statusBadges[currentStatus];
                          const StatusIcon = badgeInfo.icon;

                          return (
                            <TableCell key={a.session.id} className="text-center min-w-[130px] max-w-[130px] p-2 border-r border-border/40">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    className={cn(
                                      "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-2xs transition-all hover:scale-105 cursor-pointer disabled:opacity-50 mx-auto",
                                      badgeInfo.className
                                    )}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <>
                                        <StatusIcon className="size-3 shrink-0" />
                                        <span>{badgeInfo.label}</span>
                                        <ChevronDown className="size-3 opacity-60 ml-0.5" />
                                      </>
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="w-[195px] p-1.5 space-y-0.5">
                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs font-medium text-foreground flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 focus:bg-emerald-500/10"
                                    onClick={() => handleSetStatus(a.session.id, row.student.id, "hadir")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                                      <span>Hadir (Tepat Waktu)</span>
                                    </div>
                                    {currentStatus === "hadir" && (
                                      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs font-medium text-foreground flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-purple-500/10 dark:hover:bg-purple-500/20 focus:bg-purple-500/10"
                                    onClick={() => handleSetStatus(a.session.id, row.student.id, "terlambat")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Clock className="size-4 text-purple-600 dark:text-purple-400" />
                                      <span>Terlambat</span>
                                    </div>
                                    {currentStatus === "terlambat" && (
                                      <Check className="size-3.5 text-purple-600 dark:text-purple-400" />
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs font-medium text-foreground flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-blue-500/10 dark:hover:bg-blue-500/20 focus:bg-blue-500/10"
                                    onClick={() => handleSetStatus(a.session.id, row.student.id, "izin")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText className="size-4 text-blue-600 dark:text-blue-400" />
                                      <span>Izin</span>
                                    </div>
                                    {currentStatus === "izin" && (
                                      <Check className="size-3.5 text-blue-600 dark:text-blue-400" />
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs font-medium text-foreground flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-amber-500/10 dark:hover:bg-amber-500/20 focus:bg-amber-500/10"
                                    onClick={() => handleSetStatus(a.session.id, row.student.id, "sakit")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Stethoscope className="size-4 text-amber-600 dark:text-amber-400" />
                                      <span>Sakit</span>
                                    </div>
                                    {currentStatus === "sakit" && (
                                      <Check className="size-3.5 text-amber-600 dark:text-amber-400" />
                                    )}
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    className="cursor-pointer text-xs font-medium text-foreground flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-rose-500/10 dark:hover:bg-rose-500/20 focus:bg-rose-500/10"
                                    onClick={() => handleSetStatus(a.session.id, row.student.id, "absen")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
                                      <span>Alpha</span>
                                    </div>
                                    {currentStatus === "absen" && (
                                      <Check className="size-3.5 text-rose-600 dark:text-rose-400" />
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          );
                        })}

                        {/* Totals */}
                        <TableCell className="text-center tabular-nums font-bold font-mono text-foreground min-w-[65px] bg-muted/10 border-r border-border/40">
                          {row.present}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-bold font-mono text-foreground min-w-[65px] bg-muted/10 border-r border-border/40">
                          {row.late}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-bold font-mono text-foreground min-w-[65px] bg-muted/10 border-r border-border/40">
                          {row.permission}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-bold font-mono text-foreground min-w-[65px] bg-muted/10 border-r border-border/40">
                          {row.sick}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-bold font-mono text-foreground min-w-[65px] bg-muted/10">
                          {row.absent}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredMatrix.length > RECAP_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-xs">
                  <div className="text-muted-foreground font-medium">
                    Menampilkan{" "}
                    <span className="font-bold text-foreground">
                      {(currentPage - 1) * RECAP_PER_PAGE + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-bold text-foreground">
                      {Math.min(currentPage * RECAP_PER_PAGE, filteredMatrix.length)}
                    </span>{" "}
                    dari <span className="font-bold text-foreground">{filteredMatrix.length}</span> Mahasiswa
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 gap-1 text-xs cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                      <span>Sebelumnya</span>
                    </Button>

                    <div className="flex items-center gap-1 px-2 font-medium text-xs text-muted-foreground">
                      Halaman <span className="font-bold text-foreground">{currentPage}</span> dari{" "}
                      <span className="font-bold text-foreground">{totalPages}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 gap-1 text-xs cursor-pointer"
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
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
                <SelectTrigger id="m_student" className="w-full">
                  <SelectValue placeholder="Pilih nama mahasiswa" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56 overflow-y-auto z-[100]">
                  {students.map((st) => (
                    <SelectItem key={st.id} value={st.id} className="cursor-pointer text-xs">
                      {st.full_name} ({st.student_id ?? "—"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="m_session">Pilih Sesi Pertemuan *</FieldLabel>
              <Select value={manualSessionId} onValueChange={setManualSessionId}>
                <SelectTrigger id="m_session" className="w-full">
                  <SelectValue placeholder="Pilih sesi absensi" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56 overflow-y-auto z-[100]">
                  {sessions.map((se) => (
                    <SelectItem key={se.id} value={se.id} className="cursor-pointer text-xs">
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
                <SelectTrigger id="m_status" className="w-full">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-56 overflow-y-auto z-[100]">
                  <SelectItem value="hadir" className="cursor-pointer text-xs">Hadir (Tepat Waktu)</SelectItem>
                  <SelectItem value="terlambat" className="cursor-pointer text-xs">Terlambat</SelectItem>
                  <SelectItem value="izin" className="cursor-pointer text-xs">Izin (Ada Keterangan)</SelectItem>
                  <SelectItem value="sakit" className="cursor-pointer text-xs">Sakit</SelectItem>
                  <SelectItem value="absen" className="cursor-pointer text-xs">Alpha (Tidak Hadir)</SelectItem>
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
