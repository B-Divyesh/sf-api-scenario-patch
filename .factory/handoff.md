# Adversarial review 2 handoff

## What was done

- Completed fresh mobile (390 × 844) and desktop (1440 × 900) cold-read reviews of the live deployment.
- Audited every landing and README sentence, heading, action, jargon term, claim, and product term.
- Exercised the browser demo, reset/exit behavior, storage isolation, request log, console, offline reload, and CLI demo.
- Ran every `.factory/claims.json` command independently from clean clone `/tmp/api-scenario-patch-review2-clean-L0qh3o`.
- Rechecked every finding from `.factory/review-1.md` against the live site and source.
- Crawled live links and checked routes, metadata, 404 behavior, focus/history, headers, visual identity, and Axe accessibility.
- Wrote the evidence and FAIL verdict in `.factory/review-2.md`.

No product code was changed.

## Verification

- `npm test` — PASS.
- `npm run build` — PASS; `dist/site` and `dist/bin/asp` produced.
- All 10 listed claim commands from the clean clone — PASS as commands; three have inadequate coverage and several live/README claims are unlisted.
- `/opt/fleet/lib/verify-url.sh https://api-scenario-patch.sociobot.in <temp-dir>` — PASS.
- Live Axe — root, Privacy, Terms, and 404 have zero serious/critical violations; demo has one serious `scrollable-region-focusable` violation.
- Exact live `cargo install --path cli` instruction from an empty temporary directory — FAIL, as expected by finding F-2-1.

## Findings left for repair

The review verdict is FAIL with 19 blocking findings and one minor finding. Highest priority:

1. Provide an install command that works for a visitor outside a repository checkout.
2. Make the mobile demo terminal focusable and keyboard-scrollable.
3. Preserve landing scroll position through Privacy navigation and browser Back.
4. Add and strengthen claim entries/tests for the core record flow and privacy boundaries.
5. Remove remaining jargon, term drift, and the context-free README heading.

See `.factory/review-2.md` for exact quotes, evidence, and concrete fixes.
