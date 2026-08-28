# API Scenario Patch — repair handoff

## Status: PASS (local qualification complete; live deployment verification follows)

- Work order: `api-scenario-patch-repair-2`
- Repaired candidate: `6b20bbd59b5d67b88e418c1562cd3382cd0fd91b`
- Verifier report: `.factory/verification-2.md` at `978e1bb097f3533346e8145ce14ae2d3e045b56e`
- Repair implementation: `30fc5475de81f0c7a3949af7f50ba1360a88e36e`
- Artifact/deployment class: Rust CLI plus static documentation site (unchanged)
- Live URL: <https://api-scenario-patch.sociobot.in/>

## Findings repaired

| Finding | Root cause and repair | Exact regression coverage |
| --- | --- | --- |
| V9 HIGH — initialized config captured bodies | `DEFAULT_CONFIG` actively allowlisted `/v1/orders` despite claiming default-deny. Both generated arrays are now empty; `/v1/orders` remains only as a commented example. | The Rust config test asserts both parsed arrays are empty. The process integration test runs the real `asp init`, edits only `upstream` and `listen`, posts `raw-request-secret`, receives `private@example.test`, and proves neither value enters YAML or Markdown while both bodies report `path not allowlisted`. |
| V10 LOW — mobile text below 16 px | Utility, proof, workflow, diff, and footer rules used sub-`1rem` sizes. Product text now respects the design thesis's 16 px floor, including generated-patch code. | Chromium at 390×844 asserts computed sizes for `.steps p`, `.diff-snippet`, `.proof-list small`, `.microcopy`, and `footer` are all at least 16 px. |
| V11 LOW — Terms target 42 px wide | Navigation links had only a height floor. Links now have `min-width` and `min-height` of 44 px. | The 390 px browser regression measures every visible link and button and requires both dimensions to be at least 44 CSS px. |
| V12 LOW — unknown routes returned home with 200 | Azure's catch-all `navigationFallback` rewrote unknown paths to `/index.html`. It was replaced with a 404 response override and a dedicated, accessible `404.html`; the service worker caches that error state instead of falling back to home. | Static policy tests reject `navigationFallback`, require the 404 rewrite and built error document, and Chromium/axe covers the 404 page at 390 px. Live status/body verification is recorded below after deployment. |

The researched brief and paper-cut visual thesis were preserved. Existing query/header secret
denial, configured-secret substitution, scalar extraction, concurrency limits, contiguous
numbering, machine-readable errors, replay gating, response policies, privacy behavior, and
offline support continue to pass.

## Clean-clone verification

Qualification used an isolated clone of repair commit `30fc547` on Node 22.23.2, npm 10.9.8,
rustc/cargo 1.98.0, with Playwright 1.58.2.

- `npm ci`: PASS — 21 packages installed; 0 vulnerabilities.
- `npm audit --audit-level=low`: PASS — 0 vulnerabilities.
- `npm test`: PASS — strict Rustfmt and Clippy; 7 library tests, 3 binary tests, 1 doctest;
  built-site policy and real proxy/CLI integration; 5 Chromium tests.
- `npm run build`: PASS — produced `dist/site/` and `dist/bin/asp`.
- Release binary: 7,877,816 bytes; `asp 0.1.0`; top-level and all four subcommand help screens pass.
- `cargo package --manifest-path cli/Cargo.toml --locked`: PASS — 7 files,
  97.3 KiB unpacked / 27,172 bytes compressed; Cargo's package verification compiled it.
- Packed-crate install: PASS — installed to a clean root with `--locked` and ran `asp 0.1.0`.
- Public API consumer: PASS — a fresh locked crate imported and executed `redact_json`,
  `substitute_variables`, and `sanitize_path_and_query` against the packaged source.

Registry publication was intentionally not performed; the factory owns credentials. The
ready-to-publish check is the `cargo package ... --locked` command above.

## Browser, accessibility, privacy, offline, and performance

- `/opt/fleet/lib/verify-url.sh` against the clean local production build: PASS in 530 ms;
  title, `lang=en`, one `h1`, `main`, image alt, button names, and zero console errors.
- Chromium at 1440×900 and 390×844 across home, privacy, terms, and 404: no horizontal page
  overflow, zero axe 4.10.2 serious/critical findings, zero console/page/request errors, and
  visual inspection passed.
- Keyboard: skip link is first; install copy works with Enter; the demo works with Space;
  code rails are focusable; focus is visible; all visible mobile links/buttons are at least 44×44.
- 390 px computed type: verifier-identified classes are all 16 px or larger.
- Privacy: all observed requests were same-origin; cookies, localStorage, and sessionStorage
  remained empty; no analytics, telemetry, CDN script/font, beacon, or third-party runtime exists.
- Reduced motion: animations/transitions collapse to 0.01 ms, transforms are removed, and
  smooth scrolling is disabled.
- PWA: `asp-site-v3` controlled the page, explicit update completed, and offline reload passed
  for home, privacy, terms, and 404.
- Lighthouse 13.0.1 mobile/local: Performance 100, Accessibility 100, Best Practices 100,
  SEO 100; FCP 0.9 s, LCP 1.2 s, TBT 0 ms, CLS 0, Speed Index 0.9 s.
- Budgets: initial JS 2,144 bytes raw / 0.97 KiB gzip; CSS 9,822 bytes raw / 3.20 KiB gzip;
  hero WebP 38,712 bytes; fonts 0. These remain far below the supplied limits.

## Production hashes and live checks

Clean local build hashes before deployment:

| Resource | SHA-256 |
| --- | --- |
| `/` | `60fabac100c042074a968590bd07033fbe67b6b06b6cb0f6837e5787ad3fda2c` |
| `/404.html` | `a71887343eba182a04fe18979da7c5b54636add302e9ffcec4889f383076f338` |
| `/privacy/` | `96d184229c03d89e02419f330b1e163e71bf464b8b599df1d82d71411cf025f7` |
| `/terms/` | `27a0bc6dddc370888bcf2b1eb48193c9258c8057d8f929a515abf25acd8a593c` |
| `/sw.js` | `50e30cfb587ddb179e434495bbc57407c9d30b019a7c4ace20334ea5d5ef1e83` |

Live hashes, unknown-route status, response policy, deployment identity, and post-deploy
browser checks will be appended after the factory static deployment completes.

## Known gaps and next steps

- No product or test gaps are known after local qualification.
- Do not publish the crate from a worker. Factory release automation may publish the verified
  package when registry credentials and release policy permit.
