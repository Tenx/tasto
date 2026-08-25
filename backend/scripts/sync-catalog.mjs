import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const projectDir = path.resolve(backendDir, '..');

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function extractSimpleObject(source, variableName) {
  const match = source.match(
    new RegExp(`const\\s+${variableName}\\s*=\\s*({[\\s\\S]*?\\n});`),
  );
  if (!match) throw new Error(`Cannot find ${variableName} in index.html`);
  return Function(`"use strict"; return (${match[1]});`)();
}

function extractSimpleArray(source, variableName) {
  const match = source.match(
    new RegExp(`const\\s+${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);`),
  );
  if (!match) throw new Error(`Cannot find ${variableName} in index.html`);
  return Function(`"use strict"; return (${match[1]});`)();
}

function extractStyleTitle(source, styleKey) {
  const escaped = styleKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(
    new RegExp(`\\n\\s*${escaped}:\\s*{\\s*title:\\s*(['"])(.*?)\\1`),
  );
  return match ? match[2] : styleKey.replaceAll('_', ' ').toUpperCase();
}

function mimeType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }[extension] || 'application/octet-stream';
}

const env = parseEnv(await readFile(path.join(backendDir, '.env'), 'utf8'));
const source = await readFile(path.join(projectDir, 'index.html'), 'utf8');
const directusUrl = (env.PUBLIC_URL || 'http://localhost:8055').replace(/\/$/, '');
const categoryLabels = extractSimpleObject(source, 'CATEGORY_LABELS');
const categoryZh = extractSimpleObject(source, 'CATEGORY_ZH');
const vibeCategories = extractSimpleObject(source, 'vibeCategories');
const styleImageMap = extractSimpleObject(source, 'styleImageMap');
const menuTaxonomy = extractSimpleArray(source, 'MENU_TAXONOMY');
const categoryOrder = Object.keys(categoryLabels);
const menuItemByStyle = new Map(
  menuTaxonomy.flatMap((group) =>
    group.items.map(([label, zh, styleKey]) => [styleKey, { category: group.key, label, zh }]),
  ),
);

const catalog = Object.entries(styleImageMap).map(([styleKey, imagePath], index) => {
  const category = vibeCategories[styleKey];
  const menuItem = menuItemByStyle.get(styleKey);
  if (!category || !categoryLabels[category]) {
    throw new Error(`Style ${styleKey} has no valid TASTO category`);
  }
  if (!menuItem || menuItem.category !== category) {
    throw new Error(`Style ${styleKey} is missing from the matching TASTO menu directory`);
  }
  return {
    styleKey,
    category,
    menuPath: `${category}/${styleKey}`,
    menuLabel: menuItem.label,
    menuZh: menuItem.zh,
    title: extractStyleTitle(source, styleKey),
    imagePath,
    sort: categoryOrder.indexOf(category) * 100 + index,
  };
});

let token = '';

async function request(apiPath, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${directusUrl}${apiPath}`, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const reason = payload?.errors?.map((error) => error.message).join('; ') || text;
    const error = new Error(`${options.method || 'GET'} ${apiPath}: ${response.status} ${reason}`);
    error.status = response.status;
    throw error;
  }

  return payload?.data ?? payload;
}

async function exists(apiPath) {
  try {
    return await request(apiPath);
  } catch (error) {
    if (error.status === 403 || error.status === 404) return null;
    throw error;
  }
}

async function login() {
  const data = await request('/auth/login', {
    method: 'POST',
    body: {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      mode: 'json',
    },
  });
  token = data.access_token;
}

function menuChoices() {
  return catalog.map((entry) => ({
    text: `${categoryLabels[entry.category]} · ${categoryZh[entry.category]} / ${entry.menuLabel} · ${entry.menuZh}`,
    value: entry.menuPath,
  }));
}

function menuPathMeta() {
  return {
    interface: 'select-dropdown',
    options: { choices: menuChoices(), allowOther: false },
    display: 'labels',
    display_options: { choices: menuChoices() },
    note: '必选：决定图片显示在 TASTO 的哪个菜单目录。',
    required: true,
    width: 'full',
    sort: 3,
  };
}

async function ensureCollection() {
  if (await exists('/collections/tasto_images')) {
    await request('/fields/tasto_images/menu_path', {
      method: 'PATCH',
      body: { meta: menuPathMeta() },
    });
    return;
  }

  await request('/collections', {
    method: 'POST',
    body: {
      collection: 'tasto_images',
      meta: {
        icon: 'photo_library',
        note: 'TASTO 前端图片。每张图片必须选择一个菜单目录。',
        display_template: '{{title}} · {{menu_path}}',
        sort_field: 'sort',
        archive_field: 'status',
        archive_value: 'archived',
        unarchive_value: 'published',
      },
      schema: {},
      fields: [
        {
          field: 'status',
          type: 'string',
          meta: {
            interface: 'select-dropdown',
            options: {
              choices: [
                { text: 'Published / 前端显示', value: 'published' },
                { text: 'Draft / 暂不显示', value: 'draft' },
                { text: 'Archived / 已归档', value: 'archived' },
              ],
            },
            display: 'labels',
            required: true,
            width: 'half',
            sort: 1,
          },
          schema: { default_value: 'published', is_nullable: false, max_length: 20 },
        },
        {
          field: 'sort',
          type: 'integer',
          meta: { interface: 'input', width: 'half', sort: 2 },
          schema: { is_nullable: true },
        },
        {
          field: 'menu_path',
          type: 'string',
          meta: menuPathMeta(),
          schema: { is_nullable: false, max_length: 255 },
        },
        {
          field: 'title',
          type: 'string',
          meta: {
            interface: 'input',
            note: '前端图片卡片标题；留用英文风格名称最稳妥。',
            required: true,
            width: 'half',
            sort: 4,
          },
          schema: { is_nullable: false, max_length: 255 },
        },
        {
          field: 'alt_text',
          type: 'string',
          meta: {
            interface: 'input',
            note: '无障碍图片说明；不填时使用标题和目录自动生成。',
            width: 'half',
            sort: 5,
          },
          schema: { is_nullable: true, max_length: 500 },
        },
        {
          field: 'image',
          type: 'uuid',
          meta: {
            special: ['file'],
            interface: 'file-image',
            display: 'image',
            note: '上传或选择要在前端展示的图片。',
            required: true,
            width: 'full',
            sort: 6,
          },
          schema: { is_nullable: false },
        },
      ],
    },
  });
}

async function ensureImageRelation() {
  if (await exists('/relations/tasto_images/image')) return;
  await request('/relations', {
    method: 'POST',
    body: {
      collection: 'tasto_images',
      field: 'image',
      related_collection: 'directus_files',
      meta: { one_deselect_action: 'nullify' },
      schema: { on_delete: 'RESTRICT' },
    },
  });
}

async function findFolder(name, parent) {
  const params = new URLSearchParams({
    limit: '1',
    'filter[name][_eq]': name,
  });
  if (parent) params.set('filter[parent][_eq]', parent);
  else params.set('filter[parent][_null]', 'true');
  const folders = await request(`/folders?${params}`);
  return folders[0] || null;
}

async function ensureFolder(name, parent = null) {
  const existing = await findFolder(name, parent);
  if (existing) return existing;
  return request('/folders', { method: 'POST', body: { name, parent } });
}

async function buildFolderTree() {
  const root = await ensureFolder('TASTO Website');
  const folders = new Map();

  for (const [categoryIndex, category] of categoryOrder.entries()) {
    const number = String(categoryIndex + 1).padStart(2, '0');
    const categoryFolder = await ensureFolder(
      `${number} ${categoryLabels[category]} · ${categoryZh[category]}`,
      root.id,
    );
    for (const entry of catalog.filter((item) => item.category === category)) {
      const styleFolder = await ensureFolder(entry.title, categoryFolder.id);
      folders.set(entry.menuPath, styleFolder.id);
    }
  }

  return folders;
}

async function existingItems() {
  const params = new URLSearchParams({
    fields: 'id,menu_path,title,image,status,sort',
    limit: '-1',
  });
  return request(`/items/tasto_images?${params}`);
}

async function uploadImage(entry, folderId) {
  const absolutePath = path.join(projectDir, entry.imagePath);
  const bytes = await readFile(absolutePath);
  const filename = path.basename(absolutePath);
  const form = new FormData();
  form.set('title', entry.title);
  form.set('folder', folderId);
  form.set('file', new File([bytes], filename, { type: mimeType(filename) }));
  return request('/files', { method: 'POST', body: form });
}

async function seedImages(folders) {
  const items = await existingItems();
  const byMenuPath = new Map(items.map((item) => [item.menu_path, item]));
  let created = 0;
  let skipped = 0;

  for (const entry of catalog) {
    if (byMenuPath.has(entry.menuPath)) {
      skipped += 1;
      continue;
    }

    const file = await uploadImage(entry, folders.get(entry.menuPath));
    await request('/items/tasto_images', {
      method: 'POST',
      body: {
        status: 'published',
        sort: entry.sort,
        menu_path: entry.menuPath,
        title: entry.title,
        alt_text: `${entry.title} — ${categoryLabels[entry.category]} visual style preview`,
        image: file.id,
      },
    });
    created += 1;
    console.log(`Imported ${created}/${catalog.length}: ${entry.menuPath}`);
  }

  return { created, skipped };
}

await login();
await ensureCollection();
await ensureImageRelation();
const folders = await buildFolderTree();
const result = await seedImages(folders);

console.log(
  `Done. ${result.created} image records created, ${result.skipped} existing records kept.`,
);
