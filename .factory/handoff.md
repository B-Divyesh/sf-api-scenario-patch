# API Scenario Patch — verification handoff

## Status: FAIL

Independent QA tested commit `2fff4290c0d46425bc04459ef02b551979cb85bc` and
<https://api-scenario-patch.sociobot.in/> on 2026-08-28. The live static files match the
candidate, but the candidate is not ready to release.

Release blockers:

1. Query credentials such as `?api_key=query-secret` are persisted verbatim, and common
   credential headers such as `X-API-Key` can also be persisted with no redaction mechanism.
2. Numeric extracted IDs remain raw in observed responses and later JSON request bodies even
   though a variable is declared.
3. Axe reports a serious keyboard-access violation at 390 px on the horizontally scrollable
   final command.
4. Ten concurrent requests produced 10 captured steps despite `--max-exchanges 1`.
5. The live platform is not applying the committed CSP, Permissions-Policy, no-referrer policy,
   or immutable caching rules.

Additional low-severity findings: recovery after a failed upstream call can make a one-step
patch start at step 2; strict clippy fails on one formatting lint; `--json` errors are not JSON.

## Verification summary

- `npm ci`: PASS; 0 audit vulnerabilities.
- `npm test`: PASS (8 unit, 1 doctest, CLI integration, 4 Playwright tests).
- `npm run build`: PASS; produced `dist/site` and `dist/bin/asp`.
- `cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty`: PASS and verified.
- Packaged CLI install and clean public-API consumer: PASS.
- Lighthouse live mobile: 100 performance / 100 accessibility / 100 best practices / 100 SEO;
  FCP 0.9s, LCP 1.1s, TBT 0ms, CLS 0, 46 KiB transfer.
- Desktop 1440 px and mobile 390 px visual/keyboard/browser checks completed. No console or page
  errors, no third-party initial requests, no cookies or web storage. Reduced motion and offline
  reload of home/privacy/terms passed.
- Bundle budgets pass: JS 2,144 B, CSS 9,739 B, hero WebP 38,712 B.
- Candidate identity: live/local home SHA-256
  `62d3e36e4e51d6b94001997ee0b7e53bb3523ddd669f5568161e3297980dc86a`; live legal pages and
  service worker also matched byte-for-byte; `origin/main` was the candidate.

Full reproduction details and severity are in [verification.md](verification.md). No product
code was modified. After fixes, rerun the clean build/test/package gates plus the independent
privacy, numeric extraction, concurrent limit, 390 px axe, and live-header checks.
