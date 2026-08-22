-- Migration: Rename lands to lines and land_id to line_id across all relevant tables

-- 1. Rename table lands -> lines
ALTER TABLE IF EXISTS public.lands RENAME TO lines;

-- 2. Rename column land_id -> line_id in profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'land_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN land_id TO line_id;
  END IF;
END $$;

-- 3. Rename column land_id -> line_id in documents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'land_id'
  ) THEN
    ALTER TABLE public.documents RENAME COLUMN land_id TO line_id;
  END IF;
END $$;

-- 4. Rename column land_id -> line_id in folders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'folders' AND column_name = 'land_id'
  ) THEN
    ALTER TABLE public.folders RENAME COLUMN land_id TO line_id;
  END IF;
END $$;

-- 5. Rename column land_id -> line_id in production_reports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'production_reports' AND column_name = 'land_id'
  ) THEN
    ALTER TABLE public.production_reports RENAME COLUMN land_id TO line_id;
  END IF;
END $$;

-- 6. Rename column land_id -> line_id in display_heartbeats
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'display_heartbeats' AND column_name = 'land_id'
  ) THEN
    ALTER TABLE public.display_heartbeats RENAME COLUMN land_id TO line_id;
  END IF;
END $$;

-- 7. Update indexes and foreign keys if necessary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'documents_land_id_idx'
  ) THEN
    ALTER INDEX public.documents_land_id_idx RENAME TO documents_line_id_idx;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'folders_land_id_idx'
  ) THEN
    ALTER INDEX public.folders_land_id_idx RENAME TO folders_line_id_idx;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'production_reports_land_id_idx'
  ) THEN
    ALTER INDEX public.production_reports_land_id_idx RENAME TO production_reports_line_id_idx;
  END IF;
END $$;
