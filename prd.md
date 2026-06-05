# Add Unit & Integration Tests to wp-docker (no source changes)

## Context

`wp-docker` is a ~3,700-LOC Node.js CLI tool (CommonJS, vanilla JS, Node 20+, no build
step) for managing Dockerized WordPress dev environments. It currently has **zero
tests** — CI only runs ESLint, and the only safety net is the linter. The goal is to
add a comprehensive unit + integration test suite so future features can be added
without fear of regressions, **without changing any production code** (the architecture
is to be preserved exactly as-is).

This is feasible because the codebase already has clean seams: pure helper/validator
modules, factory functions with injected dependencies (`makeInquirer({ prompt })`,
`makeDockerCompose(spinner)`), and thin wrappers around external tools
(`src/utils/docker-compose.js`, `src/utils/make-docker.js`, `src/utils/yaml.js`). The
side-effecting modules import their dependencies by name, so they can be isolated with
Jest's module mocking — again, no source edits required.

Decisions confirmed with the user: **Jest**, **comprehensive** scope, **wire into CI**.

## Key Decisions / Constraints

- Node version: use node 26
- **Framework: Jest.** `.eslintrc.json` already declares `"jest": true` (line 6), so test
  globals (`describe`, `it`, `expect`, `jest`) are recognized with **no ESLint change**.
  Jest works natively with CommonJS — no Babel/transform needed.
- **No production code changes.** Modules that don't export their internal pure functions
  (e.g. `marshalDomains`/`marshalWordPress` in `create/inquirer.js`) are tested
  _indirectly_ through their public factory by injecting a fake `prompt`. Side-effecting
  modules are tested by mocking their imported dependencies.
- **Tests live in a top-level `test/` directory** (mirroring `src/`). This keeps tests
  out of the published npm package — `package.json` `files` only lists
  `["src","global","scripts","index.js","hosts.js"]`, so `test/` ships nothing.
- **Test files must pass the existing lint.** `npm run lint` runs `eslint .` over the
  whole repo (incl. `test/` and `jest.config.js`), and the Husky pre-commit hook runs
  `lint-staged` on `*.js`. So every test file is written in the repo's 10up style:
  **tabs** for indent, spaces inside parens/brackets/braces, `template-curly-spacing`
  (`expect( foo ).toBe( bar )`, `` `http://${ x }` ``). This is the single most important
  detail for not breaking the existing workflow.

## Setup Changes (config only — not source)

> ✅ **DONE (2026-06-05):** All setup changes implemented. Jest installed (^29.7.0), scripts added, jest.config.js created, .gitignore updated with `coverage/`, CI workflow bumped to Node 26 with `npm test` step.

1. **`package.json`** ✅
    - Add devDependency: `jest` (^29, supports Node 20).
    - Add scripts:
        - `"test": "jest"`
        - `"test:watch": "jest --watch"`
        - `"test:coverage": "jest --coverage"`
2. **`jest.config.js`** ✅ (new, root, written with tabs / lint-clean):
    ```js
    module.exports = {
    	testEnvironment: "node",
    	testMatch: ["**/test/**/*.test.js"],
    	collectCoverageFrom: ["src/**/*.js"],
    	coverageDirectory: "coverage",
    	clearMocks: true,
    };
    ```
3. **`.github/workflows/nodejs.yml`** ✅ — bump `node-version` `'12'` → `'26'` (matches
   `engines`; Node 12 would fail `npm ci` on current deps anyway) and add a step after the
   linter: `run: npm test`.
4. **`.gitignore`** ✅ — add `coverage/`.

## Test Inventory

### `test/unit/` — pure functions, no mocking

| File                              | Module under test                 | Cases                                                                                                                                                                                                                                                                                           |
| --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ `helpers.test.js`              | `src/helpers.js`                  | `unleadingslashit`, `untrailingslashit`, `removeEndSlashes` — leading/trailing/both/none, multiple slashes (16 tests, 2026-06-05)                                                                                                                                                               |
| ✅ `prompt-validators.test.js`    | `src/prompt-validators.js`        | `validateNotEmpty` (empty/whitespace/valid), `validateBool` (y/yes/n/no/other/non-string passthrough), `parseHostname` (strips `http(s)://`, spaces, path), `parseProxyUrl` (adds protocol, trims slashes) — 43 tests total across both unit files (2026-06-05)                                 |
| ✅ `env-utils.test.js` (pure subset) | `src/env-utils.js`              | `envSlug` (slugify behavior), `createDefaultProxy` (adds `http://`, `.com` TLD handling) — 13 tests (2026-06-05)                                                                                                                                                                                |
| `configure.test.js` (pure subset) | `src/configure.js`                | `createProxyConfig` (placeholder `#{TRY_PROXY}`/`#{PROXY_URL}` substitution against a fixture string), `getDefaults`, `getConfigDirectory`/`getGlobalDirectory`/`getConfigFilePath` (path composition under a stubbed `os.homedir`)                                                             |
| `create/inquirer.test.js`         | `src/commands/create/inquirer.js` | Call `makeInquirer({ prompt })` with a **stub prompt** returning canned answers; assert the marshaled return object — exercises `marshalDomains` (single vs array, dedupe via Set, extraHosts) and `marshalWordPress` (boolean→{}, title/user/pass/email, type, purify) without touching source |

### `test/integration/` — real module logic with mocked dependencies

| File                                 | Module under test                            | Mocks                                                                                                                                                          | Focus                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create/make-docker-compose.test.js` | `src/commands/create/make-docker-compose.js` | `../../configure` (`config.get('snapshotsPath')`), `os.platform`, `process.env.USER`/`process.getuid` for the Linux branch                                     | The generated compose object across matrix: PHP version → correct `images[...]`; `wordpress.type` `dev` vs other → nginx conf + wp-cli volume; `elasticsearch` on/off → service+volume; `certs` on/off → `CERT_NAME`; **Linux vs non-Linux** branch (build args, ssh/aws/wpsnapshots volumes); the `settings.dockerCompose` filter hook. Use a **snapshot** for the full object plus targeted assertions. |
| `utils/docker-compose.test.js`       | `src/utils/docker-compose.js`                | `docker-compose` npm package                                                                                                                                   | Each proxied method (`down/exec/logs/ps/pullAll/restartAll/run/upAll`) forwards args and returns `out`; throws `err` when `exitCode` is truthy (`interpretComposerResults`); `isRunning` → true when `port` resolves, false when it rejects                                                                                                                                                               |
| `environment.test.js`                | `src/environment.js`                         | `./configure`, `./database`, `./env-utils`, `./gateway`, `./utils/docker-compose`, `fs-extra`, `inquirer`, `which`, `@vscode/sudo-prompt`                      | Orchestration & branching: `start` (pull vs no-pull, calls `gateway.startGlobal` then `compose.upAll`), `stop`, `restart` (`isRunning` true→down first), `deleteEnv` (confirm=false short-circuits; confirm=true removes files/certs/db; `manageHosts` true→sudo hosts removal), `startAll/stopAll/restartAll/deleteAll` iterate envs. Assert call order/args, not Docker behavior.                       |
| `gateway.test.js`                    | `src/gateway.js`                             | `./utils/make-docker` (mock docker w/ `getNetwork`/`getVolume`/`createNetwork`/`createVolume`), `./utils/docker-compose`, `./configure`, `fs`, `netcat/client` | `ensureNetworkExists` (creates when `inspect` rejects, skips when it resolves), `removeNetwork`, `ensureCacheExists`/`removeCacheVolume`, `startGlobal` idempotency via the module-level `started` flag, `waitForDB` (fake timers + mock netcat emitting `data`). Use `jest.resetModules()` per test to reset `started`.                                                                                  |
| `database.test.js`                   | `src/database.js`                            | `mysql` (mock `createConnection` → `{ query(sql, cb), destroy() }`)                                                                                            | `create`/`deleteDatabase`/`assignPrivs` emit the correct SQL, `destroy()` the connection, resolve on success, reject on query error                                                                                                                                                                                                                                                                       |
| `certificates.test.js`               | `src/certificates.js`                        | `child_process` (`execSync`), `fs` (`promises.readFile/writeFile`), `mkcert`, `mkcert-prebuilt`, `./configure` (`getSslCertsDirectory`), `./env-utils`         | `getCARoot` (returns trimmed CAROOT), `installCA` (true on success, false on throw), `generate` (reads rootCA files, calls `mkcert.createCert` with `allHosts` incl. wildcards, writes `.crt`/`.key`, returns paths)                                                                                                                                                                                      |

### `test/helpers/` (shared test utilities, lint-clean)

- `mock-spinner.js` — factory returning a fake ora spinner (`start/succeed/warn` as `jest.fn()`), used across orchestrator tests to assert spinner-vs-console branches.
- Small mock factories for a fake `docker` (dockerode) instance and a fake mysql connection, to avoid duplication.

### `test/fixtures/`

- A sample nginx config string containing `#{TRY_PROXY}` / `#{PROXY_URL}` for the
  `createProxyConfig` test (or inline it — small enough).

## Techniques to note for implementation

- **Module-level state:** `configure.js` caches `let config = null`; `gateway.js` has
  `let started`. Use `jest.resetModules()` + re-`require()` in `beforeEach` for those two
  suites so state doesn't leak between tests.
- **`clearMocks: true`** in jest config resets mock call history between tests
  automatically.
- **Snapshots** are appropriate for `make-docker-compose` (large stable object); pair with
  explicit assertions on the branch-specific fields so failures are readable.
- **Fake timers** (`jest.useFakeTimers()`) for `gateway.waitForDB` polling loop.
- Mock `os.platform()` (not the whole `os`) where only the platform branch matters; or
  `jest.mock('os', () => ({ ...jest.requireActual('os'), platform: () => 'linux' }))`.

## Verification

1. `npm install` — pulls in Jest.
2. `npm test` — all unit + integration suites pass (green).
3. `npm run test:coverage` — produces a coverage report; confirm the targeted modules
   (helpers, validators, env-utils, configure, make-docker-compose, docker-compose
   wrapper, environment, gateway, database, certificates) are covered.
4. `npm run lint` — still passes with the new `test/` files and `jest.config.js`
   present (proves the no-workflow-breakage constraint).
5. Make a trivial throwaway commit to confirm the Husky `pre-commit` (lint-staged) hook
   still succeeds with test files staged, then discard it.
6. Confirm CI: the updated workflow runs `npm run lint` **and** `npm test` on push.

## Out of scope / future (optional follow-ups)

- The top-level `src/commands/create.js` orchestrator (large; its two highest-value
  pieces — `makeInquirer` and `makeDockerCompose` — are already covered).
- Real end-to-end tests that spin up Docker (these would require Docker in CI; the plan
  deliberately mocks the Docker/MySQL boundaries instead).
- Bumping `actions/checkout`/`actions/setup-node` action versions (cosmetic; only the
  Node version bump is functionally required).
