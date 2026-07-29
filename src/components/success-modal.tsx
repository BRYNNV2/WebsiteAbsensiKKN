import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import successCheckAnimation from "@/assets/success circle check.json";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Sparkles,
  BookmarkCheck,
} from "lucide-react";
import { type QrSession } from "@/lib/supabase";

interface SuccessScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: QrSession | null;
  studentName?: string;
}

export function SuccessScanModal({
  open,
  onOpenChange,
  session,
  studentName,
}: SuccessScanModalProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (open) {
      lottieRef.current?.goToAndPlay(0, true);
      lottieRef.current?.setSpeed(1.25);
    }
  }, [open]);

  const dateObj = session ? new Date(session.starts_at) : new Date();
  const formattedDate = session
    ? dateObj.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const scanTime =
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";

  const sessionWindow = session
    ? `${dateObj.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${new Date(session.ends_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })} WIB`
    : "";

  return (
    <Dialog open={open && Boolean(session)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[430px] p-0 overflow-hidden text-center rounded-3xl border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl bg-card relative">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full blur-3xl pointer-events-none" />

        <div className="p-6 space-y-5 relative z-10">
          {/* Lottie Animation Header */}
          <div className="relative flex justify-center items-center pt-2">
            <div className="absolute size-28 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full blur-xl animate-pulse pointer-events-none" />
            <Lottie
              lottieRef={lottieRef}
              animationData={successCheckAnimation}
              loop={false}
              className="w-36 h-36 sm:w-40 sm:h-40 relative z-10 drop-shadow-md"
            />
          </div>

          {/* Title & Live Status Badge */}
          <div className="space-y-1.5 -mt-2">
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
              Presensi Berhasil!
            </h3>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/25 shadow-2xs">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
              </span>
              <span>Hadir (Tepat Waktu)</span>
            </div>
          </div>

          {/* Premium Card Container */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-muted/40 border border-emerald-500/20 text-left space-y-3 shadow-xs">
            {/* Session Title Bar */}
            <div className="flex items-start gap-2.5 pb-2.5 border-b border-emerald-500/20">
              <div className="size-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <BookmarkCheck className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                  Sesi KKN
                </span>
                <p className="font-bold text-foreground text-sm truncate leading-snug">
                  {session.title}
                </p>
                <p className="text-[11px] text-muted-foreground font-normal truncate">
                  Rentang Sesi: {sessionWindow}
                </p>
              </div>
            </div>

            {/* Grid Detail Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {studentName && (
                <div className="p-2.5 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 space-y-0.5 col-span-2">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Nama Mahasiswa
                  </span>
                  <p className="font-semibold text-foreground truncate">
                    {studentName}
                  </p>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="size-3 text-emerald-600 dark:text-emerald-400" />
                  Tanggal
                </span>
                <p className="font-semibold text-foreground truncate">
                  {formattedDate}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="size-3 text-emerald-600 dark:text-emerald-400" />
                  Waktu Pindai
                </span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {scanTime}
                </p>
              </div>

              {session.location && (
                <div className="p-2.5 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 space-y-0.5 col-span-2">
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <MapPin className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Lokasi Pertemuan
                  </span>
                  <p className="font-semibold text-foreground truncate">
                    {session.location}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action CTA Button */}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full h-11 sm:h-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Selesai &amp; Kembali</span>
            <Sparkles className="size-4 text-emerald-200 animate-pulse" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
