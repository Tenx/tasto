export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function methodNotAllowed(allowed) {
  return json(
    { error: 'Method not allowed' },
    405,
    { Allow: allowed.join(', ') },
  );
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);
  if (!origin) return false;
  try {
    return new URL(origin).host === requestUrl.host;
  } catch {
    return false;
  }
}

export function clientIp(request) {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
