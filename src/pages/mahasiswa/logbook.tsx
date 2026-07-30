import { useState, useEffect } from "react";
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
  exportLogbookToDocx,
  exportLogbookToPdf,
  type LogbookEntryItem,
  type StudentLogbookProfile,
} from "@/lib/logbook-generator";
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  FileText,
  Calendar,
  Clock3,
  Edit2,
  Trash2,
  Save,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";

const DAYS_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export function MahasiswaLogbookPage() {
  const { profile } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [entries, setEntries] = useState<LogbookEntryItem[]>([]);
  const [weeklyNotes, setWeeklyNotes] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  async function loadLogbookData() {
    if (!profile) return;
    setLoading(true);

    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const currentUserId = authUserData.user?.id || profile.id;
      const currentWeekNum = Number(selectedWeek);

      // 1. Load entries for student
      const { data: entriesData, error: entriesErr } = await supabase
        .from("kkn_logbook_entries")
        .select("*");

      if (entriesErr) {
        console.error("Error fetching logbook entries:", entriesErr);
        toast.error("Gagal memuat kegiatan: " + entriesErr.message);
      } else {
        const filtered = (entriesData as LogbookEntryItem[] || []).filter(
          (item: any) =>
            (item.student_id === currentUserId || item.student_id === profile.id) &&
            Number(item.week_number) === currentWeekNum
        );
        setEntries(filtered);
      }

      // 2. Load weekly notes for student
      const { data: notesData, error: notesErr } = await supabase
        .from("kkn_logbook_weekly_notes")
        .select("*");

      if (notesErr) {
        console.error("Error fetching weekly notes:", notesErr);
      }

      const matchNote = (notesData || []).find(
        (n: any) =>
          (n.student_id === currentUserId || n.student_id === profile.id) &&
          Number(n.week_number) === currentWeekNum
      );

      if (matchNote && Array.isArray(matchNote.important_notes)) {
        const arr = matchNote.important_notes;
        setWeeklyNotes([arr[0] || "", arr[1] || "", arr[2] || ""]);
      } else {
        setWeeklyNotes(["", "", ""]);
      }
    } catch (err: any) {
      console.error("Error loading logbook:", err);
      toast.error("Gagal memuat data logbook: " + (err?.message || ""));
    } finally {
      setLoading(false);
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

      const payload = {
        student_id: currentUserId,
        group_id: profile.group_id || null,
        week_number: Number(selectedWeek),
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
      await loadLogbookData();
    } catch (err: any) {
      console.error("Error saving logbook entry:", err);
      toast.error("Gagal menyimpan kegiatan: " + (err?.message || ""));
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus kegiatan ini?")) return;
    try {
      const { error } = await supabase
        .from("kkn_logbook_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Kegiatan berhasil dihapus.");
      loadLogbookData();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast.error("Gagal menghapus kegiatan.");
    }
  }

  async function handleSaveWeeklyNotes() {
    if (!profile) return;
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
      await loadLogbookData();
    } catch (err: any) {
      console.error("Error saving weekly notes:", err);
      toast.error(err?.message || "Gagal menyimpan catatan penting.");
    }
  }

  async function handleExportDocx() {
    if (entries.length === 0) {
      toast.error("Belum ada kegiatan pada minggu ini untuk diunduh.");
      return;
    }
    setIsExporting(true);
    try {
      await exportLogbookToDocx(
        studentProfile,
        entries,
        weeklyNotes,
        selectedWeek
      );
      toast.success("File Word Logbook KKN (.docx) berhasil diunduh!");
    } catch (err) {
      console.error("Export DOCX Error:", err);
      toast.error(
        "Gagal mengunduh Word. Pastikan file template_logbook_kkn.docx berada di folder public/templates."
      );
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportPdf() {
    if (entries.length === 0) {
      toast.error("Belum ada kegiatan pada minggu ini untuk diunduh.");
      return;
    }
    try {
      exportLogbookToPdf(
        studentProfile,
        entries,
        weeklyNotes,
        selectedWeek
      );
      toast.success("File PDF Logbook KKN (.pdf) berhasil diunduh!");
    } catch (err) {
      console.error("Export PDF Error:", err);
      toast.error("Gagal mengunduh dokumen PDF.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Catatan Harian (Logbook KKN)"
        description="Kelola rekap kegiatan harian KKN Anda dan ekspor secara otomatis ke dalam bentuk Word (.docx) berstandar UMRAH maupun PDF."
      />

      {/* Control Bar: Select Week & Export Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/60 shadow-2xs">
        {/* Selector Minggu */}
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <BookOpen className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground block uppercase tracking-wider">
              Pilih Minggu KKN
            </span>
            <Select
              value={selectedWeek.toString()}
              onValueChange={(val: string) => setSelectedWeek(parseInt(val))}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs font-bold rounded-lg border-border/80">
                <SelectValue placeholder="Pilih Minggu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Minggu I (Pertama)</SelectItem>
                <SelectItem value="2">Minggu II (Kedua)</SelectItem>
                <SelectItem value="3">Minggu III (Ketiga)</SelectItem>
                <SelectItem value="4">Minggu IV (Keempat)</SelectItem>
                <SelectItem value="5">Minggu V (Kelima)</SelectItem>
              </SelectContent>
            </Select>
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
            onClick={handleExportDocx}
            disabled={isExporting}
            variant="outline"
            className="h-9 px-3.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-semibold text-xs rounded-xl gap-1.5"
          >
            <FileSpreadsheet className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Unduh Word (.DOCX)</span>
          </Button>

          <Button
            onClick={handleExportPdf}
            variant="outline"
            className="h-9 px-3.5 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold text-xs rounded-xl gap-1.5"
          >
            <FileText className="size-4 text-rose-600 dark:text-rose-400" />
            <span>Unduh PDF</span>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (8 cols): Tabel Jadwal & Kegiatan */}
        <Card className="lg:col-span-8 border-border/60 shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <span>A. Jadwal &amp; Kegiatan Harian</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Daftar kegiatan harian pada Minggu ke-{selectedWeek}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                {entries.length} Kegiatan
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Memuat catatan kegiatan harian...
              </div>
            ) : entries.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <BookOpen className="size-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Belum ada catatan kegiatan pada Minggu ke-{selectedWeek}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Klik tombol **"Tambah Kegiatan"** di atas untuk mulai menginventarisir kegiatan harian KKN Anda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12 text-center text-xs font-bold">No</TableHead>
                      <TableHead className="w-28 text-xs font-bold">Hari &amp; Tanggal</TableHead>
                      <TableHead className="w-28 text-xs font-bold">Jam</TableHead>
                      <TableHead className="text-xs font-bold">Rincian Kegiatan</TableHead>
                      <TableHead className="w-24 text-center text-xs font-bold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((item, idx) => (
                      <TableRow key={item.id || idx} className="hover:bg-muted/30">
                        <TableCell className="text-center text-xs font-semibold">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-xs space-y-0.5">
                          <span className="font-bold text-foreground block">
                            {item.day_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(item.entry_date), "dd/MM/yyyy")}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">
                          {item.time_range}
                        </TableCell>
                        <TableCell className="text-xs space-y-1">
                          <p className="font-bold text-foreground">
                            {item.activity_name}
                          </p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                            {item.activity_description}
                          </p>
                          {item.documentation_url && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <ImageIcon className="size-3" />
                              Ada Dokumentasi
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
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
                              onClick={() => item.id && handleDeleteEntry(item.id)}
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
              className="w-full h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-xl shadow-xs gap-1.5 mt-2"
            >
              <Save className="size-3.5" />
              <span>Simpan Catatan Mingguan</span>
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

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground block">
                Link Foto Dokumentasi (Opsional)
              </span>
              <Input
                value={formDocUrl}
                onChange={(e) => setFormDocUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="h-9 text-xs rounded-lg"
              />
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
    </div>
  );
}
