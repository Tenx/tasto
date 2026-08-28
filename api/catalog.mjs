import { db, ensureSchema } from '../lib/server/db.mjs';
import { methodNotAllowed } from '../lib/server/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    try {
      await ensureSchema();
      const rows = await db()`
        select id, sort, menu_path, title, alt_text, image_url, tier
        from tasto_images
        where status = 'published'
        order by sort nulls last, created_at, id
      `;
      return new Response(JSON.stringify({ data: rows }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('catalog error', error);
      return new Response(JSON.stringify({ error: 'Catalog unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
};
