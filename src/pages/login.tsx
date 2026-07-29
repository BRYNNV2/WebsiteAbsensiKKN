import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, GraduationCap, ShieldCheck, History, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { ModeToggle } from "@/components/mode-toggle";
import { LoadingOverlay } from "@/components/loading-lottie";

const loginSchema = z.object({
  identifier: z.string().min(3, "Masukkan NIM atau Email Anda"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ID"
  );
}

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Riwayat Akun Login State
  const [loginHistory, setLoginHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("kkn_login_history");
      let list = saved ? JSON.parse(saved) : [];
      const remembered = localStorage.getItem("kkn_remembered_identifier");
      if (remembered && Array.isArray(list) && !list.includes(remembered)) {
        list.unshift(remembered);
      }
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });
  const [showHistoryPopover, setShowHistoryPopover] = useState(false);

  function handleRemoveHistory(e: React.MouseEvent, item: string) {
    e.stopPropagation();
    const updated = loginHistory.filter((h) => h !== item);
    setLoginHistory(updated);
    localStorage.setItem("kkn_login_history", JSON.stringify(updated));
  }

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: localStorage.getItem("kkn_remembered_identifier") ?? "",
      password: "",
      rememberMe: localStorage.getItem("kkn_remember_me") === "true",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: LoginForm) {
    setSubmitting(true);
    setServerError(null);

    let loginEmail = values.identifier.trim();

    // Jika input tidak mengandung '@', diasumsikan sebagai NIM
    if (!loginEmail.includes("@")) {
      const { data: fetchedEmail } = await supabase.rpc(
        "get_email_by_student_id",
        { p_student_id: loginEmail }
      );

      if (fetchedEmail) {
        loginEmail = fetchedEmail;
      } else {
        // Fallback: Query langsung profiles
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("student_id", loginEmail)
          .maybeSingle();

        if (prof?.email) {
          loginEmail = prof.email;
        } else {
          // Fallback default email buatan jika belum ada di database
          loginEmail = `${loginEmail.toLowerCase()}@student.kkn`;
        }
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: values.password,
    });

    setSubmitting(false);

    if (error) {
      console.warn("Login attempt failed:", { input: values.identifier, error: error.message });
      setServerError(
        "NIM/Email atau kata sandi salah. Silakan periksa kembali kredensial Anda."
      );
      return;
    }

    const currentId = values.identifier.trim();
    if (currentId) {
      const updatedHistory = [
        currentId,
        ...loginHistory.filter((h) => h.toLowerCase() !== currentId.toLowerCase()),
      ].slice(0, 5);
      setLoginHistory(updatedHistory);
      localStorage.setItem("kkn_login_history", JSON.stringify(updatedHistory));
    }

    if (values.rememberMe) {
      localStorage.setItem("kkn_remembered_identifier", currentId);
      localStorage.setItem("kkn_remember_me", "true");
    } else {
      localStorage.removeItem("kkn_remembered_identifier");
      localStorage.removeItem("kkn_remember_me");
    }

    navigate("/", { replace: true });
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-muted/30">
      <LoadingOverlay show={submitting} text="Memproses Masuk Akun..." />
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="grid flex-1 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] [background-size:32px_32px]" />
          <div className="relative flex items-center gap-3 text-lg font-bold tracking-tight">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-white/20">
              <img src="/logokkn.png" alt="Logo KKN" className="size-full object-contain" />
            </div>
            <span>AbsensiKKN</span>
          </div>
          <div className="relative space-y-4">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Sistem Absensi Mahasiswa KKN Berbasis QR Code
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-primary-foreground/80">
              Dosen membuat sesi absen yang dibuktikan dengan QR code.
              Mahasiswa cukup memindai kode untuk mencatat kehadiran, dengan
              rekapitulasi yang rapi untuk seluruh kelompok.
            </p>
          </div>
          <div className="relative flex items-center gap-6 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4" />
              <span>Dosen & Mahasiswa</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              <span>Data terlindungi</span>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col gap-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-2xs ring-1 ring-border/40">
                  <img src="/logokkn.png" alt="Logo KKN" className="size-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight text-foreground">
                    AbsensiKKN
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Sistem Presensi Resmi KKN
                  </span>
                </div>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Masuk ke akun
              </h2>
              <p className="text-sm text-muted-foreground">
                Gunakan NIM (ID Mahasiswa) atau email dan kata sandi Anda.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Halaman Login</CardTitle>
                <CardDescription>
                  Masuk sebagai dosen pembimbing atau mahasiswa peserta KKN.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col gap-5"
                  noValidate
                >
                  <Field
                    data-invalid={form.formState.errors.identifier ? true : undefined}
                    className="relative"
                  >
                    <FieldLabel htmlFor="identifier">NIM atau Email</FieldLabel>

                    <div className="relative mt-1.5">
                      {(() => {
                        const reg = form.register("identifier");
                        return (
                          <Input
                            id="identifier"
                            type="text"
                            autoComplete="username"
                            placeholder="Masukkan NIM atau email"
                            onFocus={() => setShowHistoryPopover(true)}
                            aria-invalid={form.formState.errors.identifier ? true : undefined}
                            {...reg}
                            onBlur={(e) => {
                              reg.onBlur(e);
                              setTimeout(() => setShowHistoryPopover(false), 200);
                            }}
                          />
                        );
                      })()}

                      {/* Floating Account History Popover - Hanya muncul saat input KOSONG */}
                      {showHistoryPopover &&
                        loginHistory.length > 0 &&
                        !form.watch("identifier") && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 rounded-xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-md space-y-1 text-xs animate-in fade-in-50 zoom-in-95">
                            <div className="flex items-center justify-between px-2 py-1 border-b pb-1.5 text-[11px] font-semibold text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <History className="size-3.5 text-primary" />
                                <span>Akun Pernah Login</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground/70">Klik untuk isi otomatis</span>
                            </div>
                          <div className="max-h-44 overflow-y-auto space-y-0.5 pt-1">
                            {loginHistory.map((item) => (
                              <div
                                key={item}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  form.setValue("identifier", item, { shouldValidate: true });
                                  setShowHistoryPopover(false);
                                }}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 cursor-pointer transition-colors group"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="size-6 shrink-0 bg-primary/10 text-primary">
                                    <AvatarFallback className="text-[10px] font-bold">
                                      {initials(item)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-foreground truncate text-xs">
                                    {item}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveHistory(e, item);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                                  title="Hapus dari riwayat"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {form.formState.errors.identifier && (
                      <FieldError errors={[form.formState.errors.identifier]} />
                    )}
                  </Field>

                  <Field
                    data-invalid={form.formState.errors.password ? true : undefined}
                  >
                    <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                      aria-invalid={form.formState.errors.password ? true : undefined}
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <FieldError errors={[form.formState.errors.password]} />
                    )}
                  </Field>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="rememberMe"
                        checked={form.watch("rememberMe")}
                        onCheckedChange={(checked) => {
                          form.setValue("rememberMe", !!checked, { shouldValidate: true });
                        }}
                      />
                      <label
                        htmlFor="rememberMe"
                        className="text-sm font-medium leading-none select-none cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        Ingat saya
                      </label>
                    </div>
                  </div>

                  {serverError && (
                    <div
                      role="alert"
                      className={cn(
                        "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      )}
                    >
                      {serverError}
                    </div>
                  )}

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    Masuk
                  </Button>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Belum memiliki akun? Hubungi dosen pembimbing kelompok Anda
              untuk didaftarkan sebagai mahasiswa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
