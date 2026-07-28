-- Skrip Migrasi Tabel kkn_work_programs
CREATE TABLE IF NOT EXISTS public.kkn_work_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.kkn_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  day_name TEXT NOT NULL,
  date DATE NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indeks performa query berdasarkan group_id dan tanggal
CREATE INDEX IF NOT EXISTS idx_kkn_work_programs_group_id ON public.kkn_work_programs(group_id);
CREATE INDEX IF NOT EXISTS idx_kkn_work_programs_date ON public.kkn_work_programs(date);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.kkn_work_programs ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses: Mahasiswa dan Dosen kelompok dapat membaca program kerja
CREATE POLICY "Semua anggota kelompok KKN dapat membaca program kerja"
  ON public.kkn_work_programs
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM public.kkn_groups WHERE dosen_id = auth.uid()
    )
  );

-- Kebijakan Akses: Dosen dapat membuat, mengubah, dan menghapus program kerja
CREATE POLICY "Dosen dapat mengelola program kerja kelompoknya"
  ON public.kkn_work_programs
  FOR ALL
  USING (
    group_id IN (
      SELECT id FROM public.kkn_groups WHERE dosen_id = auth.uid()
    )
  );
