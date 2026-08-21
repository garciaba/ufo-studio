import type { Animation, LogoState, Pattern, RingState, Segment } from './pattern';
import { RING_LED_COUNT } from './pattern';

/**
 * Maximum length of the encoded `/api?...` request target the ESP8266's small
 * request-line buffer will accept. Compiling anything longer is a hard error.
 */
export const MAX_ENCODED_URL_LENGTH = 450;

const HEX_COLOR = /^[0-9a-fA-F]{6}$/;
const MIN_SPEED = 0;
const MAX_SPEED = 255;

/** Thrown when a Pattern cannot be turned into a valid device request. */
export class PatternEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatternEncodeError';
  }
}

function assertColor(value: string, context: string): void {
  if (!HEX_COLOR.test(value)) {
    throw new PatternEncodeError(
      `Invalid ${context}: "${value}". Expected a 6-digit RRGGBB hex colour with no leading '#'.`,
    );
  }
}

function assertSpeed(value: number, context: string): void {
  if (!Number.isInteger(value) || value < MIN_SPEED || value > MAX_SPEED) {
    throw new PatternEncodeError(
      `Invalid ${context}: ${value}. Expected an integer between ${MIN_SPEED} and ${MAX_SPEED}.`,
    );
  }
}

function encodeSegment(segment: Segment): string {
  const { pos, count, color } = segment;
  if (!Number.isInteger(pos) || pos < 0 || pos > RING_LED_COUNT - 1) {
    throw new PatternEncodeError(
      `Invalid segment position ${pos}. Expected an integer between 0 and ${RING_LED_COUNT - 1}.`,
    );
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new PatternEncodeError(
      `Invalid segment count ${count}. Expected an integer of at least 1.`,
    );
  }
  if (pos + count > RING_LED_COUNT) {
    throw new PatternEncodeError(
      `Segment overflows the ring: pos ${pos} + count ${count} exceeds ${RING_LED_COUNT} LEDs.`,
    );
  }
  assertColor(color, 'segment colour');
  return `${pos}|${count}|${color}`;
}

function encodeAnimation(ring: 'top' | 'bottom', animation: Animation): string {
  if (animation.kind === 'whirl') {
    assertSpeed(animation.speed, `${ring} whirl speed`);
    return `${ring}_whirl=${animation.speed}${animation.ccw ? '|ccw' : ''}`;
  }
  assertSpeed(animation.speed, `${ring} morph speed`);
  if (!Number.isInteger(animation.periodMs) || animation.periodMs < 0) {
    throw new PatternEncodeError(
      `Invalid ${ring} morph period ${animation.periodMs}. Expected a non-negative integer (milliseconds).`,
    );
  }
  return `${ring}_morph=${animation.periodMs}|${animation.speed}`;
}

// Canonical per-ring parameter order the firmware expects:
// <ring>_init (clears the buffer) → <ring>= segments → <ring>_bg → animation.
function encodeRing(ring: 'top' | 'bottom', state: RingState): string[] {
  const parts: string[] = [`${ring}_init`];
  if (state.segments.length > 0) {
    parts.push(`${ring}=${state.segments.map(encodeSegment).join('|')}`);
  }
  if (state.background !== undefined) {
    assertColor(state.background, `${ring} background colour`);
    parts.push(`${ring}_bg=${state.background}`);
  }
  if (state.animation !== undefined) {
    parts.push(encodeAnimation(ring, state.animation));
  }
  return parts;
}

function encodeLogo(logo: LogoState): string {
  if (logo === 'reset') {
    return 'logo_reset';
  }
  logo.forEach((color, index) => assertColor(color, `logo colour ${index + 1}`));
  return `logo=${logo.join('|')}`;
}

/**
 * Compile a Pattern into the device's `/api?...` request target.
 *
 * Pipe separators are left literal on purpose: the firmware's string splitter
 * expects them unescaped, so the result must NOT be percent-encoded.
 */
export function encodePattern(pattern: Pattern): string {
  const params: string[] = [];
  if (pattern.top !== undefined) {
    params.push(...encodeRing('top', pattern.top));
  }
  if (pattern.bottom !== undefined) {
    params.push(...encodeRing('bottom', pattern.bottom));
  }
  if (pattern.logo !== undefined) {
    params.push(encodeLogo(pattern.logo));
  }

  const encoded = `/api?${params.join('&')}`;
  if (encoded.length > MAX_ENCODED_URL_LENGTH) {
    throw new PatternEncodeError(
      `Encoded UFO request is ${encoded.length} characters, over the ${MAX_ENCODED_URL_LENGTH}-character ` +
        `device limit. Simplify the pattern (fewer segments or animations) for this device.`,
    );
  }
  return encoded;
}
