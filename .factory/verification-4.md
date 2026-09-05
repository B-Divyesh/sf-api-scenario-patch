# Verify API flows for Git review — verification 4

- Work order: `api-scenario-patch-verify-4`
- Implementation reviewed: `d5fe03f8bd73854abaebf2936eceabbe095f40a0`
- Documentation reviewed: `53fe21600550789b3a6f1e7d406b26c4dd003027`
- Live URL: <https://api-scenario-patch.sociobot.in>
- Verified: 2026-09-05 21:30 UTC
- Verdict: **FAIL**
- Findings: **1**
- Untested public claims: **1**

The core CLI, sample, live site, privacy boundaries, accessibility, and all 17 declared
claim commands pass. Release acceptance still fails because the documented minimum Rust
version cannot install the product. That compatibility statement is also absent from the
claims inventory.

## First screen before scrolling

Fresh Chromium contexts opened the live site at 1440 × 900 and 390 × 844. No scrolling
occurred before these answers were recorded.

| Question | Answer from the first screen | Evidence |
| --- | --- | --- |
| What is the job? | Record a multi-step API flow as masked Markdown and YAML for Git review. | The h1 is “Record API flows for Git review.” |
| Who is it for? | Small API teams that do not share an API-client workspace. | The audience sentence names those teams and that situation. |
| What should I do first? | Select **Try it with sample data**. | The action was visible at y=490 on desktop and y=481 on phone. Its adjacent text says it runs `asp demo` and shows both files. |

This first screen meets the plain-language and first-action contract.

## Release-blocking finding

### HIGH — ASP-V4-1: the documented Rust 1.82 install does not work

README line 15 says, “Install with Rust 1.82 or later.” `cli/Cargo.toml` also declares
`rust-version = "1.82"`. In a new Cargo home with the already-installed Rust/Cargo 1.82.0
toolchain, the exact public Git install failed with status 101:

```text
cargo +1.82.0 install --git https://github.com/B-Divyesh/sf-api-scenario-patch.git --locked
...
failed to parse manifest .../rand-0.10.2/Cargo.toml
feature `edition2024` is required
```

`cargo +1.82.0 check --locked --manifest-path cli/Cargo.toml` failed at the same manifest
boundary. The locked graph also includes ICU 2.3 packages that declare Rust 1.88. The same
install succeeds with the current Rust 1.98 toolchain, so the Git URL repair works but the
documented prerequisite does not.

The Rust 1.82 compatibility statement has no entry or tagged test in
`.factory/claims.json`. It is therefore one false, unlisted, and untested public claim.

Required repair: either pin dependencies that install and test under Rust 1.82, or raise the
README and package `rust-version` to the real minimum. Add a clean-toolchain claim test for
the stated minimum version.

## Clean checkout and installed artifact

A fresh clone was checked out detached at the implementation SHA. Environment: Node
22.23.2, npm 10.9.8, Rust/Cargo 1.98.0, Playwright 1.58.2.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 21 packages installed. |
| `npm audit --audit-level=low` | PASS | 0 vulnerabilities. |
| `npm test` | PASS | Rust format, strict Clippy, 7 library tests, 3 CLI tests, 1 doctest, static policy, proxy integration, clean consumer install, claim suite, and 12 browser tests passed. |
| `npm run build` | PASS | Produced `dist/site/` and the 7,896,080-byte `dist/bin/asp`. |
| `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty` | PASS | Verified a 26.8 KiB crate. No publication was attempted. |
| Public Git install with Rust 1.98 | PASS | Installed `asp 0.1.0` from documentation SHA `53fe216`; product source matches implementation `d5fe03f`. |
| Public Git install with documented Rust 1.82 | **FAIL** | Status 101 because locked dependencies require edition 2024 and up to Rust 1.88. See ASP-V4-1. |

The installed `asp demo` wrote exactly `checkout-flow.md` and `checkout-flow.yml` in a new
consumer directory. The two-step output contained POST and GET requests, two reviewer notes,
`${REDACTED_CARD}`, and `${order_id}` reuse. The raw sample card value was absent. `asp init`
and `asp check --json` succeeded. A missing config returned status 2 with one JSON error on
stdout and empty stderr.

The full loopback integration exercised normal capture, invalid input, body-size boundaries,
default-deny output, masking, string/number/boolean variables, replay gates, deterministic
files, output refusal, failed-upstream recovery, and JSON errors. With one capture slot and
two concurrent requests, an independent installed-artifact check returned one 200 and one
429. The 429 included `Retry-After: 1`; the final patch contained one step.

There is no deployed product backend, tenant store, or shared database. Backend tenant,
restart, and health checks do not apply to this CLI and static documentation site. CLI output
persistence after shutdown and failure recovery were tested locally.

## Declared claims

Every command below ran separately from the fresh detached checkout.

| Claim ID | Result |
| --- | --- |
| `demo-command-output` | PASS |
| `demo-no-network` | PASS |
| `default-deny-capture` | PASS |
| `mask-before-files` | PASS |
| `local-only-listener` | PASS |
| `deterministic-demo-output` | PASS |
| `record-flow-output` | PASS |
| `sensitive-header-query-exclusion` | PASS |
| `saved-values-substitute` | PASS |
| `configured-upstream-only` | PASS |
| `write-after-recording` | PASS |
| `replay-double-opt-in` | PASS |
| `no-third-party-browser-requests` | PASS |
| `demo-isolated-storage` | PASS |
| `no-account-hosted-workspace` | PASS |
| `site-no-forms-or-analytics` | PASS |
| `offline-reload` | PASS |

ASP-V4-1 is outside that inventory and accounts for the one untested claim.

## Live sample and privacy

In separate fresh desktop and phone contexts, the first click opened `/demo/?demo=1`. The
banner “Demo — sample data, nothing is saved” stayed visible before and after generation.
The populated sample showed POST then GET, a masked card value, and saved `order_id` reuse.
The “sample output” label remained visible. **Reset demo** announced “Demo reset. The bundled
sample is ready.” **Start for real** returned to the home h1.

Cookies, local storage, and session storage remained empty. All 19 observed route requests
were same-origin. No forms, analytics request, third-party script, font, or runtime request
was found. The CLI demo's proxy-monitor claim also passed with zero network connections.

The service worker controlled a fresh context after reload, used only cache `asp-site-v5`,
completed an update check, and served `/demo/` while the context was offline. The offline
page retained the title “Demo — API Scenario Patch.”

## Accessibility, keyboard, routes, and links

- Axe 4.10.2 found zero serious or critical violations on home, Demo, Privacy, Terms,
  `404.html`, and the unknown-route 404 at phone size, and on every known route at desktop.
- Every checked document has `lang="en"`, one h1, one main landmark, a route-specific title,
  canonical and social metadata, shared navigation, and footer attribution.
- The 390 px page has no horizontal page overflow. Former small text classes compute to 16
  px, and no visible link or button is smaller than 44 × 44 px.
- At 200% text size, the 390 px page retained every checked text item and control without
  horizontal page overflow.
- Keyboard activation opened the sample with Enter and generated it with Space. The 348 px
  demo terminal is 678 px wide internally; after focus, ArrowRight moved it from 0 to 40 px.
  Focus has a visible 3 px treatment and no keyboard trap was found.
- New pages focus their h1. On phone Back restored the exact landing position, 4,024 px, and
  focus returned to the footer Privacy link that opened the route.
- Reduced motion sets the demo animation to `0.00001s` and scrolling to `auto`.
- All visible internal links, skip-link targets, and the GitHub Source link returned 200.
- `/`, `/demo/`, `/privacy/`, `/terms/`, and `/404.html` return 200 with correct titles. A
  deliberate request to `/definitely-not-a-real-page` returns HTTP 404 with the designed
  error page and a working **Return home** link. That expected 404 is not a defect.

The standard URL verifier passed in 558 ms with no console errors, one h1, `lang`, main,
image alt text, and labeled controls. Known-page browser contexts also had no console or page
errors.

## Live identity, security, and performance

The live home, Demo, Privacy, Terms, 404, and service-worker SHA-256 hashes exactly match the
clean `d5fe03f` build. This proves that later report-only commit `53fe216` does not require a
different product image.

HTTPS is active, HTTP redirects with 301, and the certificate matches the product host.
Responses include the same-origin CSP with `frame-ancestors 'none'`, HSTS, no-referrer,
nosniff, and disabled camera, microphone, and geolocation. Hashed JavaScript is served with
one-year immutable caching.

Fresh Lighthouse 13 mobile results: Performance **100**, Accessibility **100**, Best
Practices **100**, and SEO **100**. FCP was 0.9 s, LCP 1.1 s, TBT 0 ms, CLS 0, and total
transfer 47 KiB. The clean build contains 3,285 B JavaScript, 12,530 B CSS, a 38,712 B hero
WebP, and no font files.

## Earlier finding disposition

### Verification findings V1–V12

| Earlier finding | Current proof | Disposition |
| --- | --- | --- |
| V1 query and API-key secrets | The dedicated claim and full loopback integration exclude authorization, cookies, API keys, and secret-named query values from both files. | Resolved |
| V2 numeric and boolean substitution | Integration asserts exact numeric and boolean replacement, plus later path, header, and body reuse. | Resolved |
| V3 mobile scrollable code | Phone Axe is clean; the focused demo terminal scrolls 0 → 40 px with ArrowRight. | Resolved |
| V4 concurrent maximum | Independent installed CLI returns one 200 and one 429 with one persisted step. | Resolved |
| V5 live headers and cache | CSP and privacy headers are live; hashed JavaScript has one-year immutable caching. | Resolved |
| V6 failed request numbering | Integration recovers from 502 and writes the later success as step 1. | Resolved |
| V7 strict Clippy | `npm test` passes Clippy with warnings denied. | Resolved |
| V8 JSON errors | Invalid installed-CLI use returns status 2 and one JSON object on stdout. | Resolved |
| V9 generated body policy | `default-deny-capture` uses real `asp init` output and proves both bodies stay out. | Resolved |
| V10 mobile text floor | Every formerly small class now computes to 16 px. | Resolved |
| V11 Terms touch target | No visible phone target is below 44 × 44 px. | Resolved |
| V12 unknown route | Unknown live path returns the designed page with HTTP 404. | Resolved |

### Review 1 findings

| Earlier finding | Current proof | Disposition |
| --- | --- | --- |
| B1 unclear audience/action | Job, small-team audience, action, and next result are visible before scrolling at both sizes. | Resolved |
| B2 missing CLI demo/sandbox | `asp demo`, bundled files, `/demo/`, banner, reset, exit, and no-storage behavior all work. | Resolved |
| B3 missing claim inventory | The 17-entry inventory exists and every declared command passes separately. | Resolved |
| B4 original unlisted product/privacy claims | The original output, privacy, replay, demo, and offline promises now have tagged tests. ASP-V4-1 is a newly identified compatibility claim outside that repaired set. | Resolved for the cited claims; new finding remains |
| M1 jargon and sentence length | The current copy audit and inspected public copy have no cited jargon or overlong sentence. | Resolved |
| M2 inconsistent artifact names | “API flow” is the input and “scenario patch” is the output throughout. | Resolved |
| M3 unclear headings/buttons | Current headings name their sections; controls name their results. | Resolved |
| M4 missing site structure | Metadata, common navigation/footer, demo, legal routes, and real 404 are present. | Resolved |
| M5 route focus | New routes focus and announce the h1; Back restores scroll and source-link focus. | Resolved |

### Review 2 findings

| Earlier finding | Current proof | Disposition |
| --- | --- | --- |
| F-2-1 path-only install | The public Git command installs and runs with current Rust. ASP-V4-1 is the separate false minimum-version promise. | Original path defect resolved |
| F-2-2 demo keyboard scrolling | The live terminal focuses and ArrowRight moves it 40 px. | Resolved |
| F-2-3 Back restoration | Live phone returns to 4,024 px and focuses the Privacy link. | Resolved |
| F-2-4 core record/output claim | `record-flow-output` passes through a real two-step proxy flow and both files. | Resolved |
| F-2-5 demo network claim | `demo-no-network` passes with local proxy monitors. | Resolved |
| F-2-6 sensitive data claim | `sensitive-header-query-exclusion` passes on both files. | Resolved |
| F-2-7 saved values claim | `saved-values-substitute` proves later path, header, and body replacement. | Resolved |
| F-2-8 configured upstream claim | `configured-upstream-only` passes with environment proxy monitors. | Resolved |
| F-2-9 output timing claim | `write-after-recording` proves chosen paths appear only after shutdown. | Resolved |
| F-2-10 forms and analytics claim | Browser claim finds neither form controls nor analytics/XHR traffic. | Resolved |
| F-2-11 weak default-deny test | The claim now records through the real proxy and inspects both files. | Resolved |
| F-2-12 weak mask test | The claim now crosses the disk boundary and inspects both files. | Resolved |
| F-2-13 incomplete replay test | The claim checks each gate separately and the both-enabled path. | Resolved |
| F-2-14 “default-deny” jargon | First-screen fact now says bodies start off. | Resolved |
| F-2-15 “loopback” jargon | Visitor copy now says this computer. | Resolved |
| F-2-16 undefined setup terms | README now says choose what `asp` may record, then start it. | Resolved |
| F-2-17 vague query wording | README names the excluded headers and query parameter names. | Resolved |
| F-2-18 three masking terms | Visitor-facing copy consistently uses “mask.” | Resolved |
| F-2-19 generic README heading | Heading is “Build and test locally.” | Resolved |
| F-2-20 “readable” wording | The word was removed from the claim. | Resolved |

## Verdict

**FAIL — 1 finding and 1 untested claim.** Do not accept implementation
`d5fe03f8bd73854abaebf2936eceabbe095f40a0` until ASP-V4-1 is repaired and verified from a
clean toolchain at the documented minimum Rust version.
