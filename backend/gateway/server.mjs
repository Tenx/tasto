import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';

const port = Number(process.env.PORT || 8060);
const uploadsDir = '/uploads';
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'database',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_DATABASE || 'directus',
  user: process.env.DB_USER || 'tasto_gateway',
  password: process.env.DB_PASSWORD,
  max: 5,
  statement_timeout: 5000,
});

if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD is required');

function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function requestBaseUrl(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || 'http';
  const host = request.headers.host || `localhost:${port}`;
  return `${protocol}://${host}`;
}

async function catalog(request, response) {
  const { rows } = await pool.query(
    `select id, sort, menu_path, title, alt_text, image
       from tasto_public_catalog
      order by sort nulls last, id`,
  );
  const baseUrl = requestBaseUrl(request);
  const data = rows.map((item) => ({
    ...item,
    image_url: `${baseUrl}/images/${item.image}`,
  }));
  response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  json(response, 200, { data });
}

function imageOptions(requestUrl) {
  const searchParams = requestUrl.searchParams;
  return {
    width: Math.min(Math.max(Number(searchParams.get('width')) || 0, 0), 2400),
    height: Math.min(Math.max(Number(searchParams.get('height')) || 0, 0), 2400),
    quality: Math.min(Math.max(Number(searchParams.get('quality')) || 82, 30), 95),
    fit: ['cover', 'contain', 'inside', 'outside'].includes(searchParams.get('fit'))
      ? searchParams.get('fit')
      : 'cover',
    format: ['auto', 'jpg', 'png', 'webp', 'avif'].includes(searchParams.get('format'))
      ? searchParams.get('format')
      : 'auto',
  };
}

function outputFormat(request, requested) {
  if (requested !== 'auto') return requested;
  const accept = request.headers.accept || '';
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpg';
}

async function image(request, requestUrl, response, fileId) {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    json(response, 400, { error: 'Invalid image id' });
    return;
  }

  const { rows } = await pool.query(
    `select filename_disk, type
       from tasto_public_catalog
      where image = $1
      limit 1`,
    [fileId],
  );
  if (!rows.length) {
    json(response, 404, { error: 'Image not found' });
    return;
  }

  const filename = rows[0].filename_disk;
  if (!filename || path.basename(filename) !== filename) {
    json(response, 404, { error: 'Image file unavailable' });
    return;
  }

  const options = imageOptions(requestUrl);
  const format = outputFormat(request, options.format);
  let transformer = sharp({ failOn: 'error', animated: true });
  if (options.width || options.height) {
    transformer = transformer.resize({
      width: options.width || undefined,
      height: options.height || undefined,
      fit: options.fit,
      withoutEnlargement: true,
    });
  }
  if (format === 'avif') transformer = transformer.avif({ quality: options.quality });
  else if (format === 'webp') transformer = transformer.webp({ quality: options.quality });
  else if (format === 'png') transformer = transformer.png({ quality: options.quality });
  else transformer = transformer.jpeg({ quality: options.quality });

  response.statusCode = 200;
  response.setHeader('Content-Type', `image/${format === 'jpg' ? 'jpeg' : format}`);
  response.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  createReadStream(path.join(uploadsDir, filename))
    .on('error', () => {
      if (!response.headersSent) json(response, 404, { error: 'Image file unavailable' });
      else response.destroy();
    })
    .pipe(transformer)
    .on('error', () => response.destroy())
    .pipe(response);
}

const server = http.createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url || '/', requestBaseUrl(request));
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      await pool.query('select 1');
      json(response, 200, { status: 'ok' });
      return;
    }
    if (request.method === 'GET' && requestUrl.pathname === '/catalog') {
      await catalog(request, response);
      return;
    }
    const imageMatch = requestUrl.pathname.match(/^\/images\/([0-9a-f-]{36})$/i);
    if (request.method === 'GET' && imageMatch) {
      await image(request, requestUrl, response, imageMatch[1]);
      return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    json(response, 502, { error: 'Media backend unavailable' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`TASTO media gateway listening on ${port}`);
});
