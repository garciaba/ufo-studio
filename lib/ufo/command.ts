// Bridges the DT_UFO workflow action's flat, human-facing input (per-ring colour,
// spin direction, speed and lit-LED count) to a device-ready `Pattern`. Both the
// action runtime and its config widget compose device requests from THIS module, so
// a "Test on UFO" preview in the widget and a real workflow run encode identically.

import type { Animation, LogoState, Pattern, RingState, Segment } from './pattern';
import { RING_LED_COUNT } from './pattern';

/** Which way a ring's lit arc rotates, as surfaced in the action's form. */
export type RingDirection = 'right' | 'left';

/** The friendly per-ring speed dial: 1 = slowest visible rotation, 10 = fastest. */
export const SPEED_DIAL_MIN = 1;
export const SPEED_DIAL_MAX = 10;

/**
 * The device whirl speed is a 0-255 byte (higher = faster). The 1-10 dial is mapped
 * onto [WHIRL_BYTE_FLOOR, 255] so even the slowest setting still visibly rotates
 * instead of looking static.
 */
const WHIRL_BYTE_FLOOR = 55;
const WHIRL_BYTE_MAX = 255;

/** One ring's visual choices as made in the action form. */
export interface RingCommand {
  /** RRGGBB, with or without a leading '#'. Normalised on encode. */
  readonly color: string;
  /** Which way the lit arc rotates around the ring. */
  readonly direction: RingDirection;
  /** Friendly 1-10 speed dial, mapped to the device whirl byte on encode. */
  readonly speed: number;
  /** How many LEDs (from position 0) light up: 1-15. Fewer => visible rotation. */
  readonly ledCount: number;
}

/** The full instruction a single DT_UFO run applies to one device. */
export interface UfoCommand {
  readonly top: RingCommand;
  readonly bottom: RingCommand;
  /** RRGGBB applied to all four logo LEDs. */
  readonly logoColor: string;
}

/** Strip a leading '#' and lower-case, leaving validation to the encoder. */
function normalizeColor(hex: string): string {
  return String(hex).trim().replace(/^#/, '').toLowerCase();
}

/** Round and clamp into [min, max]; non-finite input falls back to `min`. */
function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, rounded));
}

/** Map the 1-10 speed dial onto the device whirl byte (higher = faster). */
export function whirlSpeedByte(dial: number): number {
  const clamped = clampInt(dial, SPEED_DIAL_MIN, SPEED_DIAL_MAX);
  const span = WHIRL_BYTE_MAX - WHIRL_BYTE_FLOOR;
  const byte = WHIRL_BYTE_FLOOR + ((clamped - SPEED_DIAL_MIN) / (SPEED_DIAL_MAX - SPEED_DIAL_MIN)) * span;
  return clampInt(byte, 1, WHIRL_BYTE_MAX);
}

/** Turn one ring's form choices into a device-ready RingState (always a whirl). */
export function buildRingState(ring: RingCommand): RingState {
  const color = normalizeColor(ring.color);
  const count = clampInt(ring.ledCount, 1, RING_LED_COUNT);
  const segments: Segment[] = [{ pos: 0, count, color }];
  const animation: Animation = {
    kind: 'whirl',
    speed: whirlSpeedByte(ring.speed),
    ccw: ring.direction === 'left',
  };
  return { segments, animation };
}

/** All four logo LEDs share one colour. */
export function buildLogoState(colorHex: string): LogoState {
  const color = normalizeColor(colorHex);
  return [color, color, color, color];
}

/** Compose the complete device-ready Pattern for a UFO command. */
export function buildCommandPattern(command: UfoCommand): Pattern {
  return {
    top: buildRingState(command.top),
    bottom: buildRingState(command.bottom),
    logo: buildLogoState(command.logoColor),
  };
}
