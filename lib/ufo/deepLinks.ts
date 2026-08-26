/**
 * Deep-link contract between the workflow action widget and the app UI: the widget's
 * "Add a new UFO" button opens the app with this query param, and the app auto-opens
 * its Add UFO device modal when it sees it. Shared here so both sides stay in sync.
 */
export const ADD_DEVICE_QUERY_PARAM = 'addDevice';

/** Build the app URL that auto-opens the Add UFO device modal. */
export function buildAddDeviceUrl(environmentUrl: string, appId: string): string {
  const base = environmentUrl.replace(/\/+$/, '');
  return `${base}/ui/apps/${appId}?${ADD_DEVICE_QUERY_PARAM}=1`;
}
