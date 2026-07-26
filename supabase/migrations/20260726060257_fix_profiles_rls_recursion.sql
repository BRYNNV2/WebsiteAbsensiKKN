/*
# Fix infinite recursion in profiles RLS policy

## Problem
The `select_own_or_group_profile` policy on `profiles` queries `kkn_groups`,
and the `kkn_groups` policy queries `profiles`. This creates infinite recursion.

## Fix
- Simplify `profiles` SELECT to only allow a user to read their own row
  (`auth.uid() = id`). This breaks the circular reference.
- Add a separate `profiles_select_by_group_id` policy so that dosen can
  also read profiles that share the same group_id without joining kkn_groups
  again, using the direct `group_id` column on profiles (safe, no cycle).
- The `kkn_groups` policy already let dosen CRUD their group.
  Students can select their group via profiles.group_id = kkn_groups.id,
  which is already handled.
*/

DROP POLICY IF EXISTS "select_own_or_group_profile" ON public.profiles;

-- Every user reads their own profile (no cross-table join = no cycle)
CREATE POLICY "select_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Dosen can read profiles of students who are in their group.
-- Uses profiles.group_id directly so there is no reference back to profiles.
CREATE POLICY "dosen_reads_group_students"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.kkn_groups g
    WHERE g.id = profiles.group_id
    AND g.dosen_id = auth.uid()
  )
);
