import { useRef, useEffect } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import error404Animation from "@/assets/error404.json";
import { Construction } from "lucide-react";

export function MahasiswaLogbookPage() {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    lottieRef.current?.setSpeed(1);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Blurred background layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-indigo-950/50 to-slate-900/60 backdrop-blur-xl" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-indigo-400/10 animate-pulse"
            style={{
              width: `${40 + i * 20}px`,
              height: `${40 + i * 20}px`,
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-10 max-w-md mx-4">
        {/* Glassmorphism card */}
        <div className="bg-card/30 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6 w-full">
          {/* Lottie Animation */}
          <div className="flex justify-center">
            <Lottie
              lottieRef={lottieRef}
              animationData={error404Animation}
              loop={true}
              className="w-56 h-56 drop-shadow-lg"
            />
          </div>

          {/* Construction Icon Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300">
              <Construction className="w-4 h-4 animate-bounce" />
              <span className="text-xs font-semibold uppercase tracking-wider">Dalam Pengembangan</span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Fitur Logbook KKN
            </h1>
            <p className="text-base text-slate-300 leading-relaxed">
              Fitur dalam pengembangan harap menunggu ya 🙏
            </p>
          </div>

          {/* Decorative progress bar */}
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse"
              style={{ width: "65%" }}
            />
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Progress: ~65% selesai
          </p>
        </div>
      </div>
    </div>
  );
}
