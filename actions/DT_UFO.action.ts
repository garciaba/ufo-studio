import { userLogger, UnsuccessfulActionError } from '@dynatrace-sdk/automation-action-utils/actions';
import { appSettingsObjectsClient } from '@dynatrace-sdk/client-app-settings-v2';
import { buildCommandPattern, type RingDirection, type RingCommand } from '../lib/ufo/command';
import { encodePattern } from '../lib/ufo/encode';

// Sensible fallbacks so a freshly-added action (device picked, rings untouched)
// still delivers something visible. These mirror the widget's display defaults.
const DEFAULT_RING_COLOR = '#1496ff';
const DEFAULT_LOGO_COLOR = '#ffffff';
const DEFAULT_SPEED = 5;
const DEFAULT_LED_COUNT = 5;

/** Flat input shape the config widget stores on the action. All fields optional. */
interface DtUfoActionInput {
  connectionId?: string;
  topColor?: string;
  topDirection?: string;
  topSpeed?: number | string;
  topLedCount?: number | string;
  bottomColor?: string;
  bottomDirection?: string;
  bottomSpeed?: number | string;
  bottomLedCount?: number | string;
  logoColor?: string;
}

/** The relevant slice of a `ufo-device` settings object's value. */
interface UfoDeviceValue {
  host?: string;
  protocol?: string;
  port?: number;
}

function toDirection(value: string | undefined): RingDirection {
  return value === 'left' ? 'left' : 'right';
}

function toNumber(value: number | string | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toColor(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function ringFromInput(
  color: string | undefined,
  direction: string | undefined,
  speed: number | string | undefined,
  ledCount: number | string | undefined,
): RingCommand {
  return {
    color: toColor(color, DEFAULT_RING_COLOR),
    direction: toDirection(direction),
    speed: toNumber(speed, DEFAULT_SPEED),
    ledCount: toNumber(ledCount, DEFAULT_LED_COUNT),
  };
}

function buildBaseUrl(protocol: string, host: string, port: number | undefined): string {
  const authority = port ? `${host}:${port}` : host;
  return `${protocol}://${authority}`;
}

export default async (payload: unknown) => {
  const input = (payload ?? {}) as DtUfoActionInput;

  if (!input.connectionId) {
    throw new UnsuccessfulActionError("Input field 'connectionId' is missing. Please select a UFO device.");
  }

  // Resolve the selected device from the fleet (ufo-device settings object).
  const connectionObject = await appSettingsObjectsClient.getAppSettingsObjectByObjectId({
    objectId: input.connectionId,
  });
  const device = (connectionObject.value ?? {}) as UfoDeviceValue;

  const host = device.host;
  if (!host) {
    throw new UnsuccessfulActionError(
      'The selected UFO device has no host configured. Add it to the fleet in the UFO app, then re-select it.',
    );
  }
  const protocol = device.protocol === 'https' ? 'https' : 'http';
  const port = typeof device.port === 'number' ? device.port : undefined;
  const baseUrl = buildBaseUrl(protocol, host, port);

  // Compose the device request from the same shared core the widget's Test button uses.
  const command = {
    top: ringFromInput(input.topColor, input.topDirection, input.topSpeed, input.topLedCount),
    bottom: ringFromInput(input.bottomColor, input.bottomDirection, input.bottomSpeed, input.bottomLedCount),
    logoColor: toColor(input.logoColor, DEFAULT_LOGO_COLOR),
  };

  let path: string;
  try {
    path = encodePattern(buildCommandPattern(command));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new UnsuccessfulActionError(`Could not compose the UFO command: ${message}`);
  }
  const url = `${baseUrl}${path}`;

  userLogger.info(`Sending command to UFO ${host} (${baseUrl}): ${url}`);

  // The direct fetch is transparently routed through EdgeConnect for hosts that
  // match a configured pattern, so it can reach a UFO on a private network.
  let status = 'sent';
  let responseStatus: number | null = null;

  try {
    const response = await fetch(url);
    responseStatus = response.status;
    if (response.ok) {
      userLogger.info(`UFO responded with status ${response.status}.`);
      status = 'success';
    } else {
      userLogger.warn(`UFO responded with error status ${response.status}.`);
      status = 'error';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    userLogger.warn(
      `Could not reach UFO at ${baseUrl}: ${message}. The command was generated but the device may not be reachable from this runtime.`,
    );
    status = 'unreachable';
  }

  return {
    host,
    endpoint: baseUrl,
    url,
    status,
    responseStatus,
    top: command.top,
    bottom: command.bottom,
    logoColor: command.logoColor,
  };
};
