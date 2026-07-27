import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, LogOut } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

const emailSchema = z.object({
  email: z.string().email("Masukkan alamat email kampus yang valid"),
});

type EmailForm = z.infer<typeof emailSchema>;

export function CampusEmailModal() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isTempEmail =
    profile?.role === "mahasiswa" &&
    Boolean(profile.email && profile.email.endsWith("@student.kkn"));

  useEffect(() => {
    if (isTempEmail) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [isTempEmail]);

  const form = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: EmailForm) {
    if (!profile) return;
    setSubmitting(true);
    try {
      // Gunakan RPC Function agar email langsung ter-update di profiles & auth.users tanpa menunggu link konfirmasi
      const { error: rpcErr } = await supabase.rpc("update_student_campus_email", {
        p_new_email: values.email,
      });

      if (rpcErr) {
        // Fallback update profil & auth user
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ email: values.email })
          .eq("id", profile.id);

        if (profileErr) throw profileErr;
        await supabase.auth.updateUser({ email: values.email });
      }

      toast.success("Email kampus berhasil diperbarui.");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message ?? "Gagal mengonfirmasi email kampus");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isTempEmail) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-6" />
          </div>
          <DialogTitle className="text-center">Konfirmasi Email Kampus</DialogTitle>
          <DialogDescription className="text-center">
            Halo <strong>{profile?.full_name}</strong>! Anda berhasil masuk menggunakan NIM.
            Harap masukkan email kampus resmi Anda agar dapat menerima pemberitahuan absensi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field data-invalid={form.formState.errors.email ? true : undefined}>
            <FieldLabel htmlFor="campus_email">Email Kampus Resmi</FieldLabel>
            <Input
              id="campus_email"
              type="email"
              placeholder="contoh: mhs@kampus.ac.id"
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <FieldError errors={[form.formState.errors.email]} />
            )}
          </Field>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              <LogOut className="size-4" /> Keluar / Ganti Akun
            </Button>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Simpan Email Kampus
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
