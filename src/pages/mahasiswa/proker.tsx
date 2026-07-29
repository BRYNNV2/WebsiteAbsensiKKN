import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  Search,
  ScanLine,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";

import { supabase, type WorkProgram } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatProkerTime } from "@/pages/dosen/proker";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const DAYS_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

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

export function MahasiswaProkerPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<WorkProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>("Semua Minggu");
  const [activeTab, setActiveTab] = useState<string>("Semua Hari");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailProgram, setDetailProgram] = useState<WorkProgram | null>(null);

  const groupId = profile?.group_id;

  const fetchPrograms = async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("kkn_work_programs")
        .select("*")
        .eq("group_id", groupId)
        .order("date", { ascending: true })
        .order("starts_at", { ascending: true });

      if (error && error.code !== "42P01") {
        console.error("Error fetching work programs for mahasiswa:", error);
      } else if (data) {
        setPrograms(data as WorkProgram[]);
      }
    } catch (err) {
      console.error("Error fetching work programs for mahasiswa:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [groupId]);

  // Today's Day Name in Indonesian
  const todayDayName = useMemo(() => {
    const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return daysMap[new Date().getDay()];
  }, []);

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

  const todayCount = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    return programs.filter((p) => (p.date || "").slice(0, 10) === todayStr).length;
  }, [programs]);

  if (!groupId && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Jadwal Program Kerja"
          description="Pantau seluruh agenda dan jadwal kegiatan program kerja kelompok KKN Anda."
        />
        <Empty className="border">
          <EmptyMedia variant="icon">
            <Briefcase />
          </EmptyMedia>
          <EmptyTitle>Belum Terdaftar Dalam Kelompok</EmptyTitle>
          <EmptyDescription>
            Akun Anda belum terhubung ke kelompok KKN. Hubungi dosen pembimbing untuk didaftarkan.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Jadwal Program Kerja KKN"
        description="Pantau agenda kegiatan program kerja kelompok KKN Anda secara teratur."
        action={
          <Button asChild className="shadow-xs">
            <Link to="/scan">
              <ScanLine className="size-4" />
              Pindai QR Absen
            </Link>
          </Button>
        }
      />

      {/* 3 Stat Cards with Sparklines */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden border border-border/60 bg-card shadow-2xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Agenda KKN
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
                  <span>Program Kerja Terjadwal</span>
                </div>
              </div>
              <div className="pb-1">
                <MiniSparkline
                  data={programs.length > 0 ? [2, 5, 4, 8, 7, 12, 10] : [1, 1, 1, 1]}
                  color="#10b981"
                  id="sparklineMhsProker1"
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
                  id="sparklineMhsProker2"
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
                  id="sparklineMhsProker3"
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
              placeholder="Cari agenda kegiatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-8 rounded-xl bg-background border-border/70"
            />
          </div>
        </div>
      </div>

      {/* Schedule Grid by Days (Matching Sample Screenshot) */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
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
                Dosen pembimbing belum menyusun agenda program kerja untuk kelompok Anda.
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

                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 shrink-0"
                                title="Lihat Detail Program Kerja"
                                onClick={() => setDetailProgram(p)}
                              >
                                <Eye className="size-3.5" />
                              </Button>
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
