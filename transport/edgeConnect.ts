// EdgeConnect transport (Phase 4). Delegates the actual GET to a backend app function
// (`api/ufo-render`) running in the Dynatrace runtime. Because that fetch is server-side, it
// can READ the device's response — so this transport reports *confirmed* delivery and a
// readable GET /info, neither of which the browser beacon can provide. The request reaches a
// private device through a matching Dynatrace EdgeConnect host pattern; egress is gated by the
// environment's External Requests allowlist (Settings > General > External requests).

import { functions } from '@dynatrace-sdk/app-utils';
import { encodePattern, PatternEncodeError } from '../lib/ufo/encode';
import type { Pattern } from '../lib/ufo/pattern';
import type {
  InfoResult,
  RenderOutcome,
  UfoDevice,
  UfoProxyRequest,
  UfoProxyResult,
  UfoTransport,
} from './types';

/** Name of the backend app function (file: `api/ufo-render.function.ts`). */
export const UFO_RENDER_FUNCTION = 'ufo-render';

/** At most one render per device per this window (mirrors the browser beacon). */
export const MIN_RENDER_INTERVAL_MS = 2000;

type EdgeState = {
  /** The last encoded `/api?...` we dispatched, for change-detection. */
  lastEncoded: string | null;
  /** Epoch-ms of the last dispatch, for rate-limiting. */
  lastSentAt: number;
};

// Module-level so de-dupe and rate-limiting survive re-renders and per-call transport
// instances, keyed by the stable deviceId. Independent of the beacon's own state map.
const stateByDevice = new Map<string, EdgeState>();

function proxyRequest(device: UfoDevice, path: string): UfoProxyRequest {
  return {
    protocol: device.protocol,
    host: device.host,
    path,
    ...(device.port !== undefined ? { port: device.port } : {}),
  };
}

async function callProxy(req: UfoProxyRequest): Promise<UfoProxyResult> {
  // `functions.call` rejects on a non-2xx *from the function itself* (i.e. the function
  // crashed, not the device). Our function always returns 200 with a structured result, so a
  // rejection here means the function/tunnel path is unavailable — the caller treats a thrown
  // error as "couldn't attempt" and may fall back to the browser beacon.
  const response = await functions.call(UFO_RENDER_FUNCTION, { data: req });
  const parsed: unknown = await response.json();
  return parsed as UfoProxyResult;
}

/**
 * Create an EdgeConnect transport for one device. Encodes a pattern, suppresses no-op and
 * too-frequent renders, then delivers via the backend proxy and reports confirmed delivery.
 */
export function createEdgeConnectTransport(device: UfoDevice): UfoTransport {
  return {
    kind: 'edge-connect',

    async render(pattern: Pattern): Promise<RenderOutcome> {
      let encodedPath: string;
      try {
        encodedPath = encodePattern(pattern);
      } catch (err) {
        const message =
          err instanceof PatternEncodeError || err instanceof Error ? err.message : String(err);
        return { attempted: false, error: message };
      }

      const state = stateByDevice.get(device.deviceId) ?? { lastEncoded: null, lastSentAt: 0 };

      // Change-detection: never re-send a pattern the device already shows.
      if (state.lastEncoded === encodedPath) {
        return { attempted: false, skipped: 'unchanged', encodedLength: encodedPath.length };
      }

      // Rate-limit: at most one dispatch per device per MIN_RENDER_INTERVAL_MS.
      const now = Date.now();
      if (now - state.lastSentAt < MIN_RENDER_INTERVAL_MS) {
        return { attempted: false, skipped: 'rate-limited', encodedLength: encodedPath.length };
      }

      // Optimistically record intent so a burst of renders de-dupes / rate-limits.
      stateByDevice.set(device.deviceId, { lastEncoded: encodedPath, lastSentAt: now });

      let result: UfoProxyResult;
      try {
        result = await callProxy(proxyRequest(device, encodedPath));
      } catch (err) {
        // The function/tunnel path failed. Roll back the change-marker (keep lastSentAt to
        // preserve rate-limiting) so a retry isn't swallowed as "unchanged".
        stateByDevice.set(device.deviceId, { lastEncoded: state.lastEncoded, lastSentAt: now });
        const message = err instanceof Error ? err.message : String(err);
        return { attempted: false, attemptedAt: now, encodedLength: encodedPath.length, error: message };
      }

      if (result.outcome === 'delivered') {
        return { attempted: true, delivered: true, attemptedAt: now, encodedLength: encodedPath.length };
      }
      if (result.outcome === 'device-error') {
        return {
          attempted: true,
          delivered: false,
          attemptedAt: now,
          encodedLength: encodedPath.length,
          error: `device returned HTTP ${result.status} ${result.statusText}`,
        };
      }
      // Unreachable: roll back the change-marker so a retry can proceed, and report why.
      stateByDevice.set(device.deviceId, { lastEncoded: state.lastEncoded, lastSentAt: now });
      return { attempted: false, attemptedAt: now, encodedLength: encodedPath.length, error: result.error };
    },

    async readInfo(): Promise<InfoResult> {
      let result: UfoProxyResult;
      try {
        result = await callProxy(proxyRequest(device, '/info'));
      } catch (err) {
        return { supported: false, reason: err instanceof Error ? err.message : String(err) };
      }
      if (result.outcome === 'delivered') {
        try {
          return { supported: true, info: JSON.parse(result.body) as unknown };
        } catch {
          // Not JSON — hand back the raw body rather than failing.
          return { supported: true, info: result.body };
        }
      }
      if (result.outcome === 'device-error') {
        return { supported: false, reason: `device returned HTTP ${result.status} ${result.statusText}` };
      }
      return { supported: false, reason: result.error };
    },
  };
}
