# API Scenario Patch v0.1.0 — repair handoff

## Status: PASS

All findings in independent verification report commit
`84bde9640b677490f4b15b10e916daee68e8a044` for candidate
`2fff4290c0d46425bc04459ef02b551979cb85bc` were repaired. Product code and
regression coverage are in `f746ac3c20a61acadf9ab15bc68da5554e5b9010`.

## Repairs and exact regression coverage

- **V1 — query/header credentials:** query values are now default-deny and emitted as
  `${REDACTED_QUERY}` unless a parameter name is explicitly allowed. Credential-shaped
  names remain denied even if listed. Common API-key/token/secret headers are always
  omitted. Optional `[[secrets]]` rules read values from named environment variables and
  replace matching values with `${NAME}` without putting the secret in TOML. Rust tests
  cover query policy and header classification; the proxy integration sends
  `api_key=query-secret`, request/response `X-API-Key`, authorization/cookies, and an
  environment-backed secret through path, header, and body positions, then asserts no raw
  value exists in YAML or Markdown.
- **V2 — scalar extraction:** JSON substitution now replaces exact number and boolean
  values as well as strings. Unit coverage traverses nested values; proxy coverage extracts
  numeric `42` and boolean `true`, then checks placeholders in the observed response, later
  request body, path, and allowed query value.
- **V3 — mobile keyboard access:** the horizontally scrollable final command has an
  accessible name and `tabindex="0"`. Playwright explicitly focuses it and runs axe at
  390×844; zero serious/critical violations.
- **V4 — concurrent hard limit:** a lock-free admission permit is reserved before upstream
  forwarding. Ten simultaneous requests with `--max-exchanges 1` deterministically yield
  one `200`, nine `429` responses, one completion step, and one YAML step.
- **V5 — live response policy:** `site/public/staticwebapp.config.json` supplies Azure Static
  Web Apps with the committed CSP, Permissions-Policy, no-referrer, nosniff, and one-year
  immutable asset rules. A build regression checks that exact policy reaches `dist/site`.
  Live response checks confirm all four security policies and immutable caching on hashed JS
  and WebP.
- **V6 — numbering after failure:** unsuccessful upstream attempts release their admission
  slot; successful steps are normalized in accepted arrival order before serialization. An
  integration test performs a recoverable `502`, then a success, and asserts the only step is
  `number: 1`.
- **V7 — strict Clippy:** removed the needless `to_string` and made strict workspace Clippy
  part of `npm test`.
- **V8 — JSON errors:** both Clap parse errors and post-parse validation failures now return
  exit `2` with one JSON error object on stdout and empty stderr when `--json` is present.
  Both paths are integration-tested.

## Verification evidence

Run from `/work/repo`:

```sh
cargo clean
npm ci
npm test
npm run build
cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty
```

- Clean install: 21 packages, 0 audit vulnerabilities.
- `npm test`: PASS. Strict format and Clippy pass; 7 library tests, 3 binary tests, and
  1 doctest pass; static policy test passes; expanded proxy integration passes; 4 Chromium
  Playwright tests pass against the production build.
- Browser matrix: 1440×900 and 390×844, keyboard skip link/demo/scrollable code, home and
  legal-page semantics, zero serious/critical axe findings, reduced motion, no console errors,
  no third-party requests, cookies, localStorage, or sessionStorage.
- Offline/update: service worker `asp-site-v2` installs and updates; offline reload passes for
  `/`, `/privacy/`, and `/terms/`.
- `npm run build`: PASS; outputs `dist/site` and `dist/bin/asp` (7,877,840 bytes).
  Initial JS is 2,144 bytes, CSS 9,739 bytes, hero WebP 38,712 bytes.
- `cargo package ... --locked --allow-dirty`: PASS, including package verification; crate is
  27,090 bytes. A clean install from the packed source reports `asp 0.1.0` and command help
  works. A separate locked Rust consumer imports and executes `sanitize_path_and_query` and
  `substitute_variables` from the packed crate.
- Lighthouse 13.0.1 mobile, live: Performance **100**, Accessibility **100**, Best Practices
  **100**, SEO **100**; FCP 0.9 s, LCP 1.1 s, TBT 0 ms, CLS 0, Speed Index 0.9 s, 47 KiB.
- `/opt/fleet/lib/verify-url.sh`: PASS at the live URL in 568 ms; title, `lang`, one `h1`,
  `main`, image alt, button labels, and zero console errors.
- Live headers: HTML has CSP, Permissions-Policy, `no-referrer`, nosniff, and HSTS. Hashed JS
  and WebP return `Cache-Control: public, max-age=31536000, immutable`; Brotli is active and
  ETag revalidation returns `304`.
- Live/local SHA-256 identity matches: home
  `ce801924d8c5297a7904de365361deae589d4fdaa28c1abe91a586131bbb3174`, privacy
  `d82ef9462d4a06cafd77d7ad4787aa9312abb1b84f273bbabbf4adb57470e1cf`, terms
  `fb9de8065884c1cb5b050c230139795a4dbe08cec6e1a42992b6ff39da79174d`, and service worker
  `23481d0352a66a66bc397777f49c84bdc894f7815ace17632b7250cb71ea4874`.

## Deployment

Deployed `dist/site` with:

```sh
/opt/fleet/lib/deploy-static.sh api-scenario-patch dist/site
```

Azure deployment `6baa5420-77c2-4eb7-91b2-0f3cb0719663` succeeded. The custom domain is Ready
and serves HTTP 200 at <https://api-scenario-patch.sociobot.in/>. TLS matches the hostname and
is valid from 2026-08-28 through 2027-02-28.

## Known scope boundaries

- The CLI remains a loopback reverse proxy rather than a CONNECT MITM proxy. HTTPS upstreams
  work when clients call the local proxy over HTTP.
- Relay bodies are buffered up to 10 MiB; persisted JSON remains independently capped at the
  configured maximum of 1 MiB.
- Schema-specific JSON redaction remains configuration-driven. Unknown query values and common
  credential headers are protected automatically; teams must still review any non-secret query
  allowlist and body/header capture policy.
- Registry publication and cross-platform release attachment remain factory-owned. The package
  is ready for `cargo package --manifest-path cli/Cargo.toml --locked` and was not published here.
