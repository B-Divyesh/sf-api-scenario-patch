# API Scenario Patch v0.1.0 — handoff

## What shipped

- A Rust single-binary CLI named `asp` with four non-interactive commands:
  `init`, `check`, `record`, and `replay`.
- `record` runs an HTTP/HTTPS-upstream reverse proxy bound to loopback, accepts traffic
  from an existing API client, preserves request arrival order, and writes deterministic
  `.yml` plus `.md` scenario patches on Ctrl+C or `--max-exchanges`.
- Privacy defaults are enforced in code: authorization, proxy authorization, cookie,
  and set-cookie headers are never persisted; bodies are denied unless their path is
  allowlisted; only JSON bodies are captured; capture size is bounded; upstream URLs
  cannot contain credentials; public listener addresses are rejected.
- JSON-path redaction supports object keys, array indices, and wildcard array members.
  Response values can be extracted into named variables; raw extracted values are
  replaced by `${name}` in the observed response and later requests before disk writes.
- Replay is disabled by default and requires both a reviewed config setting and the
  `--confirm` command flag. The target host must be allowlisted and unresolved or
  omitted request data causes a refusal rather than a guess.
- A responsive static documentation site with an original paper-cut visual system,
  browser-only redaction demo, keyboard interactions, offline status, service-worker
  shell cache, immutable asset headers, privacy page, and terms page.
- README-first API documentation, MIT license, changelog, typed Rust library surface,
  and a compiling doctest.

## Build and deploy

```sh
npm ci
npm run build
```

The exact build command is `npm run build`. Static deployment root is `dist/site`
(`dist/site/index.html` exists). The same command also places the release binary at
`dist/bin/asp` for artifact collection.

For registry readiness (do not publish from a worker):

```sh
cargo package --manifest-path cli/Cargo.toml --allow-dirty
```

This produced a 23.7 KiB compressed crate package locally.

## Verification completed

- `npm test`: passes.
  - 8 Rust unit tests and 1 compiling doctest pass.
  - Live integration test passes two HTTP exchanges through the proxy and asserts the
    resulting YAML and Markdown contain none of the authorization/cookie values, card
    number, response token, or raw extracted ID.
  - The integration test also verifies `${order_id}` reuse, reviewer notes, local JSON
    redaction, and replay refusal with exit code 2 when `--confirm` is absent.
  - 4 Playwright tests pass in Chromium 145: keyboard demo, 390px layout/no overflow,
    privacy and terms routes, offline state, reduced motion, no page errors, and axe.
- `npm audit`: 0 known vulnerabilities.
- `npm run build`: passes; optimized site and Rust release binary produced.
- `cargo package --manifest-path cli/Cargo.toml --allow-dirty --no-verify`: passes.
- Lighthouse 13 mobile against the local site:
  - Performance: **97**
  - Accessibility: **100**
  - Best practices: **100**
  - SEO: **100**
  - FCP 2.1 s, LCP 2.2 s, CLS 0, TBT 0 ms, Speed Index 2.1 s
- Initial site assets: JS 2.14 KB / 0.97 KB gzip; CSS 9.74 KB / 3.21 KB gzip;
  hero WebP 38,712 bytes. These are comfortably inside the 200 KB JS, 50 KB CSS,
  and 300 KB hero budgets.
- Visual inspection completed at desktop and 390px-equivalent mobile sizes.

## Original asset

`site/public/paper-cut-api-flow.webp` was generated with the factory image service via
`/opt/fleet/lib/gen-image.sh` at 1536×1024, visually inspected, resized to 1280×853,
stripped, and encoded as a 38,712-byte WebP. The complete prompt and provenance are in
`.factory/design.md`.

## Known gaps / next steps

- v1 is a reverse proxy, not a general CONNECT MITM proxy. HTTPS upstreams work when
  clients call the local proxy over HTTP, but transparent interception of arbitrary
  HTTPS client traffic is intentionally out of scope.
- Relayed request and response bodies are buffered with a 10 MiB relay ceiling; captured
  JSON is separately limited to at most 1 MiB by policy. Streaming media APIs should
  bypass this tool.
- Redaction is configuration-driven. Teams must review their API schema and config;
  the CLI deliberately does not claim to discover unknown secrets automatically.
- The factory still needs to attach cross-platform release binaries and deploy
  `dist/site`. No registry publication, DNS, billing, or infrastructure action was taken.
