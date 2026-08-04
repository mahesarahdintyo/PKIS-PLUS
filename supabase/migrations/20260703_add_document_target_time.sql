alter table documents
add column if not exists target_time timestamptz;
