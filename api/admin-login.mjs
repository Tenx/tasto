import {
  checkLoginAllowed,
  createSessionToken,
  sessionCookie,
  verifyPassword,
} from '../lib/server/auth.mjs';
import { assertSameOrigin, json, methodNotAllowed } from '../lib/server/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin' }, 403);
    try {
      if (!(await checkLoginAllowed(request))) {
        return json({ error: '尝试次数过多，请 15 分钟后再试。' }, 429);
      }
      const body = await request.json();
      if (!(await verifyPassword(request, body.password))) {
        return json({ error: '密码不正确。' }, 401);
      }
      return json(
        { ok: true },
        200,
        { 'Set-Cookie': sessionCookie(request, createSessionToken()) },
      );
    } catch (error) {
      console.error('login error', error);
      return json({ error: '登录服务暂时不可用。' }, 503);
    }
  },
};
