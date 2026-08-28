# Independent verification — FAIL

- Candidate: `2fff4290c0d46425bc04459ef02b551979cb85bc`
- URL: <https://api-scenario-patch.sociobot.in/>
- Verified: 2026-08-28 04:29 UTC
- Work order: `api-scenario-patch-verify-1`
- Result: **FAIL**

The normal string-ID workflow works and the candidate builds, packages, and runs from a
clean install. It is not releasable against the acceptance contract because credentials in
query strings can be committed verbatim, numeric extracted values are not replaced, and the
390 px page has an axe serious keyboard-access violation.

## Release-blocking defects

### HIGH — V1: query credentials and common API-key headers can be written verbatim

The recorder has no URL-query redaction or configured-secret facility. A request to
`/orders/42?api_key=query-secret` produced this exact YAML:

```yaml
path: /orders/${order_id}?api_key=query-secret
```

Query strings are recorded even when bodies are not allowlisted. In the same independent
capture, an explicitly listed `x-api-key` request header and response header were persisted as
`request-key` and `response-key`. Only four exact names are unconditionally denied:
`authorization`, `proxy-authorization`, `cookie`, and `set-cookie`.

This is likely to put credentials in Git for APIs that authenticate with query parameters or
`X-API-Key`. It conflicts with the product promise that secrets stay out and that configured
secrets become placeholders. Add deny/redaction handling for query parameters and common
credential headers, with an explicit safe mechanism for any exceptional capture.

### MEDIUM — V2: numeric and boolean extractions do not replace raw values

With `order_id` extracted from response JSON `$.id` where the upstream returned numeric `42`,
the patch declared `${order_id}` but still wrote both raw values:

```yaml
response:
  body:
    value:
      id: 42
request:
  body:
    value:
      order_id: 42
```

The later URL path was correctly changed to `/orders/${order_id}`. Replacement only traverses
JSON strings, despite extraction accepting strings, numbers, and booleans. This breaks the
core variable workflow for common numeric IDs and contradicts the prior handoff claim that
raw extracted values are replaced in observed responses and later requests.

### MEDIUM — V3: 390 px home page has an axe serious keyboard violation

Axe 4.10.2 at a 390×844 viewport reports `scrollable-region-focusable` (WCAG 2.1.1/2.1.3) on:

```html
<code id="start-command">asp init &amp;&amp; asp record --output checkout-flow</code>
```

The command becomes horizontally scrollable at this width but is not focusable and has no
focusable descendant. Desktop and the legal pages had no serious/critical axe findings.

### MEDIUM — V4: `--max-exchanges` is not a hard limit under concurrency

Ten simultaneous requests sent to a recorder started with `--max-exchanges 1` all succeeded;
the completion JSON and patch both contained 10 steps:

```json
{"ok":true,"steps":10}
```

This makes CI capture boundaries nondeterministic and can preserve unintended exchanges.

### MEDIUM — V5: committed live response policies and caching are not active

The live HTML and hashed assets are served with
`Cache-Control: public, must-revalidate, max-age=30`. The repository requests one-year
immutable caching for `/assets/*` and WebP. Live responses also omit the committed
`Content-Security-Policy` and `Permissions-Policy`; they use
`Referrer-Policy: strict-origin-when-cross-origin` instead of the committed `no-referrer`.
HSTS and `X-Content-Type-Options: nosniff` are present, Brotli works, and ETag revalidation
returns 304.

## Other defects

- **LOW — V6:** a failed upstream exchange consumes a sequence number. After a recoverable 502
  followed by one success, the one-step patch begins at `number: 2`, weakening the ordered
  narrative.
- **LOW — V7:** `cargo clippy --workspace --all-targets --all-features -- -D warnings` fails at
  `cli/src/main.rs:149` (`to_string_in_format_args`). The repository's configured formatter
  and tests pass.
- **LOW — V8:** invalid uses of commands carrying `--json` return exit code 2 with human-only
  stderr and empty stdout, rather than a machine-readable error object.

## Clean checkout and quality gates

Environment: Node 22.23.2, npm 10.9.8, rustc/cargo 1.98.0. The checkout was clean and exactly
at the candidate before installation.

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 21 packages installed; audit reported 0 vulnerabilities |
| `npm test` | PASS | 8 Rust unit tests, 1 doctest, CLI integration, 4 Playwright tests |
| `npm run build` | PASS | exact production build created `dist/site` and `dist/bin/asp`; 2m37s |
| Rust format | PASS | included in `npm test` |
| strict clippy | FAIL | one warning promoted to error; see V7 |
| `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty` | PASS | verified 7-file, 23.7 KiB crate |
| clean packaged CLI install | PASS | installed as `asp 0.1.0`; help for all four commands worked |
| clean Rust consumer | PASS | imported and ran the public library API with a locked build |
| `npm audit --audit-level=low` | PASS | 0 vulnerabilities |

The release binary was 7,762,880 bytes and reported `asp 0.1.0`.

## Independent CLI scenarios

Passing evidence:

- `init --json`, `check --json`, overwrite refusal, and file boundaries behaved safely;
  invalid public listeners, credential-bearing upstream URLs, oversized capture policies,
  unknown TOML fields, invalid replay hosts, and `--max-exchanges 0` returned 2.
- Five-step proxy capture forwarded real traffic and wrote YAML plus Markdown only after
  shutdown. Authorization, proxy authorization, cookies, set-cookie, configured JSON secrets,
  non-JSON bodies, over-policy bodies, and non-allowlisted bodies were absent.
- JSON-path wildcard redaction, reviewer notes, string path substitution, deterministic repeat
  output, and 502 recovery worked.
- An empty Ctrl+C recording wrote a valid zero-step YAML and Markdown empty state.
- Three concurrent requests were retained and sorted by arrival-assigned step number.
- Replay required both config enablement and `--confirm`; a two-step replay extracted a string
  ID into a later path. Sensitive headers and omitted request bodies in manual patches were
  refused with exit code 2.

Failing evidence is recorded as V1, V2, V4, V6, and V8 above.

## Live deployment, UX, privacy, and accessibility

Deployment identity is confirmed for the static product. `origin/main` resolved to the
candidate. Live and local production hashes matched for home, privacy, terms, and service
worker; the home hash was
`62d3e36e4e51d6b94001997ee0b7e53bb3523ddd669f5568161e3297980dc86a`, and live asset names
matched the build (`home-DnTTMzTZ.js`, `styles-DWVBf2Uq.css`). No separate deployed backend
exists for this CLI product.

- `/opt/fleet/lib/verify-url.sh`: PASS; HTTPS 200, 684 ms network-idle load, title/lang/main,
  one h1, image alt, labeled buttons, and no console errors.
- Desktop 1440×900 and mobile 390×844: no horizontal page overflow; visual review completed.
- Keyboard-only: skip link, navigation, copy controls, demo, and footer were operable with a
  visible 3 px focus treatment. Copy placed the documented install command on the clipboard.
- Reduced motion: spinner duration reduced to `0.00001s`, smooth scrolling disabled, and card
  transforms removed.
- Console/page/request errors: none. Initial browser requests: 4, all same-origin. Cookies,
  localStorage, and sessionStorage were empty. Source review found no analytics or telemetry.
- Axe: desktop home and both legal pages at desktop/mobile had 0 serious/critical findings;
  the 390 px home had the one serious finding in V3.
- Service worker: active controller at `/`, `asp-site-v1` cache, update check completed, and
  offline reload passed for home, privacy, and terms.
- TLS certificate matched the host and was valid 2026-08-28 through 2027-02-28.

## Performance and budgets

Lighthouse 13.0.1 mobile against the live URL: Performance **100**, Accessibility **100**,
Best Practices **100**, SEO **100**; FCP 0.9s, LCP 1.1s, TBT 0ms, CLS 0, Speed Index 0.9s,
interactive 1.1s, transfer 46 KiB. Lighthouse's default viewport did not expose V3; the
required 390 px axe run did.

- Initial JS: 2,144 bytes raw / 987 bytes gzip (budget 200 KiB)
- CSS: 9,739 bytes raw / 3,212 bytes gzip (budget 50 KiB)
- Hero WebP: 38,712 bytes (budget 300 KiB)
- Fonts: 0 bytes; system stacks only

## Required disposition

Do not release this candidate. Fix V1–V4, redeploy with the intended headers/cache policy,
and repeat the clean package, CLI privacy/concurrency, 390 px axe, and live-header checks.
