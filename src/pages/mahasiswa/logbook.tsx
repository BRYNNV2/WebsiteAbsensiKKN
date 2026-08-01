import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  exportLogbookToDocx,
  type LogbookEntryItem,
  type StudentLogbookProfile,
  type WeekBundleData,
} from "@/lib/logbook-generator";
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  Calendar,
  Clock3,
  Edit2,
  Trash2,
  Save,
  ImageIcon,
  Upload,
  User,
  ChevronDown,
  Filter,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";

const DAYS_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export function MahasiswaLogbookPage() {
  const { profile } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<number>(1); // 0 = Semua Minggu (Lihat Semua Data)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc"); // asc = Tanggal 1 -> Akhir, desc = Terbaru -> Terlama
  const [entries, setEntries] = useState<LogbookEntryItem[]>([]);
  const [weeklyNotes, setWeeklyNotes] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Dialog Konfirmasi Hapus State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Dialog Ekspor Logbook State (Minggu Tunggal / Kustom / Semua Minggu)
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportScope, setExportScope] = useState<"current" | "all" | "custom">("current");
  const [customExportWeeks, setCustomExportWeeks] = useState<number[]>([1]);

  // Group & DPL info
  const [studentProfile, setStudentProfile] = useState<StudentLogbookProfile>({
    full_name: "",
    student_id: "",
    faculty_prodi: "FTTK / Teknik Informatika",
    group_name: "",
    group_location: "",
    dosen_name: "",
  });

  // Modal Dialog Form State
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [formDay, setFormDay] = useState<string>("Senin");
  const [formTime, setFormTime] = useState<string>("08:00 - 12:00 WIB");
  const [formActivityName, setFormActivityName] = useState<string>("");
  const [formActivityDesc, setFormActivityDesc] = useState<string>("");
  const [formDocUrl, setFormDocUrl] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    loadStudentGroupProfile();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    loadLogbookData();
  }, [profile, selectedWeek]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const timeA = new Date(a.entry_date || "").getTime();
      const timeB = new Date(b.entry_date || "").getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });
  }, [entries, sortOrder]);

  async function loadStudentGroupProfile() {
    if (!profile) return;

    let groupName = "";
    let groupLoc = "";
    let dosenName = "";

    if (profile.group_id) {
      const { data: groupData } = await supabase
        .from("kkn_groups")
        .select("name, village, dosen_id")
        .eq("id", profile.group_id)
        .maybeSingle();

      if (groupData) {
        groupName = groupData.name;
        groupLoc = groupData.village || groupData.name;

        if (groupData.dosen_id) {
          const { data: dosenProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", groupData.dosen_id)
            .maybeSingle();

          if (dosenProfile) {
            dosenName = dosenProfile.full_name;
          }
        }
      }
    }

    setStudentProfile({
      full_name: profile.full_name || "",
      student_id: profile.student_id || "",
      faculty_prodi: "FTTK / Teknik Informatika",
      group_name: groupName,
      group_location: groupLoc,
      dosen_name: dosenName,
    });
  }

  async function loadLogbookData(showLoading = true) {
    if (!profile) return;
    if (showLoading) setLoading(true);

    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const currentUserId = authUserData.user?.id || profile.id;
      const currentWeekNum = Number(selectedWeek);

      // 1. Load entries for student (filtered by student_id & optionally week_number, sorted by entry_date)
      let entriesQuery = supabase
        .from("kkn_logbook_entries")
        .select("*")
        .eq("student_id", currentUserId);

      if (currentWeekNum !== 0) {
        entriesQuery = entriesQuery.eq("week_number", currentWeekNum);
      }

      const { data: entriesData, error: entriesErr } = await entriesQuery.order("entry_date", { ascending: true });

      if (entriesErr) {
        console.error("Error fetching logbook entries:", entriesErr);
        toast.error("Gagal memuat kegiatan: " + entriesErr.message);
      } else {
        setEntries((entriesData as LogbookEntryItem[]) || []);
      }

      // 2. Load weekly notes for student
      if (currentWeekNum === 0) {
        const { data: notesData } = await supabase
          .from("kkn_logbook_weekly_notes")
          .select("*")
          .eq("student_id", currentUserId)
          .order("week_number", { ascending: true });

        const allN: string[] = [];
        (notesData || []).forEach((nItem: any) => {
          if (Array.isArray(nItem.important_notes)) {
            nItem.important_notes.forEach((str: string) => {
              if (str && str.trim()) allN.push(str.trim());
            });
          }
        });
        setWeeklyNotes([allN[0] || "", allN[1] || "", allN[2] || ""]);
      } else {
        const { data: notesData, error: notesErr } = await supabase
          .from("kkn_logbook_weekly_notes")
          .select("*")
          .eq("student_id", currentUserId)
          .eq("week_number", currentWeekNum)
          .maybeSingle();

        if (notesErr) {
          console.error("Error fetching weekly notes:", notesErr);
        }

        if (notesData && Array.isArray(notesData.important_notes)) {
          const arr = notesData.important_notes;
          setWeeklyNotes([arr[0] || "", arr[1] || "", arr[2] || ""]);
        } else {
          setWeeklyNotes(["", "", ""]);
        }
      }
    } catch (err: any) {
      console.error("Error loading logbook:", err);
      toast.error("Gagal memuat data logbook: " + (err?.message || ""));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  function handleOpenAddDialog() {
    setEditingId(null);
    const today = new Date();
    setFormDate(format(today, "yyyy-MM-dd"));
    const dayName = format(today, "EEEE", { locale: localeID });
    setFormDay(DAYS_LIST.includes(dayName) ? dayName : "Senin");
    setFormTime("08:00 - 12:00 WIB");
    setFormActivityName("");
    setFormActivityDesc("");
    setFormDocUrl("");
    setDialogOpen(true);
  }

  function handleEditEntry(item: LogbookEntryItem) {
    if (!item.id) return;
    setEditingId(item.id);
    setFormDate(item.entry_date);
    setFormDay(item.day_name);
    setFormTime(item.time_range);
    setFormActivityName(item.activity_name);
    setFormActivityDesc(item.activity_description);
    setFormDocUrl(item.documentation_url || "");
    setDialogOpen(true);
  }

  async function handleSaveEntry() {
    if (!profile) return;
    if (!formActivityName.trim() || !formActivityDesc.trim()) {
      toast.error("Silakan isi nama dan rincian kegiatan.");
      return;
    }

    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const currentUserId = authUserData.user?.id || profile.id;

      let entryWeekNumber = Number(selectedWeek);
      if (entryWeekNumber === 0) {
        entryWeekNumber = editingId
          ? (entries.find((e) => e.id === editingId)?.week_number || 1)
          : 1;
      }

      const payload = {
        student_id: currentUserId,
        group_id: profile.group_id || null,
        week_number: entryWeekNumber,
        entry_date: formDate,
        day_name: formDay,
        time_range: formTime,
        activity_name: formActivityName.trim(),
        activity_description: formActivityDesc.trim(),
        documentation_url: formDocUrl.trim() || null,
        status: "pending",
      };

      if (editingId) {
        const { data: updated, error: updateErr } = await supabase
          .from("kkn_logbook_entries")
          .update(payload)
          .eq("id", editingId)
          .select();

        if (updateErr) throw updateErr;
        if (updated && updated.length > 0) {
          setEntries((prev) =>
            prev.map((e) => (e.id === editingId ? (updated[0] as LogbookEntryItem) : e))
          );
        }
        toast.success("Kegiatan logbook berhasil diperbarui.");
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("kkn_logbook_entries")
          .insert(payload)
          .select();

        if (insertErr) throw insertErr;
        if (inserted && inserted.length > 0) {
          setEntries((prev) => [...prev, inserted[0] as LogbookEntryItem]);
        }
        toast.success("Kegiatan logbook baru berhasil ditambahkan.");
      }

      setDialogOpen(false);
      await loadLogbookData(false);
    } catch (err: any) {
      console.error("Error saving logbook entry:", err);
      toast.error("Gagal menyimpan kegiatan: " + (err?.message || ""));
    }
  }

  function handleOpenDeleteDialog(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("kkn_logbook_entries")
        .delete()
        .eq("id", deletingId);

      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== deletingId));
      toast.success("Kegiatan logbook berhasil dihapus.");
      await loadLogbookData(false);
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast.error("Gagal menghapus kegiatan logbook.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  }

  async function handleSaveWeeklyNotes() {
    if (!profile) return;
    setIsSavingNotes(true);
    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const currentUserId = authUserData.user?.id || profile.id;
      const cleanNotes = weeklyNotes.map((n) => n.trim());

      const { data: existing, error: findErr } = await supabase
        .from("kkn_logbook_weekly_notes")
        .select("id")
        .eq("student_id", currentUserId)
        .eq("week_number", Number(selectedWeek))
        .maybeSingle();

      if (findErr) console.error("Error checking existing notes:", findErr);

      let saveErr = null;
      let returnedNotes = null;

      if (existing) {
        const { data: updated, error: updateErr } = await supabase
          .from("kkn_logbook_weekly_notes")
          .update({
            important_notes: cleanNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select();
        saveErr = updateErr;
        returnedNotes = updated;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("kkn_logbook_weekly_notes")
          .insert({
            student_id: currentUserId,
            group_id: profile.group_id || null,
            week_number: Number(selectedWeek),
            important_notes: cleanNotes,
          })
          .select();
        saveErr = insertErr;
        returnedNotes = inserted;
      }

      if (saveErr) throw saveErr;

      if (
        returnedNotes &&
        returnedNotes.length > 0 &&
        Array.isArray(returnedNotes[0].important_notes)
      ) {
        const arr = returnedNotes[0].important_notes;
        setWeeklyNotes([arr[0] || "", arr[1] || "", arr[2] || ""]);
      }

      toast.success("Catatan penting mingguan berhasil disimpan.");
    } catch (err: any) {
      console.error("Error saving weekly notes:", err);
      toast.error(err?.message || "Gagal menyimpan catatan penting.");
    } finally {
      setIsSavingNotes(false);
    }
  }

  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.avatar_url || null);

  useEffect(() => {
    if (profile?.avatar_url) {
      setPhotoUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Format file harus berupa gambar (JPG, PNG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhotoUrl(result);
      toast.success("Pas foto 4x6 berhasil diperbarui untuk dokumen Logbook!");
    };
    reader.readAsDataURL(file);
  }

  function handleOpenExportModal() {
    setExportScope("current");
    setCustomExportWeeks([selectedWeek === 0 ? 1 : selectedWeek]);
    setExportModalOpen(true);
  }

  async function handleExecuteExport() {
    if (!profile) return;

    let targetWeeks: number[] = [];
    if (exportScope === "current") {
      targetWeeks = [selectedWeek];
    } else if (exportScope === "all") {
      targetWeeks = [1, 2, 3, 4, 5];
    } else {
      targetWeeks = [...customExportWeeks].sort((a, b) => a - b);
    }

    if (targetWeeks.length === 0) {
      toast.error("Pilih setidaknya satu minggu untuk diunduh.");
      return;
    }

    setIsExporting(true);
    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const currentUserId = authUserData.user?.id || profile.id;

      // 1. Ambil seluruh entri kegiatan mahasiswa
      let entriesQuery = supabase
        .from("kkn_logbook_entries")
        .select("*")
        .eq("student_id", currentUserId);

      if (exportScope === "current" && selectedWeek !== 0) {
        entriesQuery = entriesQuery.eq("week_number", selectedWeek);
      } else if (exportScope === "custom") {
        entriesQuery = entriesQuery.in("week_number", targetWeeks);
      }

      const { data: entriesData, error: entriesErr } = await entriesQuery.order("entry_date", { ascending: true });
      if (entriesErr) throw entriesErr;

      // 2. Ambil catatan mingguan mahasiswa
      let notesQuery = supabase
        .from("kkn_logbook_weekly_notes")
        .select("*")
        .eq("student_id", currentUserId);

      if (exportScope === "current" && selectedWeek !== 0) {
        notesQuery = notesQuery.eq("week_number", selectedWeek);
      } else if (exportScope === "custom") {
        notesQuery = notesQuery.in("week_number", targetWeeks);
      }

      const { data: notesData, error: notesErr } = await notesQuery;
      if (notesErr) console.warn("Fetch notes warning:", notesErr);

      // Susun data per minggu (WeekBundleData[])
      const effectiveWeeks = (exportScope === "all" || (exportScope === "current" && selectedWeek === 0))
        ? [1, 2, 3, 4, 5]
        : targetWeeks;

      const weekBundles: WeekBundleData[] = effectiveWeeks.map((weekNum) => {
        const weekEntries = ((entriesData as LogbookEntryItem[]) || [])
          .filter(
            (e) =>
              Number(e.week_number) === weekNum ||
              (Number(e.week_number) === 0 && weekNum === 1)
          )
          .sort((a, b) => new Date(a.entry_date || "").getTime() - new Date(b.entry_date || "").getTime());

        const matchNote = (notesData || []).find(
          (n: any) => Number(n.week_number) === weekNum
        );
        const notesArr =
          matchNote && Array.isArray(matchNote.important_notes)
            ? [
                matchNote.important_notes[0] || "",
                matchNote.important_notes[1] || "",
                matchNote.important_notes[2] || "",
              ]
            : ["", "", ""];

        return {
          weekNumber: weekNum,
          entries: weekEntries,
          weeklyNotes: notesArr,
        };
      });

      const photo = photoUrl || profile?.avatar_url || null;

      await exportLogbookToDocx(studentProfile, weekBundles, photo);
      toast.success("File Word Logbook KKN (.docx) berhasil diunduh!");

      setExportModalOpen(false);
    } catch (err: any) {
      console.error("Export Error:", err);
      toast.error("Gagal mengunduh dokumen logbook: " + (err?.message || ""));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Buku Catatan Harian (Logbook KKN)"
        description="Kelola rekap kegiatan harian KKN Anda dan ekspor secara otomatis ke dalam dokumen Word (.docx) resmi berstandar UMRAH."
      />

      {/* Control Bar: Header Info & Export Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/60 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <BookOpen className="size-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground block">
              Rekap Kegiatan Logbook KKN
            </span>
            <span className="text-[11px] text-muted-foreground">
              Catat kegiatan harian &amp; ekspor dokumen resmi KKN
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleOpenAddDialog}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs gap-1.5"
          >
            <Plus className="size-4" />
            <span>Tambah Kegiatan</span>
          </Button>

          <Button
            onClick={handleOpenExportModal}
            disabled={isExporting}
            variant="outline"
            className="h-9 px-3.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-semibold text-xs rounded-xl gap-1.5"
          >
            <FileSpreadsheet className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Unduh Word (.DOCX)</span>
          </Button>
        </div>
      </div>

      {/* Pas Foto 4x6 Widget Banner */}
      <Card className="border-border/60 shadow-2xs bg-card/60 backdrop-blur-xs">
        <CardContent className="p-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative size-12 rounded-xl border border-border/80 overflow-hidden bg-muted flex items-center justify-center shrink-0 shadow-xs">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Pas Foto 4x6"
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Pas Foto 4x6 (Halaman Cover Logbook)
                </span>
                <Badge variant="secondary" className="text-[10px] px-2 py-0 h-4 bg-primary/10 text-primary border-primary/20 font-medium">
                  {photoUrl ? "Foto Terpasang" : "Foto Bawaan Akun"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {photoUrl
                  ? "Pas foto ini otomatis dipasang pada bingkai foto 4x6 Halaman 1 saat mengunduh dokumen Word & PDF."
                  : "Otomatis menggunakan Foto Profil akun Anda, atau klik tombol di samping jika ingin mengunggah foto 4x6 kustom."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <input
              type="file"
              id="logbook-photo-input"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold rounded-xl border-border/80 gap-1.5"
              onClick={() => {
                document.getElementById("logbook-photo-input")?.click();
              }}
            >
              <Upload className="size-3.5 text-primary" />
              <span>{photoUrl ? "Ganti Pas Foto 4x6" : "Unggah Foto 4x6"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start w-full min-w-0 max-w-full">
        {/* Left Column (8 cols): Tabel Jadwal & Kegiatan */}
        <Card className="lg:col-span-8 border-border/60 shadow-2xs w-full min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <span>A. Jadwal &amp; Kegiatan Harian</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedWeek === 0
                    ? "Menampilkan seluruh daftar kegiatan KKN dari Minggu 1 s/d 5"
                    : `Daftar kegiatan harian pada Minggu ke-${selectedWeek}`}
                </CardDescription>
              </div>

              {/* Bar Dropdown (v) Filter & Urutkan Data */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold rounded-xl border-border/80 gap-2 hover:bg-muted bg-background shadow-2xs"
                    >
                      <Filter className="size-3.5 text-primary" />
                      <span>
                        {selectedWeek === 0
                          ? "✨ Semua Minggu"
                          : `Minggu ke-${selectedWeek}`}{" "}
                        • {sortOrder === "asc" ? "Tgl 1 → Akhir" : "Terbaru"}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-xl border-border/80">
                    <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      Filter Minggu KKN
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setSelectedWeek(0)}
                      className={cn(
                        "text-xs font-medium rounded-lg px-2 py-1.5 cursor-pointer justify-between",
                        selectedWeek === 0 && "bg-primary/10 text-primary font-bold"
                      )}
                    >
                      <span>✨ Lihat Semua Data</span>
                      {selectedWeek === 0 && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    {[1, 2, 3, 4, 5].map((wNum) => (
                      <DropdownMenuItem
                        key={wNum}
                        onClick={() => setSelectedWeek(wNum)}
                        className={cn(
                          "text-xs font-medium rounded-lg px-2 py-1.5 cursor-pointer justify-between",
                          selectedWeek === wNum && "bg-primary/10 text-primary font-bold"
                        )}
                      >
                        <span>Minggu {wNum}</span>
                        {selectedWeek === wNum && <Check className="size-3.5 text-primary" />}
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator className="my-1" />

                    <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      Urutan Tanggal
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setSortOrder("asc")}
                      className={cn(
                        "text-xs font-medium rounded-lg px-2 py-1.5 cursor-pointer justify-between",
                        sortOrder === "asc" && "bg-primary/10 text-primary font-bold"
                      )}
                    >
                      <span>⬆ Tanggal 1 → Akhir</span>
                      {sortOrder === "asc" && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortOrder("desc")}
                      className={cn(
                        "text-xs font-medium rounded-lg px-2 py-1.5 cursor-pointer justify-between",
                        sortOrder === "desc" && "bg-primary/10 text-primary font-bold"
                      )}
                    >
                      <span>⬇ Tanggal Terbaru → Terlama</span>
                      {sortOrder === "desc" && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
                  {sortedEntries.length} Kegiatan
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 w-full min-w-0 max-w-full overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Memuat catatan kegiatan harian...
              </div>
            ) : sortedEntries.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <BookOpen className="size-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedWeek === 0
                    ? "Belum ada catatan kegiatan KKN yang tersimpan"
                    : `Belum ada catatan kegiatan pada Minggu ke-${selectedWeek}`}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Klik tombol **"Tambah Kegiatan"** di atas untuk mulai menginventarisir kegiatan harian KKN Anda.
                </p>
              </div>
            ) : (
              <div
                className="w-full overflow-x-auto max-w-full touch-pan-x scrollbar-thin overflow-y-hidden"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
              >
                <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border/40 text-[11px] font-medium text-primary sm:hidden">
                  <span>👈 Geser tabel ke samping untuk melihat detail lengkap</span>
                </div>
                <Table className="w-full min-w-[620px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12 min-w-[48px] text-center text-xs font-bold">No</TableHead>
                      <TableHead className="w-28 min-w-[120px] text-xs font-bold">Hari &amp; Tanggal</TableHead>
                      <TableHead className="w-28 min-w-[120px] text-xs font-bold">Jam</TableHead>
                      <TableHead className="min-w-[260px] text-xs font-bold">Rincian Kegiatan</TableHead>
                      <TableHead className="w-24 min-w-[90px] text-center text-xs font-bold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEntries.map((item: LogbookEntryItem, idx: number) => (
                      <TableRow key={item.id || idx} className="hover:bg-muted/30">
                        <TableCell className="text-center text-xs font-semibold">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-xs space-y-0.5 whitespace-nowrap">
                          <span className="font-bold text-foreground block flex items-center gap-1.5">
                            {item.day_name}
                            {selectedWeek === 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 bg-primary/10 text-primary border-primary/20">
                                M{item.week_number}
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(item.entry_date), "dd/MM/yyyy")}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {item.time_range}
                        </TableCell>
                        <TableCell className="text-xs space-y-1 min-w-[260px] whitespace-normal">
                          <p className="font-bold text-foreground leading-snug">
                            {item.activity_name}
                          </p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            {item.activity_description}
                          </p>
                          {item.documentation_url && (
                            <div className="pt-1">
                              {item.documentation_url.startsWith("data:image/") || item.documentation_url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                                <a
                                  href={item.documentation_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                >
                                  <img
                                    src={item.documentation_url}
                                    alt="Dokumentasi"
                                    className="size-4 rounded object-cover border border-emerald-600/30 shrink-0"
                                  />
                                  <span>Lihat Foto Dokumentasi</span>
                                </a>
                              ) : (
                                <a
                                  href={item.documentation_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20"
                                >
                                  <ImageIcon className="size-3" />
                                  <span>Buka Link Dokumentasi ↗</span>
                                </a>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditEntry(item)}
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => item.id && handleOpenDeleteDialog(item.id)}
                              className="size-7 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                              title="Hapus"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column (4 cols): Section B Catatan Penting Harian */}
        <Card className="lg:col-span-4 border-border/60 shadow-2xs space-y-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock3 className="size-4 text-amber-500" />
              <span>B. Catatan Penting Harian</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Isi maksimal 3 poin catatan atau evaluasi penting pada Minggu ke-{selectedWeek}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Poin Catatan {idx + 1}:
                </span>
                <Textarea
                  value={weeklyNotes[idx] || ""}
                  onChange={(e) => {
                    const newArr = [...weeklyNotes];
                    newArr[idx] = e.target.value;
                    setWeeklyNotes(newArr);
                  }}
                  placeholder={`Contoh: Diskusi evaluasi dengan DPL mengenai program kerja desa poin ${idx + 1}...`}
                  rows={2}
                  className="text-xs resize-none rounded-xl"
                />
              </div>
            ))}

            <Button
              onClick={handleSaveWeeklyNotes}
              disabled={isSavingNotes}
              className="w-full h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-xl shadow-xs gap-1.5 mt-2"
            >
              <Save className="size-3.5" />
              <span>{isSavingNotes ? "Menyimpan..." : "Simpan Catatan Mingguan"}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Form Tambah / Edit Kegiatan */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingId ? "Edit Kegiatan Logbook" : "Tambah Kegiatan Logbook Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Isi data pelaksanaan kegiatan harian KKN Anda untuk Minggu ke-{selectedWeek}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">
                  Tanggal Kegiatan
                </span>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground block">
                  Hari
                </span>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Pilih Hari" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_LIST.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground block">
                Rentang Waktu / Jam
              </span>
              <Input
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="Contoh: 08:00 - 12:00 WIB"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground block">
                Nama / Judul Kegiatan
              </span>
              <Input
                value={formActivityName}
                onChange={(e) => setFormActivityName(e.target.value)}
                placeholder="Contoh: Sosialisasi Pengolahan Sampah Organik"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground block">
                Rincian Pelaksanaan Kegiatan
              </span>
              <Textarea
                value={formActivityDesc}
                onChange={(e) => setFormActivityDesc(e.target.value)}
                placeholder="Jelaskan alur, target peserta, serta hasil dari kegiatan yang telah dilakukan..."
                rows={4}
                className="text-xs resize-none rounded-xl"
              />
            </div>

            {/* Upload Gambar / Link Dokumentasi */}
            <div className="space-y-2 pt-1 border-t border-border/40">
              <span className="font-semibold text-muted-foreground block text-xs">
                Foto / Link Dokumentasi Kegiatan (Opsional)
              </span>

              {formDocUrl ? (
                <div className="relative rounded-xl border border-border/80 p-2.5 bg-muted/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {formDocUrl.startsWith("data:image/") || formDocUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                      <img
                        src={formDocUrl}
                        alt="Dokumentasi"
                        className="size-12 rounded-lg object-cover border border-border/60 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <ImageIcon className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-xs font-bold text-foreground block truncate">
                        {formDocUrl.startsWith("data:image/") ? "Foto Terunggah" : formDocUrl}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                        ✓ Dokumentasi Siap Disimpan
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormDocUrl("")}
                    className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 px-2 rounded-lg shrink-0"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Hapus
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option A: Upload File Gambar */}
                  <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all text-center group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          toast.error("File harus berupa gambar (JPG, PNG, WebP).");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const res = evt.target?.result as string;
                          setFormDocUrl(res);
                          toast.success("Foto dokumentasi berhasil dipilih!");
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Upload className="size-5 text-primary mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground block">Unggah Gambar</span>
                    <span className="text-[10px] text-muted-foreground">Pilih foto (JPG, PNG)</span>
                  </label>

                  {/* Option B: Input Link URL */}
                  <div className="flex flex-col justify-center p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Atau Tempel Link URL
                    </span>
                    <Input
                      value={formDocUrl}
                      onChange={(e) => setFormDocUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-9 text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveEntry}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl"
            >
              Simpan Kegiatan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Alert Dialog Konfirmasi Hapus Kegiatan */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[420px] rounded-2xl p-6 border-border/80 shadow-2xl">
          <AlertDialogHeader className="space-y-3 text-left">
            <div className="size-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-2xs">
              <Trash2 className="size-5" />
            </div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Hapus Kegiatan Logbook?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Apakah Anda yakin ingin menghapus kegiatan logbook ini? Data yang sudah dihapus tidak dapat dikembalikan lagi.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-2.5 mt-4 pt-2 border-t border-border/40">
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl border-border/80"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="h-9 px-4 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus Kegiatan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Opsi Ekspor Logbook Word (.docx) */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 border-border/80 shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-foreground">
                Unduh Logbook Word (.docx)
              </DialogTitle>
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
              >
                Format Word (.docx)
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Pilih cakupan minggu logbook kegiatan yang ingin Anda gabungkan ke dalam dokumen Word resmi KKN.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            {/* Opsi 1: Minggu Saat Ini */}
            <div
              onClick={() => setExportScope("current")}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
                exportScope === "current"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="exportScope"
                checked={exportScope === "current"}
                onChange={() => setExportScope("current")}
                className="mt-0.5 accent-primary"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">
                  Minggu Saat Ini (Minggu ke-{selectedWeek})
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mengunduh logbook khusus Minggu ke-{selectedWeek} yang sedang dibuka.
                </p>
              </div>
            </div>

            {/* Opsi 2: Semua Minggu */}
            <div
              onClick={() => setExportScope("all")}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
                exportScope === "all"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="exportScope"
                checked={exportScope === "all"}
                onChange={() => setExportScope("all")}
                className="mt-0.5 accent-primary"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">
                  Semua Minggu (Keseluruhan KKN - Minggu I s/d V)
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mengunduh logbook lengkap gabungan dari Minggu 1 sampai Minggu 5 dalam 1 file.
                </p>
              </div>
            </div>

            {/* Opsi 3: Pilih Minggu Kustom */}
            <div
              onClick={() => setExportScope("custom")}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
                exportScope === "custom"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="exportScope"
                checked={exportScope === "custom"}
                onChange={() => setExportScope("custom")}
                className="mt-0.5 accent-primary"
              />
              <div className="space-y-2.5 w-full">
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Pilih Minggu Kustom
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Pilih beberapa minggu tertentu yang ingin Anda gabungkan.
                  </p>
                </div>

                {exportScope === "custom" && (
                  <div className="pt-2 grid grid-cols-3 gap-2 border-t border-border/40">
                    {[1, 2, 3, 4, 5].map((wNum) => {
                      const isChecked = customExportWeeks.includes(wNum);
                      return (
                        <label
                          key={wNum}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none",
                            isChecked
                              ? "bg-primary/10 border-primary text-primary font-bold"
                              : "bg-background border-border/60 hover:bg-muted text-muted-foreground"
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setCustomExportWeeks((prev) => [...prev, wNum]);
                              } else {
                                setCustomExportWeeks((prev) =>
                                  prev.filter((num) => num !== wNum)
                                );
                              }
                            }}
                          />
                          <span>Minggu {wNum}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={() => setExportModalOpen(false)}
              className="h-9 px-4 text-xs font-semibold rounded-xl border-border/80"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isExporting}
              onClick={handleExecuteExport}
              className="h-9 px-4 text-xs font-semibold rounded-xl text-white shadow-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <FileSpreadsheet className="size-4" />
              <span>{isExporting ? "Proses Mengunduh..." : "Unduh Word (.docx)"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
