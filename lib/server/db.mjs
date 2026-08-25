import { neon } from '@neondatabase/serverless';

let sqlClient;
let schemaPromise;

export function db() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
  sqlClient ||= neon(databaseUrl);
  return sqlClient;
}

export function ensureSchema() {
  schemaPromise ||= (async () => {
    const sql = db();
    await sql`
      create table if not exists tasto_images (
        id uuid primary key default gen_random_uuid(),
        status text not null default 'draft'
          check (status in ('published', 'draft', 'archived')),
        sort integer,
        menu_path text not null,
        title text not null,
        alt_text text,
        image_url text not null,
        blob_pathname text not null,
        content_type text,
        size_bytes bigint,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create index if not exists tasto_images_public_order
      on tasto_images (status, sort, created_at)
    `;
    await sql`
      create table if not exists tasto_login_attempts (
        ip_hash text primary key,
        failed_count integer not null default 0,
        window_started timestamptz not null default now()
      )
    `;
  })().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}
