import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock every Strato / automation / SDK dependency so the test exercises only the
// widget's own logic (value wiring + the Test button) without pulling ESM UI code.
jest.mock('@dynatrace/automation-action-components', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    AutomationConnectionPicker: (props: any) =>
      react.createElement('div', { 'data-testid': 'connection-picker' }, props.connectionId ?? ''),
    AutomationNumberInput: (props: any) =>
      react.createElement('input', {
        type: 'number',
        value: props.value,
        onChange: (event: any) => props.onChange?.(Number(event.target.value)),
      }),
  };
});

jest.mock('@dynatrace/strato-components/forms', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    FormField: (props: any) => react.createElement('div', null, props.children),
    Label: (props: any) => react.createElement('label', null, props.children),
    RadioGroup: (props: any) => react.createElement('div', { role: 'radiogroup' }, props.children),
    Radio: (props: any) => react.createElement('label', null, props.children),
  };
});

jest.mock('@dynatrace/strato-components/buttons', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const Button = Object.assign(
    (props: any) =>
      react.createElement(
        'button',
        { type: 'button', onClick: props.onClick, disabled: props.disabled },
        props.children,
      ),
    { Prefix: (props: any) => react.createElement('span', null, props.children) },
  );
  return { Button };
});

jest.mock('@dynatrace/strato-icons', () => ({ PlusIcon: () => null }));

jest.mock('@dynatrace/strato-components/layouts', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return { Flex: (props: any) => react.createElement('div', null, props.children) };
});

jest.mock('@dynatrace/strato-components/typography', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    Heading: (props: any) => react.createElement('h6', null, props.children),
    Text: (props: any) => react.createElement('span', null, props.children),
  };
});

jest.mock('@dynatrace-sdk/app-utils', () => ({
  functions: { call: jest.fn() },
}));

jest.mock('@dynatrace-sdk/app-environment', () => ({
  getAppId: () => 'my.ufo',
  getEnvironmentUrl: () => 'https://example.apps.dynatrace.com/',
}));

jest.mock('@dynatrace-sdk/client-app-settings-v2', () => ({
  appSettingsObjectsClient: { getAppSettingsObjectByObjectId: jest.fn() },
}));

import { functions } from '@dynatrace-sdk/app-utils';
import { appSettingsObjectsClient } from '@dynatrace-sdk/client-app-settings-v2';
import DtUfoWidget from './DT_UFO.widget';

const mockFunctionsCall = functions.call as unknown as jest.Mock;
const mockGetObject = appSettingsObjectsClient.getAppSettingsObjectByObjectId as unknown as jest.Mock;

describe('DtUfoWidget', () => {
  it('renders independent controls for both rings and the logo', () => {
    render(<DtUfoWidget value={{ connectionId: 'ufo-1' }} onValueChanged={jest.fn()} />);

    expect(screen.getByText('Top ring')).toBeTruthy();
    expect(screen.getByText('Bottom ring')).toBeTruthy();
    expect(screen.getByText('Logo')).toBeTruthy();
    expect(screen.getByText('Test on UFO')).toBeTruthy();
    expect(screen.getByText('Add a new UFO')).toBeTruthy();
  });

  it('opens the app\'s Add UFO device modal when Add a new UFO is clicked', () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue({ focus: jest.fn() } as unknown as Window);

    render(<DtUfoWidget value={{ connectionId: 'ufo-1' }} onValueChanged={jest.fn()} />);
    fireEvent.click(screen.getByText('Add a new UFO'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.apps.dynatrace.com/ui/apps/my.ufo?addDevice=1',
      '_blank',
    );
    openSpy.mockRestore();
  });

  it('sends the configured pattern to ufo-render when Test is clicked', async () => {
    mockGetObject.mockResolvedValue({ value: { host: 'ufo.example', protocol: 'http' } });
    mockFunctionsCall.mockResolvedValue({ json: async () => ({ outcome: 'delivered', status: 200 }) });

    render(
      <DtUfoWidget
        value={{
          connectionId: 'ufo-1',
          topColor: '#ff0000',
          bottomColor: '#00ff00',
          logoColor: '#0000ff',
          topDirection: 'right',
          bottomDirection: 'right',
          topSpeed: 10,
          bottomSpeed: 10,
          topLedCount: 15,
          bottomLedCount: 15,
        }}
        onValueChanged={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Test on UFO'));

    await waitFor(() => expect(mockFunctionsCall).toHaveBeenCalledTimes(1));

    const call = mockFunctionsCall.mock.calls[0];
    expect(call[0]).toBe('ufo-render');
    const request = call[1].data;
    expect(request.host).toBe('ufo.example');
    expect(request.protocol).toBe('http');
    expect(request.path).toContain('top=0|15|ff0000');
    expect(request.path).toContain('top_whirl=255');
    expect(request.path).toContain('bottom=0|15|00ff00');
    expect(request.path).toContain('bottom_whirl=255');
    expect(request.path).toContain('logo=0000ff|0000ff|0000ff|0000ff');

    expect(await screen.findByText(/Delivered to ufo.example/)).toBeTruthy();
  });
});
