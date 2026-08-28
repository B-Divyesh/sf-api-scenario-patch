# Independent verification 2 — FAIL

- Candidate: `6b20bbd59b5d67b88e418c1562cd3382cd0fd91b`
- URL: <https://api-scenario-patch.sociobot.in/>
- Verified: 2026-08-28 06:33 UTC
- Work order: `api-scenario-patch-verify-2`
- Result: **FAIL**

The candidate builds, packages, installs, and performs the core configured capture/replay job.
The prior verification findings are repaired. It is still not releasable against the researched
brief because the configuration created by `asp init` opts `/v1/orders` request and response
bodies into capture. A minimally edited generated config therefore writes arbitrary body data
without the user having added a body allowlist, contrary to the required default-deny policy.

## Release-blocking defect

### HIGH — V9: `asp init` does not generate a default-deny body policy

The command describes itself as “Write a commented, default-deny configuration file,” the
generated comment says bodies are default-deny, and the acceptance contract requires
default-deny body recording. The generated file nevertheless contains active permissions:

```toml
request_body_paths = ["/v1/orders"]
response_body_paths = ["/v1/orders"]
```

Independent reproduction used the installed packaged CLI, ran `asp init`, changed only the
example upstream and loopback port so the proxy could run, and sent one `POST /v1/orders`.
The CLI exited 0, and both outputs persisted the unconfigured values:

- request JSON: `{"unconfigured_secret":"raw-request-secret"}`
- response JSON: `{"customer_email":"private@example.test","id":"ord-default"}`

Both `raw-request-secret` and `private@example.test` appeared verbatim in the generated YAML.
This is a privacy-by-default failure on the primary onboarding path. Make both generated body
arrays empty and retain `/v1/orders` only as commented examples. Add an integration test that
runs the actual `asp init` output after changing only upstream/listen and proves request and
response bodies remain omitted.

## Other defects

### LOW — V10: several mobile content classes are below the product's 16 px type floor

At the required 390 px viewport, computed sizes include `.steps p` 14.72 px,
`.diff-snippet` 14.08 px, `.proof-list small` and `.microcopy` 12.48 px, and the footer
12.8 px. This conflicts with `.factory/design.md`'s stated 16 px minimum scale and the supplied
clarity baseline. Axe reports no contrast failure and a 200% text-size smoke test retained the
content, so this is a readability/design-contract issue rather than an axe blocker.

### LOW — V11: one mobile footer target is 2 px under the required width

The visible footer `Terms` link measures 42×44 CSS px at 390×844. All other visible links and
buttons were at least 44×44. Adjacent footer links have ample spacing, but the supplied baseline
requires each target itself to be at least 44×44.

### LOW — V12: unknown navigation paths return the home page with HTTP 200

`GET /definitely-not-a-real-page` returned status 200 and a byte-identical copy of the home
page. The static site's broad navigation fallback hides invalid URLs instead of providing a
404/error state. This does not affect the CLI, known pages, or offline reload.

## Clean checkout and quality gates

The repository was cloned afresh from GitHub into an isolated temporary directory and checked
out detached at the exact candidate before installation. Environment: Node 22.23.2, npm
10.9.8, rustc/cargo 1.98.0.

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 21 packages installed; 0 audit vulnerabilities |
| `npm audit --audit-level=low` | PASS | 0 vulnerabilities |
| `npm test` | PASS | strict format and Clippy; 7 library tests, 3 binary tests, 1 doctest; static policy and proxy integration; 4 Chromium tests |
| `npm run build` | PASS | exact production command produced `dist/site` and `dist/bin/asp` |
| `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty` | PASS | 7 files, 97.0 KiB unpacked / 26.4 KiB compressed; package verification compiled |
| packed-crate clean install | PASS | installed `asp 0.1.0` from the extracted `.crate` |
| documented Git install | PASS | exact documented command installed `api-scenario-patch v0.1.0` from Git commit `6b20bbd5` in a clean root |
| clean Rust consumer | PASS | locked consumer imported and executed `redact_json`, `substitute_variables`, and `sanitize_path_and_query` |

The release binary is 7,877,800 bytes and reports `asp 0.1.0`. All command and subcommand help
screens are present, non-interactive, and document the exit-code/privacy behavior.

## Independent CLI and proxy scenarios

Passing evidence, run against the CLI installed from the packed candidate:

- `init`, `check`, `--force`, overwrite refusal, and JSON success/error output behaved as
  documented. Clap and semantic input failures returned exit 2 with one JSON object on stdout
  and empty stderr; an unreachable replay target returned exit 1 with `kind: "runtime"`.
- Validation rejected version 0, empty names, credential-bearing upstream URLs, public
  listeners, body limits 0 and 1,048,577, query-bearing route prefixes, empty query names, and
  unknown fields. Body-limit boundaries 1 and 1,048,576 validated successfully.
- A missing configured-secret environment variable failed before listener startup and created
  neither YAML nor Markdown.
- Two independent four-step recordings were byte-identical. They covered wildcard and scalar
  redaction, environment-backed configured secrets, string/number/boolean extraction, notes,
  query allowlisting, credential-shaped query denial, API-key/header denial, body route
  boundaries, oversized bodies, and non-JSON bodies.
- Authorization and other credentials reached the intended local upstream but no raw test
  secret appeared in YAML or Markdown. Expected placeholders included `${REDACTED_QUERY}`,
  `${REDACTED_CARD}`, `${REDACTED_TOKEN}`, `${REDACTED_ITEM}`, `${CLIENT_SECRET}`,
  `${order_id}`, `${item_count}`, and `${enabled}`.
- Output files did not exist before clean recorder shutdown. Existing outputs were refused and
  remained byte-identical. Ctrl+C with no traffic wrote valid zero-step YAML and the Markdown
  “No exchanges were recorded” state.
- Twelve concurrent requests with `--max-exchanges 1` deterministically returned one 200 and
  eleven 429 responses and persisted one step.
- Replay made no request without `--confirm` or while config replay was disabled. With both
  opt-ins it executed two steps, extracted `created-99`, and used it in the later path/body.
  Sensitive manual headers and unresolved placeholders were refused.

V9 is the separate failing test of the unmodified `asp init` capture policy.

## Live deployment, browser, privacy, and PWA

Deployment identity is confirmed for this CLI product's static documentation. At verification
time `origin/main` resolved to the candidate. Live/local SHA-256 hashes match exactly:

| Resource | SHA-256 |
| --- | --- |
| `/` | `ce801924d8c5297a7904de365361deae589d4fdaa28c1abe91a586131bbb3174` |
| `/privacy/` | `d82ef9462d4a06cafd77d7ad4787aa9312abb1b84f273bbabbf4adb57470e1cf` |
| `/terms/` | `fb9de8065884c1cb5b050c230139795a4dbe08cec6e1a42992b6ff39da79174d` |
| `/sw.js` | `23481d0352a66a66bc397777f49c84bdc894f7815ace17632b7250cb71ea4874` |

- `/opt/fleet/lib/verify-url.sh`: PASS in 605 ms; HTTPS 200, title, `lang`, one `h1`, `main`,
  image alt, button names, and zero console errors.
- Manual Playwright at 1440×900 and 390×844: home/privacy/terms have no horizontal page
  overflow and zero axe 4.10.2 serious/critical findings. Screens were visually inspected.
- Keyboard-only use: skip link is first, navigation/order is logical, install copy works with
  Enter, the demo works with Space, mobile scrollable commands receive focus, and focus uses a
  visible 3 px outline. V11 is the only undersized visible target.
- Reduced motion: animation duration is 0.00001 s, iteration count is 1, smooth scrolling is
  disabled, and decorative transforms are removed. A 200% text-size smoke test retained content
  and controls; code rails remained intentionally scrollable.
- No console errors, page errors, or request failures. All observed browser requests were
  same-origin. Cookies, localStorage, and sessionStorage remained empty. Source review found no
  analytics, telemetry, CDN font/script, beacon, or third-party runtime request.
- Service worker `/sw.js` controlled the page with cache `asp-site-v2`; an explicit update
  completed. Offline reload passed for `/`, `/privacy/`, and `/terms/`, and the home offline
  status appeared.
- HTTP redirects to HTTPS. The certificate SAN matches the host and is valid from 2026-08-28
  through 2027-02-28.

## Response policy and performance

- HTML serves CSP `default-src 'self'` with `object-src 'none'`, `base-uri 'none'`, and
  `frame-ancestors 'none'`; Permissions-Policy disables camera/microphone/geolocation;
  Referrer-Policy is `no-referrer`; nosniff and HSTS are present.
- Hashed JS and the WebP use `public, max-age=31536000, immutable`; HTML and service worker use
  30-second revalidation. Brotli is active, `Vary: Accept-Encoding` is present, and an ETag
  conditional request returned 304.
- Lighthouse 13.0.1 mobile, live: Performance **100**, Accessibility **100**, Best Practices
  **100**, SEO **100**; FCP 0.9 s, LCP 1.1 s, TBT 0 ms, CLS 0, Speed Index 0.9 s, total 45 KiB.
- Initial JS is 2,144 bytes raw / 987 bytes gzip; CSS 9,739 / 3,212; hero WebP 38,712; fonts 0.
  These are well inside the 200 KiB JS, 50 KiB CSS, 300 KiB image, and 120 KiB font budgets.

There is no deployed API/backend for this CLI artifact, so server health/build-identity checks
do not apply. Proxy concurrency, local persistence boundaries, packaged installation, and the
public library/CLI surfaces were tested directly as described above.

## Required disposition

Do not release candidate `6b20bbd59b5d67b88e418c1562cd3382cd0fd91b`. Fix V9 and add a
regression that exercises the generated config itself. V10–V12 should also be corrected to meet
the supplied design/accessibility/error-state contract, then repeat clean package, default-policy,
mobile, and live deployment verification.
