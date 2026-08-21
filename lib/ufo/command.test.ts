import { buildCommandPattern, buildLogoState, buildRingState, whirlSpeedByte } from './command';
import { encodePattern } from './encode';
import type { UfoCommand } from './command';

describe('whirlSpeedByte', () => {
  it('maps the 1-10 dial across a wide, perceptible device range', () => {
    expect(whirlSpeedByte(1)).toBe(55);
    expect(whirlSpeedByte(5)).toBe(144);
    expect(whirlSpeedByte(10)).toBe(255);
  });

  it('clamps out-of-range dials before mapping', () => {
    expect(whirlSpeedByte(0)).toBe(55);
    expect(whirlSpeedByte(42)).toBe(255);
  });
});

describe('buildRingState', () => {
  it('lights a single arc from position 0 and always whirls it clockwise for "right"', () => {
    const state = buildRingState({ color: '#FF0000', direction: 'right', speed: 10, ledCount: 5 });
    expect(state.segments).toEqual([{ pos: 0, count: 5, color: 'ff0000' }]);
    expect(state.animation).toEqual({ kind: 'whirl', speed: 255, ccw: false });
  });

  it('rotates counter-clockwise for the "left" direction', () => {
    const state = buildRingState({ color: '0000ff', direction: 'left', speed: 1, ledCount: 3 });
    expect(state.animation).toEqual({ kind: 'whirl', speed: 55, ccw: true });
  });

  it('clamps the LED count into the 1-15 ring range', () => {
    expect(buildRingState({ color: '00ff00', direction: 'right', speed: 5, ledCount: 99 }).segments[0]?.count).toBe(15);
    expect(buildRingState({ color: '00ff00', direction: 'right', speed: 5, ledCount: 0 }).segments[0]?.count).toBe(1);
  });
});

describe('buildLogoState', () => {
  it('applies one normalised colour to all four logo LEDs', () => {
    expect(buildLogoState('#1496FF')).toEqual(['1496ff', '1496ff', '1496ff', '1496ff']);
  });
});

describe('buildCommandPattern', () => {
  const command: UfoCommand = {
    top: { color: '#ff0000', direction: 'right', speed: 10, ledCount: 15 },
    bottom: { color: '#0000ff', direction: 'left', speed: 1, ledCount: 3 },
    logoColor: '#1496ff',
  };

  it('produces a device request the encoder accepts', () => {
    const encoded = encodePattern(buildCommandPattern(command));
    expect(encoded).toBe(
      '/api?top_init&top=0|15|ff0000&top_whirl=255&bottom_init&bottom=0|3|0000ff&bottom_whirl=55|ccw&logo=1496ff|1496ff|1496ff|1496ff',
    );
  });
});
