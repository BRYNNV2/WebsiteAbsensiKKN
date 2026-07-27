import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
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

const registerSchema = z
  .object({
    full_name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
    email: z.string().email("Alamat email tidak valid"),
    password: z.string().min(8, "Kata sandi minimal 8 karakter"),
    confirmPassword: z.string(),
    group_name: z.string().min(2, "Nama kelompok minimal 2 karakter"),
    location: z.string().min(2, "Lokasi KKN wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirmPassword: "",
      group_name: "",
      location: "",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: RegisterForm) {
    setSubmitting(true);
    setServerError(null);
    setServerInfo(null);

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          role: "dosen",
        },
      },
    });

    if (error) {
      setSubmitting(false);
      setServerError(error.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setSubmitting(false);
      setServerError("Pendaftaran gagal. Silakan coba beberapa saat lagi.");
      return;
    }

    // Jika session belum aktif (misal auto-confirm aktif di Supabase), coba signIn langsung
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        setSubmitting(false);
        setServerError(
          "Akun dibuat. Harap matikan 'Confirm Email' di Supabase Dashboard -> Authentication -> Providers -> Email, lalu silakan Login."
        );
        return;
      }
    }

    // Wait for the trigger to create the profile row (up to 5 seconds)
    let profileReady = false;
    for (let i = 0; i < 10; i++) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (p) { profileReady = true; break; }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!profileReady) {
      setSubmitting(false);
      setServerError(
        "Profil belum tercipta. Pastikan Anda sudah menjalankan Script SQL Migration di Supabase SQL Editor."
      );
      return;
    }

    // Create the KKN group owned by this dosen
    const { error: groupErr } = await supabase.from("kkn_groups").insert({
      name: values.group_name,
      location: values.location,
      dosen_id: userId,
    });

    setSubmitting(false);
    if (groupErr) {
      setServerError(
        "Akun dibuat namun gagal membuat kelompok KKN. Hubungi administrator."
      );
      return;
    }

    setServerInfo(
      "Akun dosen berhasil dibuat. Silakan masuk dengan email dan kata sandi Anda."
    );
    setTimeout(() => navigate("/login", { replace: true }), 1800);
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-muted/30">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col gap-1">
            <Link
              to="/login"
              className="mb-2 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke halaman login
            </Link>
            <div className="flex items-center gap-2.5 mt-1">
              <img src="/logokkn.png" alt="Logo KKN" className="size-8 object-contain shrink-0" />
              <span className="text-base font-bold tracking-tight text-foreground">
                AbsensiKKN
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Pendaftaran Dosen Pembimbing
            </h2>
            <p className="text-sm text-muted-foreground">
              Daftarkan diri sebagai dosen pembimbing dan buat kelompok KKN
              pertama Anda. Mahasiswa akan Anda tambahkan setelah masuk.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Form Pendaftaran</CardTitle>
              <CardDescription>
                Akun dosen dapat membuat sesi absensi dan mendaftarkan
                mahasiswa binaan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-5"
                noValidate
              >
                <Field
                  data-invalid={form.formState.errors.full_name ? true : undefined}
                >
                  <FieldLabel htmlFor="full_name">Nama Lengkap</FieldLabel>
                  <Input
                    id="full_name"
                    autoComplete="name"
                    placeholder="Dr. Nama Lengkap, M.Si."
                    aria-invalid={form.formState.errors.full_name ? true : undefined}
                    {...form.register("full_name")}
                  />
                  {form.formState.errors.full_name && (
                    <FieldError errors={[form.formState.errors.full_name]} />
                  )}
                </Field>

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

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    data-invalid={form.formState.errors.password ? true : undefined}
                  >
                    <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Minimal 8 karakter"
                      aria-invalid={form.formState.errors.password ? true : undefined}
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <FieldError errors={[form.formState.errors.password]} />
                    )}
                  </Field>

                  <Field
                    data-invalid={form.formState.errors.confirmPassword ? true : undefined}
                  >
                    <FieldLabel htmlFor="confirmPassword">
                      Konfirmasi Sandi
                    </FieldLabel>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi"
                      aria-invalid={form.formState.errors.confirmPassword ? true : undefined}
                      {...form.register("confirmPassword")}
                    />
                    {form.formState.errors.confirmPassword && (
                      <FieldError errors={[form.formState.errors.confirmPassword]} />
                    )}
                  </Field>
                </div>

                <div className="my-1 h-px bg-border" />

                <div className="text-sm font-medium">Kelompok KKN</div>

                <Field
                  data-invalid={form.formState.errors.group_name ? true : undefined}
                >
                  <FieldLabel htmlFor="group_name">Nama Kelompok</FieldLabel>
                  <Input
                    id="group_name"
                    placeholder="Kelompok KKN 01 Desa Sukamaju"
                    aria-invalid={form.formState.errors.group_name ? true : undefined}
                    {...form.register("group_name")}
                  />
                  {form.formState.errors.group_name && (
                    <FieldError errors={[form.formState.errors.group_name]} />
                  )}
                </Field>

                <Field
                  data-invalid={form.formState.errors.location ? true : undefined}
                >
                  <FieldLabel htmlFor="location">Lokasi KKN</FieldLabel>
                  <Input
                    id="location"
                    placeholder="Desa Sukamaju, Kec. Cibadak, Kab. Sukabumi"
                    aria-invalid={form.formState.errors.location ? true : undefined}
                    {...form.register("location")}
                  />
                  {form.formState.errors.location && (
                    <FieldError errors={[form.formState.errors.location]} />
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

                {serverInfo && (
                  <div
                    role="status"
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
                  >
                    {serverInfo}
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Daftar sebagai Dosen
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
