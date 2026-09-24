# AGENTS.md — Codebase Guide for AI Coding Agents

## Agent Workflow Rules

These rules are **mandatory** and apply to every task in this repository.

### After every change

1. Run `mise run fmt` — auto-fixes formatting (prettier, trailing whitespace, end-of-file). Run first so subsequent checks are clean.
2. Run `yarn build` — the build must pass with no errors before considering the task done.
3. Run `yarn test` — all tests must pass. Fix any failures before finishing.
4. Run `yarn lint` — must pass with zero errors. Fix any lint or formatting issues before finishing.
5. If any command fails, fix the problem and re-run until all pass cleanly.

> **Note:** `yarn lint` only covers `*.ts`. If you touched anything else (Markdown, YAML,
> `hk.pkl`, `package.json`, workflows), also run `mise run lint` — the full hk suite
> (markdownlint, actionlint, codespell, etc.).

### Pre-commit hooks (hk)

Git hooks are managed by [hk](https://hk.jdx.dev) via `hk.pkl`. Run `hk install` once per
clone (hk is provided by mise) to install the `pre-commit` hook, which runs
`hk run pre-commit` on every commit. It auto-fixes what it can (`fix = true`) and fails
the commit otherwise, so run `mise run fmt` yourself before committing to keep it green.

On each commit the hook runs, in order:

1. **build** — `mise run build` when `src/`, packaging, or build config changed, so `dist/`
  never drifts from the sources.
2. **linters** — the full hk suite (prettier, eslint, markdownlint, actionlint, codespell,
  typos, knip, etc.); most auto-fix, the rest fail the commit.
3. **postlint** — `mise run postlint` (`git diff --exit-code`); fails if a fixer left the
  tree dirty, so `git status` must be clean apart from your intended changes.
4. **precommit** — secret and safety scans (leak detection, private keys, large files,
  merge-conflict markers, no direct commit to branch).

Useful equivalents outside the hook: `mise run fmt` (`hk fix --all`) to auto-fix,
`mise run lint` (`hk check --all`) for the read-only full check. To bypass the hook in an
emergency: `HK=0 git commit ...` — but CI (`.github/workflows/lint.yml`,
`.github/workflows/check-dist.yml`) enforces the same checks, so prefer fixing the failure.

### Keeping docs in sync

- **`README.md`** — update whenever you change user-facing behaviour: inputs, outputs,
  supported registries, usage examples, or action semantics.
  - All Markdown tables must use padded, aligned columns: each column padded to the width of
    the widest cell in that column, separator row using `| --- |` style (spaces inside dashes).
- **`action.yml`** — update whenever inputs or outputs change; keep in sync with `src/main.ts`
  and `README.md`.
- **`dist/`** — committed build output (`dist/index.js`); rebuild after any `src/` change so the
  shipped action stays in sync.
- **`AGENTS.md`** — this file is self-maintained; follow the self-maintenance rules below
  whenever your change affects anything documented here.

### Maintaining AGENTS.md (self-maintenance)

AGENTS.md rots fast if it is only appended to. Apply these rules to keep it accurate:

1. **Update triggers** — revise AGENTS.md in the same change when you add, rename, or remove
  `src/` files, add a registry, change `package.json` scripts, `tsconfig`, lint/format config,
  `hk.pkl` hooks, the test layout or mocking patterns, or architecture patterns (error handling,
  logging, auth).
2. **Verify against sources** — every claim must trace to a source of truth (`package.json`,
  `tsconfig.json`, `hk.pkl`, `src/*.ts`, workflows). Read the file before documenting it;
  never document from memory.
3. **Durable over exhaustive** — state rules and patterns, not inventories that rot (e.g. "one
  test per registry" instead of naming every file). Never hardcode versions here; point at
  `.nvmrc` / `engines` / `package.json` instead.
4. **One source per fact** — do not duplicate content between sections; cross-reference instead.
  When adding a rule, check for contradictions with existing sections and fix them in the
  same edit.
5. **Examples must work** — every command and code snippet must be copy-paste correct. Prefer
  running them over trusting memory.
6. **Prune stale guidance** — a wrong rule is worse than no rule. If a convention changed,
  update or delete the old text in the same change; never append a contradicting note.
7. **Keep it lean** — prefer amending an existing bullet over adding a new section. If the file
  keeps growing, consolidate instead of appending.

---

## Overview

A GitHub Action (TypeScript, Node 24, ESM) that checks whether a Docker image needs
to be rebuilt because its base image has been updated. It compares layer digests across
one or more platforms and supports a wide range of container registries.

```bash
src/index.ts              → thin entrypoint, calls run()
src/main.ts               → action logic, input parsing, output setting, registry routing
src/registry.ts           → abstract ContainerRegistry base class + shared types
src/generic-registry.ts   → GenericRegistry: unified Bearer base (static config or auto-discovery)
src/docker-hub.ts         → DockerHub (extends GenericRegistry)
src/github.ts             → GitHubContainerRegistry (extends GenericRegistry)
src/gitlab.ts             → GitLabContainerRegistry (extends GenericRegistry; registry.gitlab.com)
src/gcr.ts                → GoogleContainerRegistry (extends GenericRegistry; gcr.io + *.gcr.io)
src/quay.ts               → QuayRegistry (extends GenericRegistry)
src/acr.ts                → AzureContainerRegistry (extends GenericRegistry; *.azurecr.io)
src/gar.ts                → GoogleArtifactRegistry (extends GenericRegistry; *.pkg.dev)
src/ecr.ts                → ECRPublicRegistry + ECRPrivateRegistry (extends GenericRegistry)
src/digitalocean.ts       → DigitalOceanContainerRegistry (extends GenericRegistry; registry.digitalocean.com)
src/ocir.ts               → OracleContainerRegistry (extends GenericRegistry; *.ocir.io)
src/auth.ts               → Docker credential resolution
src/image-utils.ts        → image string parsing and layer diff logic
src/token-utils.ts        → HTTP token fetch helpers
```

---

## Commands

### Test

```bash
yarn test                                        # run all tests
yarn test -- --testPathPattern=token-utils       # run a single test file by name
yarn test -- --testPathPattern=image-utils       # another single file
yarn test -- -t "should return diff images"      # run tests matching a name pattern
yarn test -- --testPathPattern=docker-hub -t "getToken"  # file + name filter combined
```

### Lint / Format

```bash
mise run fmt       # hk fix --all — auto-fix formatting (prettier, trailing whitespace, end-of-file)
mise run lint      # hk check --all — full lint suite (markdownlint, actionlint, codespell, etc.)
yarn lint          # prettier --check + eslint (no auto-fix)
yarn format        # prettier --write + eslint --fix (auto-fix)
yarn prettier      # check formatting only
yarn prettier:fix  # fix formatting only
yarn eslint        # lint only (0 warnings allowed)
yarn eslint:fix    # lint + auto-fix
```

### Build

```bash
yarn build           # rollup → dist/index.js  (rimraf dist first)
yarn all             # format + test + build in sequence
```

> **Note:** Tests require `NODE_OPTIONS=--experimental-vm-modules` (already set in the
> `yarn test` script). Do not strip this flag.

---

## TypeScript Configuration

- **Target / Module:** `ES2022` / `NodeNext` — full ESM, no CommonJS
- **Strict mode:** `strict`, `strictNullChecks`, `noImplicitAny`, `noUnusedLocals` all enabled
- `isolatedModules: true` — each file must be independently compilable
- `tsconfig.json` covers `src/` only; test files are excluded (ts-jest handles them separately)
- Node version is pinned in `.nvmrc` (mirrored in `.mise.toml` / `engines`); never hardcode it here

---

## Code Style (enforced by Prettier + ESLint)

### Prettier settings (`.prettierrc.json`)

| Setting | Value |
| --- | --- |
| Semicolons | **none** |
| Quotes | **single** |
| Tab width | 2 spaces |
| Trailing commas | **all** (including function params) |
| Print width | 140 |
| Arrow parens | always |
| Bracket spacing | false — `{key: value}` not `{ key: value }` |

### Imports

- Use `import * as core from '@actions/core'` (namespace import) for `@actions/core`
- Use named imports for everything else: `import {Foo, bar} from './foo.js'`
- **Always use `.js` extension** in local import paths, even when the source file is `.ts`:

  ```ts
  import {DockerHub} from './docker-hub.js'   // correct
  import {DockerHub} from './docker-hub'       // wrong — breaks NodeNext resolution
  ```

- Third-party imports before local imports (no blank line separator enforced, but keep them grouped)

### Naming Conventions

- **Files:** kebab-case (`docker-hub.ts`, `image-utils.ts`, `token-utils.ts`)
- **Classes / Interfaces / Types:** PascalCase (`ContainerRegistry`, `ImageInfo`, `DockerAuth`)
- **Functions / variables:** camelCase (`getImageInfo`, `parseImageInput`, `diffImages`)
- **Constants at module level:** camelCase (no `SCREAMING_SNAKE` convention used)
- `type` aliases preferred for simple shapes; `interface` for public API contracts

### Types

- Prefer explicit return types on exported functions and class methods
- Use `unknown` over `any`; cast with type assertions only where necessary (e.g., `as Manifest`)
- Avoid non-null assertions (`!`); use optional chaining (`?.`) and nullish coalescing (`??`)
- Generics should be descriptive when the intent is non-obvious

---

## Architecture Patterns

### Registry Implementations

All registry clients extend `GenericRegistry` from `src/generic-registry.ts` and pass a
`StaticBearerConfig` with the known token endpoint:

```ts
export class MyRegistry extends GenericRegistry {
  constructor() {
    super('myregistry.example.com', {
      realm: 'https://myregistry.example.com/token', // token endpoint URL
      service: 'myregistry.example.com',             // optional service param
      credentialKey: 'myregistry.example.com',       // Docker config key; defaults to hostname
      name: 'My Registry',                           // log label; defaults to hostname
    })
  }
}
```

- `getImageInfo()` is implemented on the base class; do not override it
- `getToken()` and `getCredentials()` are implemented by `GenericRegistry`; do not override them
- Wire new registries into `getRegistryInstance()` in `src/main.ts`:
  - Exact hostnames → add a `case` to the `switch`
  - Pattern-matched hostnames (e.g. `*.example.com`) → add an `if` before the `switch`
  - Truly unknown registries are handled automatically by the `GenericRegistry` fallback
    (auto-discovers the token endpoint from the `WWW-Authenticate` header on `/v2/`)

### `GenericRegistry` — static config vs auto-discovery

`GenericRegistry` has two modes:

- **Static config** (all named registries): `StaticBearerConfig` is passed in the constructor;
  the `/v2/` probe is skipped entirely and the token endpoint is used directly.
- **Auto-discovery** (unknown registries / fallback): no config is passed; on first use the class
  probes `https://<hostname>/v2/`, reads the `WWW-Authenticate: Bearer realm=...,service=...`
  header, and caches the result. Returns `''` (anonymous) if no Bearer challenge is found.

### Error Handling

- All action-level errors are caught in the `run()` try/catch and surfaced via `core.setFailed()`
- Registry/network errors throw `Error` with descriptive messages including the URL and status
- Registry JSON responses are validated with zod via `parseOrThrow` in `registry.ts` (turns
  `ZodError` into a plain `Error` with URL context); follow that pattern for any new response parsing
- `fetchToken` in `token-utils.ts` produces structured error messages with an `errorPrefix`
  for caller context; follow the same pattern in new token implementations
- Never swallow errors silently; rethrow or log with `core.warning()` / `core.error()`

### Logging

- `core.debug(msg)` — internal tracing, only visible when `ACTIONS_RUNNER_DEBUG=true`
- `core.isDebug()` guard — use before expensive serialisation (e.g., `JSON.stringify`)
- `core.info(msg)` — user-visible operational output
- `core.warning(msg)` — non-fatal issues (e.g., missing optional credentials)
- `core.startGroup` / `core.endGroup` — wrap related log lines for collapsible sections
- `console.error()` — avoid; use `core.error()` instead

---

## Testing

### Hermetic tests — `yarn test` must work offline

All tests in `__tests__/` are fully mocked and must never make real network calls.
Real end-to-end testing runs exclusively in `.github/workflows/test-workflow.yml`.

### Test layout

```bash
__tests__/
  <registry>.test.ts         ← one test per registry in src/ (e.g. docker-hub.test.ts, gcr.test.ts;
                              artifact-registry.test.ts covers gar.ts); global.fetch + @actions/core mocked
  image-utils.test.ts          ← pure unit tests, no network, no mocking needed
  token-utils.test.ts          ← unit tests, global.fetch mocked via jest.fn() (own local mockResponse helper)
  generic-registry.test.ts     ← unit tests for static config + auto-discovery modes
  main.test.ts                 ← unit tests for getRegistryInstance routing + run(), global.fetch + @actions/core mocked
  auth.test.ts                 ← unit tests for getRegistryAuth, child_process + Docker config mocked
  registry-test-utils.ts       ← shared mockResponse() factory (not a test file)

__mocks__/
  @actions/core.ts       ← manual mock; wired via moduleNameMapper in jest.config.js
```

### `@actions/core` mock

`@actions/core` is mapped to `__mocks__/@actions/core.ts` via `moduleNameMapper` in
`jest.config.js`. The mock exports `jest.fn()` stubs for every `@actions/core` export.
Import `jest` from `@jest/globals` inside the mock file (required for ESM mode).

### Mocking `getCredentials()` and calling `getToken()` in registry tests

`getToken()` and `getCredentials()` are both `protected` on `GenericRegistry` and its
subclasses. They are plain prototype methods at runtime, so they can be accessed
in tests via a type cast:

```ts
// spy on getCredentials to prevent real Docker credential store access
jest.spyOn(instance as unknown as {getCredentials: () => undefined}, 'getCredentials').mockReturnValue(undefined)

// call getToken directly in unit tests
const token = await (instance as unknown as {getToken: (r: string) => Promise<string>}).getToken('library/nginx')
```

### Mock response factory pattern

Both `registry.ts` and `token-utils.ts` call different `Response` methods:

- `registry.ts` uses `response.json()` and `response.headers.entries()`
- `token-utils.ts` uses `response.text()` and `response.headers.get()`

All registry tests (plus `main.test.ts`) import the shared factory from
`__tests__/registry-test-utils.ts`, which implements all four:

```ts
import {mockResponse} from './registry-test-utils.js'
```

(`token-utils.test.ts` is the exception — it defines its own local `mockResponse`
because `fetchToken` needs control over `ok`/`status`/`statusText`, not just the body.)

### Test style

- Use `describe('ClassName/functionName', () => { ... })` for grouping
- Use `it('should <expected behaviour>', ...)` with "should" phrasing for test names
- Mock `global.fetch` in `beforeEach`; `clearMocks: true` (jest config) resets state automatically
- Do not use `expect(value).not.toBeNull()` when a subsequent assertion already implies non-null
- Import test utilities from `@jest/globals` explicitly:

  ```ts
  import {jest, describe, it, expect, beforeAll, beforeEach} from '@jest/globals'
  ```

### Fetch call sequence for registry tests

**Static-config registries (DockerHub, GHCR, etc.) — manifest list path:**

1. Token fetch
2. Manifest list fetch (content-type: `…manifest.list.v2+json` or `…oci.image.index.v1+json`)
3. One `getLayers` fetch per non-unknown platform

**Static-config registries — single manifest path:**

1. Token fetch
2. Single manifest fetch (content-type: `…manifest.v2+json` or `…oci.image.manifest.v1+json`)
3. Blob config fetch (resolves architecture/os/variant)
4. `getLayers` fetch (fetches manifest by `docker-content-digest`)

**`GenericRegistry` in auto-discovery mode — prepend one extra call:**

1. `/v2/` probe (fired once per instance, cached; skipped in static-config mode)
2. Token fetch (skipped if probe found no Bearer challenge — returns `''`)
3. Manifest + layers as above
