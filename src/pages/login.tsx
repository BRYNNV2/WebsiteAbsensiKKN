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
import { Checkbox } from "@/components/ui/checkbox";
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
  identifier: z.string().min(3, "Masukkan NIM atau Email Anda"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
  rememberMe: z.boolean().optional(),
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
      console.warn("Login attempt failed:", { input: values.identifier, email: loginEmail, error: error.message });
      setServerError(
        `NIM/Email (${loginEmail}) atau kata sandi salah. (${error.message})`
      );
      return;
    }

    if (values.rememberMe) {
      localStorage.setItem("kkn_remembered_identifier", values.identifier.trim());
      localStorage.setItem("kkn_remember_me", "true");
    } else {
      localStorage.removeItem("kkn_remembered_identifier");
      localStorage.removeItem("kkn_remember_me");
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
                  >
                    <FieldLabel htmlFor="identifier">NIM atau Email</FieldLabel>
                    <Input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="Masukkan NIM atau email"
                      aria-invalid={form.formState.errors.identifier ? true : undefined}
                      {...form.register("identifier")}
                    />
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
