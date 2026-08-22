-- Migration: Drop NOT NULL constraint on "mesin" column in production log tables
-- prod_mesin_settings DILEWATI: kolom mesin adalah Primary Key di sana (PK implisit NOT NULL, tidak bisa diubah)

ALTER TABLE public.prod_production_log      ALTER COLUMN mesin DROP NOT NULL;
ALTER TABLE public.prod_downtime_log        ALTER COLUMN mesin DROP NOT NULL;
ALTER TABLE public.prod_production_planning ALTER COLUMN mesin DROP NOT NULL;
ALTER TABLE public.prod_dandori_log         ALTER COLUMN mesin DROP NOT NULL;
