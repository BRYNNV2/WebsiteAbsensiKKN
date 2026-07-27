import { useEffect, useState } from "react";
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

export function DosenSessionsPage() {
  const { group } = useDosenData();
  const [sessions, setSessions] = useState<QrSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewSession, setPreviewSession] = useState<QrSession | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

      <Card>
        <CardHeader>
          <CardTitle>Daftar Sesi</CardTitle>
          <CardDescription>
            {sessions.length} sesi terdaftar untuk kelompok Anda.
          </CardDescription>
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
                Buat sesi pertama untuk mulai mencatat kehadiran mahasiswa
                Anda.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="grid gap-3">
              {sessions.map((s) => {
                const status = statusOf(s);
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
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
