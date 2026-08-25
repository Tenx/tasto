import assert from 'node:assert/strict';
import test from 'node:test';
import adminImages from '../api/admin-images.mjs';
import adminLogin from '../api/admin-login.mjs';
import adminLogout from '../api/admin-logout.mjs';
import adminSession from '../api/admin-session.mjs';
import {
  createSessionToken,
  verifySessionToken,
} from '../lib/server/auth.mjs';
import {
  isValidMenuPath,
  MENU_CHOICES,
} from '../lib/catalog-taxonomy.mjs';

process.env.TASTO_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

test('taxonomy contains exactly the 38 managed TASTO menu paths', () => {
  assert.equal(MENU_CHOICES.length, 38);
  assert.equal(new Set(MENU_CHOICES.map(([value]) => value)).size, 38);
  assert.equal(isValidMenuPath('minimal_modern/swiss_style'), true);
  assert.equal(isValidMenuPath('unknown/style'), false);
});

test('signed admin sessions validate and reject tampering', () => {
  const token = createSessionToken();
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken(`${token.slice(0, -1)}x`), false);
});

test('session endpoint reports unauthenticated without a cookie', async () => {
  const response = await adminSession.fetch(new Request('https://www.tasto.world/api/admin-session'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('admin data endpoint rejects unauthenticated requests before touching storage', async () => {
  const response = await adminImages.fetch(new Request('https://www.tasto.world/api/admin-images'));
  assert.equal(response.status, 401);
});

test('login rejects cross-origin submissions before checking a password', async () => {
  const response = await adminLogin.fetch(new Request('https://www.tasto.world/api/admin-login', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example' },
    body: '{}',
  }));
  assert.equal(response.status, 403);
});

test('logout clears the HttpOnly same-site cookie', async () => {
  const response = await adminLogout.fetch(new Request('https://www.tasto.world/api/admin-logout', {
    method: 'POST',
    headers: { Origin: 'https://www.tasto.world' },
  }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=0/);
});
