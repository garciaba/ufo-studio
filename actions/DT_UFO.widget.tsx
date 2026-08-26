import { AutomationConnectionPicker, AutomationNumberInput } from '@dynatrace/automation-action-components';
import { FormField, Label, Radio, RadioGroup } from '@dynatrace/strato-components/forms';
import { Button } from '@dynatrace/strato-components/buttons';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Heading, Text } from '@dynatrace/strato-components/typography';
import { PlusIcon } from '@dynatrace/strato-icons';
import type { ActionWidget } from '@dynatrace-sdk/automation-action-utils';
import { getAppId, getEnvironmentUrl } from '@dynatrace-sdk/app-environment';
import { functions } from '@dynatrace-sdk/app-utils';
import { appSettingsObjectsClient } from '@dynatrace-sdk/client-app-settings-v2';
import React, { useState } from 'react';
import {
  buildCommandPattern,
  type RingCommand,
  type RingDirection,
  type UfoCommand,
} from '../lib/ufo/command';
import { buildAddDeviceUrl } from '../lib/ufo/deepLinks';
import { encodePattern } from '../lib/ufo/encode';
import { OFF_PATTERN } from '../lib/ufo/palette';
import { RING_LED_COUNT } from '../lib/ufo/pattern';

// All fields are optional: a stored action config only carries what the author
// has touched, so every read below falls back to a friendly default.
interface DtUfoInput {
  connectionId?: string;
  topColor?: string;
  topDirection?: RingDirection;
  topSpeed?: number;
  topLedCount?: number;
  bottomColor?: string;
  bottomDirection?: RingDirection;
  bottomSpeed?: number;
  bottomLedCount?: number;
  logoColor?: string;
}

const DEFAULT_RING_COLOR = '#000000';
const DEFAULT_LOGO_COLOR = '#000000';
const DEFAULT_DIRECTION: RingDirection = 'right';
const DEFAULT_SPEED = 5;
const DEFAULT_LED_COUNT = 5;

const COLOR_SWATCH_STYLE: React.CSSProperties = {
  width: 56,
  height: 34,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
};

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';
interface TestState {
  status: TestStatus;
  message?: string;
}

function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Map a single ring's edits back onto the flat, prefixed input fields. */
function ringPatch(which: 'top' | 'bottom', patch: Partial<RingCommand>): Partial<DtUfoInput> {
  const mapped: Partial<DtUfoInput> = {};
  if (which === 'top') {
    if (patch.color !== undefined) mapped.topColor = patch.color;
    if (patch.direction !== undefined) mapped.topDirection = patch.direction;
    if (patch.speed !== undefined) mapped.topSpeed = patch.speed;
    if (patch.ledCount !== undefined) mapped.topLedCount = patch.ledCount;
    return mapped;
  }
  if (patch.color !== undefined) mapped.bottomColor = patch.color;
  if (patch.direction !== undefined) mapped.bottomDirection = patch.direction;
  if (patch.speed !== undefined) mapped.bottomSpeed = patch.speed;
  if (patch.ledCount !== undefined) mapped.bottomLedCount = patch.ledCount;
  return mapped;
}

/** One independently configurable ring: colour, spin direction, speed and lit-LED count. */
function RingSection(props: {
  title: string;
  hint: string;
  name: string;
  ring: RingCommand;
  onChange: (patch: Partial<RingCommand>) => void;
}) {
  const { title, hint, name, ring, onChange } = props;
  const fullRingHidesSpin = ring.ledCount >= RING_LED_COUNT;
  return (
    <Flex flexDirection="column" gap={8}>
      <Flex flexDirection="column" gap={2}>
        <Heading level={6}>{title}</Heading>
        <Text>{hint}</Text>
      </Flex>
      <Flex gap={16} flexWrap="wrap" alignItems="flex-start">
        <FormField>
          <Label>Colour</Label>
          <input
            type="color"
            aria-label={`${title} colour`}
            value={ring.color}
            onChange={(event) => onChange({ color: event.target.value })}
            style={COLOR_SWATCH_STYLE}
          />
        </FormField>
        <FormField>
          <Label>Spin direction</Label>
          <RadioGroup
            name={`${name}-direction`}
            value={ring.direction}
            onChange={(direction) => onChange({ direction: direction === 'left' ? 'left' : 'right' })}
          >
            <Radio value="right" aria-label={`${title} clockwise`}>
              Clockwise (right)
            </Radio>
            <Radio value="left" aria-label={`${title} counter-clockwise`}>
              Counter-clockwise (left)
            </Radio>
          </RadioGroup>
        </FormField>
        <FormField>
          <Label>Speed (1-10)</Label>
          <AutomationNumberInput
            value={ring.speed}
            onChange={(speed) => onChange({ speed: coerceNumber(speed, DEFAULT_SPEED) })}
          />
        </FormField>
        <FormField>
          <Label>LEDs lit (1-15)</Label>
          <AutomationNumberInput
            value={ring.ledCount}
            onChange={(ledCount) => onChange({ ledCount: coerceNumber(ledCount, DEFAULT_LED_COUNT) })}
          />
        </FormField>
      </Flex>
      {fullRingHidesSpin ? (
        <Text>A fully lit ring cannot show rotation. Reduce the lit-LED count to see it spin.</Text>
      ) : null}
    </Flex>
  );
}

const DtUfoWidget: ActionWidget<DtUfoInput> = (props) => {
  const { value, onValueChanged } = props;
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [activeAction, setActiveAction] = useState<'test' | 'clean' | null>(null);

  const updateValue = (patch: Partial<DtUfoInput>) => {
    onValueChanged({ ...value, ...patch });
  };

  const top: RingCommand = {
    color: value.topColor ?? DEFAULT_RING_COLOR,
    direction: value.topDirection ?? DEFAULT_DIRECTION,
    speed: coerceNumber(value.topSpeed, DEFAULT_SPEED),
    ledCount: coerceNumber(value.topLedCount, DEFAULT_LED_COUNT),
  };
  const bottom: RingCommand = {
    color: value.bottomColor ?? DEFAULT_RING_COLOR,
    direction: value.bottomDirection ?? DEFAULT_DIRECTION,
    speed: coerceNumber(value.bottomSpeed, DEFAULT_SPEED),
    ledCount: coerceNumber(value.bottomLedCount, DEFAULT_LED_COUNT),
  };
  const logoColor = value.logoColor ?? DEFAULT_LOGO_COLOR;

  // Resolve the selected device and deliver an encoded path through the `ufo-render` app function
  // (which reaches the UFO via EdgeConnect). Shared by the Test and Clean buttons.
  const deliver = async (
    objectId: string,
    path: string,
  ): Promise<{ ok: true; host: string; status: number } | { ok: false; message: string }> => {
    const connectionObject = await appSettingsObjectsClient.getAppSettingsObjectByObjectId({ objectId });
    const device = (connectionObject.value ?? {}) as { host?: string; protocol?: string; port?: number };
    if (!device.host) {
      return { ok: false, message: 'The selected device has no host configured. Add it to the fleet first.' };
    }
    const request = {
      protocol: device.protocol === 'https' ? 'https' : 'http',
      host: device.host,
      path,
      ...(typeof device.port === 'number' ? { port: device.port } : {}),
    };
    const response = await functions.call('ufo-render', { data: request });
    const result = (await response.json()) as {
      outcome?: string;
      status?: number;
      statusText?: string;
      error?: string;
    };
    if (result.outcome === 'delivered') {
      return { ok: true, host: device.host, status: result.status ?? 200 };
    }
    if (result.outcome === 'device-error') {
      return {
        ok: false,
        message: `The UFO rejected the command (HTTP ${result.status ?? '?'} ${result.statusText ?? ''}).`.trim(),
      };
    }
    return { ok: false, message: result.error ?? 'The UFO could not be reached from Dynatrace.' };
  };

  const runTest = async () => {
    if (!value.connectionId) {
      setTestState({ status: 'error', message: 'Select a UFO device first.' });
      return;
    }
    setActiveAction('test');
    setTestState({ status: 'testing' });
    try {
      const command: UfoCommand = { top, bottom, logoColor };
      const result = await deliver(value.connectionId, encodePattern(buildCommandPattern(command)));
      setTestState(
        result.ok
          ? { status: 'ok', message: `Delivered to ${result.host} (HTTP ${result.status}).` }
          : { status: 'error', message: result.message },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState({ status: 'error', message: `Test failed: ${message}` });
    } finally {
      setActiveAction(null);
    }
  };

  const runClean = async () => {
    if (!value.connectionId) {
      setTestState({ status: 'error', message: 'Select a UFO device first.' });
      return;
    }
    setActiveAction('clean');
    setTestState({ status: 'testing' });
    try {
      // Send the same "Off" pattern as the app's quick-test: every LED fully off (RGB 000).
      const result = await deliver(value.connectionId, encodePattern(OFF_PATTERN));
      setTestState(
        result.ok
          ? { status: 'ok', message: `Cleared ${result.host} (HTTP ${result.status}).` }
          : { status: 'error', message: result.message },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState({ status: 'error', message: `Clean failed: ${message}` });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Flex flexDirection="column" gap={16}>
      <FormField>
        <Label>UFO device</Label>
        <AutomationConnectionPicker
          connectionId={value.connectionId}
          schema="ufo-device"
          hideEditConnectionButton
          hideAddConnectionButton
          onChange={(connectionId) => updateValue({ connectionId })}
        />
      </FormField>

      <Flex>
        <Button
          onClick={() => {
            // Opens the app's own Fleet screen with its Add UFO device modal, rather than the
            // connection picker's default (a raw, generic settings-object editor page).
            window.open(buildAddDeviceUrl(getEnvironmentUrl(), getAppId()), '_blank')?.focus();
          }}
        >
          <Button.Prefix>
            <PlusIcon />
          </Button.Prefix>
          Add a new UFO
        </Button>
      </Flex>

      <RingSection
        title="Top ring"
        hint="The upper 15-LED ring."
        name="top"
        ring={top}
        onChange={(patch) => updateValue(ringPatch('top', patch))}
      />

      <RingSection
        title="Bottom ring"
        hint="The lower 15-LED ring, configured independently of the top ring."
        name="bottom"
        ring={bottom}
        onChange={(patch) => updateValue(ringPatch('bottom', patch))}
      />

      <Flex flexDirection="column" gap={8}>
        <Flex flexDirection="column" gap={2}>
          <Heading level={6}>Logo</Heading>
          <Text>All four logo LEDs use this colour.</Text>
        </Flex>
        <FormField>
          <Label>Colour</Label>
          <input
            type="color"
            aria-label="Logo colour"
            value={logoColor}
            onChange={(event) => updateValue({ logoColor: event.target.value })}
            style={COLOR_SWATCH_STYLE}
          />
        </FormField>
      </Flex>

      <Flex flexDirection="column" gap={4} alignItems="flex-start">
        <Flex gap={8} alignItems="center">
          <Button
            variant="emphasized"
            color="primary"
            disabled={activeAction !== null || !value.connectionId}
            onClick={() => {
              void runTest();
            }}
          >
            {activeAction === 'test' ? 'Testing...' : 'Test on UFO'}
          </Button>
          <Button
            variant="default"
            color="neutral"
            disabled={activeAction !== null || !value.connectionId}
            onClick={() => {
              void runClean();
            }}
          >
            {activeAction === 'clean' ? 'Cleaning...' : 'Clean UFO'}
          </Button>
        </Flex>
        {testState.message ? <Text>{testState.message}</Text> : null}
      </Flex>
    </Flex>
  );
};

export default DtUfoWidget;
