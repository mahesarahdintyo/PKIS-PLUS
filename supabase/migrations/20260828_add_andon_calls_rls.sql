-- =========================================================
-- MIGRATION: Add RLS Policies for andon_calls, andon_leaders, push_subscriptions
-- =========================================================

-- 1. ANDON_CALLS RLS Policies
ALTER TABLE public.andon_calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid duplicate conflicts
DROP POLICY IF EXISTS "Login bisa lihat andon_calls" ON public.andon_calls;
DROP POLICY IF EXISTS "Login bisa tambah andon_calls" ON public.andon_calls;
DROP POLICY IF EXISTS "Login/Leader/Admin bisa update andon_calls" ON public.andon_calls;
DROP POLICY IF EXISTS "Admin/Leader bisa update andon_calls" ON public.andon_calls;
DROP POLICY IF EXISTS "Admin/Leader bisa hapus andon_calls" ON public.andon_calls;

-- Select: All authenticated users can view andon calls
CREATE POLICY "Login bisa lihat andon_calls"
  ON public.andon_calls FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Authenticated users (operators & leaders) can trigger andon calls
CREATE POLICY "Login bisa tambah andon_calls"
  ON public.andon_calls FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update: Authenticated users (operators acknowledge, admin/leaders update)
CREATE POLICY "Login/Leader/Admin bisa update andon_calls"
  ON public.andon_calls FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Delete: Admin and Leader can delete andon calls
CREATE POLICY "Admin/Leader bisa hapus andon_calls"
  ON public.andon_calls FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );


-- 2. ANDON_LEADERS RLS Policies
ALTER TABLE public.andon_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Login bisa lihat andon_leaders" ON public.andon_leaders;
DROP POLICY IF EXISTS "Admin/Leader bisa insert andon_leaders" ON public.andon_leaders;
DROP POLICY IF EXISTS "Admin/Leader bisa update andon_leaders" ON public.andon_leaders;
DROP POLICY IF EXISTS "Admin/Leader bisa hapus andon_leaders" ON public.andon_leaders;

CREATE POLICY "Login bisa lihat andon_leaders"
  ON public.andon_leaders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Leader bisa insert andon_leaders"
  ON public.andon_leaders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa update andon_leaders"
  ON public.andon_leaders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa hapus andon_leaders"
  ON public.andon_leaders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );


-- 3. PUSH_SUBSCRIPTIONS RLS Policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Login bisa kelola push_subscriptions miliknya" ON public.push_subscriptions;

CREATE POLICY "Login bisa kelola push_subscriptions miliknya"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
