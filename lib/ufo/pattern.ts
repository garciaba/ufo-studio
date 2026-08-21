// Core visual vocabulary for the Dynatrace UFO device.
// Pure types and constants — no runtime dependencies, no imports.

/** Geometry: each of the two rings has 15 addressable LEDs (positions 0-14). */
export const RING_LED_COUNT = 15;

/** Geometry: the logo has exactly four LEDs. */
export const LOGO_LED_COUNT = 4;

/** A contiguous run of LEDs on a ring. `pos` is 0-14; `pos + count` must be <= 15. */
export type Segment = {
  readonly pos: number;
  readonly count: number;
  /** RRGGBB hex, no leading '#'. Sent to the device verbatim (no byte-swizzling). */
  readonly color: string;
};

/** A ring animation. A ring may carry at most one. */
export type Animation =
  | { readonly kind: 'whirl'; readonly speed: number; readonly ccw: boolean }
  | { readonly kind: 'morph'; readonly periodMs: number; readonly speed: number };

/** The full state of one 15-LED ring. */
export type RingState = {
  readonly segments: readonly Segment[];
  /** RRGGBB background colour behind the segments. */
  readonly background?: string;
  readonly animation?: Animation;
};

/** The four logo LEDs (RRGGBB each), or the sentinel restoring factory colours. */
export type LogoState = readonly [string, string, string, string] | 'reset';

/** A complete, device-ready visual. An absent ring/logo is left untouched. */
export type Pattern = {
  readonly top?: RingState;
  readonly bottom?: RingState;
  readonly logo?: LogoState;
};

/** The three independently addressable render targets on a device. */
export const RENDER_TARGETS = ['top', 'bottom', 'logo'] as const;
export type RenderTarget = (typeof RENDER_TARGETS)[number];

/**
 * What a single binding wants to show. `ring` is applied to whichever ring
 * targets ('top'/'bottom') the binding claims; `logo` supplies the logo target.
 */
export type PatternFragment = {
  readonly ring?: RingState;
  readonly logo?: LogoState;
};
