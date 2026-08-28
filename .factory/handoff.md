# Review handoff — review 1

Completed an adversarial, read-only review of the live site and repository. No product code was changed.

Created `.factory/review-1.md` with a **FAIL** verdict. Blocking issues are: the cold mobile screen does not state who the product is for or provide a result-naming first action; the required CLI sample/demo sandbox does not exist (`asp demo` exits 2, no `/demo`, no examples or demo documentation); and `.factory/claims.json` plus claim-tagged tests are absent.

Verification performed:

- Fresh Chromium checks at 390 × 844 and 1440 × 900; no console errors.
- Live-route, metadata, link, demo, storage, network-interception, offline-reload, focus, and 404 checks.
- Clean-clone check at base commit `9fa4cdf7b7ae82a3b78d914bf029c27c3895a68f`: claims manifest missing.
- `npm ci && npm test` passed locally (Rust, static policy, CLI integration, site build, and 5 Playwright tests).
- Temporary-directory CLI check: `asp demo` is an unrecognized subcommand (exit 2).

No repair work was performed because this work order was review-only. The review document lists concrete repairs and the claim/test coverage needed before a follow-up verification.
