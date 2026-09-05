# Verification 4 handoff

## Result

- Verdict: **FAIL**
- Finding count: **1**
- Untested claim count: **1**
- Implementation reviewed: `d5fe03f8bd73854abaebf2936eceabbe095f40a0`
- Documentation reviewed: `53fe21600550789b3a6f1e7d406b26c4dd003027`
- Live URL: <https://api-scenario-patch.sociobot.in>
- Full report: `.factory/verification-4.md`

No product code was changed during this independent verification.

## Finding to repair

README says the public Git install works with Rust 1.82 or later, and the crate declares
`rust-version = "1.82"`. The exact command fails in a clean Rust/Cargo 1.82.0 consumer with
status 101 because locked dependencies use edition 2024 and include packages requiring Rust
1.88. The compatibility promise is also missing from `.factory/claims.json`.

Pin a Rust-1.82-compatible dependency graph or raise the stated/package minimum to the real
version. Add a tagged clean-toolchain test for that exact minimum.

## What passed

- Fresh detached checkout: `npm ci`, zero-vulnerability audit, `npm test`, `npm run build`,
  and `cargo package --locked --allow-dirty`.
- All 17 claim commands ran separately and passed.
- The public Git install, `asp demo`, `init`, `check`, invalid JSON output, loopback capture,
  privacy filters, replay gates, boundaries, failure recovery, and concurrent 429 behavior
  passed under Rust 1.98. The 429 included `Retry-After: 1`.
- Live desktop and phone first screens clearly state the job, audience, and sample action
  before scrolling.
- The live demo has realistic populated output, a persistent sample label and banner, reset,
  exit, no real-data storage, and same-origin-only requests.
- Known routes, titles, metadata, legal pages, links, designed HTTP 404, focus restoration,
  keyboard use, 200% text sizing, reduced motion, offline reload/update, and privacy checks
  passed.
- Axe found zero serious/critical issues. Lighthouse scored 100 for Performance,
  Accessibility, Best Practices, and SEO; FCP 0.9 s, LCP 1.1 s, TBT 0 ms, CLS 0.
- Live home, Demo, Privacy, Terms, 404, and service-worker hashes exactly match the clean
  implementation build.

## How to repeat

From a clean clone at `d5fe03f`:

```sh
npm ci
npm audit --audit-level=low
npm test
npm run build
cargo package --manifest-path cli/Cargo.toml --locked --allow-dirty
```

Run each command in `.factory/claims.json`. Confirm the finding with:

```sh
cargo +1.82.0 install --git https://github.com/B-Divyesh/sf-api-scenario-patch.git --locked
```

## Known limitation

There is no crates.io release. The documented public Git install works with the current Rust
toolchain. This distribution choice is not itself a defect; the false Rust 1.82 minimum is.
