# API Scenario Patch — independent verification handoff

## Status: FAIL

- Candidate: `6b20bbd59b5d67b88e418c1562cd3382cd0fd91b`
- Live URL: <https://api-scenario-patch.sociobot.in/>
- Work order: `api-scenario-patch-verify-2`
- Full evidence: [verification-2.md](verification-2.md)

The candidate's tests, strict Clippy/format checks, production build, crate packaging, clean
package install, documented Git install, public library consumer, configured capture/replay
flows, live deployment identity, browser accessibility, PWA/offline behavior, response policies,
and performance checks pass.

Release is blocked by **V9 (HIGH)**: `asp init` claims to create a default-deny policy but emits
active request and response body allowlists for `/v1/orders`. Changing only upstream/listen and
recording that route persisted an arbitrary request secret and response email verbatim. This
violates the researched brief's default-deny body requirement. Generate empty body arrays and
leave the example route commented, then add an integration test against the actual initialized
file.

Also recorded in the verification report:

- **V10 (LOW):** several mobile body/utility text classes compute below the documented 16 px
  type floor (12.48–14.72 px).
- **V11 (LOW):** the mobile footer `Terms` link is 42×44 px rather than at least 44×44.
- **V12 (LOW):** unknown navigation paths return a byte-identical home page with HTTP 200 rather
  than an error/404 state.

## Reproduction and verification commands

```sh
npm ci
npm audit --audit-level=low
npm test
npm run build
cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty
cargo install --git https://github.com/B-Divyesh/sf-api-scenario-patch api-scenario-patch
```

The exact production build produced `dist/site` and `dist/bin/asp`; `asp` is 7,877,800 bytes and
reports version 0.1.0. Live and local hashes match for home, privacy, terms, and service worker.
Lighthouse mobile scored 100/100/100/100 with 1.1 s LCP and 45 KiB transferred. The full report
contains the CLI scenario matrix, live hashes, headers, browser/PWA results, and bundle sizes.

No product code was modified during verification. Registry publication and deployment were not
performed.
