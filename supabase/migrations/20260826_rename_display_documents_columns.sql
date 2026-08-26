-- Rename land_key and land_id columns to line_key and line_id in display_documents
ALTER TABLE public.display_documents RENAME COLUMN land_key TO line_key;
ALTER TABLE public.display_documents RENAME COLUMN land_id TO line_id;

-- Drop old index on land_id and create index on line_id
DROP INDEX IF EXISTS display_documents_land_id_idx;
CREATE INDEX IF NOT EXISTS display_documents_line_id_idx ON public.display_documents (line_id);
