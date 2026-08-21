import React, { useState } from 'react';
import { Modal } from '@dynatrace/strato-components/overlays';
import { Button } from '@dynatrace/strato-components/buttons';
import { Flex } from '@dynatrace/strato-components/layouts';
import { FormField, Label, TextInput, Switch } from '@dynatrace/strato-components/forms';
import { Text } from '@dynatrace/strato-components/typography';
import type { UfoDevice } from '../../transport/types';

/** Everything needed to create a device except the app-generated `deviceId`. */
export type NewDeviceInput = Omit<UfoDevice, 'deviceId'>;

type AddDeviceModalProps = {
  readonly show: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (device: NewDeviceInput) => Promise<void> | void;
  readonly submitting?: boolean;
  readonly error?: string;
};

const PORT_MIN = 1;
const PORT_MAX = 65535;

export function AddDeviceModal({
  show,
  onDismiss,
  onSubmit,
  submitting = false,
  error,
}: AddDeviceModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [host, setHost] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [portText, setPortText] = useState('');
  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [enabled, setEnabled] = useState(true);

  const trimmedName = displayName.trim();
  const trimmedHost = host.trim();
  const portTrimmed = portText.trim();
  const portNum = portTrimmed === '' ? undefined : Number(portTrimmed);
  const portValid =
    portNum === undefined ||
    (Number.isInteger(portNum) && portNum >= PORT_MIN && portNum <= PORT_MAX);

  const canSubmit =
    trimmedName.length > 0 && trimmedHost.length > 0 && portValid && !submitting;

  const reset = () => {
    setDisplayName('');
    setHost('');
    setUseHttps(false);
    setPortText('');
    setOrganization('');
    setDepartment('');
    setLocation('');
    setEnabled(true);
  };

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    const device: NewDeviceInput = {
      displayName: trimmedName,
      host: trimmedHost,
      protocol: useHttps ? 'https' : 'http',
      enabled,
      ...(portNum !== undefined ? { port: portNum } : {}),
      ...(organization.trim() ? { organization: organization.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    };
    await onSubmit(device);
    // Parent closes the modal on success; reset so the next open starts clean.
    reset();
  };

  return (
    <Modal
      title="Add UFO device"
      show={show}
      onDismiss={handleDismiss}
      size="small"
      footer={
        <Flex gap={8} justifyContent="flex-end">
          <Button onClick={handleDismiss} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="emphasized"
            color="primary"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
            loading={submitting}
          >
            Add device
          </Button>
        </Flex>
      }
    >
      <Flex flexDirection="column" gap={16}>
        <FormField required>
          <Label>Display name</Label>
          <TextInput value={displayName} onChange={setDisplayName} placeholder="Lobby UFO" />
        </FormField>

        <FormField required>
          <Label>Host</Label>
          <TextInput value={host} onChange={setHost} placeholder="192.168.1.42 or ufo.local" />
        </FormField>

        <FormField>
          <Label>Use HTTPS (device serves TLS)</Label>
          <Switch value={useHttps} onChange={setUseHttps} />
        </FormField>

        <FormField>
          <Label>Port (optional)</Label>
          <TextInput
            value={portText}
            onChange={setPortText}
            placeholder="Default 80 / 443"
            type="text"
          />
          {!portValid ? (
            <Text>Enter a whole number between {PORT_MIN} and {PORT_MAX}.</Text>
          ) : null}
        </FormField>

        <FormField>
          <Label>Organization (optional)</Label>
          <TextInput value={organization} onChange={setOrganization} />
        </FormField>

        <FormField>
          <Label>Department (optional)</Label>
          <TextInput value={department} onChange={setDepartment} />
        </FormField>

        <FormField>
          <Label>Location (optional)</Label>
          <TextInput value={location} onChange={setLocation} />
        </FormField>

        <FormField>
          <Label>Enabled</Label>
          <Switch value={enabled} onChange={setEnabled} />
        </FormField>

        {error ? <Text>Could not add device: {error}</Text> : null}
      </Flex>
    </Modal>
  );
}
