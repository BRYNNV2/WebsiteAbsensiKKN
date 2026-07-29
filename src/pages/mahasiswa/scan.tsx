import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Calendar,
  MapPin,
} from "lucide-react";

import { supabase, type QrSession } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrScanner } from "@/components/qr-scanner";
import { SuccessScanModal } from "@/components/success-modal";

type Result =
  | { kind: "success"; session: QrSession }
  | { kind: "error"; message: string };

export function MahasiswaScanPage() {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState<QrSession[]>([]);

  useEffect(() => {
    if (!profile?.group_id) return;
    let isMounted = true;
    (async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("qr_sessions")
        .select("id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at")
        .eq("group_id", profile.group_id)
        .gte("ends_at", now)
        .order("starts_at", { ascending: true });
      if (isMounted) {
        setActiveSessions((data as QrSession[]) ?? []);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [profile?.group_id]);

  async function handleScan(decoded: string) {
    setProcessing(true);
    setResult(null);
    try {
      const token = decoded.trim();
      const { data: session, error } = await supabase
        .from("qr_sessions")
        .select(
          "id, group_id, title, meeting_date, starts_at, ends_at, location, token, created_by, created_at"
        )
        .eq("token", token)
        .maybeSingle();

      if (error || !session) {
        setResult({
          kind: "error",
          message:
            "QR code tidak valid. Pastikan Anda memindai kode dari sesi absen yang benar.",
        });
        setProcessing(false);
        return;
      }

      const now = new Date();
      const start = new Date(session.starts_at);
      const end = new Date(session.ends_at);

      if (now < start) {
        setResult({
          kind: "error",
          message: `Sesi "${session.title}" belum dimulai. Sesi akan dibuka pada ${start.toLocaleString(
            "id-ID",
            { dateStyle: "medium", timeStyle: "short" }
          )}.`,
        });
        setProcessing(false);
        return;
      }

      if (now > end) {
        setResult({
          kind: "error",
          message: `Sesi "${session.title}" sudah berakhir. Anda tidak dapat melakukan absen lagi.`,
        });
        setProcessing(false);
        return;
      }

      if (profile?.group_id !== session.group_id) {
        setResult({
          kind: "error",
          message:
            "Sesi absen ini bukan untuk kelompok KKN Anda. Hubungi dosen pembimbing jika ini adalah kesalahan.",
        });
        setProcessing(false);
        return;
      }

      // Selama scan dilakukan dalam jendela waktu sesi aktif (sebelum ends_at), catat sebagai Hadir
      const status: "hadir" | "terlambat" = "hadir";

      const { error: insertErr } = await supabase
        .from("attendance_records")
        .insert({
          session_id: session.id,
          student_id: profile?.id,
          status,
        });

      if (insertErr) {
        if (insertErr.code === "23505") {
          setResult({
            kind: "error",
            message: `Anda sudah tercatat hadir pada sesi "${session.title}". Tidak perlu absen dua kali.`,
          });
        } else {
          setResult({
            kind: "error",
            message: "Gagal mencatat absen. Silakan coba beberapa saat lagi.",
          });
        }
        setProcessing(false);
        return;
      }

      setResult({ kind: "success", session: session as QrSession });
      setShowSuccessModal(true);
      toast.success("Absen berhasil tercatat.");
    } catch {
      setResult({
        kind: "error",
        message: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pindai QR Absen"
        description="Arahkan kamera ke kode QR yang ditampilkan dosen, atau unggah foto QR jika hanya memiliki satu perangkat."
      />

      <div className="grid gap-6 lg:grid-cols-12 w-full items-start">
        {/* Left Column (7/12 width): Pemindai QR */}
        <Card className="lg:col-span-7 border-border/60 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ScanLine className="size-4 text-primary" />
              <span>Pemindai QR Code</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Arahkan kamera ke kode QR dosen atau unggah file foto QR. Sesi akan divalidasi otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner onResult={handleScan} />
          </CardContent>
        </Card>

        {/* Right Column (5/12 width): Status Absen + Panduan & Sesi Aktif */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Status Hasil Scan */}
          <Card className="border-border/60 shadow-2xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span>Status Absen</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Hasil validasi pindaian terakhir Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {processing ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Sedang memvalidasi absen Anda...
                  </p>
                </div>
              ) : result ? (
                result.kind === "success" ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">Absen Berhasil Tercatat!</p>
                      <p className="text-sm font-medium text-foreground">
                        {result.session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(result.session.starts_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResult(null)}
                      className="mt-2 text-xs"
                    >
                      Pindai Sesi Lain
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                      <XCircle className="size-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {result.message}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResult(null)}
                      className="mt-2 text-xs"
                    >
                      Coba Pindai Ulang
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center text-muted-foreground">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <ScanLine className="size-5 text-foreground" />
                  </div>
                  <p className="text-xs">
                    Belum ada pindaian. Klik tombol <strong>Mulai Kamera</strong> atau <strong>Unggah Foto QR</strong>.
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                    <Clock className="size-3.5" />
                    Status dicatat otomatis sesuai waktu pindaian.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Sesi Aktif & Panduan Penggunaan (Mengisi Ruang Kosong) */}
          <Card className="border-border/60 shadow-2xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span>Sesi Aktif &amp; Panduan</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Informasi sesi KKN yang dapat diabsen saat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Active Sessions List */}
              <div>
                <span className="font-semibold text-foreground block mb-2">
                  Daftar Sesi KKN Aktif:
                </span>
                {activeSessions.length === 0 ? (
                  <div className="p-3 rounded-lg border bg-muted/30 text-muted-foreground text-center">
                    Belum ada sesi KKN yang dibuka oleh dosen saat ini.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((s) => (
                      <div
                        key={s.id}
                        className="p-2.5 rounded-lg border bg-card flex flex-col gap-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground truncate">
                            {s.title}
                          </span>
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">
                            Aktif
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(s.starts_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            -{" "}
                            {new Date(s.ends_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {s.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="size-3 shrink-0" />
                              {s.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Panduan Ringkas */}
              <div className="pt-3 border-t space-y-2 text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="size-3.5 text-primary" />
                  Tips Pemindaian Lancar:
                </span>
                <ul className="space-y-1.5 pl-4 list-disc text-[11px] leading-relaxed">
                  <li>Pastikan izin kamera peramban dalam keadaan **diizinkan**.</li>
                  <li>Arahkan kamera hingga kode QR berada di dalam bingkai hijau.</li>
                  <li>Jika menggunakan HP yang sama untuk melihat &amp; mengabsen, **tangkap layar (screenshot)** QR lalu pilih **Unggah Foto QR**.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Centered Success Lottie Modal Popup */}
      <SuccessScanModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        session={result?.kind === "success" ? result.session : null}
        studentName={profile?.full_name}
      />
    </div>
  );
}
