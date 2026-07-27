-- ============================================================
-- UPDATE CONSTRAINT: attendance_records_status_check
-- Mendukung status: hadir, terlambat, izin, sakit, absen
-- ============================================================
ALTER TABLE public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_status_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_status_check CHECK (status IN ('hadir', 'terlambat', 'izin', 'sakit', 'absen'));

-- ============================================================
-- RPC FUNCTION: set_manual_attendance
-- Memungkinkan Dosen mengubah/mengisi status absen manual
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_manual_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dosen'
  ) THEN
    RAISE EXCEPTION 'Hanya dosen yang dapat mengubah status absensi';
  END IF;

  IF p_status NOT IN ('hadir', 'terlambat', 'izin', 'sakit', 'absen') THEN
    RAISE EXCEPTION 'Status absensi % tidak valid', p_status;
  END IF;

  IF p_status = 'absen' THEN
    DELETE FROM public.attendance_records
    WHERE session_id = p_session_id AND student_id = p_student_id;
  ELSE
    INSERT INTO public.attendance_records (session_id, student_id, status, scanned_at)
    VALUES (p_session_id, p_student_id, p_status, now())
    ON CONFLICT (session_id, student_id) DO UPDATE
    SET status = EXCLUDED.status,
        scanned_at = now();
  END IF;

  RETURN json_build_object('status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_manual_attendance(uuid, uuid, text) TO authenticated, service_role;

-- ============================================================
-- RPC FUNCTION: update_student_campus_email
-- Memungkinkan mahasiswa memperbarui email kampus resmi secara langsung
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_student_campus_email(p_new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_clean_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna belum terautentikasi';
  END IF;

  v_clean_email := lower(trim(p_new_email));

  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RAISE EXCEPTION 'Email tidak boleh kosong';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email AND id <> v_user_id) THEN
    RAISE EXCEPTION 'Email % sudah digunakan oleh akun lain', v_clean_email;
  END IF;

  UPDATE auth.users
  SET email = v_clean_email,
      email_change = '',
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE auth.identities
  SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
      updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE public.profiles
  SET email = v_clean_email
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_campus_email(text) TO authenticated, service_role;

-- ============================================================
-- RPC FUNCTION: assign_student_to_group
-- Menghubungkan mahasiswa ke kelompok KKN (Bypass RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_student_to_group(p_student_id uuid, p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET group_id = p_group_id
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_student_to_group(uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- TRIGGER UPDATE: handle_new_user
-- Menyimpan group_id secara otomatis saat signUp jika dikirim via metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id_text text;
  v_group_id uuid := NULL;
BEGIN
  v_group_id_text := NEW.raw_user_meta_data->>'group_id';
  IF v_group_id_text IS NOT NULL AND trim(v_group_id_text) != '' THEN
    v_group_id := v_group_id_text::uuid;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, student_id, group_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mahasiswa')::text,
    NEW.raw_user_meta_data->>'student_id',
    v_group_id
  )
  ON CONFLICT (id) DO UPDATE
  SET group_id = COALESCE(EXCLUDED.group_id, profiles.group_id),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      student_id = COALESCE(EXCLUDED.student_id, profiles.student_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RPC FUNCTION: get_email_by_student_id
-- Mengizinkan pencarian email berdasarkan NIM untuk fitur login NIM
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_email_by_student_id(p_student_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE lower(trim(student_id)) = lower(trim(p_student_id)) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_student_id(text) TO anon, authenticated, service_role;

-- ============================================================
-- RPC FUNCTION: create_student_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_student_user(
  p_full_name text,
  p_student_id text,
  p_group_id uuid,
  p_password text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_pass text;
  v_encrypted_pw text;
  v_instance_id uuid;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'dosen'
  ) THEN
    RAISE EXCEPTION 'Hanya dosen yang dapat mendaftarkan mahasiswa';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    v_email := lower(trim(p_student_id)) || '@student.kkn';
  ELSE
    v_email := lower(trim(p_email));
  END IF;

  IF p_password IS NULL OR trim(p_password) = '' THEN
    v_pass := trim(p_student_id);
  ELSE
    v_pass := trim(p_password);
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(trim(student_id)) = lower(trim(p_student_id))) THEN
    RAISE EXCEPTION 'Mahasiswa dengan NIM % sudah terdaftar', p_student_id;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Email/NIM % sudah terdaftar', v_email;
  END IF;

  SELECT instance_id INTO v_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(v_pass, extensions.gen_salt('bf', 10));

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud, is_sso_user
  ) VALUES (
    v_user_id, v_instance_id, v_email, v_encrypted_pw, now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name, 'role', 'mahasiswa', 'student_id', p_student_id, 'group_id', p_group_id),
    now(), now(), 'authenticated', 'authenticated', false
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id, v_user_id::text, jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, full_name, role, student_id, group_id)
  VALUES (v_user_id, v_email, p_full_name, 'mahasiswa', p_student_id, p_group_id)
  ON CONFLICT (id) DO UPDATE
  SET group_id = p_group_id, full_name = p_full_name, student_id = p_student_id, email = v_email;

  RETURN json_build_object('id', v_user_id, 'email', v_email, 'student_id', p_student_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_user(text, text, uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- RPC FUNCTION: admin_update_student
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_student(
  p_student_uuid uuid,
  p_full_name text,
  p_student_id text,
  p_new_email text DEFAULT NULL,
  p_new_password text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'dosen'
  ) THEN
    RAISE EXCEPTION 'Hanya dosen yang dapat mengubah data mahasiswa';
  END IF;

  IF p_new_email IS NOT NULL AND trim(p_new_email) <> '' THEN
    v_email := lower(trim(p_new_email));
    UPDATE auth.users SET email = v_email, updated_at = now() WHERE id = p_student_uuid;
    UPDATE auth.identities SET identity_data = jsonb_build_object('sub', p_student_uuid::text, 'email', v_email), updated_at = now() WHERE user_id = p_student_uuid;
  END IF;

  IF p_new_password IS NOT NULL AND trim(p_new_password) <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf', 10)),
        email_confirmed_at = now(),
        is_sso_user = false,
        updated_at = now()
    WHERE id = p_student_uuid;
  END IF;

  UPDATE public.profiles
  SET full_name = trim(p_full_name),
      student_id = trim(p_student_id),
      email = COALESCE(v_email, email)
  WHERE id = p_student_uuid;

  RETURN json_build_object('status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_student(uuid, text, text, text, text) TO authenticated, service_role;

-- ============================================================
-- RPC FUNCTION: admin_delete_student
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_student(p_student_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'dosen'
  ) THEN
    RAISE EXCEPTION 'Hanya dosen yang dapat menghapus mahasiswa';
  END IF;

  DELETE FROM public.profiles WHERE id = p_student_uuid;
  DELETE FROM auth.users WHERE id = p_student_uuid;

  RETURN json_build_object('status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_student(uuid) TO authenticated, service_role;

UPDATE auth.users SET is_sso_user = false WHERE is_sso_user IS NULL OR is_sso_user = true;
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

UPDATE public.profiles p
SET group_id = (SELECT id FROM public.kkn_groups LIMIT 1)
WHERE p.role = 'mahasiswa' AND p.group_id IS NULL;
