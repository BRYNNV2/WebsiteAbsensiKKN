import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  MessageSquareHeart,
  Star,
  Send,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Clock,
  Trash2,
  MessageCircle,
  Search,
} from "lucide-react";

import { supabase, type FeedbackItem } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingLottie } from "@/components/loading-lottie";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const feedbackSchema = z.object({
  category: z.string().min(1, "Pilih kategori feedback"),
  rating: z.number().min(1).max(5),
  title: z.string().min(4, "Judul minimal 4 karakter"),
  content: z.string().min(10, "Isi pesan feedback minimal 10 karakter"),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

const CATEGORIES = [
  "Saran & Masukan",
  "Laporan Kendala",
  "Pertanyaan",
  "Apresiasi & Ulasan",
];

const RATING_LABELS: Record<number, string> = {
  1: "Sangat Buruk 😞",
  2: "Kurang Baik 😕",
  3: "Cukup Baik 🙂",
  4: "Sangat Bagus 😃",
  5: "Sangat Memuaskan! 🌟",
};

export function FeedbackPage() {
  const { profile } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // State for Dosen Responding
  const [selectedFeedbackForResponse, setSelectedFeedbackForResponse] = useState<FeedbackItem | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responding, setResponding] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: "Saran & Masukan",
      rating: 5,
      title: "",
      content: "",
    },
  });

  const currentRating = watch("rating");

  // Fetch Feedbacks
  async function fetchFeedbacks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kkn_feedbacks")
        .select(`
          *,
          profiles:user_id (
            full_name,
            role,
            student_id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching feedbacks:", error);
        // Fallback demo mock if table not migrated yet
        setFeedbacks([]);
      } else if (data) {
        const formatted = data.map((item: any) => ({
          ...item,
          user_name: item.profiles?.full_name || "Pengguna",
          user_role: item.profiles?.role || "mahasiswa",
        }));
        setFeedbacks(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  // Submit Feedback
  async function onSubmitFeedback(values: FeedbackFormValues) {
    if (!profile) return;

    // Anti-spam limit: Maximum 1 feedback per day per user
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const hasSubmittedToday = feedbacks.some((f) => {
      if (f.user_id !== profile.id) return false;
      const createdAt = new Date(f.created_at);
      return createdAt >= startOfToday;
    });

    if (hasSubmittedToday) {
      toast.warning("Batas Pengiriman Feedback Terlampaui!", {
        description:
          "Demi mencegah spam, pengiriman masukan dibatasi 1 kali per hari. Silakan kirimkan masukan baru Anda besok!",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("kkn_feedbacks").insert({
        user_id: profile.id,
        group_id: profile.group_id,
        category: values.category,
        rating: values.rating,
        title: values.title,
        content: values.content,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Feedback & Masukan Anda berhasil dikirim!", {
        description: "Terima kasih atas kontribusi Anda dalam pengembangan sistem Web Absensi KKN.",
      });

      reset();
      setOpenCreateModal(false);
      fetchFeedbacks();
    } catch (err: any) {
      toast.error("Gagal mengirim feedback: " + (err.message || "Terjadi kesalahan sistem."));
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Dosen Response
  async function handleSendResponse() {
    if (!selectedFeedbackForResponse || !responseText.trim()) return;
    setResponding(true);
    try {
      const { data, error } = await supabase
        .from("kkn_feedbacks")
        .update({
          response: responseText,
          status: "resolved",
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedFeedbackForResponse.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "Izin RLS Supabase menghalangi pengeditan row. Silakan eksekusi query RLS UPDATE di Supabase SQL Editor."
        );
      }

      toast.success("Tanggapan berhasil disimpan dan dikirim!");
      setSelectedFeedbackForResponse(null);
      setResponseText("");
      fetchFeedbacks();
    } catch (err: any) {
      toast.error("Gagal memberikan tanggapan: " + err.message);
    } finally {
      setResponding(false);
    }
  }

  // Delete Feedback (Only Dosen has authority)
  async function handleDeleteFeedback(item: FeedbackItem) {
    if (profile?.role !== "dosen") {
      toast.error("Hanya Dosen Pembimbing yang memiliki wewenang untuk menghapus masukan.");
      return;
    }

    if (!confirm("Apakah Anda yakin ingin menghapus masukan ini secara permanen?")) return;
    try {
      const { data, error } = await supabase
        .from("kkn_feedbacks")
        .delete()
        .eq("id", item.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "Izin RLS Supabase menghalangi penghapusan. Silakan eksekusi query RLS DELETE di Supabase SQL Editor."
        );
      }

      toast.success("Feedback telah dihapus oleh Dosen.");
      setFeedbacks((prev) => prev.filter((f) => f.id !== item.id));
    } catch (err: any) {
      toast.error("Gagal menghapus feedback: " + err.message);
    }
  }

  // Filtered List
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((item) => {
      // Tab filter
      if (activeTab === "my" && item.user_id !== profile?.id) return false;
      if (activeTab === "resolved" && item.status !== "resolved") return false;

      // Category Filter
      if (selectedCategoryFilter !== "semua" && item.category !== selectedCategoryFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchContent = item.content.toLowerCase().includes(q);
        const matchUser = (item.user_name || "").toLowerCase().includes(q);
        return matchTitle || matchContent || matchUser;
      }

      return true;
    });
  }, [feedbacks, activeTab, selectedCategoryFilter, searchQuery, profile?.id]);

  // Statistics
  const avgRating = useMemo(() => {
    if (feedbacks.length === 0) return 5.0;
    const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    return (sum / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  const resolvedCount = useMemo(() => {
    return feedbacks.filter((f) => f.status === "resolved").length;
  }, [feedbacks]);

  return (
    <div className="w-full max-w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Feedback & Masukan"
          description="Sampaikan saran, ulasan, atau laporkan kendala teknis demi kenyamanan penggunaan Web Absensi KKN."
        />
        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-semibold shadow-md cursor-pointer">
              <MessageSquareHeart className="size-4" />
              Kirim Masukan / Feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="size-5 text-amber-500" />
                Form Feedback &amp; Saran
              </DialogTitle>
              <DialogDescription>
                Bantu kami meningkatkan kualitas layanan sistem absensi KKN dengan memberikan saran atau laporan kendala Anda.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmitFeedback)} className="space-y-4 py-2">
              {/* Rating Selection */}
              <div className="space-y-2 text-center bg-muted/40 p-4 rounded-xl border border-border/50">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Penilaian Kepuasan Sistem
                </label>
                <div className="flex items-center justify-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setValue("rating", star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      <Star
                        className={cn(
                          "size-7 transition-colors",
                          (hoverRating !== null ? star <= hoverRating : star <= currentRating)
                            ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                            : "text-muted-foreground/30 fill-transparent"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {RATING_LABELS[hoverRating || currentRating]}
                </p>
              </div>

              {/* Kategori Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Kategori Feedback <span className="text-destructive">*</span>
                </label>
                <Select
                  defaultValue={watch("category")}
                  onValueChange={(val) => setValue("category", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-destructive">{errors.category.message}</p>
                )}
              </div>

              {/* Judul Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Judul Ringkas <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Contoh: Usulan penambahan fitur unduh PDF Rekap Absen"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Detail Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Detail Pesan / Masukan <span className="text-destructive">*</span>
                </label>
                <Textarea
                  rows={4}
                  placeholder="Jelaskan masukan, kendala, atau tanggapan Anda secara rinci agar dapat ditindaklanjuti dengan baik..."
                  {...register("content")}
                />
                {errors.content && (
                  <p className="text-xs text-destructive">{errors.content.message}</p>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenCreateModal(false)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2 font-semibold">
                  {submitting ? (
                    "Mengirim..."
                  ) : (
                    <>
                      <Send className="size-4" />
                      Kirim Feedback
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <Star className="size-6 fill-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Rating Rata-rata Kepuasan</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold tracking-tight text-foreground">{avgRating}</span>
                <span className="text-xs text-amber-500 font-semibold">/ 5.0 ⭐️</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Masukan Terkirim</p>
              <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                {feedbacks.length} <span className="text-xs font-normal text-muted-foreground">Pesan</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sudah Ditanggapi / Selesai</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                {resolvedCount} <span className="text-xs font-normal text-muted-foreground">Tanggapan</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Tabs defaultValue="all" onValueChange={setActiveTab} className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
          <TabsList className="grid grid-cols-3 sm:w-auto">
            <TabsTrigger value="all">Semua ({feedbacks.length})</TabsTrigger>
            <TabsTrigger value="my">Masukan Saya</TabsTrigger>
            <TabsTrigger value="resolved">Ditanggapi ({resolvedCount})</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-1 sm:max-w-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari masukan atau saran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            {/* Category Dropdown */}
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Kategori</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Feedback List */}
        <TabsContent value={activeTab} className="m-0 space-y-4">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <LoadingLottie text="Memuat daftar feedback &amp; saran..." />
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <Card className="border border-border/60">
              <CardContent className="py-16 text-center">
                <Empty className="border-0">
                  <EmptyMedia variant="icon">
                    <MessageSquareHeart />
                  </EmptyMedia>
                  <EmptyTitle>Belum Ada Feedback</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery || selectedCategoryFilter !== "semua"
                      ? "Tidak ada masukan yang sesuai dengan filter pencarian Anda."
                      : "Belum ada masukan yang dikirimkan. Klik tombol 'Kirim Masukan' di atas untuk menyampaikan saran Anda."}
                  </EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredFeedbacks.map((item) => (
                <Card
                  key={item.id}
                  className="border border-border/60 hover:border-primary/40 transition-all duration-200 shadow-sm flex flex-col justify-between"
                >
                  <CardHeader className="p-3.5 sm:p-5 pb-2 sm:pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px] sm:text-[11px] font-medium bg-secondary/50 px-1.5 py-0.5">
                            {item.category}
                          </Badge>
                          {item.status === "resolved" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] sm:text-[10px] px-1.5 py-0.5 gap-1">
                              <CheckCircle2 className="size-2.5 sm:size-3" /> Ditanggapi
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px] sm:text-[10px] px-1.5 py-0.5 gap-1">
                              <Clock className="size-2.5 sm:size-3" /> Menunggu
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-xs sm:text-base font-bold text-foreground leading-snug pt-0.5 line-clamp-2">
                          {item.title}
                        </CardTitle>
                      </div>

                      {/* Rating Stars */}
                      <div className="flex items-center gap-0.5 bg-amber-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg shrink-0 self-start">
                        <Star className="size-3 sm:size-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-400">
                          {item.rating}.0
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3.5 sm:p-5 pt-0 space-y-3 sm:space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-3 sm:line-clamp-none">
                      "{item.content}"
                    </p>

                    {/* Dosen Official Response Box if exists */}
                    {item.response && (
                      <div className="p-2.5 sm:p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-sky-600 dark:text-sky-400">
                          <MessageCircle className="size-3 shrink-0" />
                          Tanggapan Pembimbing:
                        </div>
                        <p className="text-[10px] sm:text-xs text-foreground/90 italic pl-4 leading-normal line-clamp-2 sm:line-clamp-none">
                          "{item.response}"
                        </p>
                        {item.responded_at && (
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground pl-4 pt-0.5">
                            {new Date(item.responded_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB
                          </p>
                        )}
                      </div>
                    )}

                    {/* Footer Author & Actions */}
                    <div className="pt-2 sm:pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="size-4 sm:size-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[9px] sm:text-[10px] shrink-0">
                          {(item.user_name || "U")[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground text-[10px] sm:text-[11px] truncate">
                          {item.user_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
                          {new Date(item.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Action for Dosen to respond */}
                          {profile?.role === "dosen" && !item.response && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-[11px] gap-1 text-sky-600 border-sky-500/30 hover:bg-sky-500/10 cursor-pointer"
                              onClick={() => {
                                setSelectedFeedbackForResponse(item);
                                setResponseText("");
                              }}
                            >
                              <MessageCircle className="size-2.5 sm:size-3" />
                              Balas
                            </Button>
                          )}

                          {/* Action to Delete feedback (Only Dosen has full control authority) */}
                          {profile?.role === "dosen" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6 sm:size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                              onClick={() => handleDeleteFeedback(item)}
                              title="Hapus Feedback (Wewenang Dosen)"
                            >
                              <Trash2 className="size-3 sm:size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dosen Response Dialog Modal */}
      <Dialog
        open={!!selectedFeedbackForResponse}
        onOpenChange={(open) => !open && setSelectedFeedbackForResponse(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MessageCircle className="size-5 text-sky-500" />
              Tanggapi Masukan Mahasiswa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sampaikan pesan tanggapan atau instruksi tindak lanjut terhadap feedback berikut.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedbackForResponse && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/50 rounded-xl border border-border/50 space-y-1">
                <p className="text-xs font-bold text-foreground">
                  "{selectedFeedbackForResponse.title}"
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedFeedbackForResponse.content}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tanggapan Dosen Pembimbing <span className="text-destructive">*</span>
                </label>
                <Textarea
                  rows={4}
                  placeholder="Tuliskan saran balik, apresiasi, atau solusi atas masukan mahasiswa..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedFeedbackForResponse(null)}
              disabled={responding}
            >
              Batal
            </Button>
            <Button
              onClick={handleSendResponse}
              disabled={responding || !responseText.trim()}
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
            >
              {responding ? "Menyimpan..." : "Kirim Tanggapan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
