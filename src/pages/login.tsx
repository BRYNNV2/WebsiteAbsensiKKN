import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, GraduationCap, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const loginSchema = z.object({
  email: z.string().email("Alamat email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: LoginForm) {
    setSubmitting(true);
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      setServerError(
        "Email atau kata sandi salah. Silakan periksa kembali akun Anda."
      );
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-muted/30">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="grid flex-1 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] [background-size:32px_32px]" />
          <div className="relative flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ShieldCheck className="size-5" />
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
              <div className="flex items-center gap-2 lg:hidden">
                <ShieldCheck className="size-5 text-primary" />
                <span className="text-base font-semibold tracking-tight">
                  AbsensiKKN
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Masuk ke akun
              </h2>
              <p className="text-sm text-muted-foreground">
                Gunakan email dan kata sandi yang diberikan oleh pembimbing
                kelompok Anda.
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
                    data-invalid={form.formState.errors.email ? true : undefined}
                  >
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nama@kampus.ac.id"
                      aria-invalid={form.formState.errors.email ? true : undefined}
                      {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                      <FieldError errors={[form.formState.errors.email]} />
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
