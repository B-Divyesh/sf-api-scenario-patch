# Independent verification 3 — PASS

- Candidate: `cd26a90525d4baa0b5ec1e4054529146bf72a3f7`
- Live URL: <https://api-scenario-patch.sociobot.in/>
- Verified: 2026-08-28 07:29 UTC
- Work order: `api-scenario-patch-verify-3`
- Result: **PASS**

This was an independent run from a freshly cloned detached checkout of the exact candidate.
The candidate is a documentation-only commit above the repaired implementation; source,
artifacts, behaviour, and live deployment were verified rather than relying on the prior handoff.

## Clean checkout and package

Environment: Node 22.23.2, npm 10.9.8, rustc/cargo 1.98.0, Playwright 1.58.2.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 21 packages installed; `npm audit --audit-level=low` reported 0 vulnerabilities. |
| `npm test` | PASS | rustfmt, strict Clippy, 7 library tests, 3 CLI tests, 1 doctest, static policy, proxy integration, and 5 Playwright tests all passed. |
| `npm run build` | PASS | Exact production command created `dist/site/` and executable `dist/bin/asp`. |
| `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty` | PASS | Ready-to-publish `api-scenario-patch-0.1.0.crate` (27 KiB) produced. No publication was attempted. |
| packed consumer | PASS | Installed the extracted packed crate into a clean Cargo root; `asp 0.1.0` ran. A fresh locked consumer invoked `redact_json`, `substitute_variables`, and `sanitize_path_and_query`. |

The release binary is 7,877,816 bytes and reports `asp 0.1.0`. Top-level help describes the
four commands, default-deny policy, and exit codes. `init`, `check --json`, and refusal paths
were independently exercised: replay without `--confirm` and an absent config each returned
machine-readable input errors with exit code 2.

## Job-to-be-done and privacy

The built-in integration uses a real loopback upstream/proxy and passed fresh. It covered:

- actual `asp init` output modified only for loopback upstream/listen: request and response
  bodies stayed omitted by default, and both outputs identified the route as not allowlisted;
- opted-in two-step capture: YAML and Markdown retained ordered review context, note, scalar
  `order_id`/boolean variable extraction, configured-secret placeholders, and redaction;
- negative privacy checks: authorization, cookies, set-cookie, API keys, credential-shaped
  query values, raw card number, configured secret, and upstream secret did not enter either
  artifact;
- recovery after failed upstream and deterministic output/empty capture behaviour; and
- concurrency: with `--max-exchanges 1`, a burst of 10 rapid proxy requests returned exactly
  **one 200 and nine 429** responses, persisted one step, and released capacity after failed
  upstream work. This local loopback proxy is the only product API listener; the public
  deployment is static and exposes no product API or sign-in/unlock endpoint.

Replay remained gated by both reviewed config (`enabled = true`) and `--confirm`. The deployed
site has no telemetry, cookies, local/session storage, third-party runtime request, CDN font,
or hosted account flow. The service worker caches only same-origin public documentation.

## Live deployment, browser, accessibility, and PWA

Fresh local-production/live SHA-256 checks match exactly:

| Resource | SHA-256 |
| --- | --- |
| `/` | `60fabac100c042074a968590bd07033fbe67b6b06b6cb0f6837e5787ad3fda2c` |
| `/404.html` | `a71887343eba182a04fe18979da7c5b54636add302e9ffcec4889f383076f338` |
| `/privacy/` | `96d184229c03d89e02419f330b1e163e71bf464b8b599df1d82d71411cf025f7` |
| `/terms/` | `27a0bc6dddc370888bcf2b1eb48193c9258c8057d8f929a515abf25acd8a593c` |
| `/sw.js` | `50e30cfb587ddb179e434495bbc57407c9d30b019a7c4ace20334ea5d5ef1e83` |

Live Chromium checks at 1440×900 and 390×844 found one `h1` and one `main` per home, privacy,
terms, and 404 document; no horizontal overflow; and zero axe serious/critical violations.
Known-page console/page errors were zero (the deliberately requested 404 naturally reports its
failed resource status). The first keyboard focus is the visible 3px-outline “Skip to main
content” link. The repository's full browser suite also verified keyboard demo activation,
mobile 44×44 targets and 16px floor, service-worker update, and offline reload of home/privacy/
terms. Fresh live service-worker inspection found controller `/sw.js`, only cache `asp-site-v3`,
and reduced-motion duration `0.00001s` with `scroll-behavior: auto`.

## Delivery policy and performance

- HTTPS home/privacy/terms return 200; an unknown route returns a real 404. HTTP redirects 301
  to HTTPS. TLS SAN is the product host, valid 2026-08-28 through 2027-02-28.
- Live policy includes CSP `default-src 'self'`, same-origin image/script/style/connect,
  `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`; also HSTS,
  `no-referrer`, `nosniff`, and camera/microphone/geolocation disabled.
- Hashed JS is Brotli-encoded with `Vary: Accept-Encoding` and
  `public, max-age=31536000, immutable`; an ETag conditional request returned 304. HTML and
  service worker use 30-second revalidation.
- Fresh Lighthouse 13 mobile/live: Performance **100**, Accessibility **100**, Best Practices
  **100**, SEO **100**; FCP 830 ms, LCP 1,068 ms, TBT 0 ms, CLS 0.
- Build sizes: initial JS 2,144 B raw / 0.97 KiB gzip; CSS 9,822 B / 3.20 KiB gzip; hero WebP
  38,712 B; fonts 0. All are below the supplied budgets.

## Defects

No release-blocking, high, medium, or low defects were found in this verification.

## Disposition

**PASS — candidate `cd26a90525d4baa0b5ec1e4054529146bf72a3f7` is verified for release.**
