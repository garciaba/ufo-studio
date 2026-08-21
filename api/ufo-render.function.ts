// Backend proxy for the EdgeConnect transport. Runs server-side in the Dynatrace runtime,
// so unlike a browser beacon it can READ the device's response — enabling confirmed delivery
// and a readable GET /info. Outbound egress is gated by the environment's External Requests
// allowlist (Settings > General > External requests); the request reaches a private device
// transparently when its host matches a configured Dynatrace EdgeConnect host pattern.
import type { UfoProxyRequest, UfoProxyResult } from '../transport/types';

/** Validate the untyped payload before composing a URL (defense against malformed/SSRF input). */
function isValidRequest(payload: unknown): payload is UfoProxyRequest {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const r = payload as Record<string, unknown>;
  if (r.protocol !== 'http' && r.protocol !== 'https') {
    return false;
  }
  if (typeof r.host !== 'string' || r.host.length === 0 || /[\s/]/.test(r.host)) {
    return false;
  }
  if (typeof r.path !== 'string' || !r.path.startsWith('/')) {
    return false;
  }
  if (r.port !== undefined && (typeof r.port !== 'number' || !Number.isInteger(r.port))) {
    return false;
  }
  return true;
}

export default async function ufoRender(payload: unknown): Promise<UfoProxyResult> {
  if (!isValidRequest(payload)) {
    console.warn('[ufo-render] rejected invalid request payload');
    return { outcome: 'unreachable', error: 'Invalid device request (protocol, host, or path).' };
  }

  const port = payload.port !== undefined ? `:${payload.port}` : '';
  const url = `${payload.protocol}://${payload.host}${port}${payload.path}`;
  console.info(`[ufo-render] GET ${url}`);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', cache: 'no-store' });
  } catch (err) {
    // The fetch never got an HTTP response: host not allowlisted, EdgeConnect down/unrouted,
    // DNS failure, or the device is offline.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ufo-render] unreachable ${url}: ${message}`);
    return { outcome: 'unreachable', error: message };
  }

  const body = await response.text().catch(() => '');
  if (response.ok) {
    console.info(`[ufo-render] delivered HTTP ${response.status} ${url}`);
    return { outcome: 'delivered', status: response.status, statusText: response.statusText, body };
  }
  // Reached and answered, but the device rejected the request (non-2xx).
  console.warn(`[ufo-render] device-error HTTP ${response.status} ${url}`);
  return { outcome: 'device-error', status: response.status, statusText: response.statusText, body };
}
