// Browser-beacon transport (Phase 2).
//
// The browser fires a single fire-and-forget GET straight at the UFO on the local
// network. Because the device replies without CORS headers, we send with
// `mode: 'no-cors'` and receive an *opaque* response: a resolved fetch means the
// request was *dispatched*, and tells us nothing about whether the device accepted it.
// Confirmed delivery and `GET /info` require the EdgeConnect transport (transport/edgeConnect.ts).
//
// IMPORTANT (mixed content): when this app is served over https:// and a device is
// configured as http://, browsers block the request as mixed content. That surfaces
// here as a rejected fetch and is reported via `RenderOutcome.error`.

import { encodePattern, PatternEncodeError } from '../lib/ufo/encode';
import type { Pattern } from '../lib/ufo/pattern';
import type { InfoResult, RenderOutcome, UfoDevice, UfoTransport } from './types';

/** At most one render per device per this window (Prompt §2: ≤1/device/2s). */
export const MIN_RENDER_INTERVAL_MS = 2000;

type BeaconState = {
  /** The last encoded `/api?...` we dispatched, for change-detection. */
  lastEncoded: string | null;
  /** Epoch-ms of the last dispatch, for rate-limiting. */
  lastSentAt: number;
};

// Module-level so de-dupe and rate-limiting survive re-renders and per-call transport
// instances. Keyed by the stable deviceId (per-device semantics).
const beaconStateByDevice = new Map<string, BeaconState>();

function composeUrl(device: UfoDevice, encodedPath: string): string {
  const port = device.port ? `:${device.port}` : '';
  return `${device.protocol}://${device.host}${port}${encodedPath}`;
}

/**
 * Create a browser-beacon transport for one device. The returned transport encodes a
 * pattern, suppresses no-op and too-frequent renders, and dispatches an opaque GET.
 */
export function createBrowserBeaconTransport(device: UfoDevice): UfoTransport {
  return {
    kind: 'browser-beacon',

    async render(pattern: Pattern): Promise<RenderOutcome> {
      // Encode first (may reject an invalid or oversized pattern). Kept total: an
      // encode failure is reported, not thrown, so callers have one code path.
      let encodedPath: string;
      try {
        encodedPath = encodePattern(pattern);
      } catch (err) {
        const message =
          err instanceof PatternEncodeError || err instanceof Error ? err.message : String(err);
        return { attempted: false, error: message };
      }

      const state = beaconStateByDevice.get(device.deviceId) ?? { lastEncoded: null, lastSentAt: 0 };

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
      beaconStateByDevice.set(device.deviceId, { lastEncoded: encodedPath, lastSentAt: now });

      const url = composeUrl(device, encodedPath);
      try {
        // Opaque, fire-and-forget. `keepalive` lets it outlive a tab navigation.
        await fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true });
        return { attempted: true, attemptedAt: now, encodedLength: encodedPath.length };
      } catch (err) {
        // The browser refused to dispatch (offline, unresolved host, or https→http
        // mixed content). Roll back the change-marker so a retry isn't swallowed as
        // "unchanged", but keep lastSentAt to preserve rate-limiting.
        beaconStateByDevice.set(device.deviceId, {
          lastEncoded: state.lastEncoded,
          lastSentAt: now,
        });
        const message = err instanceof Error ? err.message : String(err);
        return { attempted: false, attemptedAt: now, encodedLength: encodedPath.length, error: message };
      }
    },

    readInfo(): Promise<InfoResult> {
      // No `await` needed: the browser can never read this endpoint, so the answer is static.
      return Promise.resolve({
        supported: false,
        reason:
          "Reading GET /info isn't possible from the browser: the device sends no CORS " +
          'headers, so the response is opaque. The EdgeConnect transport can read it.',
      });
    },
  };
}
