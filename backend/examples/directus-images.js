/**
 * Minimal browser-side helpers for the Directus image backend.
 * Copy the functions you need into the existing static frontend.
 */

const DIRECTUS_URL = 'http://localhost:8055';

export function directusImageUrl(
  fileId,
  { width, height, fit = 'cover', quality = 82, format = 'auto' } = {},
) {
  const url = new URL(`/assets/${fileId}`, DIRECTUS_URL);

  if (width) url.searchParams.set('width', width);
  if (height) url.searchParams.set('height', height);
  if (width || height) url.searchParams.set('fit', fit);
  url.searchParams.set('quality', quality);
  url.searchParams.set('format', format);

  return url.toString();
}

export async function listImages({ folderId, limit = 100 } = {}) {
  const url = new URL('/files', DIRECTUS_URL);
  url.searchParams.set(
    'fields',
    'id,title,description,type,width,height,filesize,folder,tags,uploaded_on',
  );
  url.searchParams.set('filter[type][_starts_with]', 'image/');
  url.searchParams.set('sort', '-uploaded_on');
  url.searchParams.set('limit', String(limit));

  if (folderId) url.searchParams.set('filter[folder][_eq]', folderId);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directus request failed: ${response.status}`);
  }

  const { data } = await response.json();
  return data.map((file) => ({
    ...file,
    src: directusImageUrl(file.id),
    thumbnail: directusImageUrl(file.id, { width: 640, height: 480 }),
  }));
}
