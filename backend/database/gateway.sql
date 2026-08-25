\set ON_ERROR_STOP on

select format(
  'create role tasto_gateway login password %L',
  :'gateway_password'
)
where not exists (select 1 from pg_roles where rolname = 'tasto_gateway')
\gexec

select format(
  'alter role tasto_gateway with login password %L',
  :'gateway_password'
)
\gexec

alter role tasto_gateway set default_transaction_read_only = on;
grant connect on database directus to tasto_gateway;
grant usage on schema public to tasto_gateway;

create or replace view public.tasto_public_catalog
with (security_barrier = true)
as
select
  ti.id,
  ti.sort,
  ti.menu_path,
  ti.title,
  ti.alt_text,
  ti.image,
  df.filename_disk,
  df.filename_download,
  df.type,
  df.width,
  df.height,
  df.filesize
from public.tasto_images as ti
join public.directus_files as df on df.id = ti.image
where ti.status = 'published';

revoke all on public.tasto_public_catalog from public;
grant select on public.tasto_public_catalog to tasto_gateway;
