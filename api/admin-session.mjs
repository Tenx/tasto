import { isAdmin } from '../lib/server/auth.mjs';
import { json, methodNotAllowed } from '../lib/server/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    return json({ authenticated: isAdmin(request) });
  },
};
