import { clearSessionCookie } from '../lib/server/auth.mjs';
import { assertSameOrigin, json, methodNotAllowed } from '../lib/server/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin' }, 403);
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': clearSessionCookie(request) },
    );
  },
};
