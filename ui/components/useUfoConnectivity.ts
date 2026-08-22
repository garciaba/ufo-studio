import { useEffect, useState } from 'react';
import type { UfoDevice } from '../../transport/types';
import { createEdgeConnectTransport } from '../../transport/edgeConnect';

/** Live reachability of a device, resolved by probing it rather than by any stored flag. */
export type ConnectivityStatus = 'checking' | 'connected' | 'disconnected';

/**
 * Probe each device's reachability by reading `GET /info` through EdgeConnect. A device counts as
 * `connected` only when the backend actually read a 2xx response from it; anything else (EdgeConnect
 * not configured, device offline, non-2xx) is reported as `disconnected`. The set is re-probed
 * whenever the devices or their endpoints change.
 */
export function useUfoConnectivity(
  devices: readonly UfoDevice[],
): Record<string, ConnectivityStatus> {
  const [statusById, setStatusById] = useState<Record<string, ConnectivityStatus>>({});

  // A stable key describing every device + endpoint we depend on; drives the effect below.
  const signature = devices
    .map((d) => `${d.deviceId}@${d.protocol}://${d.host}:${d.port ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    setStatusById(Object.fromEntries(devices.map((d) => [d.deviceId, 'checking' as const])));

    void Promise.all(
      devices.map(async (device) => {
        const info = await createEdgeConnectTransport(device).readInfo();
        if (cancelled) {
          return;
        }
        setStatusById((prev) => ({
          ...prev,
          [device.deviceId]: info.supported ? 'connected' : 'disconnected',
        }));
      }),
    );

    return () => {
      cancelled = true;
    };
    // `signature` fully captures the identity of every device/endpoint the probes depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return statusById;
}
