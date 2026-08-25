import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { db, ensureSchema } from './db.mjs';
import { clientIp } from './http.mjs';

const COOKIE_NAME = 'tasto_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MINUTES = 15;
const MAX_LOGIN_FAILURES = 5;

function secret() {
  const value = process.env.TASTO_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('TASTO_SESSION_SECRET must contain at least 32 characters');
  }
  return value;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(unsigned) {
  return createHmac('sha256', secret()).update(unsigned).digest('base64url');
}

export function createSessionToken() {
  const payload = encode(JSON.stringify({
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  }));
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(unsigned));
  const received = Buffer.from(parts[2]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload.role === 'admin' && Number(payload.exp) > Date.now() / 1000;
  } catch {
    return false;
  }
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('='))
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function isAdmin(request) {
  return verifySessionToken(parseCookies(request)[COOKIE_NAME]);
}

export function sessionCookie(request, token) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function passwordMatches(candidate) {
  const configured = process.env.TASTO_ADMIN_PASSWORD;
  if (!configured || configured.length < 12) {
    throw new Error('TASTO_ADMIN_PASSWORD must contain at least 12 characters');
  }
  const left = createHash('sha256').update(String(candidate || '')).digest();
  const right = createHash('sha256').update(configured).digest();
  return timingSafeEqual(left, right);
}

function loginHash(request) {
  return createHmac('sha256', secret()).update(clientIp(request)).digest('hex');
}

export async function checkLoginAllowed(request) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    select failed_count, window_started
    from tasto_login_attempts
    where ip_hash = ${loginHash(request)}
  `;
  if (!rows.length) return true;
  const elapsed = Date.now() - new Date(rows[0].window_started).getTime();
  if (elapsed > LOGIN_WINDOW_MINUTES * 60 * 1000) return true;
  return Number(rows[0].failed_count) < MAX_LOGIN_FAILURES;
}

export async function verifyPassword(request, candidate) {
  await ensureSchema();
  const sql = db();
  const ipHash = loginHash(request);
  if (passwordMatches(candidate)) {
    await sql`delete from tasto_login_attempts where ip_hash = ${ipHash}`;
    return true;
  }
  await sql`
    insert into tasto_login_attempts (ip_hash, failed_count, window_started)
    values (${ipHash}, 1, now())
    on conflict (ip_hash) do update set
      failed_count = case
        when tasto_login_attempts.window_started < now() - interval '15 minutes' then 1
        else tasto_login_attempts.failed_count + 1
      end,
      window_started = case
        when tasto_login_attempts.window_started < now() - interval '15 minutes' then now()
        else tasto_login_attempts.window_started
      end
  `;
  return false;
}
