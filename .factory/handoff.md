# Repair 3 handoff

## Release identity

- Product: API Scenario Patch, a local CLI for small API teams reviewing multi-step API flows in Git.
- Implementation commit: `d5fe03f8bd73854abaebf2936eceabbe095f40a0`.
- Core repair commit: `8dc5278d62e4b1886937adfa3f8dd66aef806e5b`.
- Published URL: <https://api-scenario-patch.sociobot.in>.
- Deployment: production static site deployed from `dist/site` with the existing `staticwebapp.config.json`.

## What changed

- Replaced the unusable path-only installation instruction with the working public Git install command:
  `cargo install --git https://github.com/B-Divyesh/sf-api-scenario-patch.git --locked`.
- Added a clean consumer test to `npm test` and exercised that exact public command after publishing the commit. It installed `asp 0.1.0` from `d5fe03f` and ran `asp demo` successfully in a new temporary directory.
- Made the horizontal mobile demo terminal keyboard reachable with `tabindex="0"`; the live 390 px Axe check and ArrowRight scrolling pass.
- Preserved Back/Forward scroll and focus. New navigation focuses the destination heading; a restored history entry returns focus to the link that opened the page without moving the saved scroll position.
- Expanded `.factory/claims.json` from 10 to 17 claims. Every material CLI, demo, privacy, and offline statement on the landing page, README, and Privacy page now has one tagged, observable regression test.
- Replaced weak source/config-only claim checks with real loopback recordings. They prove default body omission, masking in both files, ordered output, notes, saved values in later paths/headers/bodies, sensitive header/query exclusion, output timing, configured-upstream-only traffic, and both replay opt-ins.
- Made the CLI ignore environment proxy variables for recording and replay. The configured-upstream claim uses local proxy monitors to prove the recorder reaches only the reviewed upstream target.
- Rewrote review-2 jargon and terminology issues: visitor copy now says “bodies start off”, “this computer”, and “mask”; the README heading is “Build and test locally”; “readable” was removed.
- Updated the service-worker cache to `asp-site-v5`, preserving the offline demo path after deployment.
- Updated `.factory/copy-audit.md` and copied the verb-first, 69-character catalog description to `/work/.evidence/catalog-description.txt`.

## Review disposition

All review-2 findings are resolved:

| Finding group | Current evidence |
| --- | --- |
| F-2-1 install path | Exact Git install works from a clean external consumer directory. |
| F-2-2 mobile terminal | Live phone Axe has zero serious/critical issues; the terminal receives focus and ArrowRight scrolls it. |
| F-2-3 Back restoration | Playwright and live phone/desktop checks restore the long landing position and the Privacy link focus. |
| F-2-4 to F-2-10 missing core/privacy claims | Seven new manifest claims cover real recording, demo network isolation, sensitive data, saved values, configured upstream, output timing, and site forms/analytics. |
| F-2-11 to F-2-13 inadequate claim checks | Default-deny, mask-before-files, and replay claims now cross the real file/network boundary and test every stated gate. |
| F-2-14 to F-2-19 copy and terms | Plain-language copy audit is clean; terminology is consistent; the README heading is specific. |
| F-2-20 minor wording | Removed “readable”. |

Earlier review-1 B1/B2/M4 behavior remains covered by the browser suite: first-screen clarity, one-click demo with persistent banner/reset/exit, metadata/routes/404, and shared site structure. Review-1 B3/B4/M1/M2/M3/M5 are now covered by the 17-claim contract, copy audit, and history regression.

The previous verification findings remain covered by the loopback integration and browser suite: query/API-key exclusion, numeric/boolean substitution, hard 429 concurrency limit, recovery after upstream failure, JSON errors, generated default policy, mobile type/target floor, and real 404 behavior.

## Verification

Fresh clean checkout at `d5fe03f`:

- `npm ci` — PASS; 0 audit vulnerabilities.
- `npm test` — PASS: format, strict Clippy, 10 Rust tests, doctest, static policy, proxy integration, clean consumer install, all claims, and 12 browser tests.
- `npm run build` — PASS; produced `dist/site` and `dist/bin/asp`.
- `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty` — PASS; package verified (26.8 KiB compressed).
- Every one of the 17 `.factory/claims.json` commands was run separately from that clean clone — PASS.
- The exact public Git install command was run from another empty consumer directory — PASS; `asp demo` produced two files and two sample steps.

Live production at the published URL:

- `/opt/fleet/lib/verify-url.sh` — PASS: HTTPS 200, 808 ms load, title/lang/one `h1`/`main`, alt text, labelled controls, and no console errors.
- Fresh 390 × 844 and 1440 × 900 Chromium contexts — PASS. Before scrolling, each showed the job (“Record API flows for Git review”), the audience (small API teams), and “Try it with sample data” at y=481/y=490. Both demo flows showed the persistent sample banner, generated/reset realistic output, and left local/session storage empty.
- Live Axe (Playwright integration) — zero serious/critical violations on home, demo, Privacy, Terms, `404.html`, and an unknown-route 404.
- Live route checks — `/`, `/demo/`, `/privacy/`, `/terms/`, and `/404.html` returned 200 with route titles; `/definitely-not-a-real-page` returned designed HTTP 404.
- Production HTML, demo, Privacy, Terms, 404, and service-worker SHA-256 hashes matched the final local build exactly.
- Security headers are live: same-origin CSP with `frame-ancestors 'none'`, no-referrer, nosniff, HSTS, and disabled camera/microphone/geolocation. Hashed JavaScript has one-year immutable caching.
- Lighthouse mobile, live — Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.4 s, LCP 1.4 s, TBT 0 ms, CLS 0.
- Final static assets: JavaScript 3,285 B raw, CSS 12,530 B raw, hero WebP 38,712 B, system fonts only.

## Remaining limitations

- The CLI is intentionally not published to crates.io. Installation uses the documented public Git command; a crates.io release is a future distribution task, not a current claim.
- Recording still forwards real traffic to the upstream URL chosen in the reviewed configuration. `asp demo` is the no-network sandbox; replay stays disabled unless both explicit opt-ins are supplied.
- There is no hosted workspace, account, billing flow, or backend persistence. This matches the researched scope.
