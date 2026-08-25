import { del, put } from '@vercel/blob';
import { isAdmin } from '../lib/server/auth.mjs';
import { db, ensureSchema } from '../lib/server/db.mjs';
import { assertSameOrigin, json, methodNotAllowed } from '../lib/server/http.mjs';
import { isValidMenuPath, MENU_CHOICES } from '../lib/catalog-taxonomy.mjs';

const IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function status(value) {
  return ['published', 'draft', 'archived'].includes(value) ? value : null;
}

function sortValue(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function safeFilename(filename) {
  const clean = String(filename || 'image')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100);
  return clean || 'image';
}

function validateRecord(input, requireImage = false) {
  const record = {
    id: text(input.id, 40),
    status: status(text(input.status, 20)),
    sort: sortValue(input.sort),
    menu_path: text(input.menu_path, 180),
    title: text(input.title, 120),
    alt_text: text(input.alt_text, 300) || null,
    image: input.image,
  };
  if (record.id && !UUID_PATTERN.test(record.id)) return { error: '记录 ID 无效。' };
  if (!record.status) return { error: '请选择显示状态。' };
  if (!isValidMenuPath(record.menu_path)) return { error: '请选择有效的 TASTO 菜单目录。' };
  if (!record.title) return { error: '请填写图片标题。' };
  if (requireImage && (!(record.image instanceof File) || !record.image.size)) {
    return { error: '请选择要上传的图片。' };
  }
  if (record.image instanceof File && record.image.size) {
    if (!IMAGE_TYPES.has(record.image.type)) return { error: '只支持 JPG、PNG、WebP、AVIF 或 GIF 图片。' };
    if (record.image.size > MAX_IMAGE_BYTES) return { error: '图片不能超过 4 MB。' };
  }
  return { record };
}

async function listImages() {
  const rows = await db()`
    select id, status, sort, menu_path, title, alt_text, image_url,
           content_type, size_bytes, created_at, updated_at
    from tasto_images
    order by sort nulls last, created_at, id
  `;
  return json({ data: rows, menu_choices: MENU_CHOICES });
}

async function saveWithImage(record) {
  const sql = db();
  const oldRows = record.id
    ? await sql`select image_url from tasto_images where id = ${record.id}`
    : [];
  if (record.id && !oldRows.length) return json({ error: '找不到这条图片记录。' }, 404);

  const [category, style] = record.menu_path.split('/');
  const pathname = `tasto/${category}/${style}/${safeFilename(record.image.name)}`;
  let blob;
  try {
    blob = await put(pathname, record.image, {
      access: 'public',
      addRandomSuffix: true,
    });

    let rows;
    if (record.id) {
      rows = await sql`
        update tasto_images set
          status = ${record.status}, sort = ${record.sort}, menu_path = ${record.menu_path},
          title = ${record.title}, alt_text = ${record.alt_text}, image_url = ${blob.url},
          blob_pathname = ${blob.pathname}, content_type = ${record.image.type},
          size_bytes = ${record.image.size}, updated_at = now()
        where id = ${record.id}
        returning *
      `;
    } else {
      rows = await sql`
        insert into tasto_images
          (status, sort, menu_path, title, alt_text, image_url, blob_pathname, content_type, size_bytes)
        values
          (${record.status}, ${record.sort}, ${record.menu_path}, ${record.title}, ${record.alt_text},
           ${blob.url}, ${blob.pathname}, ${record.image.type}, ${record.image.size})
        returning *
      `;
    }
    if (oldRows[0]?.image_url) await del(oldRows[0].image_url).catch(console.error);
    return json({ data: rows[0] }, record.id ? 200 : 201);
  } catch (error) {
    if (blob?.url) await del(blob.url).catch(console.error);
    throw error;
  }
}

async function saveMetadata(record) {
  if (!record.id) return json({ error: '记录 ID 无效。' }, 400);
  const rows = await db()`
    update tasto_images set
      status = ${record.status}, sort = ${record.sort}, menu_path = ${record.menu_path},
      title = ${record.title}, alt_text = ${record.alt_text}, updated_at = now()
    where id = ${record.id}
    returning *
  `;
  if (!rows.length) return json({ error: '找不到这条图片记录。' }, 404);
  return json({ data: rows[0] });
}

async function deleteImage(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!UUID_PATTERN.test(id)) return json({ error: '记录 ID 无效。' }, 400);
  const rows = await db()`
    delete from tasto_images where id = ${id}
    returning image_url
  `;
  if (!rows.length) return json({ error: '找不到这条图片记录。' }, 404);
  await del(rows[0].image_url).catch((error) => console.error('blob delete error', error));
  return json({ ok: true });
}

export default {
  async fetch(request) {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
      return methodNotAllowed(['GET', 'POST', 'PATCH', 'DELETE']);
    }
    if (!isAdmin(request)) return json({ error: '请先登录。' }, 401);
    if (request.method !== 'GET' && !assertSameOrigin(request)) {
      return json({ error: 'Invalid request origin' }, 403);
    }
    try {
      await ensureSchema();
      if (request.method === 'GET') return listImages();
      if (request.method === 'DELETE') return deleteImage(request);
      if (request.method === 'PATCH') {
        const validation = validateRecord(await request.json());
        return validation.error ? json({ error: validation.error }, 400) : saveMetadata(validation.record);
      }
      const form = await request.formData();
      const validation = validateRecord(Object.fromEntries(form), !form.get('id'));
      if (validation.error) return json({ error: validation.error }, 400);
      if (!(validation.record.image instanceof File) || !validation.record.image.size) {
        return saveMetadata(validation.record);
      }
      return saveWithImage(validation.record);
    } catch (error) {
      console.error('admin images error', error);
      return json({ error: '保存失败，请稍后重试。' }, 500);
    }
  },
};
