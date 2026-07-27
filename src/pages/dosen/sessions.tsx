import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  QrCode,
  Plus,
  Trash2,
  Eye,
  CalendarClock,
  ShieldAlert,
  Search,
  ArrowUpDown,
  X,
  Activity,
  CheckCircle2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { supabase, type QrSession } from "@/lib/supabase";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { QrPreview } from "@/components/qr-preview";

const sessionSchema = z
  .object({
    title: z.string().min(3, "Judul sesi minimal 3 karakter"),
    meeting_date: z.string().min(1, "Tanggal pertemuan wajib diisi"),
    starts_at: z.string().min(1, "Waktu mulai wajib diisi"),
    duration: z
      .number()
      .int()
      .min(5, "Durasi minimal 5 menit")
      .max(240, "Durasi maksimal 240 menit"),
    location: z.string().optional(),
  });

type SessionForm = z.infer<typeof sessionSchema>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusOf(s: QrSession): "active" | "past" | "scheduled" {
  const now = new Date();
  if (new Date(s.ends_at) < now) return "past";
  if (new Date(s.starts_at) > now) return "scheduled";
  return "active";
}

function MiniSparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  const points = data.length > 2 ? data : [12, 18, 14, 24, 19, 28, 24, 32];
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

export function DosenSessionsPage() {
  const { group } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewSession, setPreviewSession] = useState<QrSession | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Search, Filter, & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "scheduled" | "past">("all");
  const [sortOption, setSortOption] = useState<"terbaru" | "terlama" | "judul_az" | "judul_za">("terbaru");

  const activeCount = useMemo(() => sessions.filter((s) => statusOf(s) === "active").length, [sessions]);
  const scheduledCount = useMemo(() => sessions.filter((s) => statusOf(s) === "scheduled").length, [sessions]);
  const pastCount = useMemo(() => sessions.filter((s) => statusOf(s) === "past").length, [sessions]);

  const processedSessions = useMemo(() => {
    let list = [...sessions];

    // 1. Filter Status
    if (statusFilter !== "all") {
      list = list.filter((s) => statusOf(s) === statusFilter);
    }

    // 2. Search Filter (Judul, Lokasi, Waktu)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.location && s.location.toLowerCase().includes(q)) ||
          formatDateTime(s.starts_at).toLowerCase().includes(q)
      );
    }

    // 3. Sorting Logic
    list.sort((a, b) => {
      if (sortOption === "judul_az") {
        return a.title.localeCompare(b.title, "id");
      }
      if (sortOption === "judul_za") {
        return b.title.localeCompare(a.title, "id");
      }
      if (sortOption === "terlama") {
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      }
      // "terbaru" (default)
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });

    return list;
  }, [sessions, statusFilter, searchQuery, sortOption]);

  // Pagination State (6 sesi per halaman untuk performa cepat dan ringan)
  const SESSIONS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination ke halaman 1 saat pencarian, filter, atau sorting berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOption]);

  const totalPages = Math.ceil(processedSessions.length / SESSIONS_PER_PAGE) || 1;

  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * SESSIONS_PER_PAGE;
    return processedSessions.slice(start, start + SESSIONS_PER_PAGE);
  }, [processedSessions, currentPage]);

  const form = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      title: "",
      meeting_date: new Date().toISOString().slice(0, 10),
      starts_at: "08:00",
      duration: 60,
      location: "",
    },
    mode: "onBlur",
  });

  async function loadSessions() {
    if (!group) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("qr_sessions")
      .select(
        "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
      )
      .eq("group_id", group.id)
      .order("created_at", { ascending: false });
    setSessions((data as QrSession[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSessions();
  }, [group]);

  async function onSubmit(values: SessionForm) {
    if (!group) return;
    setSubmitting(true);
    const start = new Date(`${values.meeting_date}T${values.starts_at}`);
    const end = new Date(start.getTime() + values.duration * 60 * 1000);
    const { error } = await supabase.from("qr_sessions").insert({
      group_id: group.id,
      title: values.title,
      meeting_date: values.meeting_date,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      location: values.location || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Gagal membuat sesi absen.");
      return;
    }
    toast.success("Sesi absen berhasil dibuat.");
    form.reset();
    setOpen(false);
    loadSessions();
  }

  async function handleRemove(id: string) {
    if (!confirm("Hapus sesi absen ini? Semua catatan kehadiran terkait juga akan dihapus.")) {
      return;
    }
    setRemovingId(id);
    const { error } = await supabase
      .from("qr_sessions")
      .delete()
      .eq("id", id);
    setRemovingId(null);
    if (error) {
      toast.error("Gagal menghapus sesi.");
      return;
    }
    toast.success("Sesi absen dihapus.");
    loadSessions();
  }

  if (!group && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Sesi Absensi"
          description="Buat dan kelola sesi absen berbasis QR code."
        />
        <Empty className="border">
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Kelompok KKN belum siap</EmptyTitle>
          <EmptyDescription>
            Anda belum memiliki kelompok KKN. Sesi absen hanya bisa dibuat
            setelah kelompok terbentuk.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sesi Absensi"
        description="Buat dan kelola sesi absen berbasis QR code untuk mahasiswa kelompok Anda."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Buat Sesi Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Buat Sesi Absen Baru</DialogTitle>
                <DialogDescription>
                  QR code akan dihasilkan otomatis. Mahasiswa memindainya
                  saat sesi sedang aktif.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
                noValidate
              >
                <Field
                  data-invalid={form.formState.errors.title ? true : undefined}
                >
                  <FieldLabel htmlFor="s_title">Judul Pertemuan</FieldLabel>
                  <Input
                    id="s_title"
                    placeholder="Pertemuan 1 - Pengenalan"
                    aria-invalid={form.formState.errors.title ? true : undefined}
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <FieldError errors={[form.formState.errors.title]} />
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field
                    data-invalid={form.formState.errors.meeting_date ? true : undefined}
                  >
                    <FieldLabel htmlFor="s_date">Tanggal</FieldLabel>
                    <Input
                      id="s_date"
                      type="date"
                      aria-invalid={form.formState.errors.meeting_date ? true : undefined}
                      {...form.register("meeting_date")}
                    />
                    {form.formState.errors.meeting_date && (
                      <FieldError errors={[form.formState.errors.meeting_date]} />
                    )}
                  </Field>

                  <Field
                    data-invalid={form.formState.errors.starts_at ? true : undefined}
                  >
                    <FieldLabel htmlFor="s_start">Waktu Mulai</FieldLabel>
                    <Input
                      id="s_start"
                      type="time"
                      aria-invalid={form.formState.errors.starts_at ? true : undefined}
                      {...form.register("starts_at")}
                    />
                    {form.formState.errors.starts_at && (
                      <FieldError errors={[form.formState.errors.starts_at]} />
                    )}
                  </Field>
                </div>

                <Field
                  data-invalid={form.formState.errors.duration ? true : undefined}
                >
                  <FieldLabel htmlFor="s_duration">
                    Durasi (menit)
                  </FieldLabel>
                  <Input
                    id="s_duration"
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    aria-invalid={form.formState.errors.duration ? true : undefined}
                    {...form.register("duration", { valueAsNumber: true })}
                  />
                  {form.formState.errors.duration && (
                    <FieldError errors={[form.formState.errors.duration]} />
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="s_location">
                    Lokasi (opsional)
                  </FieldLabel>
                  <Input
                    id="s_location"
                    placeholder="Pulau Parit/Selat Gelam Kabupaten Karimun"
                    {...form.register("location")}
                  />
                </Field>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    Buat Sesi
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* 3 Top Stat Metric Cards matching Ringkasan Dashboard */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Total Sesi Absen */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Sesi Absen
              </span>
              <QrCode className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : sessions.length}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>{sessions.length} Sesi Terdaftar</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={sessions.length > 0 ? [2, 4, 3, 6, 5, 8, 6, 12] : [1, 2, 2, 4, 3, 5, 4, 6]}
                  color="#10b981"
                  id="sparklineSesi1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Sesi Aktif Saat Ini */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sesi Aktif Saat Ini
              </span>
              <Activity className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : activeCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                  {activeCount > 0 && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
                  <span>{activeCount > 0 ? `${activeCount} Sesi Sedang Berlangsung` : "Tidak Ada Sesi Aktif"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={activeCount > 0 ? [10, 15, 12, 24, 20, 28] : [2, 3, 2, 4, 3, 5]}
                  color="#0284c7"
                  id="sparklineSesi2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Terjadwal & Selesai */}
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs transition-all hover:border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Terjadwal &amp; Selesai
              </span>
              <CalendarClock className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : scheduledCount}
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">/ {pastCount} Selesai</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <UserCheck className="size-3.5" />
                  <span>{scheduledCount} Terjadwal • {pastCount} Selesai</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={[15, 22, 18, 30, 25, 34, 28, 40]}
                  color="#a855f7"
                  id="sparklineSesi3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-2xs">
        <CardHeader className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold">Daftar Sesi Absensi</CardTitle>
              <CardDescription className="text-xs">
                {sessions.length} sesi terdaftar untuk kelompok Anda.
              </CardDescription>
            </div>

            {/* Filter Status Pills */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg text-xs font-medium self-start sm:self-auto">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "active", label: "Aktif" },
                  { id: "scheduled", label: "Terjadwal" },
                  { id: "past", label: "Selesai" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md transition-all cursor-pointer",
                    statusFilter === tab.id
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul sesi, lokasi, atau tanggal..."
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

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <Select value={sortOption} onValueChange={(val: any) => setSortOption(val)}>
                <SelectTrigger className="w-[170px] text-xs h-9">
                  <SelectValue placeholder="Urutkan Sesi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terbaru" className="text-xs">Sesi Terbaru</SelectItem>
                  <SelectItem value="terlama" className="text-xs">Sesi Terlama</SelectItem>
                  <SelectItem value="judul_az" className="text-xs">Judul (A - Z)</SelectItem>
                  <SelectItem value="judul_za" className="text-xs">Judul (Z - A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <Empty className="border">
              <EmptyMedia variant="icon">
                <QrCode />
              </EmptyMedia>
              <EmptyTitle>Belum ada sesi absen</EmptyTitle>
              <EmptyDescription>
                Buat sesi pertama untuk mulai mencatat kehadiran mahasiswa Anda.
              </EmptyDescription>
            </Empty>
          ) : processedSessions.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <Search className="size-8 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Tidak ditemukan sesi absen</p>
              <p>Tidak ada sesi yang cocok dengan kriteria pencarian dan filter Anda.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="mt-2 text-xs"
              >
                Reset Filter & Pencarian
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                {paginatedSessions.map((s) => {
                  const status = statusOf(s);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between hover:border-border transition-colors"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {s.title}
                          </span>
                          <Badge
                            variant={
                              status === "active"
                                ? "default"
                                : status === "past"
                                  ? "secondary"
                                  : "outline"
                            }
                            className={cn(
                              status === "active" &&
                                "bg-emerald-600 text-white dark:bg-emerald-600/80"
                            )}
                          >
                            {status === "active"
                              ? "Aktif"
                              : status === "past"
                                ? "Selesai"
                                : "Terjadwal"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            {formatDateTime(s.starts_at)} -{" "}
                            {new Date(s.ends_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {s.location && <span>{s.location}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewSession(s)}
                        >
                          <Eye className="size-4" />
                          Lihat QR
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemove(s.id)}
                          disabled={removingId === s.id}
                          aria-label="Hapus sesi"
                        >
                          {removingId === s.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {processedSessions.length > SESSIONS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-xs">
                  <div className="text-muted-foreground font-medium">
                    Menampilkan{" "}
                    <span className="font-bold text-foreground">
                      {(currentPage - 1) * SESSIONS_PER_PAGE + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-bold text-foreground">
                      {Math.min(currentPage * SESSIONS_PER_PAGE, processedSessions.length)}
                    </span>{" "}
                    dari <span className="font-bold text-foreground">{processedSessions.length}</span> Sesi Absen
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

      <Dialog
        open={!!previewSession}
        onOpenChange={(o) => !o && setPreviewSession(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{previewSession?.title}</DialogTitle>
            <DialogDescription>
              {previewSession &&
                `${formatDateTime(previewSession.starts_at)} - ${new Date(
                  previewSession.ends_at
                ).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </DialogDescription>
          </DialogHeader>
          {previewSession && (
            <div className="flex justify-center py-2">
              <QrPreview
                value={previewSession.token}
                size={260}
                caption="Tampilkan QR ini kepada mahasiswa untuk dipindai atau diunduh lalu dikirim melalui perangkat lain."
                downloadName={`qr-${previewSession.title
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
