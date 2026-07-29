import { Component, type ReactNode } from "react";
import Lottie from "lottie-react";
import successCheckAnimation from "@/assets/success-check.json";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, X } from "lucide-react";
import { type QrSession } from "@/lib/supabase";

class LottieErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface SuccessScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: QrSession | null;
  studentName?: string;
}

export function SuccessScanModal({
  open,
  onOpenChange,
  session,
}: SuccessScanModalProps) {
  if (!open) return null;

  const fallbackCheck = (
    <div className="size-28 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
      <CheckCircle2 className="size-16 text-emerald-500 animate-pulse" />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-all duration-200 animate-in fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[340px] sm:max-w-[360px] p-6 text-center rounded-3xl border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl bg-card text-card-foreground relative z-10 animate-in zoom-in-95 duration-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button at Top Right */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          title="Tutup"
        >
          <X className="size-4" />
        </button>

        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/25 dark:bg-emerald-500/35 rounded-full blur-3xl pointer-events-none" />

        {/* Lottie Animation Header */}
        <div className="relative flex justify-center items-center pt-2 min-h-[140px]">
          <div className="absolute size-28 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full blur-xl animate-pulse pointer-events-none" />
          <LottieErrorBoundary fallback={fallbackCheck}>
            <Lottie
              animationData={successCheckAnimation}
              loop={false}
              autoplay={true}
              className="w-36 h-36 sm:w-40 sm:h-40 relative z-10 drop-shadow-md"
            />
          </LottieErrorBoundary>
        </div>

        {/* Minimalist Title & Subtitle */}
        <div className="space-y-1 relative z-10">
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
            Absen Berhasil Tercatat!
          </h3>
          {session?.title && (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate px-2">
              Sesi: {session.title}
            </p>
          )}
          <p className="text-xs text-muted-foreground pt-0.5">
            Presensi kehadiran Anda telah sukses divalidasi dan dicatat di server.
          </p>
        </div>

        {/* Action CTA Button */}
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full h-11 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>OK, Selesai</span>
          <Sparkles className="size-4 text-emerald-200 animate-pulse" />
        </Button>
      </div>
    </div>
  );
}
