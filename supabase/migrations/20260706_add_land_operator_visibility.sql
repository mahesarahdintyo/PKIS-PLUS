alter table lands
add column if not exists hidden_from_operator boolean not null default false;
