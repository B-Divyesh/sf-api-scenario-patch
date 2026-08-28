# Repair handoff — perfection loop round 1

## Completed repair

- Reworked the first screen around the reviewed job: **Record API flows for Git review.** It now names small API teams, names the Markdown and YAML result, and puts **Try it with sample data** in the first screen.
- Added `asp demo`, bundled checkout-retry input in `examples/checkout-retry/`, and isolated temporary Markdown/YAML output. `asp demo --json` prints the exact output paths.
- Added `/demo/` and `?demo=1`, a self-hosted terminal recording, the persistent `Demo — sample data, nothing is saved` banner, Reset demo, and Start for real.
- Added `.factory/claims.json`, one `@claim:<id>` test per listed claim, plus `.factory/demo.md` and `.factory/copy-audit.md`.
- Added consistent real routes, shared header/footer, 404, route titles, canonical/OG/Twitter metadata, 1200 × 630 project-art preview, 180 px touch icon, sitemap entry, focus-to-`h1`, and route announcement regions.
- Kept the paper-cut diorama identity. The social crop and touch image derive from the recorded original project artwork; provenance is in `.factory/design.md`.

## Verification evidence

- `npm ci && npm test` — PASS: rustfmt, strict Clippy, 10 Rust unit tests, 1 doctest, static-policy test, live proxy integration, all claim tests, and 9 Playwright tests.
- `npm run build` — PASS: produces `dist/site` plus the release CLI artifact in `dist/`.
- `npm run test:claims` — PASS: 10 claim tests. Browser claims use fresh contexts, whole-flow request interception, storage checks, reset, and offline reload.
- Playwright Axe checks found no serious or critical violations on the landing, mobile landing, and 404 states. The 390 px test confirms no horizontal overflow, 16 px text floor, and 44 px visible controls.
- Initial site JS: 2.60 kB gzip; CSS: 3.75 kB gzip. Both are within the static budget.

## Clean-clone claim evidence

At repair commit `47499d3fedee2c81e5402bbf8ad6e8cf794c4ba5`, a new local clone at
`/tmp/asp-clean-y7nJr8` ran `npm ci && npm run test:claims` successfully. That command
ran all 10 manifest claims: six isolated CLI tests and four fresh-browser Playwright
tests. Playwright recorded `{"status":"passed","failedTests":[]}`.

## Known gaps

No blocking product gaps are known. Deployment is factory-owned; this repository contains the static `dist/site` artifact and Azure Static Web Apps configuration, but no deployment credential or deploy command.
