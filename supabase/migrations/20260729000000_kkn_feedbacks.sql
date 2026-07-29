-- Migration: Add kkn_feedbacks table for user feedback, ratings, and suggestions

CREATE TABLE IF NOT EXISTS public.kkn_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.kkn_groups(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Saran & Masukan',
  rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kkn_feedbacks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read their own feedback or dosen group feedback" ON public.kkn_feedbacks;
DROP POLICY IF EXISTS "Authenticated users can read feedbacks" ON public.kkn_feedbacks;
DROP POLICY IF EXISTS "Users can insert feedback" ON public.kkn_feedbacks;
DROP POLICY IF EXISTS "Users or Dosen can update feedback" ON public.kkn_feedbacks;
DROP POLICY IF EXISTS "Users can delete own feedback" ON public.kkn_feedbacks;

-- RLS Policies
-- 1. All authenticated users (Dosen & Mahasiswa) can read all feedbacks
CREATE POLICY "Authenticated users can read feedbacks"
  ON public.kkn_feedbacks FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Authenticated users can insert feedback
CREATE POLICY "Users can insert feedback"
  ON public.kkn_feedbacks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Authenticated users (Dosen & Mahasiswa) can update feedback / response
CREATE POLICY "Users or Dosen can update feedback"
  ON public.kkn_feedbacks FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Users can delete their own feedback
CREATE POLICY "Users can delete own feedback"
  ON public.kkn_feedbacks FOR DELETE
  USING (auth.uid() = user_id);
