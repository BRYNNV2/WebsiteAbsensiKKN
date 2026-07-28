import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import loadingAnimation from "@/assets/loading.json";

interface LoadingLottieProps {
  className?: string;
  text?: string;
}

export function LoadingLottie({
  className = "w-36 h-36",
  text,
}: LoadingLottieProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    lottieRef.current?.setSpeed(3.5);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Lottie
        lottieRef={lottieRef}
        animationData={loadingAnimation}
        loop={true}
        className={className}
      />
      {text && (
        <p className="text-xs font-semibold text-muted-foreground animate-pulse mt-1">
          {text}
        </p>
      )}
    </div>
  );
}

export function LoadingOverlay({
  show,
  text = "Memproses, mohon tunggu...",
}: {
  show: boolean;
  text?: string;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (show) {
      lottieRef.current?.setSpeed(3.5);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-card border border-border/80 shadow-2xl space-y-2 max-w-xs text-center mx-4">
        <Lottie
          lottieRef={lottieRef}
          animationData={loadingAnimation}
          loop={true}
          className="w-36 h-36"
        />
        <div className="space-y-1">
          <p className="text-sm font-bold tracking-tight text-foreground">
            {text}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Menghubungkan ke server &amp; mengamankan sesi...
          </p>
        </div>
      </div>
    </div>
  );
}
