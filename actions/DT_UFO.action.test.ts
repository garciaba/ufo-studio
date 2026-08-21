import dtUfo from './DT_UFO.action';
import { buildMockedFetchResponse } from './test-utils';

describe('DT_UFO', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    // Clean up the mock to prevent interference with other tests
    fetchMock.mockClear();
  });

  it('sends a colour command to the selected fleet UFO device', async () => {
    fetchMock.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/app-settings/v2/objects/')) {
        return buildMockedFetchResponse({
          objectId: 'ufo-device-object-id',
          value: { displayName: 'Lab UFO', host: 'ufo.example', protocol: 'http', enabled: true },
          summary: 'Lab UFO (http://ufo.example)',
        });
      }
      return buildMockedFetchResponse({});
    });

    const result = await dtUfo({
      connectionId: 'ufo-device-object-id',
      topColor: '#ff0000',
      bottomColor: '#ff0000',
      logoColor: '#ff0000',
      topDirection: 'right',
      bottomDirection: 'right',
      topSpeed: 10,
      bottomSpeed: 10,
      topLedCount: 15,
      bottomLedCount: 15,
    });

    expect(result.status).toBe('success');
    expect(result.host).toBe('ufo.example');
    expect(result.endpoint).toBe('http://ufo.example');
    expect(result.url).toBe(
      'http://ufo.example/api?top_init&top=0|15|ff0000&top_whirl=255&bottom_init&bottom=0|15|ff0000&bottom_whirl=255&logo=ff0000|ff0000|ff0000|ff0000',
    );
  });

  it('honours protocol and port configured on the device', async () => {
    fetchMock.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/app-settings/v2/objects/')) {
        return buildMockedFetchResponse({
          objectId: 'ufo-device-object-id',
          value: { displayName: 'Secure UFO', host: 'ufo.demo', protocol: 'https', port: 8443, enabled: true },
          summary: 'Secure UFO (https://ufo.demo)',
        });
      }
      return buildMockedFetchResponse({});
    });

    const result = await dtUfo({
      connectionId: 'ufo-device-object-id',
      topColor: '#00ff00',
      bottomColor: '#00ff00',
      logoColor: '#00ff00',
    });

    expect(result.endpoint).toBe('https://ufo.demo:8443');
    expect(result.url.startsWith('https://ufo.demo:8443/api?')).toBe(true);
  });

  it('encodes each ring spin direction, speed and lit-LED count independently', async () => {
    fetchMock.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/app-settings/v2/objects/')) {
        return buildMockedFetchResponse({
          objectId: 'ufo-device-object-id',
          value: { displayName: 'Lab UFO', host: 'ufo.example', protocol: 'http', enabled: true },
          summary: 'Lab UFO (http://ufo.example)',
        });
      }
      return buildMockedFetchResponse({});
    });

    const result = await dtUfo({
      connectionId: 'ufo-device-object-id',
      topColor: '#112233',
      topDirection: 'right',
      topSpeed: 10,
      topLedCount: 5,
      bottomColor: '#445566',
      bottomDirection: 'left',
      bottomSpeed: 1,
      bottomLedCount: 15,
      logoColor: '#778899',
    });

    expect(result.url).toContain('top=0|5|112233');
    expect(result.url).toContain('top_whirl=255');
    expect(result.url).toContain('bottom=0|15|445566');
    expect(result.url).toContain('bottom_whirl=55|ccw');
    expect(result.url).toContain('logo=778899|778899|778899|778899');
  });

  it('throws when no device is selected', async () => {
    await expect(dtUfo({ topColor: '#ff0000' })).rejects.toThrow(/connectionId/);
  });
});
