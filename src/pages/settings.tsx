import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  User,
  Shield,
  KeyRound,
  Loader2,
  HelpCircle,
  MessageSquare,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong.");
      return;
    }

    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Nama profil berhasil diperbarui.");
    } catch (err) {
      toast.error((err as Error).message ?? "Gagal memperbarui profil.");
    } finally {
      setUpdatingProfile(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Kata sandi berhasil diperbarui.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error((err as Error).message ?? "Gagal memperbarui kata sandi.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  if (!profile) return null;

  const roleLabel =
    profile.role === "dosen" ? "Dosen Pembimbing Lapangan (DPL)" : "Mahasiswa KKN";

  return (
    <div className="space-y-6 w-full pb-10">
      <PageHeader
        title="Pengaturan"
        description="Kelola informasi profil akun, kata sandi, dan preferensi sistem Anda."
      />

      {/* Profil Summary Card */}
      <Card className="border-border/60 shadow-2xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative">
              <Avatar className="size-20 border-2 border-primary/20 shadow-xs">
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {initials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>
                <Badge variant="secondary" className="font-medium text-xs">
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
              {profile.student_id && (
                <p className="text-xs font-mono text-muted-foreground">NIM: {profile.student_id}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form Profil Akun */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">Informasi Profil</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Perbarui nama lengkap dan data diri akun Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="fullName" className="text-xs font-semibold">
                  Nama Lengkap
                </FieldLabel>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda"
                  className="text-xs"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs font-semibold text-muted-foreground">
                  Alamat Email
                </FieldLabel>
                <Input
                  value={profile.email}
                  disabled
                  className="text-xs bg-muted/50 cursor-not-allowed"
                />
                <span className="text-[11px] text-muted-foreground pt-1 block">
                  Email akun tidak dapat diubah dari menu ini.
                </span>
              </Field>

              <Button type="submit" disabled={updatingProfile} size="sm" className="w-full">
                {updatingProfile && <Loader2 className="size-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form Keamanan Kata Sandi */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <CardTitle className="text-base">Keamanan Kata Sandi</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Ubah kata sandi untuk menjaga keamanan akun Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="newPassword" className="text-xs font-semibold">
                  Kata Sandi Baru
                </FieldLabel>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="text-xs"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword" className="text-xs font-semibold">
                  Konfirmasi Kata Sandi Baru
                </FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="text-xs"
                />
              </Field>

              <Button type="submit" disabled={updatingPassword} size="sm" variant="outline" className="w-full">
                {updatingPassword && <Loader2 className="size-4 animate-spin" />}
                Ubah Kata Sandi
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Support & Bantuan Section */}
      <Card className="border-border/60 shadow-2xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <CardTitle className="text-base">Dukungan & Bantuan System</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Layanan pengaduan dan bantuan teknis sistem absensi KKN.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div
            onClick={() => toast.success("Terima kasih! Umpan balik Anda telah dikirimkan.")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <MessageSquare className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-xs text-foreground">Kirim Umpan Balik (Feedback)</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Beri masukan atau saran untuk pengembangan sistem absensi.
              </p>
            </div>
          </div>

          <div
            onClick={() => toast.info("Pusat Bantuan AbsensiKKN siap melayani Anda 24/7.")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <HelpCircle className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-xs text-foreground">Bantuan & Dukungan Teknis</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hubungi administrator jika mengalami kendala akun.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
