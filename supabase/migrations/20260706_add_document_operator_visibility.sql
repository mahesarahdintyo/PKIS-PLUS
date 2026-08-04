alter table documents
add column if not exists hidden_from_operator boolean not null default false;
