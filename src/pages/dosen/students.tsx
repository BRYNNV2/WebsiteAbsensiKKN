import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail, Trash2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useDosenData } from "@/hooks/use-dosen-data";
import { useAuth } from "@/lib/auth";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const studentSchema = z.object({
  full_name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  email: z.string().email("Alamat email tidak valid"),
  student_id: z.string().min(3, "NIM minimal 3 karakter"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
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
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const form = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", email: "", student_id: "", password: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: StudentForm) {
    if (!group || !session?.access_token) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-student`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            full_name: values.full_name,
            student_id: values.student_id,
            group_id: group.id,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Gagal mendaftarkan mahasiswa");
      }
      toast.success(`Mahasiswa ${values.full_name} berhasil didaftarkan.`);
      form.reset();
      setOpen(false);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Hapus mahasiswa ${name} dari kelompok ini?`)) return;
    setRemovingId(id);
    const { error } = await supabase
      .from("profiles")
      .update({ group_id: null })
      .eq("id", id);
    setRemovingId(null);
    if (error) {
      toast.error("Gagal menghapus mahasiswa dari kelompok.");
      return;
    }
    toast.success("Mahasiswa dikeluarkan dari kelompok.");
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mahasiswa"
        description="Daftar mahasiswa binaan dalam kelompok KKN Anda."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
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
                  Akun akan dibuatkan otomatis. Mahasiswa dapat langsung
                  masuk dengan email dan kata sandi di bawah ini.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
                noValidate
              >
                <Field
                  data-invalid={form.formState.errors.full_name ? true : undefined}
                >
                  <FieldLabel htmlFor="st_full_name">Nama Lengkap</FieldLabel>
                  <Input
                    id="st_full_name"
                    placeholder="Nama mahasiswa"
                    aria-invalid={form.formState.errors.full_name ? true : undefined}
                    {...form.register("full_name")}
                  />
                  {form.formState.errors.full_name && (
                    <FieldError errors={[form.formState.errors.full_name]} />
                  )}
                </Field>

                <Field
                  data-invalid={form.formState.errors.student_id ? true : undefined}
                >
                  <FieldLabel htmlFor="st_student_id">NIM</FieldLabel>
                  <Input
                    id="st_student_id"
                    placeholder="Nomor Induk Mahasiswa"
                    aria-invalid={form.formState.errors.student_id ? true : undefined}
                    {...form.register("student_id")}
                  />
                  {form.formState.errors.student_id && (
                    <FieldError errors={[form.formState.errors.student_id]} />
                  )}
                </Field>

                <Field
                  data-invalid={form.formState.errors.email ? true : undefined}
                >
                  <FieldLabel htmlFor="st_email">Email</FieldLabel>
                  <Input
                    id="st_email"
                    type="email"
                    placeholder="mahasiswa@kampus.ac.id"
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
                  <FieldLabel htmlFor="st_password">
                    Kata Sandi Sementara
                  </FieldLabel>
                  <Input
                    id="st_password"
                    type="password"
                    placeholder="Minimal 8 karakter"
                    aria-invalid={form.formState.errors.password ? true : undefined}
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <FieldError errors={[form.formState.errors.password]} />
                  )}
                </Field>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
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

      <Card>
        <CardHeader>
          <CardTitle>Anggota Kelompok</CardTitle>
          <CardDescription>
            {group
              ? `${group.name} - ${students.length} mahasiswa`
              : "Kelompok belum siap."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <Empty className="border">
              <EmptyMedia variant="icon">
                <Mail />
              </EmptyMedia>
              <EmptyTitle>Belum ada mahasiswa</EmptyTitle>
              <EmptyDescription>
                Tambahkan mahasiswa binaan Anda agar mereka dapat memulai
                absensi.
              </EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIM</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Avatar size="sm">
                        <AvatarFallback>{initials(s.full_name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.full_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {s.student_id ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(s.id, s.full_name)}
                        disabled={removingId === s.id}
                        aria-label="Keluarkan dari kelompok"
                      >
                        {removingId === s.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
