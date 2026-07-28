import { useState } from "react";
import { toast } from "sonner";
import {
  ScanLine,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
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
import { QrScanner } from "@/components/qr-scanner";

type Result =
  | { kind: "success"; session: QrSession }
  | { kind: "error"; message: string };

export function MahasiswaScanPage() {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

      <div className="grid gap-6 lg:grid-cols-12 max-w-5xl mx-auto items-start">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Pemindai QR</CardTitle>
            <CardDescription>
              Sesi akan divalidasi otomatis saat kode berhasil dipindai.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrScanner onResult={handleScan} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Status Absen</CardTitle>
            <CardDescription>
              Hasil pindaian terakhir akan muncul di sini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processing ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sedang memvalidasi absen Anda...
                </p>
              </div>
            ) : result ? (
              result.kind === "success" ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Absen Berhasil</p>
                    <p className="text-sm text-muted-foreground">
                      {result.session.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(result.session.starts_at).toLocaleString(
                        "id-ID",
                        { dateStyle: "medium", timeStyle: "short" }
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResult(null)}
                  >
                    Pindai Lagi
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                    <XCircle className="size-6" />
                  </div>
                  <p className="text-sm text-foreground">
                    {result.message}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResult(null)}
                  >
                    Coba Lagi
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ScanLine className="size-6 text-foreground" />
                </div>
                <p className="text-sm">
                  Belum ada hasil. Mulai pindai untuk mencatat kehadiran.
                </p>
                <p className="flex items-center gap-1.5 text-xs">
                  <Clock className="size-3.5" />
                  Absen tercatat otomatis hadir / terlambat sesuai waktu scan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
