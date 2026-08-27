-- Migration: Allow all authenticated users (operator, leader, admin) to manage prod_production_planning
DROP POLICY IF EXISTS "Admin/Leader bisa tambah prod_production_planning" ON public.prod_production_planning;
DROP POLICY IF EXISTS "Admin/Leader bisa update prod_production_planning" ON public.prod_production_planning;
DROP POLICY IF EXISTS "Admin/Leader bisa hapus prod_production_planning" ON public.prod_production_planning;

CREATE POLICY "Login bisa tambah prod_production_planning" ON public.prod_production_planning
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Login bisa update prod_production_planning" ON public.prod_production_planning
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Login bisa hapus prod_production_planning" ON public.prod_production_planning
  FOR DELETE TO authenticated USING (true);
