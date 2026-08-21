import type { Pattern } from './pattern';
import { RING_LED_COUNT } from './pattern';

/**
 * Semantic colour tokens (RRGGBB, no '#') mapping health states to device colours.
 * `healthy` and `critical` intentionally match the device's own green/red presets.
 */
export const palette = {
  healthy: '00ff00',
  warning: 'ffaa00',
  critical: 'ff0000',
  deploying: '1496ff',
  idle: '101820',
} as const;

export type SemanticColor = keyof typeof palette;

/**
 * Shown when no binding claims any target. An explicit dim standby glow on both
 * rings — arbitration must never emit an empty render.
 */
export const IDLE_PATTERN: Pattern = {
  top: { segments: [{ pos: 0, count: RING_LED_COUNT, color: palette.idle }] },
  bottom: { segments: [{ pos: 0, count: RING_LED_COUNT, color: palette.idle }] },
};
