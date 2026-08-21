import { encodePattern, MAX_ENCODED_URL_LENGTH, PatternEncodeError } from './encode';
import type { Pattern } from './pattern';

describe('encodePattern — golden fixtures (device-authoritative)', () => {
  // Each case is [label, Pattern, exact `/api?...` string read off the physical device].
  const cases: Array<[string, Pattern, string]> = [
    [
      'logo colours',
      { logo: ['ff0000', '00ff00', '0000ff', 'ff00cc'] },
      '/api?logo=ff0000|00ff00|0000ff|ff00cc',
    ],
    ['logo reset', { logo: 'reset' }, '/api?logo_reset'],
    [
      'both rings cleared (idle/off)',
      { top: { segments: [] }, bottom: { segments: [] } },
      '/api?top_init&bottom_init',
    ],
    [
      'green fill, slow morph 1000|5',
      {
        top: {
          segments: [{ pos: 0, count: 15, color: '00ff00' }],
          animation: { kind: 'morph', periodMs: 1000, speed: 5 },
        },
        bottom: {
          segments: [{ pos: 0, count: 15, color: '00ff00' }],
          animation: { kind: 'morph', periodMs: 1000, speed: 5 },
        },
      },
      '/api?top_init&top=0|15|00ff00&top_morph=1000|5&bottom_init&bottom=0|15|00ff00&bottom_morph=1000|5',
    ],
    [
      'red fill, fast morph 80|8',
      {
        top: {
          segments: [{ pos: 0, count: 15, color: 'ff0000' }],
          animation: { kind: 'morph', periodMs: 80, speed: 8 },
        },
        bottom: {
          segments: [{ pos: 0, count: 15, color: 'ff0000' }],
          animation: { kind: 'morph', periodMs: 80, speed: 8 },
        },
      },
      '/api?top_init&top=0|15|ff0000&top_morph=80|8&bottom_init&bottom=0|15|ff0000&bottom_morph=80|8',
    ],
    [
      'red top, green bottom',
      {
        top: { segments: [{ pos: 0, count: 15, color: 'ff0000' }] },
        bottom: { segments: [{ pos: 0, count: 15, color: '00ff00' }] },
      },
      '/api?top_init&top=0|15|ff0000&bottom_init&bottom=0|15|00ff00',
    ],
    [
      'single pixel, background and whirl (ccw + cw)',
      {
        top: {
          segments: [{ pos: 0, count: 1, color: 'ff0000' }],
          background: '00ff00',
          animation: { kind: 'whirl', speed: 240, ccw: true },
        },
        bottom: {
          segments: [{ pos: 0, count: 1, color: '00ff00' }],
          background: 'ff0000',
          animation: { kind: 'whirl', speed: 190, ccw: false },
        },
      },
      '/api?top_init&top=0|1|ff0000&top_bg=00ff00&top_whirl=240|ccw&bottom_init&bottom=0|1|00ff00&bottom_bg=ff0000&bottom_whirl=190',
    ],
  ];

  it.each(cases)('round-trips byte-identically: %s', (_label, pattern, expected) => {
    expect(encodePattern(pattern)).toBe(expected);
  });
});

describe('encodePattern — validation', () => {
  it('rejects a segment that overflows the ring', () => {
    expect(() => encodePattern({ top: { segments: [{ pos: 14, count: 3, color: 'ff0000' }] } })).toThrow(
      PatternEncodeError,
    );
  });

  it('rejects pos + count > 15 at the boundary', () => {
    expect(() => encodePattern({ top: { segments: [{ pos: 1, count: 15, color: 'ff0000' }] } })).toThrow(
      /exceeds 15/,
    );
  });

  it('accepts pos + count === 15 at the boundary', () => {
    expect(encodePattern({ top: { segments: [{ pos: 1, count: 14, color: 'ff0000' }] } })).toBe(
      '/api?top_init&top=1|14|ff0000',
    );
  });

  it('rejects malformed colours (non-hex, leading #, wrong length)', () => {
    expect(() => encodePattern({ top: { segments: [{ pos: 0, count: 1, color: 'xyz' }] } })).toThrow(
      PatternEncodeError,
    );
    expect(() => encodePattern({ top: { segments: [{ pos: 0, count: 1, color: '#ff0000' }] } })).toThrow(
      /RRGGBB/,
    );
    expect(() => encodePattern({ logo: ['ff0000', '00ff00', '0000ff', 'nothex'] })).toThrow(
      PatternEncodeError,
    );
  });

  it('rejects out-of-range whirl speed', () => {
    expect(() =>
      encodePattern({ top: { segments: [], animation: { kind: 'whirl', speed: 256, ccw: false } } }),
    ).toThrow(/between 0 and 255/);
    expect(() =>
      encodePattern({ top: { segments: [], animation: { kind: 'whirl', speed: -1, ccw: false } } }),
    ).toThrow(PatternEncodeError);
  });

  it('rejects out-of-range morph speed and negative periods', () => {
    expect(() =>
      encodePattern({ top: { segments: [], animation: { kind: 'morph', periodMs: 1000, speed: 999 } } }),
    ).toThrow(PatternEncodeError);
    expect(() =>
      encodePattern({ top: { segments: [], animation: { kind: 'morph', periodMs: -1, speed: 5 } } }),
    ).toThrow(PatternEncodeError);
  });

  it(`fails clearly when the encoded URL exceeds ${MAX_ENCODED_URL_LENGTH} characters`, () => {
    const segments = Array.from({ length: 60 }, (_v, i) => ({ pos: i % 15, count: 1, color: 'ff00cc' }));
    expect(() => encodePattern({ top: { segments } })).toThrow(/450-character/);
  });
});
