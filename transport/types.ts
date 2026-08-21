// Delivery layer for the UFO device. Turns a device-ready `Pattern` (from the pure
// `lib/ufo` core) into an actual request to a physical UFO. The core knows *what* to
// show; a transport knows *how* to get it there.
//
// Two transports are foreseen:
//   - browser-beacon  (Phase 2, implemented): the browser fires a fire-and-forget GET
//     straight at the device on the local network. The device answers without CORS
//     headers, so the response is opaque — we learn that a request was *dispatched*,
//     never that it was *delivered*.
//   - edge-connect    (implemented in edgeConnect.ts): the request is tunnelled through a
//     Dynatrace EdgeConnect via a backend app function, which *can* read the device's
//     response and so confirms delivery and can read `GET /info`.

import type { Pattern } from '../lib/ufo/pattern';

/** How a device is reached at the network level. */
export type UfoProtocol = 'http' | 'https';

/**
 * A single addressable UFO. This mirrors the `ufo-device` app-settings schema; the
 * `host` is a bare hostname or IP with no scheme and no path (the transport adds those).
 */
export type UfoDevice = {
  /** Stable, app-generated identifier (independent of the settings object id). */
  readonly deviceId: string;
  readonly displayName: string;
  /** Bare hostname or IP, e.g. `192.168.1.42` or `ufo.local`. No scheme, no path. */
  readonly host: string;
  readonly protocol: UfoProtocol;
  /** Optional TCP port; omitted means the protocol default (80/443). */
  readonly port?: number;
  readonly organization?: string;
  readonly department?: string;
  readonly location?: string;
  /** Disabled devices are shown but never receive renders. */
  readonly enabled: boolean;
};

/** Why a render was intentionally not dispatched (a non-error outcome). */
export type RenderSkipReason = 'disabled' | 'unchanged' | 'rate-limited';

/**
 * The result of asking a transport to render a pattern. A resolved `render()` with
 * `attempted: true` means the request was *handed to the browser* — for the browser
 * beacon that is the strongest guarantee available, since the response is opaque.
 */
export type RenderOutcome = {
  /** True only when a network request was actually dispatched. */
  readonly attempted: boolean;
  /** EdgeConnect only: the device confirmed receipt (HTTP 2xx). The browser beacon never sets this. */
  readonly delivered?: boolean;
  /** Present when the render was deliberately not sent. */
  readonly skipped?: RenderSkipReason;
  /** Length of the encoded `/api?...` target, when one was produced. */
  readonly encodedLength?: number;
  /** Epoch-ms at which dispatch was attempted, for honest "last attempted at" UI. */
  readonly attemptedAt?: number;
  /** Set when the browser could not even dispatch the request (offline, bad host, …). */
  readonly error?: string;
};

/**
 * The device's `GET /info`. Only a transport that can read the device response (i.e.
 * EdgeConnect) can return `supported: true`; the browser beacon always reports why not.
 */
export type InfoResult =
  | { readonly supported: true; readonly info: unknown }
  | { readonly supported: false; readonly reason: string };

/** Discriminator for the concrete transport in use. */
export type UfoTransportKind = 'browser-beacon' | 'edge-connect';

/**
 * The delivery contract shared by every transport. Callers depend only on this, so a
 * future EdgeConnect transport is a drop-in replacement.
 */
export interface UfoTransport {
  readonly kind: UfoTransportKind;
  /** Encode and deliver a pattern. Never throws for network failure — see `RenderOutcome.error`. */
  render(pattern: Pattern): Promise<RenderOutcome>;
  /** Read the device's `GET /info`, when the transport can. */
  readInfo(): Promise<InfoResult>;
}

/**
 * One GET the EdgeConnect proxy app function (`api/ufo-render`) performs against a device.
 * `path` is an absolute path beginning with '/', e.g. an encoded `/api?...` or `/info`.
 */
export type UfoProxyRequest = {
  readonly protocol: UfoProtocol;
  readonly host: string;
  readonly port?: number;
  readonly path: string;
};

/** The structured result the proxy app function returns for a single GET. */
export type UfoProxyResult =
  | { readonly outcome: 'delivered'; readonly status: number; readonly statusText: string; readonly body: string }
  | { readonly outcome: 'device-error'; readonly status: number; readonly statusText: string; readonly body: string }
  | { readonly outcome: 'unreachable'; readonly error: string };
