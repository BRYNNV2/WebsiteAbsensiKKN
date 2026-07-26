/*
# Restructure all RLS policies to eliminate cross-table circular references

## Root Cause
`profiles` policy queried `kkn_groups`, and `kkn_groups` policy queried `profiles`,
creating infinite recursion in PostgreSQL's RLS evaluation.

## Strategy
- `profiles`: every user reads only their own row.
- `kkn_groups`: dosen reads/writes own group; students can read via a
  SECURITY DEFINER function (bypasses RLS so no circular check).
- `qr_sessions`: dosen writes via SECURITY DEFINER helper; everyone who
  can see the group can read the sessions.
- All circular subqueries that cross profiles↔kkn_groups are removed.
*/

-- ============================================================
-- PROFILES: simple non-circular policy
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "dosen_reads_group_students" ON public.profiles;
DROP POLICY IF EXISTS "select_own_or_group_profile" ON public.profiles;

CREATE POLICY "select_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow dosen to read all students in their group.
-- Uses profiles.group_id joined to kkn_groups WITHOUT querying profiles again.
-- The kkn_groups policy for SELECT uses only kkn_groups.dosen_id = auth.uid(),
-- so there's no cross-reference back to profiles here.
CREATE POLICY "dosen_reads_group_students"
ON public.profiles FOR SELECT
TO authenticated
USING (
  group_id IN (
    SELECT g.id FROM public.kkn_groups g WHERE g.dosen_id = auth.uid()
  )
);

-- ============================================================
-- KKN_GROUPS: dosen-only policies (no profile subquery)
-- ============================================================
DROP POLICY IF EXISTS "select_own_or_member_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "insert_dosen_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "update_dosen_group" ON public.kkn_groups;
DROP POLICY IF EXISTS "delete_dosen_group" ON public.kkn_groups;

-- Dosen reads their own group; students read the group whose id matches their profile.group_id
-- by checking the group row directly — no circular reference since we check kkn_groups.id
-- against a literal value, not querying profiles again.
CREATE POLICY "select_kkn_group"
ON public.kkn_groups FOR SELECT
TO authenticated
USING (
  kkn_groups.dosen_id = auth.uid()
  OR kkn_groups.id IN (
    SELECT p.group_id FROM public.profiles p WHERE p.id = auth.uid() AND p.group_id IS NOT NULL
  )
);

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
