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
} from "lucide-react";
import { Link } from "react-router-dom";

import { supabase, type WorkProgram } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

export function MahasiswaProkerPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<WorkProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Semua Hari");
  const [searchQuery, setSearchQuery] = useState("");

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
    if (activeTab !== "Semua Hari") {
      result = result.filter((p) => p.day_name === activeTab);
    }
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
  }, [programs, activeTab, searchQuery]);

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

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={activeTab === "Semua Hari" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("Semua Hari")}
            className="text-xs shrink-0"
          >
            Semua Hari
          </Button>
          {DAYS_LIST.map((day) => (
            <Button
              key={day}
              variant={activeTab === day ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(day)}
              className={cn(
                "text-xs shrink-0",
                day === todayDayName && activeTab !== day && "border-sky-500/50 text-sky-600 dark:text-sky-400 font-semibold"
              )}
            >
              {day} {day === todayDayName && "• Hari Ini"}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari agenda kegiatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Schedule Grid by Days (Matching Sample Screenshot) */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {programsByDay.map(({ day, items }) => {
            const isToday = day === todayDayName;
            if (activeTab === "Semua Hari" && items.length === 0) return null;

            return (
              <div key={day} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span>{day}</span>
                    {isToday && (
                      <Badge className="bg-sky-500 text-white text-[10px] px-2 py-0">
                        Hari Ini
                      </Badge>
                    )}
                  </h3>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {items.length} Agenda
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                    Tidak ada kegiatan pada hari {day}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((p) => {
                      return (
                        <Card
                          key={p.id}
                          className={cn(
                            "relative transition-all duration-200 hover:shadow-md border",
                            isToday
                              ? "bg-sky-50/70 border-sky-300 dark:bg-sky-950/40 dark:border-sky-800 shadow-xs"
                              : "bg-card border-border/70 hover:border-border"
                          )}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Title & Code Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-foreground tracking-tight line-clamp-2">
                                  {p.title} - {p.code}
                                </h4>
                              </div>
                              {isToday && (
                                <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-600 dark:text-sky-400 shrink-0">
                                  Aktif
                                </Badge>
                              )}
                            </div>

                            {/* Details matching reference screenshot */}
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                <span>{p.day_name}, {new Date(p.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                              </div>

                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="size-3.5 text-rose-500 shrink-0" />
                                <span className="font-mono font-medium">{p.starts_at} - {p.ends_at} WIB</span>
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
    </div>
  );
}
