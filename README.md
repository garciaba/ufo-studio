# UFO Studio

A Dynatrace App for registering and driving physical **[Dynatrace UFO](https://github.com/Dynatrace/ufo)** LED devices from your Dynatrace environment. Manage a fleet of UFOs, push colours and animations to them from a device card, and drive them from Dynatrace Workflows.

Built with the Dynatrace App Toolkit (`dt-app`), React + TypeScript, and the Strato Design System.

## What is a UFO?

The Dynatrace UFO is an open-source Wi-Fi ambient information radiator: two rings of 15 RGB LEDs plus a 4-LED logo, controlled over HTTP through a simple `GET /api?...` endpoint. UFO Studio speaks that protocol for you.

## Features

- **Fleet management** — Register, list, and remove UFO devices. Each card shows a **live connection status** and an **LED preview** that mirrors the pattern last pushed to that UFO. Devices are stored as Dynatrace app-settings objects (`ufo-device` schema) with a display name, host, protocol, and optional port.
- **Quick pattern tests** — Pick a visually distinct smoke-test pattern (Green whirl, Red alert, Blue spin, Rainbow, Off) from a device card and apply it to confirm the link end-to-end.
- **"Send to UFO" workflow action** — A Dynatrace Workflow action that drives any registered UFO from automation: pick a device, then set each ring's colour, spin direction, speed, and lit-LED count, plus the logo colour.
- **Two delivery transports** — A browser beacon for devices on your own network, and an EdgeConnect-backed server-side proxy that can reach private-network devices and confirm delivery.
- **Pure, tested core** — `lib/ufo` encodes patterns into the device protocol with no runtime dependencies and full unit-test coverage.

## How delivery works

A device-ready `Pattern` (*what* to show) is handed to a *transport* (*how* to get it there):

| Transport | Runs in | Reaches | Confirms delivery? |
| --- | --- | --- | --- |
| **Browser beacon** | The browser | Devices routable from the user's machine | No — the device response is opaque (CORS), so we only know a request was *dispatched* |
| **EdgeConnect** | Backend app function (`api/ufo-render`) | Private-network devices via a Dynatrace EdgeConnect | Yes — the function reads the device's HTTP response |

The backend function validates every request (protocol / host / path) before composing a URL, as a guard against malformed and SSRF-style input. Outbound egress is gated by the environment's **External requests** allowlist.

## Architecture

```
lib/ufo/           Pure visual core — no I/O, fully unit-tested
  pattern.ts         Types: rings (15 LEDs), logo (4 LEDs), segments, animations
  palette.ts         Semantic colour tokens (healthy, warning, critical, …)
  command.ts         Build a Pattern from a simple ring/logo command
  encode.ts          Encode a Pattern into the device `/api?...` query string
transport/         Delivery layer
  types.ts           UfoDevice, the transport contract, proxy request/result types
  browserBeacon.ts   Fire-and-forget GET from the browser
  edgeConnect.ts     Server-side delivery via the backend function
api/
  ufo-render.function.ts   Backend proxy: validates + fetches the device, returns an outcome
settings/schemas/
  ufo-device.schema.json   App-settings schema for a registered UFO
actions/           "Send to UFO" workflow action + its config widget
ui/                React app (fleet list, quick tests, add-device modal)
```

## Prerequisites

- One or more physical **Dynatrace UFO** devices on a reachable network.
- For devices on a **private network**: a configured **Dynatrace EdgeConnect** and matching **External requests** allowlist entries.

## Configuration

### Registering a device

Add devices from the app UI (**Add device**), or directly as `ufo-device` app-settings objects. Each device has:

| Field | Description |
| --- | --- |
| `displayName` | Human-friendly name |
| `host` | Bare hostname or IP — no scheme, no path (e.g. `ufo.local`) |
| `protocol` | `http` or `https` |
| `port` | Optional; defaults to 80 / 443 |

### Reaching devices on a private network (EdgeConnect)

To drive a UFO that isn't directly routable from the Dynatrace runtime:

1. Set up a **Dynatrace EdgeConnect** on a host that can reach the device.
2. Configure its host pattern to match your device hosts.
3. Add the device hosts to **Settings → General → External requests**.

The backend function then reaches the device transparently through EdgeConnect.

## Credits

UFO hardware and firmware: the open-source [Dynatrace UFO](https://github.com/Dynatrace/ufo) project.
