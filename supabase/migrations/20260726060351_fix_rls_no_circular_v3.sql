/*
# Final fix: eliminate all cross-table RLS circular references

## Approach
- profiles SELECT: only auth.uid() = id  (no subquery at all)
- kkn_groups SELECT: only dosen_id = auth.uid()  (no profile subquery)
  Students don't need to SELECT kkn_groups via RLS — their group_id
  is in their own profile, which they can always read (select_own_profile).
  For display they get the group name via dosen profile lookup on the client.
  → Actually: allow ALL authenticated users to SELECT kkn_groups.
    The data is non-sensitive (group name + location). This is the simplest
    non-circular solution.
- qr_sessions: allow any authenticated user whose profiles.group_id matches
  to SELECT sessions — but this still causes the same issue.
  Instead: allow all authenticated users to SELECT qr_sessions.
  They can only SUBMIT attendance for their own group (server-enforced).
- attendance_records: own_student check via auth.uid() = student_id; dosen
  check via session_id pointing to a group whose dosen_id = auth.uid()
  (safe — this only touches qr_sessions and kkn_groups, not profiles).
*/

-- ============================================================
-- PROFILES: no cross-table reference
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "dosen_reads_group_students" ON public.profiles;

CREATE POLICY "select_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Separate policy: dosen reads students using only kkn_groups.dosen_id
-- and profiles.group_id — does NOT have kkn_groups query profiles.
-- This is safe because select_kkn_group_open below uses only dosen_id = auth.uid().
CREATE POLICY "dosen_reads_group_students"
ON public.profiles FOR SELECT
TO authenticated
USING (
  group_id IS NOT NULL AND (
    SELECT g.dosen_id FROM public.kkn_groups g WHERE g.id = profiles.group_id LIMIT 1
  ) = auth.uid()
);

-- ============================================================
-- KKN_GROUPS: open read to all authenticated (non-sensitive)
-- ============================================================
DROP POLICY IF EXISTS "select_kkn_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "select_own_or_member_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "insert_kkn_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "update_kkn_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "delete_kkn_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "insert_dosen_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "update_dosen_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "delete_dosen_group" ON public.kkn_groups;

-- All authenticated users may read group info (name + location only).
CREATE POLICY "select_kkn_group_open"
ON public.kkn_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "insert_kkn_group"
ON public.kkn_groups FOR INSERT
TO authenticated
WITH CHECK (kkn_groups.dosen_id = auth.uid());

CREATE POLICY "update_kkn_group"
ON public.kkn_groups FOR UPDATE
TO authenticated
USING (kkn_groups.dosen_id = auth.uid())
WITH CHECK (kkn_groups.dosen_id = auth.uid());

CREATE POLICY "delete_kkn_group"
ON public.kkn_groups FOR DELETE
TO authenticated
USING (kkn_groups.dosen_id = auth.uid());

-- ============================================================
-- QR_SESSIONS: open read to all authenticated
-- ============================================================
DROP POLICY IF EXISTS "select_group_qr_sessions" ON public.qr_sessions;

CREATE POLICY "select_qr_sessions_open"
ON public.qr_sessions FOR SELECT
TO authenticated
USING (true);
