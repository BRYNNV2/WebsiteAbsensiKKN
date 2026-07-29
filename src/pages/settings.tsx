import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useDosenData } from "@/hooks/use-dosen-data";
import { supabase, type KknGroup } from "@/lib/supabase";
import { toast } from "sonner";
import {
  User,
  Shield,
  KeyRound,
  Loader2,
  HelpCircle,
  MessageSquare,
  Camera,
  GraduationCap,
  Phone,
  CreditCard,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  Trash2,
  ZoomIn,
  Move,
  RotateCcw,
  Crop,
  UserCheck,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function initials(name: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { group: dosenGroup } = useDosenData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDosen = profile?.role === "dosen";

  // Form States for Profile
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [studentId, setStudentId] = useState(profile?.student_id ?? "");
  const [nip, setNip] = useState(profile?.nip ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Group state for student
  const [currentGroup, setCurrentGroup] = useState<KknGroup | null>(null);

  // Password States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Crop Dialog States
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [tempImgSrc, setTempImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setStudentId(profile.student_id ?? "");
      setNip(profile.nip ?? "");
      setPhone(profile.phone ?? "");
      setDepartment(profile.department ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  useEffect(() => {
    async function fetchGroup() {
      if (isDosen) {
        setCurrentGroup(dosenGroup);
      } else if (profile?.group_id) {
        const { data } = await supabase
          .from("kkn_groups")
          .select("*")
          .eq("id", profile.group_id)
          .maybeSingle();
        if (data) setCurrentGroup(data as KknGroup);
      }
    }
    fetchGroup();
  }, [profile, isDosen, dosenGroup]);

  // Handle Photo File Selection -> Opens Crop Modal
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file foto maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTempImgSrc(base64);
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Draw crop preview on canvas when params change
  useEffect(() => {
    if (!isCropOpen || !tempImgSrc) return;

    const img = new Image();
    img.src = tempImgSrc;
    img.onload = () => {
      cropImgRef.current = img;
      renderCanvas();
    };
  }, [isCropOpen, tempImgSrc, zoom, panX, panY]);

  function renderCanvas() {
    const canvas = cropCanvasRef.current;
    const img = cropImgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;

    if (aspect > 1) {
      drawW = size * aspect;
    } else {
      drawH = size / aspect;
    }

    drawW *= zoom;
    drawH *= zoom;

    const drawX = (size - drawW) / 2 + (panX / 100) * (size / 2);
    const drawY = (size - drawH) / 2 + (panY / 100) * (size / 2);

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  // Apply Crop & Save Base64 Image
  function applyCrop() {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setAvatarUrl(croppedDataUrl);
    setIsCropOpen(false);
    toast.success("Foto profil berhasil dipotong (rasio 1:1 presisi). Klik 'Simpan Perubahan' untuk memperbarui akun.");
  }

  // Handle Delete Profile Photo
  async function handleDeletePhoto() {
    if (!profile) return;
    if (!confirm("Apakah Anda yakin ingin menghapus foto profil ini?")) return;

    setAvatarUrl("");
    localStorage.removeItem(`profile_extra_${profile.id}`);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);

      if (error && !error.message?.includes("column")) {
        console.error("Error deleting avatar:", error);
      }

      await refreshProfile();
      toast.success("Foto profil telah dihapus.");
    } catch (err: any) {
      toast.error(err.message ?? "Gagal menghapus foto profil.");
    }
  }

  // Submit Profile Changes
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong.");
      return;
    }

    setUpdatingProfile(true);
    try {
      // Backup extra profile info to localStorage
      localStorage.setItem(
        `profile_extra_${profile.id}`,
        JSON.stringify({
          full_name: fullName.trim(),
          student_id: studentId.trim() || null,
          nip: nip.trim() || null,
          phone: phone.trim() || null,
          department: department.trim() || null,
          avatar_url: avatarUrl || null,
        })
      );

      const updatePayload: Record<string, any> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        department: department.trim() || null,
        avatar_url: avatarUrl || null,
      };

      if (isDosen) {
        updatePayload.nip = nip.trim() || null;
      } else {
        updatePayload.student_id = studentId.trim() || null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.id);

      if (error && !error.message?.includes("column")) {
        console.error("Supabase update profile error:", error);
      }

      await refreshProfile();
      toast.success(`Profil akun ${isDosen ? "Dosen" : "Mahasiswa"} berhasil diperbarui!`);
    } catch (err: any) {
      toast.error(err.message ?? "Gagal memperbarui profil.");
    } finally {
      setUpdatingProfile(false);
    }
  }

  // Submit Password Change
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
    } catch (err: any) {
      toast.error(err.message ?? "Gagal memperbarui kata sandi.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  if (!profile) return null;

  const roleLabel = isDosen ? "Dosen Pembimbing Lapangan (DPL)" : "Mahasiswa KKN";

  return (
    <div className="space-y-6 w-full pb-12">
      <PageHeader
        title="Pengaturan Profil"
        description={`Kelola data pribadi, foto profil, dan keamanan akun ${isDosen ? "Dosen Pembimbing" : "Mahasiswa KKN"}.`}
      />

      {/* Profil Summary Header Card */}
      <Card className="border-border/60 shadow-2xs relative overflow-hidden bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar & Upload Trigger */}
            <div className="relative group shrink-0">
              <Avatar className="size-24 border-4 border-background shadow-md">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />}
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {initials(fullName)}
                </AvatarFallback>
              </Avatar>

              {/* Upload Overlay Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1 cursor-pointer"
                title="Ganti Foto Profil"
              >
                <Camera className="size-5" />
                <span>Potong &amp; Ubah</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <span className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 ring-2 ring-background" title="Akun Aktif" />
            </div>

            {/* Profile Brief Info */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-foreground">{fullName || profile.full_name}</h2>
                <Badge variant="secondary" className="font-semibold text-xs bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 gap-1">
                  {isDosen ? <GraduationCap className="size-3.5" /> : <UserCheck className="size-3.5" />}
                  {roleLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  {profile.email}
                </span>

                {!isDosen && (studentId || profile.student_id) && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <CreditCard className="size-3.5 text-sky-500" />
                    NIM: {studentId || profile.student_id}
                  </span>
                )}

                {isDosen && nip && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <CreditCard className="size-3.5 text-amber-500" />
                    NIP/NIDN: {nip}
                  </span>
                )}

                {phone && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone className="size-3.5 text-emerald-500" />
                    {phone}
                  </span>
                )}
              </div>

              {currentGroup && (
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge variant="outline" className="text-xs bg-muted/50 gap-1 font-semibold">
                    <Building2 className="size-3 text-purple-500" />
                    {currentGroup.name}
                  </Badge>
                  {currentGroup.location && (
                    <Badge variant="outline" className="text-xs bg-muted/50 gap-1">
                      <MapPin className="size-3 text-rose-500" />
                      {currentGroup.location}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Photo Action Buttons */}
            <div className="shrink-0 flex flex-wrap sm:flex-col items-center gap-2 self-center sm:self-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Camera className="size-3.5 text-primary" />
                Unggah Foto Baru
              </Button>

              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeletePhoto}
                  className="gap-1.5 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  Hapus Foto
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form Edit Informasi Profil Akun */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <CardTitle className="text-base">Informasi Data Pribadi {isDosen ? "Dosen" : "Mahasiswa"}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Perbarui data profil, {isDosen ? "gelar, NIP," : "NIM,"} dan informasi kontak Anda.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="fullName" className="text-xs font-semibold">
                  Nama Lengkap {isDosen && "& Gelar Akademik"}
                </FieldLabel>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isDosen ? "Contoh: Dr. Budi Santoso, M.Kom" : "Masukkan nama lengkap Anda"}
                  className="text-xs"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isDosen ? (
                  <Field>
                    <FieldLabel htmlFor="nip" className="text-xs font-semibold">
                      NIP / NIDN (Opsional)
                    </FieldLabel>
                    <Input
                      id="nip"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="Contoh: 19850101 201012 1 001"
                      className="text-xs font-mono"
                    />
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="studentId" className="text-xs font-semibold">
                      NIM (Nomor Induk Mahasiswa)
                    </FieldLabel>
                    <Input
                      id="studentId"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Contoh: 210101001"
                      className="text-xs font-mono"
                    />
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="phone" className="text-xs font-semibold">
                    No. WhatsApp / HP
                  </FieldLabel>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="text-xs font-mono"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="department" className="text-xs font-semibold">
                  Fakultas / Program Studi
                </FieldLabel>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Contoh: Fakultas Ilmu Komputer / Teknik Informatika"
                  className="text-xs"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs font-semibold text-muted-foreground">
                  Alamat Email Akun
                </FieldLabel>
                <Input
                  value={profile.email}
                  disabled
                  className="text-xs bg-muted/50 cursor-not-allowed"
                />
                <span className="text-[11px] text-muted-foreground pt-0.5 block">
                  Email akun terdaftar secara terpusat di sistem.
                </span>
              </Field>

              <Button type="submit" disabled={updatingProfile} size="sm" className="w-full gap-2 font-semibold shadow-xs">
                {updatingProfile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Simpan Perubahan Profil
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Form Keamanan Kata Sandi */}
        <Card className="border-border/60 shadow-2xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <CardTitle className="text-base">Keamanan Kata Sandi Akun</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Ubah kata sandi akun Anda untuk menjaga kerahasiaan akses.
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

              <Button type="submit" disabled={updatingPassword} size="sm" variant="outline" className="w-full font-semibold">
                {updatingPassword && <Loader2 className="size-4 animate-spin" />}
                Perbarui Kata Sandi
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Support & Layanan Masukan */}
      <Card className="border-border/60 shadow-2xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <CardTitle className="text-base">Pusat Layanan &amp; Masukan Sistem</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Layanan pengaduan feedback dan bantuan operasional sistem absensi KKN.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div
            onClick={() => navigate("/feedback")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 hover:bg-muted/40 transition-all cursor-pointer group"
          >
            <MessageSquare className="size-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1">
                <span>Halaman Feedback &amp; Masukan</span>
                <Sparkles className="size-3 text-amber-500" />
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isDosen
                  ? "Lihat dan berikan tanggapan resmi atas saran mahasiswa KKN."
                  : "Kirimkan ulasan, saran, atau laporkan kendala sistem."}
              </p>
            </div>
          </div>

          <div
            onClick={() => toast.info("Pusat Bantuan Absensi KKN aktif melayani Anda 24/7.")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 hover:bg-muted/40 transition-all cursor-pointer group"
          >
            <HelpCircle className="size-5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="font-semibold text-xs text-foreground">Bantuan &amp; Dukungan Teknis</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hubungi pengelola sistem jika memerlukan bantuan administrasi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Crop Foto Profil (Rasio 1:1 Presisi) */}
      <Dialog open={isCropOpen} onOpenChange={setIsCropOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Crop className="size-4 text-primary" />
              Potong &amp; Atur Posisi Foto Profil (1:1)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur posisi dan skala foto agar pas dan tidak gepeng pada lingkaran profil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Interactive Preview Frame with Circular Mask Overlay */}
            <div className="relative mx-auto size-64 rounded-2xl bg-black/90 border border-border flex items-center justify-center overflow-hidden shadow-inner">
              <canvas
                ref={cropCanvasRef}
                className="w-full h-full object-contain rounded-2xl"
              />
              {/* Circular Avatar Guide Mask */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-sky-400/70 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>

            {/* Slider Controls */}
            <div className="space-y-3 bg-muted/40 p-3.5 rounded-xl border text-xs">
              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ZoomIn className="size-3.5 text-primary" /> Skala / Perbesar (Zoom):
                  </span>
                  <span className="font-mono text-primary">{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              {/* Horizontal Shift Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Move className="size-3.5 text-amber-500" /> Geser Horisontal (Kiri - Kanan):
                  </span>
                  <span className="font-mono">{panX}px</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={panX}
                  onChange={(e) => setPanX(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              {/* Vertical Shift Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-semibold text-[11px]">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Move className="size-3.5 text-emerald-500 rotate-90" /> Geser Vertikal (Atas - Bawah):
                  </span>
                  <span className="font-mono">{panY}px</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={panY}
                  onChange={(e) => setPanY(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="size-3" /> Reset Posisi
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCropOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={applyCrop}
              className="gap-1.5 font-semibold"
            >
              <Crop className="size-3.5" />
              Potong &amp; Gunakan Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
