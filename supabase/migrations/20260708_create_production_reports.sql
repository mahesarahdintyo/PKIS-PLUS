-- Create production_reports table with updated fields
CREATE TABLE IF NOT EXISTS public.production_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  land_id UUID REFERENCES public.lands(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  part_number TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  ng_qty INTEGER NOT NULL DEFAULT 0,
  ng_category TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on land_id and report_date for faster lookups
CREATE INDEX IF NOT EXISTS production_reports_land_id_idx ON public.production_reports (land_id);
CREATE INDEX IF NOT EXISTS production_reports_report_date_idx ON public.production_reports (report_date);

-- Enable RLS
ALTER TABLE public.production_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid duplication error)
DROP POLICY IF EXISTS "Allow public read production_reports" ON public.production_reports;
DROP POLICY IF EXISTS "Allow public insert production_reports" ON public.production_reports;
DROP POLICY IF EXISTS "Allow public update production_reports" ON public.production_reports;
DROP POLICY IF EXISTS "Allow public delete production_reports" ON public.production_reports;

-- Create Policy for public read (everyone can see reports)
CREATE POLICY "Allow public read production_reports"
  ON public.production_reports FOR SELECT
  USING (true);

-- Create Policy for public insert (operators can submit reports)
CREATE POLICY "Allow public insert production_reports"
  ON public.production_reports FOR INSERT
  WITH CHECK (true);

-- Create Policy for public update (operators/admin can edit reports)
CREATE POLICY "Allow public update production_reports"
  ON public.production_reports FOR UPDATE
  USING (true);

-- Create Policy for public delete (operators/admin can delete reports)
CREATE POLICY "Allow public delete production_reports"
  ON public.production_reports FOR DELETE
  USING (true);
