# AGENTS.md — Codebase Guide for AI Coding Agents

## Agent Workflow Rules

These rules are **mandatory** and apply to every task in this repository.

### After every change

1. Run `yarn build` — the build must pass with no errors before considering the task done.
2. Run `yarn test` — all tests must pass. Fix any failures before finishing.
3. Run `yarn lint` — must pass with zero errors. Fix any lint or formatting issues before finishing.
4. If any command fails, fix the problem and re-run until all three pass cleanly.

### Keeping docs in sync

- **`README.md`** — update whenever you change user-facing behaviour: inputs, outputs,
  supported registries, usage examples, or action semantics.
- **`AGENTS.md`** — update whenever you change commands, project structure, code style
  conventions, architecture patterns, or testing rules.

---

## Overview

A GitHub Action (TypeScript, Node 24, ESM) that checks whether a Docker image needs
to be rebuilt because its base image has been updated. It compares layer digests across
one or more platforms using Docker Hub and GHCR registry APIs.

```bash
src/index.ts          → thin entrypoint, calls run()
src/main.ts           → action logic, input parsing, output setting
src/registry.ts       → abstract ContainerRegistry base class + shared types
src/docker-hub.ts     → DockerHub registry implementation
src/github.ts         → GitHubContainerRegistry implementation
src/gcr.ts            → GoogleContainerRegistry (defined, not wired into main.ts)
src/auth.ts           → Docker credential resolution
src/image-utils.ts    → image string parsing and layer diff logic
src/token-utils.ts    → HTTP token fetch helpers
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
yarn lint            # prettier --check + eslint (no auto-fix)
yarn format          # prettier --write + eslint --fix (auto-fix)
yarn prettier        # check formatting only
yarn prettier:fix    # fix formatting only
yarn eslint          # lint only (0 warnings allowed)
yarn eslint:fix      # lint + auto-fix
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
- Node ≥ 24.14.1 required (`.nvmrc` / `.mise.toml`)

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

Extend `ContainerRegistry` from `src/registry.ts`:

```ts
export class MyRegistry extends ContainerRegistry {
  constructor() { super('myregistry.example.com/v2/') }
  protected async getToken(repository: string): Promise<string> { ... }
  protected getCredentials(): DockerAuth | undefined { ... }
}
```

- `getImageInfo()` is implemented on the base class; do not override it
- Wire new registries into `getRegistryInstance()` in `src/main.ts`

### Error Handling

- All action-level errors are caught in the `run()` try/catch and surfaced via `core.setFailed()`
- Registry/network errors throw `Error` with descriptive messages including the URL and status
- `fetchToken` in `token-utils.ts` produces structured error messages with an `errorPrefix`
  for caller context; follow the same pattern in new token implementations
- Never swallow errors silently; rethrow or log with `core.warning()` / `core.error()`

### Logging

- `core.debug(msg)` — internal tracing, only visible when `ACTIONS_RUNNER_DEBUG=true`
- `core.isDebug()` guard — use before expensive serialisation (e.g., `JSON.stringify`)
- `core.info(msg)` — user-visible operational output
- `core.warning(msg)` — non-fatal issues (e.g., missing optional credentials)
- `core.startGroup` / `core.endGroup` — wrap related log lines for collapsible sections
- `console.error()` — avoid; use `core.error()` instead (one existing exception in `auth.ts`)

---

## Testing

### Hermetic tests — `yarn test` must work offline

All tests in `__tests__/` are fully mocked and must never make real network calls.
Real end-to-end testing runs exclusively in `.github/workflows/test-workflow.yml`.

### Test layout

```bash
__tests__/
  image-utils.test.ts    ← pure unit tests, no network, no mocking needed
  token-utils.test.ts    ← unit tests, global.fetch mocked via jest.fn()
  docker-hub.test.ts     ← unit tests, global.fetch + @actions/core mocked
  github.test.ts         ← unit tests, global.fetch + @actions/core mocked

__mocks__/
  @actions/core.ts       ← manual mock; wired via moduleNameMapper in jest.config.js
```

### `@actions/core` mock

`@actions/core` is mapped to `__mocks__/@actions/core.ts` via `moduleNameMapper` in
`jest.config.js`. The mock exports `jest.fn()` stubs for every `@actions/core` export.
Import `jest` from `@jest/globals` inside the mock file (required for ESM mode).

### Mocking `getCredentials()` and calling `getToken()` in registry tests

`getToken()` and `getCredentials()` are both `protected` on the base class and its
implementations. They are plain prototype methods at runtime, so they can be accessed
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

The mock factory must implement all four:

```ts
function mockResponse(body: unknown, headers: Record<string, string> = {}): Response {
  const headersMap = {'content-type': 'application/json', ...headers}
  const bodyStr = JSON.stringify(body)
  return {
    ok: true, status: 200, statusText: 'OK',
    headers: {
      get: (name: string) => headersMap[name.toLowerCase()] ?? null,
      entries: () => Object.entries(headersMap)[Symbol.iterator](),
    },
    json: (jest.fn() as jest.MockedFunction<() => Promise<unknown>>).mockResolvedValue(body),
    text: (jest.fn() as jest.MockedFunction<() => Promise<string>>).mockResolvedValue(bodyStr),
  } as unknown as Response
}
```

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

**DockerHub / GitHubContainerRegistry — manifest list path:**

1. Token fetch
2. Manifest list fetch (content-type: `…manifest.list.v2+json` or `…oci.image.index.v1+json`)
3. One `getLayers` fetch per non-unknown platform

**DockerHub / GitHubContainerRegistry — single manifest path:**

1. Token fetch
2. Single manifest fetch (content-type: `…manifest.v2+json` or `…oci.image.manifest.v1+json`)
3. Blob config fetch (resolves architecture/os/variant)
4. `getLayers` fetch (fetches manifest by `docker-content-digest`)
