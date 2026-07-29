import { Component, type ReactNode } from "react";
import Lottie from "lottie-react";
import error404Animation from "@/assets/error404.json";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, RotateCcw } from "lucide-react";

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

interface ErrorScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string | null;
}

export function ErrorScanModal({
  open,
  onOpenChange,
  message,
}: ErrorScanModalProps) {
  if (!open) return null;

  const fallbackCheck = (
    <div className="size-24 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-300">
      <AlertCircle className="size-14 text-rose-600 dark:text-rose-400" />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200 animate-in fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[340px] sm:max-w-[360px] p-6 text-center rounded-3xl border border-border shadow-2xl bg-card text-card-foreground relative z-10 animate-in zoom-in-95 duration-200 space-y-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Rose Ambient Light */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 size-40 bg-rose-500/10 dark:bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          title="Tutup"
        >
          <X className="size-4" />
        </button>

        {/* Lottie Error 404 Animation Header */}
        <div className="relative flex justify-center items-center pt-1 min-h-[130px]">
          <LottieErrorBoundary fallback={fallbackCheck}>
            <Lottie
              animationData={error404Animation}
              loop={true}
              autoplay={true}
              className="w-36 h-36 sm:w-40 sm:h-40 relative z-10 drop-shadow-xs"
            />
          </LottieErrorBoundary>
        </div>

        {/* Title & Error Message */}
        <div className="space-y-2 relative z-10">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-destructive flex items-center justify-center gap-1.5">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <span>Absen Gagal!</span>
          </h3>

          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5 max-w-[280px] mx-auto font-medium">
            {message || "Gagal mencatat absen. Silakan periksa kembali kode QR Anda."}
          </p>
        </div>

        {/* Action Retry CTA Button */}
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full h-10 sm:h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Coba Pindai Ulang</span>
          <RotateCcw className="size-4 opacity-90" />
        </Button>
      </div>
    </div>
  );
}
