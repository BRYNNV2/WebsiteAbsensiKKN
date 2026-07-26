/*
# KKN Attendance System - Initial Schema

## Overview
Skema lengkap untuk sistem absensi KKN berbasis QR code dengan
dua role: dosen dan mahasiswa. Satu dosen membawahi satu
kelompok KKN. Dosen mendaftarkan akun mahasiswa binaannya.

## Tables
1. `profiles` - data pengguna (dosen/mahasiswa), pelengkap akun
   Supabase Auth. `id` -> auth.users.id. `role`: dosen/mahasiswa.
   `group_id` -> kkn_groups.id.
2. `kkn_groups` - kelompok KKN. `dosen_id` -> profiles.id, unik
   (one dosen one group).
3. `qr_sessions` - sesi absen yang dibuat dosen. Berisi tanggal,
   jendela waktu mulai/berakhir, lokasi, dan `token` acak yang
   di-encode ke QR code.
4. `attendance_records` - catatan kehadiran mahasiswa per sesi.
   `status`: hadir/terlambat/absen. Unique (session_id,
   student_id) agar tidak absen dua kali.

## Security (RLS)
- Semua tabel ENABLE ROW LEVEL SECURITY.
- Dosen membaca semua profile di kelompoknya; user baca/ubah
  profil sendiri.
- Dosen CRUD kelompoknya; mahasiswa anggota SELECT kelompoknya.
- Dosen CRUD qr_sessions di kelompoknya; mahasiswa anggota
  SELECT.
- Mahasiswa INSERT record untuk dirinya sendiri saja; mahasiswa
  SELECT record miliknya; dosen SELECT/UPDATE/DELETE semua
  record di kelompoknya.
- `student_id` dan `created_by` di-default auth.uid() agar insert
  tanpa owner lolos WITH CHECK.

## Notes
- Trigger handle_new_user otomatis buat baris profile saat user
  mendaftar via Supabase Auth (signUp). Role/full_name diambil
  dari raw_user_meta_data.
- Function is_session_active cek apakah sesi masih dalam jendela
  waktu absen.
*/

-- ============================================================
-- TABLES (created before policies to avoid circular refs)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'mahasiswa' CHECK (role IN ('dosen', 'mahasiswa')),
  student_id text,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kkn_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  dosen_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link profiles.group_id -> kkn_groups.id (added after groups exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_group_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.kkn_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.kkn_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_sessions_group_id_idx ON public.qr_sessions(group_id);
CREATE INDEX IF NOT EXISTS qr_sessions_token_idx ON public.qr_sessions(token);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.qr_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'terlambat', 'absen')),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS attendance_session_id_idx ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx ON public.attendance_records(student_id);

-- ============================================================
-- RLS ENABLE
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kkn_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: profiles
-- ============================================================
DROP POLICY IF EXISTS "select_own_or_group_profile" ON public.profiles;
CREATE POLICY "select_own_or_group_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = profiles.group_id AND g.dosen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLICIES: kkn_groups
-- ============================================================
DROP POLICY IF EXISTS "select_own_or_member_group" ON public.kkn_groups;
CREATE POLICY "select_own_or_member_group"
ON public.kkn_groups FOR SELECT
TO authenticated
USING (
  kkn_groups.dosen_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.group_id = kkn_groups.id
  )
);

DROP POLICY IF EXISTS "insert_dosen_group" ON public.kkn_groups;
CREATE POLICY "insert_dosen_group"
ON public.kkn_groups FOR INSERT
TO authenticated
WITH CHECK (kkn_groups.dosen_id = auth.uid());

DROP POLICY IF EXISTS "update_dosen_group" ON public.kkn_groups;
CREATE POLICY "update_dosen_group"
ON public.kkn_groups FOR UPDATE
TO authenticated
USING (kkn_groups.dosen_id = auth.uid())
WITH CHECK (kkn_groups.dosen_id = auth.uid());

DROP POLICY IF EXISTS "delete_dosen_group" ON public.kkn_groups;
CREATE POLICY "delete_dosen_group"
ON public.kkn_groups FOR DELETE
TO authenticated
USING (kkn_groups.dosen_id = auth.uid());

-- ============================================================
-- POLICIES: qr_sessions
-- ============================================================
DROP POLICY IF EXISTS "select_group_qr_sessions" ON public.qr_sessions;
CREATE POLICY "select_group_qr_sessions"
ON public.qr_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = qr_sessions.group_id
    AND (g.dosen_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.group_id = g.id))
  )
);

DROP POLICY IF EXISTS "insert_dosen_qr_session" ON public.qr_sessions;
CREATE POLICY "insert_dosen_qr_session"
ON public.qr_sessions FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = qr_sessions.group_id AND g.dosen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "update_dosen_qr_session" ON public.qr_sessions;
CREATE POLICY "update_dosen_qr_session"
ON public.qr_sessions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = qr_sessions.group_id AND g.dosen_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = qr_sessions.group_id AND g.dosen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_dosen_qr_session" ON public.qr_sessions;
CREATE POLICY "delete_dosen_qr_session"
ON public.qr_sessions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = qr_sessions.group_id AND g.dosen_id = auth.uid()
  )
);

-- ============================================================
-- POLICIES: attendance_records
-- ============================================================
DROP POLICY IF EXISTS "select_own_or_group_attendance" ON public.attendance_records;
CREATE POLICY "select_own_or_group_attendance"
ON public.attendance_records FOR SELECT
TO authenticated
USING (
  attendance_records.student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.qr_sessions s
    JOIN public.kkn_groups g ON g.id = s.group_id
    WHERE s.id = attendance_records.session_id AND g.dosen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_own_attendance" ON public.attendance_records;
CREATE POLICY "insert_own_attendance"
ON public.attendance_records FOR INSERT
TO authenticated
WITH CHECK (
  attendance_records.student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'mahasiswa'
  )
);

DROP POLICY IF EXISTS "update_dosen_attendance" ON public.attendance_records;
CREATE POLICY "update_dosen_attendance"
ON public.attendance_records FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qr_sessions s
    JOIN public.kkn_groups g ON g.id = s.group_id
    WHERE s.id = attendance_records.session_id AND g.dosen_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.qr_sessions s
    JOIN public.kkn_groups g ON g.id = s.group_id
    WHERE s.id = attendance_records.session_id AND g.dosen_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_dosen_attendance" ON public.attendance_records;
CREATE POLICY "delete_dosen_attendance"
ON public.attendance_records FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qr_sessions s
    JOIN public.kkn_groups g ON g.id = s.group_id
    WHERE s.id = attendance_records.session_id AND g.dosen_id = auth.uid()
  )
);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, student_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mahasiswa')::text,
    NEW.raw_user_meta_data->>'student_id'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPER: is_session_active
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_session_active(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qr_sessions
    WHERE id = p_session_id
    AND now() >= starts_at
    AND now() <= ends_at
  );
$$;
