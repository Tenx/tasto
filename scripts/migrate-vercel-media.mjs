import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { del, put } from '@vercel/blob';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, index), value];
      }),
  );
}

function extractObject(source, variableName) {
  const match = source.match(new RegExp(`const\\s+${variableName}\\s*=\\s*({[\\s\\S]*?\\n});`));
  if (!match) throw new Error(`Cannot find ${variableName} in index.html`);
  return Function(`"use strict"; return (${match[1]});`)();
}

function extractStyleTitle(source, styleKey) {
  const escaped = styleKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`\\n\\s*${escaped}:\\s*{\\s*title:\\s*(['"])(.*?)\\1`));
  return match ? match[2] : styleKey.replaceAll('_', ' ').toUpperCase();
}

function contentType(filename) {
  return {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

try {
  const localEnv = parseEnv(await readFile(path.join(projectDir, '.env.local'), 'utf8'));
  Object.assign(process.env, localEnv);
} catch {
  // CI or an already-exported shell may provide the variables directly.
}

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) throw new Error('DATABASE_URL is missing. Run `vercel env pull .env.local`.');
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is missing. Connect Vercel Blob first.');

const source = await readFile(path.join(projectDir, 'index.html'), 'utf8');
const categories = extractObject(source, 'vibeCategories');
const categoryLabels = extractObject(source, 'CATEGORY_LABELS');
const categoryOrder = Object.keys(categoryLabels);
const images = extractObject(source, 'styleImageMap');
const { db, ensureSchema } = await import('../lib/server/db.mjs');
await ensureSchema();
const sql = db();
const existing = await sql`select menu_path from tasto_images`;
const existingPaths = new Set(existing.map((row) => row.menu_path));

let created = 0;
let skipped = 0;
for (const [index, [styleKey, relativePath]] of Object.entries(images).entries()) {
  const category = categories[styleKey];
  const menuPath = `${category}/${styleKey}`;
  if (existingPaths.has(menuPath)) {
    skipped += 1;
    continue;
  }

  const absolutePath = path.join(projectDir, relativePath);
  const bytes = await readFile(absolutePath);
  const filename = path.basename(relativePath);
  const title = extractStyleTitle(source, styleKey);
  const blob = await put(`tasto/${category}/${styleKey}/${filename}`, bytes, {
    access: 'public',
    addRandomSuffix: true,
    contentType: contentType(filename),
  });

  try {
    await sql`
      insert into tasto_images
        (status, sort, menu_path, title, alt_text, image_url, blob_pathname, content_type, size_bytes)
      values
         ('published', ${categoryOrder.indexOf(category) * 100 + index}, ${menuPath}, ${title},
         ${`${title} — ${categoryLabels[category]} visual style preview`},
         ${blob.url}, ${blob.pathname}, ${contentType(filename)}, ${bytes.length})
    `;
    created += 1;
    console.log(`Uploaded ${created}: ${menuPath}`);
  } catch (error) {
    await del(blob.url).catch(() => {});
    throw error;
  }
}

console.log(`Migration complete: ${created} created, ${skipped} existing records kept.`);
