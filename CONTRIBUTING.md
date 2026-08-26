# Contributing to UFO Studio

Thanks for your interest in improving UFO Studio! This is an **experimental**,
community-maintained project, so please set expectations accordingly: reviews
and releases happen on a best-effort basis.

By contributing, you agree that your contributions will be licensed under the
project's [Apache License 2.0](LICENSE).

## Ways to contribute

- Report bugs and request features via [issues](../../issues).
- Improve documentation.
- Submit code via pull requests.

Please search existing issues before opening a new one.

## Development setup

Prerequisites:

- Node.js 20 LTS (the repo targets a modern LTS; `package.json` sets the minimum
  engine).
- npm.
- A Dynatrace environment and the Dynatrace App Toolkit (`dt-app`) for running
  and deploying the app.

Install dependencies and start the dev server:

```bash
npm install
npm run start      # dt-app dev, with hot reload
```

Point the app at your own Dynatrace environment by setting `environmentUrl` in
`app.config.json` before deploying. Do **not** commit another environment's URL.

## Quality gates

All pull requests should keep the following green:

```bash
npm run lint             # ESLint
npm run typecheck:lib    # type-check the pure core
npx tsc -p ui/tsconfig.json   # type-check the UI
npm run test:lib         # unit tests for lib/ufo
npm run test:actions     # workflow action tests
npm run test:widgets     # action config widget tests
npm run build            # dt-app build
```

## Code style and conventions

- TypeScript + React with the Strato Design System.
- Import Strato components from their category subpath (for example
  `@dynatrace/strato-components/layouts`), never from the package root — ESLint
  enforces this.
- Keep `lib/ufo` pure: no React, SDK, or network imports there.
- Prefer small, focused commits with clear messages.

## Pull request checklist

- [ ] The change is scoped and described in the PR body (what and why).
- [ ] Linked to a related issue where one exists.
- [ ] All quality gates above pass locally.
- [ ] Documentation updated where behavior changed.
- [ ] No secrets, credentials, or environment-specific URLs are included.

## Reporting security issues

Please do not open a public issue for security problems. See
[SECURITY.md](SECURITY.md) for private reporting instructions.
