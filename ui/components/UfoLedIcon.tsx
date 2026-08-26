import React, { useEffect } from 'react';
import { RING_LED_COUNT } from '../../lib/ufo/pattern';
import type { LogoState, Pattern, RingState } from '../../lib/ufo/pattern';

/**
 * A compact CSS-only replica of a UFO's two LED rings plus its logo core. It renders the exact
 * same `Pattern` the app last pushed to a device, so each fleet card carries a live-ish glyph of
 * what that UFO is showing. Nothing here talks to hardware — the device can't be read back, so the
 * icon mirrors the last pattern *this app applied*, not any externally-set state.
 */

/** RRGGBB (no '#') shown for "off"/idle LEDs so an unlit UFO reads as a neutral grey glyph, not a black disc. */
const OFF = '9aa4b0';
const HEX6 = /^[0-9a-fA-F]{6}$/;

/** Dark backing/separator colour so the rings read as concentric bands, not one solid disc. */
const BACKING = '#0b0e14';

function hex(color: string | undefined): string {
  return color && HEX6.test(color) ? `#${color}` : `#${OFF}`;
}

/** Expand a ring's background + segments into one colour per physical LED. */
function ledColors(ring: RingState | undefined): string[] {
  const base = ring?.background && HEX6.test(ring.background) ? ring.background : OFF;
  const leds = new Array<string>(RING_LED_COUNT).fill(base);
  for (const seg of ring?.segments ?? []) {
    for (let i = 0; i < seg.count; i += 1) {
      const idx = seg.pos + i;
      if (idx >= 0 && idx < RING_LED_COUNT) {
        leds[idx] = HEX6.test(seg.color) ? seg.color : base;
      }
    }
  }
  return leds;
}

/** Build a hard-stop conic-gradient (one arc per entry), starting at 12 o'clock. */
function conicFrom(colors: readonly string[]): string {
  const step = 360 / colors.length;
  const stops = colors
    .map((c, i) => `${hex(c)} ${(i * step).toFixed(3)}deg ${((i + 1) * step).toFixed(3)}deg`)
    .join(', ');
  return `conic-gradient(from -90deg, ${stops})`;
}

function ringGradient(ring: RingState | undefined): string {
  return conicFrom(ledColors(ring));
}

function logoGradient(logo: LogoState | undefined): string {
  if (!logo || logo === 'reset') {
    return `#${OFF}`;
  }
  return conicFrom(logo);
}

/** Map a whirl animation to a CSS rotation; a higher device speed spins in a shorter period. */
function spinStyle(ring: RingState | undefined): React.CSSProperties {
  const anim = ring?.animation;
  if (!anim || anim.kind !== 'whirl') {
    return {};
  }
  const seconds = Math.max(1.6, 9 - (anim.speed / 255) * 7);
  return {
    animation: `${anim.ccw ? 'ufo-spin-ccw' : 'ufo-spin-cw'} ${seconds.toFixed(2)}s linear infinite`,
  };
}

let keyframesInjected = false;

/** Inject the two spin keyframes once per document (idempotent, guarded for SSR-less runtime). */
function useSpinKeyframes(): void {
  useEffect(() => {
    if (keyframesInjected || typeof document === 'undefined') {
      return;
    }
    keyframesInjected = true;
    const style = document.createElement('style');
    style.textContent =
      '@keyframes ufo-spin-cw{to{transform:rotate(360deg)}}' +
      '@keyframes ufo-spin-ccw{to{transform:rotate(-360deg)}}';
    document.head.appendChild(style);
  }, []);
}

export type UfoLedIconProps = {
  /** The pattern to mirror. When omitted, the icon shows a neutral grey "off" glyph. */
  readonly pattern?: Pattern;
  /** Outer diameter in pixels. */
  readonly size?: number;
  /** Fade + desaturate the glyph, e.g. for a device that isn't connected. */
  readonly dimmed?: boolean;
};

/**
 * Concentric layers (painted outermost-first, later layers cover the centre of earlier discs so
 * each reads as a ring): outer top ring, dark gap, inner bottom ring, dark gap, 4-quadrant logo.
 */
export function UfoLedIcon({ pattern, size = 44, dimmed = false }: UfoLedIconProps): React.ReactElement {
  useSpinKeyframes();

  const disc: React.CSSProperties = { position: 'absolute', borderRadius: '50%' };

  return (
    <div
      aria-hidden
      data-dt-name="ufo-led-icon"
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: '50%',
        background: BACKING,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.45)',
        opacity: dimmed ? 0.5 : 1,
        filter: dimmed ? 'grayscale(1) brightness(0.8)' : 'none',
        transition: 'opacity 150ms ease, filter 150ms ease',
      }}
    >
      <div style={{ ...disc, inset: '6%', background: ringGradient(pattern?.top), ...spinStyle(pattern?.top) }} />
      <div style={{ ...disc, inset: '26%', background: BACKING }} />
      <div style={{ ...disc, inset: '30%', background: ringGradient(pattern?.bottom), ...spinStyle(pattern?.bottom) }} />
      <div style={{ ...disc, inset: '52%', background: BACKING }} />
      <div style={{ ...disc, inset: '56%', background: logoGradient(pattern?.logo) }} />
    </div>
  );
}
