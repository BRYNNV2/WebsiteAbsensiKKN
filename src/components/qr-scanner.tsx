import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  Upload,
  ScanLine,
  Loader2,
  X,
  Image as ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QrScannerProps = {
  onResult: (decoded: string) => void;
  className?: string;
};

type ScanState = "idle" | "scanning" | "error";

export function QrScanner({ onResult, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processingFile, setProcessingFile] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, w, h, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        stopCamera();
        setState("idle");
        onResult(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onResult, stopCamera]);

  const startCamera = useCallback(async () => {
    setErrorMsg(null);
    setState("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setState("error");
      const message = (err as Error).message ?? "";
      if (message.includes("Permission") || message.includes("denied")) {
        setErrorMsg(
          "Akses kamera ditolak. Izinkan kamera di pengaturan browser Anda, atau unggah foto QR sebagai gantinya."
        );
      } else if (message.includes("NotFound")) {
        setErrorMsg(
          "Kamera tidak terdeteksi pada perangkat ini. Silakan unggah foto QR sebagai gantinya."
        );
      } else {
        setErrorMsg(
          "Tidak dapat mengakses kamera. Coba unggah foto QR sebagai gantinya."
        );
      }
    }
  }, [tick]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function handleFile(file: File) {
    setProcessingFile(true);
    setErrorMsg(null);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setProcessingFile(false);
        setErrorMsg("Gagal memproses gambar.");
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: "attemptBoth",
      });
      setProcessingFile(false);
      if (code && code.data) {
        onResult(code.data);
      } else {
        setErrorMsg(
          "Kode QR tidak terdeteksi pada gambar. Pastikan foto jelas dan kode QR terlihat utuh."
        );
      }
    };
    img.onerror = () => {
      setProcessingFile(false);
      setErrorMsg("Gagal memuat gambar. Coba foto lain.");
    };
    img.src = URL.createObjectURL(file);
  }

  const isScanning = state === "scanning";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-xl border bg-black",
          !isScanning && "flex items-center justify-center"
        )}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "h-full w-full object-cover",
            !isScanning && "hidden"
          )}
        />
        <canvas ref={canvasRef} className="hidden" />

        {isScanning && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 size-2/3 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/80" />
            </div>
          </div>
        )}

        {!isScanning && (
          <div className="flex flex-col items-center gap-3 p-6 text-center text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <ScanLine className="size-7 text-foreground" />
            </div>
            <p className="text-sm">
              {state === "error"
                ? "Kamera tidak tersedia. Coba unggah foto QR."
                : "Tekan tombol di bawah untuk mulai memindai QR code."}
            </p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {isScanning ? (
          <Button variant="outline" onClick={stopCamera} className="flex-1">
            <X className="size-4" />
            Hentikan
          </Button>
        ) : (
          <Button onClick={startCamera} className="flex-1">
            <Camera className="size-4" />
            Mulai Kamera
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={processingFile}
        >
          {processingFile ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Unggah Foto QR
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ImageIcon className="size-3.5" />
        Pilihan unggah tersedia untuk mahasiswa yang hanya memiliki satu
        perangkat.
      </p>
    </div>
  );
}
