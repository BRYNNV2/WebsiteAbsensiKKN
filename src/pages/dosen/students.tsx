import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail, Trash2, Pencil, Eye, KeyRound, Copy, Search, ArrowUpDown, X, ChevronLeft, ChevronRight } from "lucide-react";

import { createClient } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";
import { useDosenData } from "@/hooks/use-dosen-data";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LoadingLottie } from "@/components/loading-lottie";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const studentSchema = z.object({
  full_name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  student_id: z.string().min(3, "NIM minimal 3 karakter"),
  email: z
    .string()
    .refine((val) => val === "" || z.string().email().safeParse(val).success, {
      message: "Format email tidak valid",
    })
    .optional(),
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 6, {
      message: "Kata sandi minimal 6 karakter jika diisi",
    })
    .optional(),
});

type StudentForm = z.infer<typeof studentSchema>;

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DosenStudentsPage() {
  const { group, students, loading, reload } = useDosenData();
  const [createOpen, setCreateOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Profile | null>(null);
  const [viewStudent, setViewStudent] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<{ id: string; name: string } | null>(null);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<"terbaru" | "terlama" | "az" | "za" | "nim">("terbaru");

  const processedStudents = useMemo(() => {
    let list = [...students];

    // 1. Search Filter (Nama, NIM, Email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.student_id && s.student_id.toLowerCase().includes(q)) ||
          s.email.toLowerCase().includes(q)
      );
    }

    // 2. Sort Logic
    list.sort((a, b) => {
      if (sortOption === "az") {
        return a.full_name.localeCompare(b.full_name, "id");
      }
      if (sortOption === "za") {
        return b.full_name.localeCompare(a.full_name, "id");
      }
      if (sortOption === "nim") {
        const nimA = a.student_id || "";
        const nimB = b.student_id || "";
        return nimA.localeCompare(nimB, undefined, { numeric: true });
      }
      if (sortOption === "terlama") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      // "terbaru" (default)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return list;
  }, [students, searchQuery, sortOption]);

  // Pagination State (8 mahasiswa per halaman)
  const STUDENTS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption]);

  const totalPages = Math.ceil(processedStudents.length / STUDENTS_PER_PAGE) || 1;

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * STUDENTS_PER_PAGE;
    return processedStudents.slice(start, start + STUDENTS_PER_PAGE);
  }, [processedStudents, currentPage]);

  const createForm = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", email: "", student_id: "", password: "" },
    mode: "onBlur",
  });

  const editForm = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", email: "", student_id: "", password: "" },
    mode: "onBlur",
  });

  async function onCreateSubmit(values: StudentForm) {
    if (!group) return;
    setSubmitting(true);
    try {
      const targetEmail = values.email?.trim()
        ? values.email.trim()
        : `${values.student_id.trim().toLowerCase()}@student.kkn`;
      const targetPassword = values.password?.trim()
        ? values.password.trim()
        : values.student_id.trim();

      // Gunakan Native Supabase Auth Client tanpa persistSession agar akun ter-hash sempurna oleh Supabase Auth GoTrue
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );

      const { data: signUpData, error: signUpErr } = await tempSupabase.auth.signUp({
        email: targetEmail,
        password: targetPassword,
        options: {
          data: {
            full_name: values.full_name,
            role: "mahasiswa",
            student_id: values.student_id,
            group_id: group.id,
          },
        },
      });

      if (signUpErr) {
        // Fallback ke RPC
        const { error: rpcErr } = await supabase.rpc("create_student_user", {
          p_full_name: values.full_name,
          p_student_id: values.student_id,
          p_group_id: group.id,
          p_password: targetPassword,
          p_email: targetEmail,
        });
        if (rpcErr) throw new Error(signUpErr.message || rpcErr.message);
      } else if (signUpData.user?.id) {
        // Hubungkan mahasiswa ke kelompok dosen via RPC assign_student_to_group atau update langsung
        const { error: assignErr } = await supabase.rpc("assign_student_to_group", {
          p_student_id: signUpData.user.id,
          p_group_id: group.id,
        });

        if (assignErr) {
          await supabase
            .from("profiles")
            .update({
              group_id: group.id,
              full_name: values.full_name,
              student_id: values.student_id,
              email: targetEmail,
            })
            .eq("id", signUpData.user.id);
        }
      }

      toast.success(
        `Mahasiswa ${values.full_name} (NIM: ${values.student_id}) berhasil didaftarkan.`
      );
      createForm.reset();
      setCreateOpen(false);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenEdit(student: Profile) {
    setEditStudent(student);
    editForm.reset({
      full_name: student.full_name,
      student_id: student.student_id ?? "",
      email: student.email,
      password: "",
    });
  }

  async function onEditSubmit(values: StudentForm) {
    if (!editStudent) return;
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_update_student", {
        p_student_uuid: editStudent.id,
        p_full_name: values.full_name,
        p_student_id: values.student_id,
        p_new_email: values.email || null,
        p_new_password: values.password || null,
      });

      if (rpcErr) {
        if (
          rpcErr.message?.includes("function") ||
          rpcErr.code === "PGRST202" ||
          rpcErr.message?.includes("Could not find")
        ) {
          throw new Error(
            "Fungsi database 'admin_update_student' belum dibuat di Supabase SQL Editor."
          );
        }
        throw new Error(rpcErr.message);
      }

      toast.success(`Data mahasiswa ${values.full_name} berhasil diperbarui.`);
      setEditStudent(null);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    setRemovingId(id);
    try {
      const { error: rpcErr } = await supabase.rpc("admin_delete_student", {
        p_student_uuid: id,
      });

      if (rpcErr) {
        // Fallback jika RPC admin_delete_student belum ada
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ group_id: null })
          .eq("id", id);
        if (updateErr) throw updateErr;
      }

      toast.success(`Mahasiswa ${name} berhasil dihapus.`);
      reload();
    } catch (err) {
      toast.error((err as Error).message ?? "Gagal menghapus mahasiswa");
    } finally {
      setRemovingId(null);
      setDeleteConfirmStudent(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mahasiswa"
        description="Daftar mahasiswa binaan dalam kelompok KKN Anda."
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!group}>
                <UserPlus className="size-4" />
                Tambah Mahasiswa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Mahasiswa Baru</DialogTitle>
                <DialogDescription>
                  Mahasiswa dapat login menggunakan <strong>NIM</strong> &amp; <strong>Password</strong> (default sama dengan NIM jika dikosongkan).
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="flex flex-col gap-4"
                noValidate
              >
                <Field
                  data-invalid={createForm.formState.errors.full_name ? true : undefined}
                >
                  <FieldLabel htmlFor="st_full_name">Nama Lengkap *</FieldLabel>
                  <Input
                    id="st_full_name"
                    placeholder="Nama mahasiswa"
                    aria-invalid={createForm.formState.errors.full_name ? true : undefined}
                    {...createForm.register("full_name")}
                  />
                  {createForm.formState.errors.full_name && (
                    <FieldError errors={[createForm.formState.errors.full_name]} />
                  )}
                </Field>

                <Field
                  data-invalid={createForm.formState.errors.student_id ? true : undefined}
                >
                  <FieldLabel htmlFor="st_student_id">NIM (ID Login) *</FieldLabel>
                  <Input
                    id="st_student_id"
                    placeholder="Nomor Induk Mahasiswa"
                    aria-invalid={createForm.formState.errors.student_id ? true : undefined}
                    {...createForm.register("student_id")}
                  />
                  {createForm.formState.errors.student_id && (
                    <FieldError errors={[createForm.formState.errors.student_id]} />
                  )}
                </Field>

                <Field
                  data-invalid={createForm.formState.errors.email ? true : undefined}
                >
                  <FieldLabel htmlFor="st_email">Email Kampus (Opsional)</FieldLabel>
                  <Input
                    id="st_email"
                    type="email"
                    placeholder="Biarkan kosong jika tidak tahu"
                    aria-invalid={createForm.formState.errors.email ? true : undefined}
                    {...createForm.register("email")}
                  />
                  {createForm.formState.errors.email && (
                    <FieldError errors={[createForm.formState.errors.email]} />
                  )}
                </Field>

                <Field
                  data-invalid={createForm.formState.errors.password ? true : undefined}
                >
                  <FieldLabel htmlFor="st_password">
                    Kata Sandi (Opsional)
                  </FieldLabel>
                  <Input
                    id="st_password"
                    type="password"
                    placeholder="Kosongkan untuk menggunakan NIM sebagai kata sandi"
                    aria-invalid={createForm.formState.errors.password ? true : undefined}
                    {...createForm.register("password")}
                  />
                  {createForm.formState.errors.password && (
                    <FieldError errors={[createForm.formState.errors.password]} />
                  )}
                </Field>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={submitting}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    Daftarkan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="border-border/60 shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle>Anggota Kelompok</CardTitle>
            <CardDescription>
              {group
                ? `${group.name} - ${students.length} Mahasiswa Binaan`
                : "Kelompok belum siap."}
            </CardDescription>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIM, atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9 bg-background/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <Select value={sortOption} onValueChange={(val: any) => setSortOption(val)}>
                <SelectTrigger className="w-[170px] text-xs h-9">
                  <SelectValue placeholder="Urutkan Data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terbaru" className="text-xs">Terbaru Didaftarkan</SelectItem>
                  <SelectItem value="terlama" className="text-xs">Terlama Didaftarkan</SelectItem>
                  <SelectItem value="az" className="text-xs">Nama (A - Z)</SelectItem>
                  <SelectItem value="za" className="text-xs">Nama (Z - A)</SelectItem>
                  <SelectItem value="nim" className="text-xs">NIM (Urutan Angka)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <LoadingLottie text="Memuat data mahasiswa binaan KKN..." />
            </div>
          ) : students.length === 0 ? (
            <Empty className="border">
              <EmptyMedia variant="icon">
                <Mail />
              </EmptyMedia>
              <EmptyTitle>Belum ada mahasiswa</EmptyTitle>
              <EmptyDescription>
                Tambahkan mahasiswa binaan Anda agar mereka dapat memulai absensi.
              </EmptyDescription>
            </Empty>
          ) : processedStudents.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground space-y-2">
              <Search className="size-8 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">Tidak ditemukan hasil pencarian</p>
              <p>Tidak ada mahasiswa yang cocok dengan pencarian "{searchQuery}".</p>
              <Button size="sm" variant="outline" onClick={() => setSearchQuery("")} className="mt-2 text-xs">
                Bersihkan Pencarian
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead>Nama Mahasiswa</TableHead>
                    <TableHead>NIM (Username Login)</TableHead>
                    <TableHead>Email Terdaftar</TableHead>
                    <TableHead className="text-right">Aksi &amp; Kredensial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Avatar size="sm">
                          {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.full_name} className="object-cover" />}
                          <AvatarFallback>{initials(s.full_name)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.full_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {s.student_id ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {s.email}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setViewStudent(s)}
                            title="Lihat Detail & Kredensial Login"
                          >
                            <Eye className="size-4" />
                          </Button>

                          {/* Edit & Reset Password Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(s)}
                            title="Edit Data / Reset Password"
                          >
                            <Pencil className="size-4" />
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteConfirmStudent({ id: s.id, name: s.full_name })}
                            disabled={removingId === s.id}
                            title="Hapus Mahasiswa"
                          >
                            {removingId === s.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Table Pagination Controls */}
              {processedStudents.length > STUDENTS_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4 text-xs">
                  <div className="text-muted-foreground font-medium">
                    Menampilkan{" "}
                    <span className="font-bold text-foreground">
                      {(currentPage - 1) * STUDENTS_PER_PAGE + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-bold text-foreground">
                      {Math.min(currentPage * STUDENTS_PER_PAGE, processedStudents.length)}
                    </span>{" "}
                    dari <span className="font-bold text-foreground">{processedStudents.length}</span> Mahasiswa
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 gap-1 text-xs cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                      <span>Sebelumnya</span>
                    </Button>

                    <div className="flex items-center gap-1 px-2 font-medium text-xs text-muted-foreground">
                      Halaman <span className="font-bold text-foreground">{currentPage}</span> dari{" "}
                      <span className="font-bold text-foreground">{totalPages}</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 gap-1 text-xs cursor-pointer"
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal View Detail & Kredensial */}
      {viewStudent && (
        <Dialog open={Boolean(viewStudent)} onOpenChange={() => setViewStudent(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                Detail Akun Mahasiswa
              </DialogTitle>
              <DialogDescription>
                Informasi login mahasiswa untuk keperluan autentikasi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border p-4 bg-muted/20 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Nama Lengkap</span>
                <span className="font-semibold">{viewStudent.full_name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">NIM (ID Login)</span>
                <span className="font-mono font-bold text-primary">{viewStudent.student_id}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Email Terdaftar</span>
                <span className="font-mono text-xs">{viewStudent.email}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Password Default</span>
                <span className="font-mono font-semibold">{viewStudent.student_id}</span>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-col sm:space-x-0">
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `NIM: ${viewStudent.student_id}\nPassword: ${viewStudent.student_id}`
                  );
                  toast.success("Info login disalin ke clipboard!");
                }}
              >
                <Copy className="size-4" /> Salin Info Login
              </Button>
              <Button
                onClick={() => {
                  const st = viewStudent;
                  setViewStudent(null);
                  handleOpenEdit(st);
                }}
                className="w-full justify-center"
              >
                <Pencil className="size-4" /> Edit / Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Edit & Reset Password */}
      {editStudent && (
        <Dialog open={Boolean(editStudent)} onOpenChange={() => setEditStudent(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Data &amp; Reset Password</DialogTitle>
              <DialogDescription>
                Ubah informasi mahasiswa atau atur ulang password baru.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="flex flex-col gap-4"
              noValidate
            >
              <Field
                data-invalid={editForm.formState.errors.full_name ? true : undefined}
              >
                <FieldLabel htmlFor="edit_full_name">Nama Lengkap *</FieldLabel>
                <Input
                  id="edit_full_name"
                  placeholder="Nama mahasiswa"
                  aria-invalid={editForm.formState.errors.full_name ? true : undefined}
                  {...editForm.register("full_name")}
                />
                {editForm.formState.errors.full_name && (
                  <FieldError errors={[editForm.formState.errors.full_name]} />
                )}
              </Field>

              <Field
                data-invalid={editForm.formState.errors.student_id ? true : undefined}
              >
                <FieldLabel htmlFor="edit_student_id">NIM (ID Login) *</FieldLabel>
                <Input
                  id="edit_student_id"
                  placeholder="Nomor Induk Mahasiswa"
                  aria-invalid={editForm.formState.errors.student_id ? true : undefined}
                  {...editForm.register("student_id")}
                />
                {editForm.formState.errors.student_id && (
                  <FieldError errors={[editForm.formState.errors.student_id]} />
                )}
              </Field>

              <Field
                data-invalid={editForm.formState.errors.email ? true : undefined}
              >
                <FieldLabel htmlFor="edit_email">Email Kampus / Terdaftar</FieldLabel>
                <Input
                  id="edit_email"
                  type="email"
                  placeholder="Email mahasiswa"
                  aria-invalid={editForm.formState.errors.email ? true : undefined}
                  {...editForm.register("email")}
                />
                {editForm.formState.errors.email && (
                  <FieldError errors={[editForm.formState.errors.email]} />
                )}
              </Field>

              <Field
                data-invalid={editForm.formState.errors.password ? true : undefined}
              >
                <FieldLabel htmlFor="edit_password">
                  Password Baru (Reset Password)
                </FieldLabel>
                <Input
                  id="edit_password"
                  type="password"
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  aria-invalid={editForm.formState.errors.password ? true : undefined}
                  {...editForm.register("password")}
                />
                {editForm.formState.errors.password && (
                  <FieldError errors={[editForm.formState.errors.password]} />
                )}
              </Field>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditStudent(null)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Confirm Delete Student */}
      <Dialog open={Boolean(deleteConfirmStudent)} onOpenChange={(o) => !o && setDeleteConfirmStudent(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus Mahasiswa?</DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan. Mahasiswa <span className="font-semibold text-foreground">{deleteConfirmStudent?.name}</span> akan dihapus dari anggota kelompok KKN ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmStudent(null)}
              disabled={Boolean(removingId)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteConfirmStudent) {
                  handleRemove(deleteConfirmStudent.id, deleteConfirmStudent.name);
                }
              }}
              disabled={Boolean(removingId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {removingId && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
