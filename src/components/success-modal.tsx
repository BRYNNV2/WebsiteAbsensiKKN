import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import successCheckAnimation from "@/assets/success circle check.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, MapPin, UserCheck, CheckCircle2 } from "lucide-react";
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
      lottieRef.current?.setSpeed(1.2);
    }
  }, [open]);

  if (!session) return null;

  const formattedDate = new Date(session.starts_at).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedTime = `${new Date(session.starts_at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${new Date(session.ends_at).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-[420px] p-5 sm:p-6 overflow-hidden text-center rounded-2xl border-emerald-500/20 shadow-2xl">
        <DialogHeader className="space-y-1">
          {/* Lottie Success Animation */}
          <div className="flex justify-center -mt-2 -mb-3">
            <Lottie
              lottieRef={lottieRef}
              animationData={successCheckAnimation}
              loop={false}
              className="w-36 h-36 sm:w-44 sm:h-44"
            />
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Absen Berhasil!</span>
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground pt-0.5">
            Presensi kehadiran Anda telah sukses divalidasi dan dicatat di server.
          </DialogDescription>
        </DialogHeader>

        {/* Session & Student Summary Info Card */}
        <div className="my-3 p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5 text-left text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
            <span className="font-bold text-foreground text-sm truncate">
              {session.title}
            </span>
            <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 shrink-0 font-semibold shadow-xs">
              Hadir
            </Badge>
          </div>

          <div className="space-y-1.5 text-muted-foreground font-medium">
            {studentName && (
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <UserCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{studentName}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CalendarClock className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{formattedDate} ({formattedTime})</span>
            </div>

            {session.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{session.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Dismiss Button */}
        <Button
          onClick={() => onOpenChange(false)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 sm:h-11 text-xs sm:text-sm rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02]"
        >
          Selesai &amp; Tutup
        </Button>
      </DialogContent>
    </Dialog>
  );
}
