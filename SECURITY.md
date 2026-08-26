# Security Policy

## Project status

UFO Studio is an **experimental**, community-maintained project. It is provided
"as is" with no service-level commitment. Security fixes are made on a
best-effort basis.

## Supported versions

Only the latest released version on the default branch receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Select **Report a vulnerability** to open a private advisory.

If private reporting is unavailable, contact the maintainer
([@garciaba](https://github.com/garciaba)) and ask for a private channel before
sharing any details.

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected version, configuration, or deployment (for example, browser beacon
  vs. EdgeConnect transport).
- Any suggested remediation.

You can expect an initial acknowledgement on a best-effort basis. Please give
the maintainer a reasonable opportunity to address the issue before any public
disclosure.

## Scope and hardening notes

- The backend function (`api/ufo-render.function.ts`) validates the protocol,
  host, and path of every request before composing a URL, as a guard against
  malformed and SSRF-style input.
- Outbound egress is gated by the Dynatrace environment's **External requests**
  allowlist; UFO Studio cannot reach a host that is not allowlisted.
- Device credentials and environment secrets are never committed. The
  `.gitignore` excludes EdgeConnect credentials, `.env` files, and local
  mock-data secrets.
