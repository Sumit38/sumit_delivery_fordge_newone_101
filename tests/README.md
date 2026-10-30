# DeliveryForge test suite

Three layers, one command each:

| Layer | Tool | Folder | Needs |
| --- | --- | --- | --- |
| Unit | Vitest | `tests/unit/` | Nothing |
| API | Playwright (`api` project) | `tests/api/` | Running app, a browser (the `apiRequest` fixture opens a page); Supabase test project for signed-in tests |
| E2E | Playwright (`e2e` project) | `tests/e2e/` | Running app, a browser; Supabase test project for signed-in tests |

The plan behind these tests (risks, priorities, scenarios) is in
`_bmad-output/test-artifacts/test-design-qa.md` and `test-design-architecture.md`.

## Setup

1. Use Node 24 (`.nvmrc`); Node 22 also works.
2. Run `npm install`.
3. Copy `.env.example` to `.env.test` and fill it in.
   - Point it at a **dedicated Supabase test project. Never use production.** The helpers create and delete users.
   - `.env.test` is git-ignored. Never commit it.
   - Set `ALLOW_TEST_USER_CREATION=true` only for the test project.
4. Install a browser:
   - `npx playwright install chromium`
   - If that download fails with a certificate error (corporate network), either set `NODE_EXTRA_CA_CERTS` to your company's root certificate, or use an installed browser with `PW_CHANNEL=msedge` (or `chrome`) in `.env.test`.
   - Do not turn off TLS checks.

Tests that need a signed-in user skip themselves, with a clear reason, when Supabase test settings are missing. Tests that need the fake AI provider (`AI_PROVIDER=fake`, not built yet, see TC-2 in the architecture doc) skip in the same way.

## Running tests

| Command | What it runs |
| --- | --- |
| `npm test` | Unit, then API, then E2E |
| `npm run test:unit` | Vitest once |
| `npm run test:unit:watch` | Vitest in watch mode |
| `npm run test:unit:coverage` | Vitest with coverage of `lib/**` |
| `npm run test:api` | Playwright `api` project |
| `npm run test:e2e` | Playwright `e2e` project |
| `npm run test:e2e:headed` | E2E with a visible browser |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:debug` | Step through with the Playwright inspector |
| `npm run test:p0` | Only tests tagged `@P0` |
| `npm run test:report` | Open the last HTML report |

Playwright starts `npm run dev` for you. To test an app that is already running (local or deployed), set `BASE_URL` and it will not start one.

Failed tests keep a trace in `test-results/`. Open one with `npx playwright show-trace <path>/trace.zip`.

## How it is built

```
tests/
  api/        API specs (Playwright, no browser)
  e2e/        UI specs (Playwright, browser)
  unit/       Vitest specs
  support/
    merged-fixtures.ts   The only place specs import `test` from
    auth-fixture.ts      Signed-in sessions per worker
    auth/                Supabase auth provider (password grant, token cache)
    global-setup.ts      Prepares the token store in .auth-sessions/
    factories/           Test data: requirements, Q&A answers
    helpers/             Env checks, Supabase admin, score rules, leak scan
```

- **Fixtures.** Every spec imports `test`, `expect` and `log` from `support/merged-fixtures.ts`. It merges the `@seontechnologies/playwright-utils` fixtures (`apiRequest`, `interceptNetworkCall`, `recurse`, network error monitor, file utils) with our auth fixture.
- **Auth.** Each Playwright worker signs in as its own user (`<prefix>+worker-N@<domain>`). The token is cached in `.auth-sessions/` and refreshed when it expires. To test signed-out behaviour, use `test.use({ authSessionEnabled: false })`.
- **Factories.** `createRequirement()` builds requirement text. `createAnswers({ valid, invalid })` builds Q&A answers, so a test can choose which path it gets (0 valid = Assumption, 1–7 = Hybrid, 8+ = Guided).
- **Score rules** (`helpers/score-rules.ts`). These encode the PRD rules: path from valid answers, M = E − N + 2P, and bands per path. Tests compare app output against them. They have their own unit tests, because every other test trusts them.
- **Leak scan** (`helpers/leak-scan.ts`). Checks customer-facing text for internal data: score, formula, band, path, confidence, inferred labels, backup-estimate wording.

## Writing tests

- **Selectors:** roles and labels first (`getByRole`, `getByLabel`), then `data-testid`. No CSS or XPath chains. The handoff doc lists the suggested `data-testid` values.
- **Waiting:** never `waitForTimeout`. Wait for the thing you need: a web-first assertion, or an intercepted response.
- **Network:** call `interceptNetworkCall(...)` *before* the action that triggers the request, then `await` it after.
- **API calls:** use the `apiRequest` fixture, not raw `request`.
- **Polling:** use `recurse`, not loops with sleeps.
- **Logging:** use `log.step(...)`, not `console.log`.
- **Isolation:** each test makes its own data with factories and does not depend on another test. Clean up what you create.
- **Structure:** Given / When / Then comments; one behaviour per test; tag priority in the title (`[P0] ... @P0`).
- **Size:** keep spec files well under 1,000 lines.
- **Skips:** a conditional `test.skip` must have a comment on the line above saying why.

## CI

- Pull requests: unit, API and E2E with the fake AI provider. Target under 12 minutes.
- Nightly: real-Claude checks (score invariants, timeouts).
- CI downloads Chromium normally (`npx playwright install --with-deps chromium`).
- Store `.env.test` values as CI secrets.
- Reports: JUnit at `test-results/junit.xml` (Playwright) and HTML in `playwright-report/`. In CI, Vitest also writes JUnit.
- Keep traces and reports as build artifacts on failure.

`bmad-testarch-ci` can generate the pipeline.

## Write-time checks (TEA hook)

Claude Code runs `.claude/hooks/tea-enforce.cjs` when it writes test files (registered in `.claude/settings.json`). It checks files that match `testGlobs` in `.tea/enforce-config.json`.

| Rule | What it catches | Action |
| --- | --- | --- |
| C1 Disabled test | `skip` / `todo` / `xit` with no reason comment | Warn |
| C2 Focused test | `.only` | Block |
| C3 Tautological assertion | e.g. `expect(true).toBe(true)` | Block |
| C4 Flow asserts nothing | A test with no assertion | Block |
| H1 Hard wait | `waitForTimeout`, `sleep`, `delay(n)` | Block |
| H5 Oversize test file | Over `maxFileLines` (1,000) | Block |

The Pact rules (H6, H8) do not apply here: there are no contract tests.

Severity comes from the TEA criteria registry (`bmad-testarch-test-review/steps-c/criteria-registry.md`), not from the hook.

To turn a rule off for this project, add its id to `disabledRules` in `.tea/enforce-config.json` and give the reason in the commit message. `hookSha256` lets the hook detect if it has been edited; update the hook by copying it again, not by hand.

## Further reading

TEA knowledge fragments live in `.claude/skills/bmad-tea/resources/knowledge/`. The most useful here:

- `playwright-utils-mandate.md`: which utilities to use and why
- `fixture-architecture.md`, `data-factories.md`
- `network-first.md`, `selector-resilience.md`, `test-quality.md`
- `auth-session.md`
