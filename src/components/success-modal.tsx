import { Component, type ReactNode } from "react";
import Lottie from "lottie-react";
import successCheckAnimation from "@/assets/success-check.json";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";
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
    <div className="size-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-300">
      <CheckCircle2 className="size-14 text-emerald-600 dark:text-emerald-400" />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200 animate-in fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[330px] sm:max-w-[350px] p-6 text-center rounded-3xl border border-border shadow-2xl bg-card text-card-foreground relative z-10 animate-in zoom-in-95 duration-200 space-y-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Light */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 size-40 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          title="Tutup"
        >
          <X className="size-4" />
        </button>

        {/* Lottie Animation Header */}
        <div className="relative flex justify-center items-center pt-1 min-h-[130px]">
          <LottieErrorBoundary fallback={fallbackCheck}>
            <Lottie
              animationData={successCheckAnimation}
              loop={false}
              autoplay={true}
              className="w-32 h-32 sm:w-36 sm:h-36 relative z-10 drop-shadow-xs"
            />
          </LottieErrorBoundary>
        </div>

        {/* Title, Session Pill & Subtitle */}
        <div className="space-y-2 relative z-10">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Absen Berhasil Tercatat!
          </h3>

          {session?.title && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium border border-emerald-500/20 max-w-[90%]">
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">Sesi: {session.title}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5 max-w-[260px] mx-auto">
            Presensi kehadiran Anda telah sukses divalidasi dan dicatat di sistem.
          </p>
        </div>

        {/* Action CTA Button */}
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full h-10 sm:h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>OK, Selesai</span>
          <CheckCircle2 className="size-4 opacity-90" />
        </Button>
      </div>
    </div>
  );
}
