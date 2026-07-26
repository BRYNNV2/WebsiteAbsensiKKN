import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QrPreviewProps = {
  value: string;
  caption?: string;
  size?: number;
  className?: string;
  downloadName?: string;
};

export function QrPreview({
  value,
  caption,
  size = 280,
  className,
  downloadName = "qr-absensi",
}: QrPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      },
      (err) => {
        if (!active) return;
        setLoading(false);
        if (err) setError("Gagal membuat QR code.");
      }
    );
    return () => {
      active = false;
    };
  }, [value, size]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${downloadName}.png`;
    a.click();
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        className="relative rounded-xl border bg-white p-4 shadow-sm"
        style={{ width: size + 32, height: size + 32 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cn("block", (loading || error) && "opacity-0")}
        />
      </div>

      {caption && (
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          {caption}
        </p>
      )}

      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="size-4" />
        Unduh QR
      </Button>
    </div>
  );
}
