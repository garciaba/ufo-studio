import React, { useCallback, useMemo, useState } from 'react';
import { Divider, Flex, Grid, Surface } from '@dynatrace/strato-components/layouts';
import { Button } from '@dynatrace/strato-components/buttons';
import { FormField, Label, Select } from '@dynatrace/strato-components/forms';
import { Chip, EmptyState, MessageContainer } from '@dynatrace/strato-components/content';
import { Heading, Paragraph, Text } from '@dynatrace/strato-components/typography';
import {
  useSettingsObjectsV2,
  useCreateSettingsV2,
  useDeleteSettingsV2,
} from '@dynatrace-sdk/react-hooks';
import { palette } from '../../lib/ufo/palette';
import { RING_LED_COUNT } from '../../lib/ufo/pattern';
import type { Pattern } from '../../lib/ufo/pattern';
import type { RenderOutcome, UfoDevice, UfoTransportKind } from '../../transport/types';
import { createBrowserBeaconTransport } from '../../transport/browserBeacon';
import { createEdgeConnectTransport } from '../../transport/edgeConnect';
import { AddDeviceModal, type NewDeviceInput } from './AddDeviceModal';
import { UfoLedIcon } from './UfoLedIcon';
import { useUfoConnectivity, type ConnectivityStatus } from './useUfoConnectivity';

const SCHEMA_ID = 'ufo-device';

/** A named, colour-coded smoke test the fleet table exposes as a one-click button. */
type TestPattern = {
  readonly id: string;
  readonly label: string;
  /** Button colour, constrained to the Strato Button palette. */
  readonly color: 'primary' | 'neutral' | 'success' | 'critical' | 'warning';
  readonly pattern: Pattern;
};

/**
 * Visually distinct one-click smoke tests, built only from the pure `lib/ufo` vocabulary.
 * Whirl rotates the LED buffer, so it is only visible over a NON-uniform ring — the spinning
 * tests paint a bright comet arc over a dim background, not one solid colour.
 */
const TEST_PATTERNS: readonly TestPattern[] = [
  {
    id: 'green-whirl',
    label: 'Green whirl',
    color: 'success',
    pattern: {
      top: {
        background: palette.idle,
        segments: [{ pos: 0, count: 5, color: palette.healthy }],
        animation: { kind: 'whirl', speed: 180, ccw: false },
      },
      bottom: {
        background: palette.idle,
        segments: [{ pos: 0, count: 5, color: palette.healthy }],
        animation: { kind: 'whirl', speed: 180, ccw: false },
      },
      logo: [palette.healthy, palette.healthy, palette.healthy, palette.healthy],
    },
  },
  {
    id: 'red-alert',
    label: 'Red alert',
    color: 'critical',
    pattern: {
      top: {
        background: palette.idle,
        segments: [{ pos: 0, count: 4, color: palette.critical }],
        animation: { kind: 'whirl', speed: 220, ccw: false },
      },
      bottom: {
        background: palette.idle,
        segments: [{ pos: 0, count: 4, color: palette.critical }],
        animation: { kind: 'whirl', speed: 220, ccw: true },
      },
      logo: [palette.critical, palette.critical, palette.critical, palette.critical],
    },
  },
  {
    id: 'blue-spin',
    label: 'Blue spin',
    color: 'primary',
    pattern: {
      top: {
        background: palette.idle,
        segments: [{ pos: 0, count: 5, color: palette.deploying }],
        animation: { kind: 'whirl', speed: 140, ccw: false },
      },
      bottom: {
        background: palette.idle,
        segments: [{ pos: 0, count: 5, color: palette.deploying }],
        animation: { kind: 'whirl', speed: 140, ccw: true },
      },
      logo: [palette.deploying, palette.deploying, palette.deploying, palette.deploying],
    },
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    color: 'warning',
    pattern: {
      top: {
        segments: [
          { pos: 0, count: 3, color: palette.critical },
          { pos: 3, count: 3, color: palette.warning },
          { pos: 6, count: 3, color: palette.healthy },
          { pos: 9, count: 3, color: palette.deploying },
          { pos: 12, count: 3, color: 'aa00ff' },
        ],
        animation: { kind: 'whirl', speed: 90, ccw: false },
      },
      bottom: {
        segments: [
          { pos: 0, count: 3, color: 'aa00ff' },
          { pos: 3, count: 3, color: palette.deploying },
          { pos: 6, count: 3, color: palette.healthy },
          { pos: 9, count: 3, color: palette.warning },
          { pos: 12, count: 3, color: palette.critical },
        ],
        animation: { kind: 'whirl', speed: 90, ccw: true },
      },
      logo: [palette.critical, palette.warning, palette.healthy, palette.deploying],
    },
  },
  {
    id: 'off',
    label: 'Off',
    color: 'neutral',
    pattern: {
      top: { segments: [{ pos: 0, count: RING_LED_COUNT, color: palette.idle }] },
      bottom: { segments: [{ pos: 0, count: RING_LED_COUNT, color: palette.idle }] },
      logo: [palette.idle, palette.idle, palette.idle, palette.idle],
    },
  },
];

/** A device plus the settings-object identity needed to update/delete it. */
type DeviceRow = UfoDevice & { readonly objectId: string; readonly version: string };

type NoticeTone = 'info' | 'warning' | 'critical';
type ActionNotice = { readonly tone: NoticeTone; readonly message: string };

/** Map a notice tone to the matching MessageContainer visual variant. */
function noticeVariant(tone: NoticeTone): 'primary' | 'warning' | 'critical' {
  switch (tone) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    default:
      return 'primary';
  }
}

/** Turn a transport outcome into an honest, user-facing message; only EdgeConnect can confirm delivery. */
function describeOutcome(
  outcome: RenderOutcome,
  name: string,
  label: string,
  via: UfoTransportKind,
): ActionNotice {
  const at = outcome.attemptedAt ? new Date(outcome.attemptedAt).toLocaleTimeString() : 'just now';
  if (outcome.delivered) {
    return {
      tone: 'info',
      message: `Delivered "${label}" to ${name} at ${at} — the UFO confirmed receipt (HTTP 2xx) through EdgeConnect.`,
    };
  }
  if (outcome.attempted) {
    return {
      tone: 'info',
      message:
        `Dispatched "${label}" to ${name} at ${at}. Delivery can't be confirmed from the ` +
        "browser (the device's response is opaque) — check the physical UFO to verify.",
    };
  }
  if (outcome.error) {
    const hint =
      via === 'edge-connect'
        ? ' Check that the EdgeConnect container is running, the device host is on the External Requests allowlist, and an EdgeConnect host pattern matches it.'
        : ' If the device is http:// while this app is served over https://, the browser blocks the request as mixed content.';
    return { tone: 'critical', message: `Could not deliver "${label}" to ${name}: ${outcome.error}.${hint}` };
  }
  switch (outcome.skipped) {
    case 'unchanged':
      return { tone: 'info', message: `${name} already shows "${label}" — nothing re-sent.` };
    case 'rate-limited':
      return { tone: 'warning', message: `Too soon — wait ~2s before re-sending to ${name}.` };
    default:
      return { tone: 'info', message: `Nothing was sent to ${name}.` };
  }
}

/** Send `pattern` to a device via EdgeConnect, falling back to the browser beacon only when the
 * tunnel could not attempt at all. Shared by the manual test buttons and the binding auto-driver;
 * both transports de-dupe and rate-limit per device, so repeat calls with the same pattern are no-ops. */
async function deliverPattern(
  device: UfoDevice,
  pattern: Pattern,
): Promise<{ outcome: RenderOutcome; via: UfoTransportKind }> {
  let via: UfoTransportKind = 'edge-connect';
  let outcome = await createEdgeConnectTransport(device).render(pattern);
  if (!outcome.attempted && outcome.skipped === undefined && outcome.error !== undefined) {
    const beaconOutcome = await createBrowserBeaconTransport(device).render(pattern);
    if (beaconOutcome.attempted || beaconOutcome.skipped !== undefined) {
      outcome = beaconOutcome;
      via = 'browser-beacon';
    }
  }
  return { outcome, via };
}

/** Format a device endpoint as `protocol://host[:port]` for display. */
function endpointOf(device: DeviceRow): string {
  return `${device.protocol}://${device.host}${device.port ? `:${device.port}` : ''}`;
}

/**
 * One UFO rendered as a card: an LED glyph mirroring its last-applied pattern, its name, endpoint, a
 * live connection status chip, its metadata as key/value chips, and the quick-test + remove actions
 * in the footer.
 */
function UfoCard({
  device,
  busy,
  status,
  appliedPattern,
  onTest,
  onRemove,
}: {
  readonly device: DeviceRow;
  readonly busy: boolean;
  readonly status: ConnectivityStatus;
  readonly appliedPattern?: Pattern;
  readonly onTest: (device: DeviceRow, pattern: Pattern, label: string) => void;
  readonly onRemove: (device: DeviceRow) => void;
}): React.ReactElement {
  const [selectedTest, setSelectedTest] = useState<TestPattern | null>(null);

  return (
    <Surface elevation="raised" padding={16}>
      <Flex flexDirection="column" gap={12}>
        <Flex justifyContent="space-between" alignItems="flex-start" gap={8}>
          <Flex alignItems="center" gap={12}>
            <UfoLedIcon pattern={appliedPattern} dimmed={status !== 'connected'} size={44} />
            <Flex flexDirection="column" gap={2}>
              <Heading level={3}>{device.displayName}</Heading>
              <Text textStyle="small">{endpointOf(device)}</Text>
            </Flex>
          </Flex>
          <Chip
            color={
              status === 'connected' ? 'success' : status === 'disconnected' ? 'critical' : 'neutral'
            }
            variant="accent"
          >
            {status === 'connected'
              ? 'Connected'
              : status === 'disconnected'
                ? 'Not Connected'
                : 'Checking…'}
          </Chip>
        </Flex>

        {device.organization || device.department || device.location ? (
          <Flex flexWrap="wrap" gap={4}>
            {device.organization ? (
              <Chip>
                <Chip.Key>org</Chip.Key>
                {device.organization}
              </Chip>
            ) : null}
            {device.department ? (
              <Chip>
                <Chip.Key>dept</Chip.Key>
                {device.department}
              </Chip>
            ) : null}
            {device.location ? (
              <Chip>
                <Chip.Key>site</Chip.Key>
                {device.location}
              </Chip>
            ) : null}
          </Flex>
        ) : null}

        <Divider />

        <Flex justifyContent="space-between" alignItems="flex-end" gap={8} flexWrap="wrap">
          <Flex alignItems="flex-end" gap={4}>
            <FormField>
              <Label>Test pattern</Label>
              <Select
                name={`test-pattern-${device.objectId}`}
                value={selectedTest}
                disabled={busy}
                onChange={(next) => setSelectedTest(next)}
              >
                <Select.Trigger placeholder="Select pattern" width="150px" />
                <Select.Content>
                  {TEST_PATTERNS.map((test) => (
                    <Select.Option key={test.id} value={test} textValue={test.label}>
                      {test.label}
                    </Select.Option>
                  ))}
                </Select.Content>
              </Select>
            </FormField>
            <Button
              variant="accent"
              color="primary"
              size="condensed"
              disabled={busy || !selectedTest}
              onClick={() => {
                if (selectedTest) {
                  onTest(device, selectedTest.pattern, selectedTest.label);
                }
              }}
            >
              Apply
            </Button>
          </Flex>
          <Button
            variant="default"
            color="critical"
            size="condensed"
            disabled={busy}
            onClick={() => onRemove(device)}
          >
            Remove
          </Button>
        </Flex>
      </Flex>
    </Surface>
  );
}

export function FleetList() {
  const { data, isLoading, error, refetch } = useSettingsObjectsV2({
    schemaId: SCHEMA_ID,
    addFields: 'value,summary',
  });
  const createSettings = useCreateSettingsV2();
  const deleteSettings = useDeleteSettingsV2();

  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  // Last pattern this app pushed to each device, keyed by deviceId — drives the card LED glyph.
  const [appliedById, setAppliedById] = useState<Record<string, Pattern>>({});

  const rows = useMemo<DeviceRow[]>(() => {
    const items = data?.items ?? [];
    const result: DeviceRow[] = [];
    for (const item of items) {
      // `value` is a Record<string, any> on the wire; cast through `unknown` to a typed
      // shape, then validate the fields we actually depend on.
      const value = item.value as unknown as Partial<UfoDevice> | undefined;
      if (!value) {
        continue;
      }
      const { displayName, host } = value;
      if (typeof displayName !== 'string' || displayName.length === 0) {
        continue;
      }
      if (typeof host !== 'string' || host.length === 0) {
        continue;
      }
      result.push({
        objectId: item.objectId,
        version: item.version,
        deviceId:
          typeof value.deviceId === 'string' && value.deviceId.length > 0
            ? value.deviceId
            : item.objectId,
        displayName,
        host,
        protocol: value.protocol === 'https' ? 'https' : 'http',
        ...(typeof value.port === 'number' ? { port: value.port } : {}),
        ...(typeof value.organization === 'string' ? { organization: value.organization } : {}),
        ...(typeof value.department === 'string' ? { department: value.department } : {}),
        ...(typeof value.location === 'string' ? { location: value.location } : {}),
      });
    }
    return result;
  }, [data]);

  const connectivityById = useUfoConnectivity(rows);

  const handleSendPattern = useCallback(
    async (device: DeviceRow, pattern: Pattern, label: string) => {
      setBusyDeviceId(device.deviceId);
      try {
        const { outcome, via } = await deliverPattern(device, pattern);
        // Mirror the pattern on the card's LED glyph whenever we actually dispatched (or delivered) it.
        if (outcome.attempted || outcome.delivered) {
          setAppliedById((prev) => ({ ...prev, [device.deviceId]: pattern }));
        }
        // Quick-test feedback goes to the browser console only, never the UI. Failures log as errors.
        const note = describeOutcome(outcome, device.displayName, label, via);
        const line = `[UFO] ${note.message}`;
        if (note.tone === 'critical') {
          console.error(line);
        } else if (note.tone === 'warning') {
          console.warn(line);
        } else {
          console.info(line);
        }
      } catch (err) {
        console.error(`[UFO] Could not send "${label}" to ${device.displayName}:`, err);
      } finally {
        setBusyDeviceId(null);
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (device: DeviceRow) => {
      setBusyDeviceId(device.deviceId);
      setNotice(null);
      try {
        await deleteSettings.execute({
          objectId: device.objectId,
          optimisticLockingVersion: device.version,
        });
        await refetch();
        setNotice({ tone: 'info', message: `Removed ${device.displayName}.` });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setNotice({
          tone: 'critical',
          message: `Could not remove ${device.displayName}: ${message}`,
        });
      } finally {
        setBusyDeviceId(null);
      }
    },
    [deleteSettings, refetch],
  );

  const handleAdd = useCallback(
    async (input: NewDeviceInput) => {
      setAddError(undefined);
      setAddSubmitting(true);
      try {
        // `enabled` is a legacy, non-nullable schema field; set it true so older readers stay happy.
        const value: UfoDevice = { deviceId: crypto.randomUUID(), enabled: true, ...input };
        await createSettings.execute({ body: { schemaId: SCHEMA_ID, value } });
        await refetch();
        setShowAdd(false);
        setNotice({ tone: 'info', message: `Added ${input.displayName}.` });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setAddError(message);
      } finally {
        setAddSubmitting(false);
      }
    },
    [createSettings, refetch],
  );

  return (
    <Flex flexDirection="column" gap={16}>
      <Flex justifyContent="space-between" alignItems="center" gap={16}>
        <Heading level={1}>All UFOs</Heading>
        <Button variant="emphasized" color="primary" onClick={() => setShowAdd(true)}>
          Add device
        </Button>
      </Flex>

      <Paragraph>
        Every UFO registered on your network. Use the quick tests on a card to push a colour straight
        to that device and confirm the link end-to-end.
      </Paragraph>

      {notice ? (
        <MessageContainer variant={noticeVariant(notice.tone)} onDismiss={() => setNotice(null)}>
          {notice.message}
        </MessageContainer>
      ) : null}

      {error ? (
        <MessageContainer variant="critical">Could not load devices: {error.message}</MessageContainer>
      ) : null}

      {isLoading ? (
        <Text>Loading devices…</Text>
      ) : rows.length === 0 ? (
        <EmptyState size="small">
          <EmptyState.Visual>
            <EmptyState.VisualPreset context="generic" type="create-new" />
          </EmptyState.Visual>
          <EmptyState.Title>No UFO devices yet</EmptyState.Title>
          <EmptyState.Details>
            Register your first UFO to start pushing colours and animations to it.
          </EmptyState.Details>
          <EmptyState.Actions>
            <Button variant="emphasized" color="primary" onClick={() => setShowAdd(true)}>
              Add device
            </Button>
          </EmptyState.Actions>
        </EmptyState>
      ) : (
        <Grid gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={16}>
          {rows.map((device) => (
            <UfoCard
              key={device.deviceId}
              device={device}
              busy={busyDeviceId === device.deviceId}
              status={connectivityById[device.deviceId] ?? 'checking'}
              appliedPattern={appliedById[device.deviceId]}
              onTest={(d, pattern, label) => {
                void handleSendPattern(d, pattern, label);
              }}
              onRemove={(d) => {
                void handleDelete(d);
              }}
            />
          ))}
        </Grid>
      )}

      <AddDeviceModal
        show={showAdd}
        onDismiss={() => setShowAdd(false)}
        onSubmit={handleAdd}
        submitting={addSubmitting}
        error={addError}
      />
    </Flex>
  );
}
