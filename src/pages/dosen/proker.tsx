import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  GraduationCap,
  Loader2,
  CheckCircle2,
  Sparkles,
  Search,
  Eye,
} from "lucide-react";

import { supabase, type WorkProgram } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useDosenData } from "@/hooks/use-dosen-data";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingLottie } from "@/components/loading-lottie";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const DAYS_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const prokerSchema = z.object({
  title: z.string().min(3, "Nama program kerja minimal 3 karakter"),
  code: z.string().min(2, "Kode proker minimal 2 karakter"),
  day_name: z.string().min(1, "Pilih hari pelaksanaan"),
  date: z.string().min(1, "Pilih tanggal pelaksanaan"),
  starts_at: z.string().min(1, "Masukkan jam mulai"),
  ends_at: z.string().min(1, "Masukkan jam selesai"),
  category: z.string().optional(),
  location: z.string().min(2, "Lokasi minimal 2 karakter"),
  description: z.string().optional(),
});

type ProkerFormValues = z.infer<typeof prokerSchema>;

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

function getProkerStatus(p: WorkProgram) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;

  const startTime = (p.starts_at || "").slice(0, 5);
  const endTime = (p.ends_at || "").slice(0, 5);
  const pDate = (p.date || "").slice(0, 10);

  if (pDate < todayStr) {
    return {
      statusKey: "completed",
      label: "Selesai",
      badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      cardClass: "bg-card border-border/70 hover:border-border",
    };
  }
  if (pDate > todayStr) {
    return {
      statusKey: "scheduled",
      label: "Terjadwal",
      badgeClass: "bg-muted text-muted-foreground border-border",
      cardClass: "bg-card border-border/70 hover:border-border",
    };
  }

  // Same day: check time slot!
  if (currentTimeStr >= startTime && currentTimeStr <= endTime) {
    return {
      statusKey: "active",
      label: "Sedang Berlangsung",
      badgeClass: "bg-sky-500 text-white border-sky-600 font-bold",
      cardClass: "bg-card border-l-4 border-l-sky-500 border-border/70 shadow-2xs",
    };
  } else if (currentTimeStr > endTime) {
    return {
      statusKey: "completed",
      label: "Selesai",
      badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      cardClass: "bg-card border-border/70 hover:border-border",
    };
  } else {
    return {
      statusKey: "scheduled",
      label: "Terjadwal (Hari Ini)",
      badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      cardClass: "bg-card border-border/70 hover:border-border",
    };
  }
}

function getProkerWeek(dateStr: string) {
  if (!dateStr) return 1;
  const day = new Date(dateStr).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function formatProkerTime(startsAt: string, endsAt: string) {
  if (!endsAt || endsAt.toLowerCase().includes("selesai") || endsAt === "23:59") {
    return `${startsAt} WIB - Selesai`;
  }
  return `${startsAt} - ${endsAt} WIB`;
}

export function DosenProkerPage() {
  const { profile } = useAuth();
  const { group, loading: groupLoading } = useDosenData();

  const [programs, setPrograms] = useState<WorkProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>("Semua Minggu");
  const [activeTab, setActiveTab] = useState<string>("Semua Hari");
  const [searchQuery, setSearchQuery] = useState("");
  const [isUntilFinish, setIsUntilFinish] = useState(false);

  // Modal Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkProgram | null>(null);
  const [detailProgram, setDetailProgram] = useState<WorkProgram | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form setup
  const form = useForm<ProkerFormValues>({
    resolver: zodResolver(prokerSchema),
    defaultValues: {
      title: "",
      code: "PRK-01",
      day_name: "Senin",
      date: new Date().toISOString().split("T")[0],
      starts_at: "08:00",
      ends_at: "10:00",
      category: "Bidang Kesehatan & Lingkungan",
      location: "Balai Desa",
      description: "",
    },
  });

  const fetchPrograms = async () => {
    if (!group?.id) return;
    try {
      const { data, error } = await supabase
        .from("kkn_work_programs")
        .select("*")
        .eq("group_id", group.id)
        .order("date", { ascending: true })
        .order("starts_at", { ascending: true });

      if (error && error.code !== "42P01") {
        console.error("Error fetching work programs:", error);
      } else if (data) {
        setPrograms(data as WorkProgram[]);
      }
    } catch (err) {
      console.error("Error fetching work programs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (group?.id) {
      fetchPrograms();
    } else if (!groupLoading) {
      setLoading(false);
    }
  }, [group?.id, groupLoading]);

  // Today's Day Name in Indonesian
  const todayDayName = useMemo(() => {
    const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return daysMap[new Date().getDay()];
  }, []);

  const openCreateModal = () => {
    form.reset({
      title: "",
      code: `PRK-0${programs.length + 1}`,
      day_name: todayDayName,
      date: new Date().toISOString().split("T")[0],
      starts_at: "08:00",
      ends_at: "10:00",
      category: "Bidang Kesehatan & Lingkungan",
      location: group?.location ?? "Balai Desa",
      description: "",
    });
    setIsUntilFinish(false);
    setEditingProgram(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (p: WorkProgram) => {
    const isSelesai = p.ends_at?.toLowerCase().includes("selesai") || p.ends_at === "23:59";
    setIsUntilFinish(Boolean(isSelesai));
    form.reset({
      title: p.title,
      code: p.code,
      day_name: p.day_name,
      date: p.date,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      category: p.category,
      location: p.location,
      description: p.description ?? "",
    });
    setEditingProgram(p);
    setIsCreateOpen(true);
  };

  const onSubmit = async (values: ProkerFormValues) => {
    if (!group?.id || !profile?.id) return;
    setSubmitting(true);
    try {
      if (editingProgram) {
        const { error } = await supabase
          .from("kkn_work_programs")
          .update({
            title: values.title,
            code: values.code,
            day_name: values.day_name,
            date: values.date,
            starts_at: values.starts_at,
            ends_at: values.ends_at,
            category: values.category || "Umum",
            location: values.location,
            description: values.description || null,
          })
          .eq("id", editingProgram.id);

        if (error) throw error;
        toast.success("Program kerja berhasil diperbarui.");
      } else {
        const { error } = await supabase.from("kkn_work_programs").insert({
          group_id: group.id,
          title: values.title,
          code: values.code,
          day_name: values.day_name,
          date: values.date,
          starts_at: values.starts_at,
          ends_at: values.ends_at,
          category: values.category || "Umum",
          location: values.location,
          description: values.description || null,
          created_by: profile.id,
        });

        if (error) throw error;
        toast.success("Program kerja baru berhasil ditambahkan.");
      }

      setIsCreateOpen(false);
      fetchPrograms();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan program kerja.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("kkn_work_programs")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Program kerja berhasil dihapus.");
      setDeletingId(null);
      fetchPrograms();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus program kerja.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered programs
  const filteredPrograms = useMemo(() => {
    let result = programs;

    // Filter by Week
    if (selectedWeek !== "Semua Minggu") {
      if (selectedWeek === "Hari Ini") {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const todayStr = `${y}-${m}-${d}`;
        result = result.filter((p) => (p.date || "").slice(0, 10) === todayStr);
      } else {
        const targetWeekNum = parseInt(selectedWeek.replace("Minggu ", ""), 10);
        result = result.filter((p) => getProkerWeek(p.date) === targetWeekNum);
      }
    }

    // Filter by Day of Week
    if (activeTab !== "Semua Hari") {
      result = result.filter((p) => p.day_name === activeTab);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
      );
    }
    return result;
  }, [programs, selectedWeek, activeTab, searchQuery]);

  // Group programs by Day for UI rendering
  const programsByDay = useMemo(() => {
    const days = activeTab === "Semua Hari" ? DAYS_LIST : [activeTab];
    return days.map((day) => ({
      day,
      items: filteredPrograms.filter((p) => p.day_name === day),
    }));
  }, [filteredPrograms, activeTab]);

  const todayCount = useMemo(
    () => programs.filter((p) => p.day_name === todayDayName).length,
    [programs, todayDayName]
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Program Kerja KKN"
        description={`Susun dan kelola jadwal program kerja harian untuk ${group?.name ?? "Kelompok KKN"}.`}
        action={
          <Button onClick={openCreateModal} className="shadow-xs">
            <Plus className="size-4" />
            Buat Program Kerja
          </Button>
        }
      />

      {/* 3 Stat Cards with Sparklines */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Program Kerja
              </span>
              <Briefcase className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : programs.length}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>Agenda KKN Terjadwal</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={programs.length > 0 ? [2, 5, 4, 8, 7, 12, 10] : [1, 1, 1, 1]}
                  color="#10b981"
                  id="sparklineProker1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kegiatan Hari Ini ({todayDayName})
              </span>
              <Calendar className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : todayCount}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                  <Sparkles className="size-3.5" />
                  <span>{todayCount > 0 ? `${todayCount} Agenda Aktif Hari Ini` : "Tidak Ada Agenda Hari Ini"}</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={todayCount > 0 ? [3, 6, 5, 9, 8, 12] : [1, 2, 1, 1]}
                  color="#0284c7"
                  id="sparklineProker2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Bidang &amp; Kategori
              </span>
              <GraduationCap className="size-4 text-muted-foreground/70" />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                  {loading ? <Skeleton className="h-9 w-16" /> : new Set(programs.map((p) => p.category)).size}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <GraduationCap className="size-3.5" />
                  <span>Sektor Kegiatan KKN</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={[20, 45, 35, 65, 55, 90]}
                  color="#a855f7"
                  id="sparklineProker3"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2-Level Weekly & Daily Filter Navigation Bar */}
      <div className="space-y-3 bg-card p-3.5 rounded-2xl border border-border/70 shadow-2xs">
        {/* Row 1: Week Selection Navbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="size-3.5 text-primary" />
              <span>Minggu KKN:</span>
            </span>

            {[
              { id: "Semua Minggu", label: "Semua Minggu" },
              { id: "Minggu 1", label: "Minggu 1 (Tgl 1-7)" },
              { id: "Minggu 2", label: "Minggu 2 (Tgl 8-14)" },
              { id: "Minggu 3", label: "Minggu 3 (Tgl 15-21)" },
              { id: "Minggu 4", label: "Minggu 4 (Tgl 22-31)" },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWeek(w.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                  selectedWeek === w.id
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {w.label}
              </button>
            ))}

            <button
              onClick={() => {
                setSelectedWeek("Hari Ini");
                setActiveTab(todayDayName);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
                selectedWeek === "Hari Ini"
                  ? "bg-sky-500 text-white shadow-xs font-bold"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 font-semibold"
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Hari Ini ({todayDayName})</span>
            </button>
          </div>
        </div>

        {/* Row 2: Day Filter & Search Input */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Filter Hari:</span>
            <Select value={activeTab} onValueChange={(val) => setActiveTab(val)}>
              <SelectTrigger className="h-8 border-border/70 bg-background text-xs font-semibold w-48">
                <SelectValue placeholder="Pilih Hari" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="Semua Hari" className="text-xs font-semibold">
                  Semua Hari (Senin - Minggu)
                </SelectItem>
                {DAYS_LIST.map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d} {d === todayDayName && "(Hari Ini)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(selectedWeek !== "Semua Minggu" || activeTab !== "Semua Hari" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedWeek("Semua Minggu");
                  setActiveTab("Semua Hari");
                  setSearchQuery("");
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset Filter
              </Button>
            )}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari program kerja..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-8 rounded-xl bg-background border-border/70"
            />
          </div>
        </div>
      </div>

      {/* Schedule Grid by Days (Matching Sample Screenshot) */}
      {loading ? (
        <div className="py-16 flex justify-center items-center">
          <LoadingLottie text="Memuat daftar agenda &amp; program kerja KKN..." />
        </div>
      ) : programs.length === 0 ? (
        <Card className="border border-border/60">
          <CardContent className="py-12">
            <Empty className="border-0">
              <EmptyMedia variant="icon">
                <Briefcase />
              </EmptyMedia>
              <EmptyTitle>Belum Ada Program Kerja</EmptyTitle>
              <EmptyDescription>
                Klik tombol "Buat Program Kerja" di atas untuk menyusun agenda kegiatan KKN kelompok Anda.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {programsByDay.map(({ day, items }) => {
            const isToday = day === todayDayName;
            if (activeTab === "Semua Hari" && items.length === 0) return null;

            return (
              <div key={day} className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
                    <span>{day}</span>
                    {isToday && (
                      <Badge className="bg-sky-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0">
                        Hari Ini
                      </Badge>
                    )}
                  </h3>
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">
                    {items.length} Agenda
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed text-center text-[11px] sm:text-xs text-muted-foreground">
                    Tidak ada kegiatan pada hari {day}.
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3">
                    {items.map((p) => {
                      const status = getProkerStatus(p);
                      return (
                        <Card
                          key={p.id}
                          className={cn(
                            "relative transition-all duration-200 hover:shadow-md border",
                            status.cardClass
                          )}
                        >
                          <CardContent className="p-3 sm:p-4 space-y-2.5">
                            {/* Title & Code Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-foreground tracking-tight line-clamp-2">
                                  {p.title} - {p.code}
                                </h4>
                                <Badge className={cn("mt-1 text-[10px] px-2 py-0.5 border", status.badgeClass)}>
                                  {status.label}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950"
                                  title="Lihat Detail Program Kerja"
                                  onClick={() => setDetailProgram(p)}
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-foreground"
                                  title="Edit Program Kerja"
                                  onClick={() => openEditModal(p)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  title="Hapus Program Kerja"
                                  onClick={() => setDeletingId(p.id)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Details matching reference screenshot */}
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                <span>{p.day_name}, {new Date(p.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                              </div>

                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="size-3.5 text-rose-500 shrink-0" />
                                <span className="font-mono font-medium">{formatProkerTime(p.starts_at, p.ends_at)}</span>
                              </div>

                              <div className="flex items-center gap-2 text-muted-foreground">
                                <GraduationCap className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                <span>{p.category}</span>
                              </div>

                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="truncate">{p.location}</span>
                              </div>
                            </div>

                            {p.description && (
                              <p className="pt-2 border-t text-[11px] text-muted-foreground/90 line-clamp-2 leading-relaxed">
                                {p.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog: Create / Edit Program Kerja */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="size-5 text-primary" />
                <span>{editingProgram ? "Edit Program Kerja" : "Buat Program Kerja Baru"}</span>
              </DialogTitle>
              <DialogDescription>
                Isi rincian jadwal agenda program kerja kelompok KKN Anda.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-xs">
              <Field>
                <FieldLabel>Nama Program Kerja</FieldLabel>
                <Input
                  {...form.register("title")}
                  placeholder="Contoh: Sosialisasi Pengolahan Sampah Organik"
                  className="text-xs"
                />
                {form.formState.errors.title && (
                  <FieldError>{form.formState.errors.title.message}</FieldError>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Kode / ID Proker</FieldLabel>
                  <Input
                    {...form.register("code")}
                    placeholder="Contoh: PRK-01 / INF11030"
                    className="text-xs"
                  />
                  {form.formState.errors.code && (
                    <FieldError>{form.formState.errors.code.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Hari Pelaksanaan</FieldLabel>
                  <Select
                    value={form.watch("day_name")}
                    onValueChange={(val) => form.setValue("day_name", val)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Pilih hari" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_LIST.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.day_name && (
                    <FieldError>{form.formState.errors.day_name.message}</FieldError>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel>Tanggal</FieldLabel>
                  <Input
                    type="date"
                    {...form.register("date")}
                    className="text-xs"
                  />
                  {form.formState.errors.date && (
                    <FieldError>{form.formState.errors.date.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Jam Mulai</FieldLabel>
                  <Input
                    type="time"
                    {...form.register("starts_at")}
                    className="text-xs"
                  />
                  {form.formState.errors.starts_at && (
                    <FieldError>{form.formState.errors.starts_at.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Jam Selesai</FieldLabel>
                  {isUntilFinish ? (
                    <Input
                      value="Selesai"
                      disabled
                      className="text-xs bg-muted font-semibold text-sky-600 dark:text-sky-400 border-sky-500/30"
                    />
                  ) : (
                    <Input
                      type="time"
                      {...form.register("ends_at")}
                      className="text-xs"
                    />
                  )}
                  {form.formState.errors.ends_at && (
                    <FieldError>{form.formState.errors.ends_at.message}</FieldError>
                  )}
                </Field>
              </div>

              {/* Checkbox Waktu Fleksibel (Sampai Selesai) */}
              <div className="flex items-center gap-2 -mt-1 pb-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isUntilFinish}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsUntilFinish(checked);
                      if (checked) {
                        form.setValue("ends_at", "Selesai");
                      } else {
                        form.setValue("ends_at", "12:00");
                      }
                    }}
                    className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                  />
                  <span>Jam Selesai Fleksibel ("Mulai {form.watch("starts_at") || "08:00"} - Selesai")</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Bidang / Kategori (Opsional)</FieldLabel>
                  <Input
                    {...form.register("category")}
                    placeholder="Contoh: Bidang Kesehatan & Lingkungan"
                    className="text-xs"
                  />
                  {form.formState.errors.category && (
                    <FieldError>{form.formState.errors.category.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel>Lokasi Pelaksanaan</FieldLabel>
                  <Input
                    {...form.register("location")}
                    placeholder="Contoh: Balai Desa Pulau Parit"
                    className="text-xs"
                  />
                  {form.formState.errors.location && (
                    <FieldError>{form.formState.errors.location.message}</FieldError>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel>Deskripsi / Target Kegiatan (Opsional)</FieldLabel>
                <Textarea
                  {...form.register("description")}
                  placeholder="Tambahkan detail target atau catatan program kerja..."
                  className="text-xs min-h-[80px]"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {editingProgram ? "Simpan Perubahan" : "Buat Program Kerja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirm Delete */}
      <Dialog open={Boolean(deletingId)} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus Program Kerja?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan. Program kerja akan dihapus dari agenda kelompok.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Program Kerja */}
      <Dialog open={Boolean(detailProgram)} onOpenChange={() => setDetailProgram(null)}>
        <DialogContent className="sm:max-w-[500px]">
          {detailProgram && (
            <div>
              <DialogHeader className="pb-3 border-b">
                <div className="flex items-center justify-between gap-2 pr-6">
                  <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                    {detailProgram.code}
                  </Badge>
                  <Badge className={cn("text-xs px-2.5 py-0.5 border", getProkerStatus(detailProgram).badgeClass)}>
                    {getProkerStatus(detailProgram).label}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground mt-2">
                  {detailProgram.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Rincian lengkap informasi kegiatan program kerja KKN.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border bg-muted/40">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-sky-600 dark:text-sky-400" />
                      Hari &amp; Tanggal
                    </span>
                    <p className="font-semibold text-foreground">
                      {detailProgram.day_name},{" "}
                      {new Date(detailProgram.date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-rose-500" />
                      Waktu Pelaksanaan
                    </span>
                    <p className="font-semibold font-mono text-foreground">
                      {formatProkerTime(detailProgram.starts_at, detailProgram.ends_at)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="size-3 text-purple-600 dark:text-purple-400" />
                      Bidang / Kategori
                    </span>
                    <p className="font-semibold text-foreground truncate">
                      {detailProgram.category}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 text-emerald-600 dark:text-emerald-400" />
                      Lokasi
                    </span>
                    <p className="font-semibold text-foreground truncate">
                      {detailProgram.location}
                    </p>
                  </div>
                </div>

                {/* Deskripsi Target */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Briefcase className="size-3.5 text-primary" />
                    Deskripsi &amp; Target Kegiatan:
                  </span>
                  <div className="p-3.5 rounded-xl border bg-card text-foreground/90 text-xs leading-relaxed whitespace-pre-line">
                    {detailProgram.description || "Tidak ada deskripsi tambahan yang dimasukkan."}
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setDetailProgram(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
