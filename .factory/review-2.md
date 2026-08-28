# Adversarial first-read review 2

**Product:** API Scenario Patch  
**Reviewed:** 2026-08-28  
**Live URL:** <https://api-scenario-patch.sociobot.in>  
**Repository HEAD reviewed:** `c27cea068bdde22aa0636fc159b70538f16751b5`  
**Verdict:** **FAIL**

There are blocking and minor findings. The first screen and one-click demo are now clear,
the listed test commands pass, and the site has a distinct visual identity. Acceptance still
fails because a visitor cannot use the advertised install command from a normal directory,
the demo has a serious keyboard-access failure, Back loses the saved scroll position, and
material claims remain unlisted or inadequately tested.

## 1. Cold first screen

I opened the live root URL in two fresh Chromium contexts at 390 × 844 and 1440 × 900.
Both returned HTTP 200. I did not scroll before recording this interpretation.

| Question | My cold answer | Result |
| --- | --- | --- |
| What does this do? | It records a multi-step API flow and produces Markdown and YAML for Git review. | Clear |
| Who is it for? | Small API teams that review multi-step requests without sharing an API-client workspace. | Clear |
| What should I click first? | **Try it with sample data**. The adjacent line says it runs `asp demo` and shows the files. | Clear |

The exact first-screen text that supplied those answers was “**Record API flows for Git
review.**”, “**For small API teams reviewing multi-step requests without a shared API-client
workspace.**”, “**Try it with sample data**”, and “**Runs `asp demo` and shows its Markdown
and YAML files.**” The action and its explanation were visible without scrolling at both
sizes. There is no first-screen blocking finding in this round.

## 2. Findings, ordered by severity

### F-2-1 — BLOCKING — The advertised install command fails for a normal visitor

- **Quote/location:** landing first screen, `cargo install --path cli`; README, “From source
  (Rust 1.82+):” followed by the same command.
- **Evidence:** from a fresh temporary directory, the exact command failed with
  `error: .../cli is not a directory. --path must point to a directory containing a
  Cargo.toml file.` Crates.io returned 404 for `api-scenario-patch`, and GitHub’s
  `/releases/latest` redirected to the releases index.
- **Why this blocks a first-time visitor:** the live site offers the command as the real-use
  path but never tells the visitor to clone and enter the repository. The demo is tryable;
  the product is not installable from the instruction shown.
- **Concrete fix:** publish a versioned crate and use `cargo install api-scenario-patch`, or
  show a complete sequence: `git clone ...`, `cd sf-api-scenario-patch`, then
  `cargo install --path cli`. Add a clean-directory install test and a first-run test.

### F-2-2 — BLOCKING — The mobile demo terminal cannot be reached by keyboard

- **Quote/location:** `/demo/`, `<pre aria-label="Sample asp demo terminal output">` inside
  `.terminal-recording`.
- **Evidence:** live Axe at 390 × 844 reports the serious WCAG 2.1.1/2.1.3 violation
  `scrollable-region-focusable`: “Element should have focusable content” or “Element should
  be focusable.” The terminal output is horizontally scrollable at this width.
- **Why this blocks a first-time visitor:** a keyboard user cannot focus and pan the clipped
  command output. This is the main proof that the CLI works.
- **Concrete fix:** give the labelled `<pre>` `tabindex="0"`, preserve a visible focus ring,
  and add Axe coverage for `/demo/` at 390 px. Confirm arrow-key scrolling.

### F-2-3 — BLOCKING — Back navigation destroys the saved landing position

- **Prior finding:** review 1 M5, re-raised because the routing repair is incomplete.
- **Location/evidence:** I scrolled the 390 px landing page to 3,975 px, used the footer
  Privacy link, and confirmed focus moved to the Privacy `h1`. Browser Back returned to `/`
  at 221 px with the hero `h1` focused, not at 3,975 px. `site/src/main.ts` focuses the first
  `h1` on every page load, overriding native history scroll restoration.
- **Why this blocks a first-time visitor:** someone checking Privacy loses their place in a
  long mobile page. The required Back behavior is not preserved.
- **Concrete fix:** focus the `h1` for new navigations, but do not do so on back/forward
  restoration. Add a Playwright test that records a nonzero scroll position, follows a real
  route, presses Back, and asserts both restored scroll and sensible focus.

### F-2-4 — BLOCKING — The core record-and-output claim is unlisted

- **Quote/location:** landing, “A scenario patch holds requests, masked values, saved
  response values, and notes in two readable files,” “Send existing client traffic through
  the local proxy,” and “Keep using your usual API client.” README, “`asp` makes a scenario
  patch: a Markdown and YAML record of one multi-step API flow” and “Point your existing API
  client at `http://127.0.0.1:4317`.”
- **Why this misleads:** `.factory/claims.json` tests the fixed demo output, not the core
  `asp record` promise and all listed artifact contents. This continues review 1 B4.
- **Concrete fix:** add one claim for actual proxy recording. Its tagged test must drive a
  two-step loopback flow and assert ordered requests, masking, saved-value substitution,
  notes, and both output files. Remove “readable” unless it has an objective test.

### F-2-5 — BLOCKING — The demo network-isolation claim is unlisted

- **Quote/location:** landing, “The demo does not use your API traffic.” README, “It does not
  contact an API or use your traffic.”
- **Why this misleads:** neither sentence appears as a claim. The `demo-command-output` test
  checks files; it does not observe CLI network activity. The browser-only request claim is
  not a test of `asp demo`.
- **Concrete fix:** add a claim for `asp demo` making no network connection. Run it in an
  isolated network namespace or with a connection monitor, and assert that only temporary
  output files change.

### F-2-6 — BLOCKING — Sensitive-header and query-value exclusion is unlisted

- **Quote/location:** README, “Sensitive headers and credential-shaped query values remain
  excluded.”
- **Why this misleads:** this is a material privacy promise with no claims entry. The broad
  integration suite exercises it, but the manifest does not expose a tagged test a verifier
  can run for this sentence. This continues review 1 B4.
- **Concrete fix:** add a claim and tagged end-to-end test that sends authorization, cookie,
  API-key, password/token query, and ordinary query values through the proxy, then inspects
  both files for inclusion and exclusion.

### F-2-7 — BLOCKING — Saved-value capture and substitution are unlisted

- **Quote/location:** README, “Save a response value under a name” and “Later matching values
  appear as `${variable}` in captured requests and responses.”
- **Why this misleads:** this core behavior has no entry in `.factory/claims.json` even though
  the untagged integration suite covers part of it.
- **Concrete fix:** list the claim and tag an observable two-step proxy test that extracts a
  response scalar and confirms substitution in a later path, header, and body.

### F-2-8 — BLOCKING — The configured-upstream privacy claim is unlisted

- **Quote/location:** live `/privacy/`, “The CLI sends recorded traffic only to your
  configured upstream.”
- **Why this misleads:** this security boundary has no claim entry or claim command.
- **Concrete fix:** list it and test with a loopback upstream plus a connection log that no
  other destination receives traffic during recording.

### F-2-9 — BLOCKING — The output-location and shutdown timing claim is unlisted

- **Quote/location:** live `/privacy/`, “It writes output files where you choose after
  recording ends.” README, “Press Ctrl+C after the flow” and “The command writes
  `checkout-flow.yml` and `checkout-flow.md`.”
- **Why this misleads:** neither the chosen location nor “after recording ends” is represented
  in the manifest.
- **Concrete fix:** add a tagged test that observes the selected paths before, during, and
  after shutdown, or narrow the sentence to exactly what an existing test proves.

### F-2-10 — BLOCKING — “No forms or analytics” is only partly listed

- **Quote/location:** live `/privacy/`, “This site has no accounts, forms, analytics, or
  third-party browser requests.”
- **Why this misleads:** `no-account-hosted-workspace` covers account controls and
  `no-third-party-browser-requests` covers foreign requests. The combined sentence also
  promises no forms and no first-party analytics, neither of which has a claim entry.
- **Concrete fix:** split the sentence into listed claims. Extend a whole-flow browser test
  to assert no form controls and no analytics endpoints or storage writes.

### F-2-11 — BLOCKING — The default-deny claim test checks configuration, not capture

- **Quote/location:** claim `default-deny-capture`, “Default-deny capture.”
- **Evidence:** the listed command passes, but `tests/claims.test.mjs` only asserts that two
  generated TOML arrays are empty. It never sends a body through `asp record` or inspects the
  resulting Markdown/YAML.
- **Why this is untested:** an empty default setting does not prove the observable promise
  that request and response bodies stay out of output.
- **Concrete fix:** make the tagged test run the proxy from a fresh `asp init` file, send
  distinctive request and response secrets, stop recording, and assert both files omit them.

### F-2-12 — BLOCKING — The “before files” redaction test never writes a file

- **Quote/location:** claim `redact-before-files`, “JSON field rules mask values before files
  are written.”
- **Evidence:** the listed command calls the Rust unit test
  `redacts_wildcards_before_serialization`. It verifies an in-memory transform, not either
  generated file.
- **Why this is untested:** the claim names a disk boundary that the tagged test does not
  cross. An untagged integration test cannot substitute for the manifest’s promised command.
- **Concrete fix:** tag an end-to-end test that records a unique secret, then checks both
  on-disk outputs contain the placeholder and never the raw value.

### F-2-13 — BLOCKING — The replay double-opt-in test proves only one opt-in

- **Quote/location:** claim `replay-double-opt-in`, “Config and command line both must opt in
  to replay.”
- **Evidence:** the test uses `enabled = false` and omits `--confirm`. The implementation
  checks `--confirm` first, so the observed “pass --confirm” refusal never exercises the
  disabled config branch or the both-enabled path.
- **Why this is untested:** one negative case cannot establish the two independent gates.
- **Concrete fix:** in the single tagged claim test, assert no request for (a) enabled config
  without `--confirm`, (b) `--confirm` with disabled config, and assert a request occurs only
  for (c) both enabled.

### F-2-14 — BLOCKING — “Default-deny capture” is unexplained jargon

- **Prior finding:** review 1 M1, re-raised because the first-screen term remains.
- **Quote/location:** landing first-screen fact, “Default-deny capture”.
- **Why this loses a first-time visitor:** it requires security-policy vocabulary and does
  not say what is denied.
- **Concrete rewrite:** “Request and response bodies start off.”

### F-2-15 — BLOCKING — “Loopback addresses” is unexplained jargon

- **Prior finding:** review 1 M1, re-raised.
- **Quote/location:** landing and README, “The proxy accepts loopback addresses only.”
- **Why this loses a first-time visitor:** “loopback” is implementation vocabulary where the
  visitor needs the practical boundary.
- **Concrete rewrite:** “The proxy listens only on this computer.”

### F-2-16 — BLOCKING — The README introduces two undefined setup terms

- **Prior finding:** review 1 M1, re-raised.
- **Quote/location:** README, “Create a reviewed capture policy, then run the local proxy:”
- **Why this loses a first-time visitor:** “reviewed capture policy” is not defined, and
  “local proxy” describes architecture rather than the action.
- **Concrete rewrite:** “Choose what `asp` may record. Then start `asp` on your computer.”

### F-2-17 — BLOCKING — “Credential-shaped query values” is vague jargon

- **Prior finding:** review 1 M1, re-raised.
- **Quote/location:** README, “Sensitive headers and credential-shaped query values remain
  excluded.”
- **Why this loses a first-time visitor:** the phrase does not say which values the tool
  recognizes or whether an unusual secret name is safe.
- **Concrete rewrite:** “`asp` leaves out authorization headers, cookies, API keys, and query
  values named password, secret, signature, or token.”

### F-2-18 — BLOCKING — The same privacy operation has three names

- **Prior finding:** review 1 M2, re-raised because terminology is still inconsistent.
- **Quote/location:** landing metadata says “redacted”; landing body says “mask” and “masked”;
  README says JSON rules “replace values”.
- **Why this loses a first-time visitor:** a reader cannot tell whether redact, mask, and
  replace describe one operation or different safeguards.
- **Concrete fix:** choose one visitor-facing verb, preferably “mask”, and use “masked value”
  everywhere. Introduce “redaction rule” once only where the configuration key is taught.

### F-2-19 — BLOCKING — One README heading remains meaningless out of context

- **Prior finding:** review 1 M3, re-raised because the heading repair is incomplete.
- **Quote/location:** README heading “Development”.
- **Why this loses a first-time visitor:** a screen-reader heading list does not reveal
  whether this section covers contributing, architecture, deployment, or verification.
- **Concrete rewrite:** “Build and test locally”.

### F-2-20 — MINOR — “Readable” is an unsupported marketing adjective

- **Quote/location:** landing, “...notes in two readable files.”
- **Why this is weak copy:** readability is subjective and adds nothing after naming Markdown
  and YAML.
- **Concrete rewrite:** “A scenario patch puts requests, masked values, saved response values,
  and notes in Markdown and YAML files.”

## 3. Complete copy audit

Counts are whitespace-delimited visible words. Inline code counts as one word. No sentence
exceeds 22 words, and no banned marketing word appears. The flags are the jargon,
terminology, heading, and unsupported-adjective findings above.

### Landing page sentences

| Words | Sentence | Flag |
| ---: | --- | --- |
| 1 | Offline. | — |
| 7 | The sample and docs are still available. | — |
| 6 | Record API flows for Git review. | — |
| 12 | For small API teams reviewing multi-step requests without a shared API-client workspace. | — |
| 10 | Runs `asp demo` and shows its Markdown and YAML files. | — |
| 12 | It records no request or response body until you allow a route. | — |
| 9 | JSON field rules mask values before files are written. | F-2-18 terminology |
| 6 | The proxy accepts loopback addresses only. | F-2-15 jargon |
| 7 | The same sample makes the same patch. | — |
| 8 | Config and command line both must opt in. | — |
| 3 | Run `asp init`. | — |
| 10 | Choose routes, JSON fields to mask, and saved response values. | — |
| 8 | Send existing client traffic through the local proxy. | F-2-4 unlisted core claim |
| 6 | Keep using your usual API client. | F-2-4 unlisted core claim |
| 10 | Review the Markdown and YAML files with the pull request. | — |
| 16 | A scenario patch holds requests, masked values, saved response values, and notes in two readable files. | F-2-4, F-2-20 |
| 5 | Use a bundled checkout retry. | — |
| 8 | The demo does not use your API traffic. | F-2-5 unlisted claim |

### README sentences

| Words | Sentence | Flag |
| ---: | --- | --- |
| 6 | Record API flows for Git review. | — |
| 15 | `asp` makes a scenario patch: a Markdown and YAML record of one multi-step API flow. | F-2-4 unlisted claim |
| 5 | Run the isolated sample first: | — |
| 13 | The bundled checkout retry writes `checkout-flow.md` and `checkout-flow.yml` in a new temporary directory. | Listed under demo output; default-path coverage should be added |
| 10 | It does not contact an API or use your traffic. | F-2-5 unlisted claim |
| 4 | From source (Rust 1.82+): | F-2-1 incomplete instruction |
| 10 | Create a reviewed capture policy, then run the local proxy: | F-2-16 jargon |
| 7 | Point your existing API client at `http://127.0.0.1:4317`. | F-2-4 unlisted core claim |
| 5 | Press Ctrl+C after the flow. | F-2-9 unlisted timing claim |
| 6 | The command writes `checkout-flow.yml` and `checkout-flow.md`. | F-2-9 unlisted output claim |
| 6 | Request and response bodies start off. | — |
| 8 | Allow a route before its body is written. | — |
| 8 | Sensitive headers and credential-shaped query values remain excluded. | F-2-6, F-2-17 |
| 11 | JSON field rules replace values before the scenario patch is written. | F-2-18 terminology |
| 6 | The listener accepts loopback addresses only. | F-2-15 jargon |
| 7 | Save a response value under a name. | F-2-7 unlisted claim |
| 11 | Later matching values appear as `${variable}` in captured requests and responses. | F-2-7 unlisted claim |
| 13 | Replay requires `replay.enabled = true` in the config and `asp replay ... --confirm`. | Exact instruction; claim test incomplete under F-2-13 |
| 9 | Open `/demo/` or `/?demo=1` for the bundled browser view. | — |
| 11 | Demo mode has no account and does not save sample data. | Listed |
| 15 | The static site makes no third-party browser requests and works offline after its first visit. | Listed |
| 8 | The factory deploys `dist/site` as a static site. | — |
| 11 | See `.factory/demo.md` for the demo sandbox and `.factory/claims.json` for claim verification. | — |
| 1 | MIT. | — |
| 2 | See `LICENSE`. | — |

### Heading and action audit

Landing headings that stand alone: “Record API flows for Git review”, “What asp records by
default”, “Create a scenario patch in three steps”, “Set capture rules”, “Record your API
flow”, “Commit the scenario patch”, “Review the flow without sharing a client workspace”,
and “Generate a sample scenario patch”. Kicker labels are contextual but are not headings.

README headings are “API Scenario Patch”, “Install”, “Record a flow”, “Capture rules”,
“Website demo and privacy”, “Development”, and “License”. “Development” is flagged in
F-2-19. “Install” is understandable, but its command is blocked by F-2-1.

Landing actions are “Try it with sample data” (twice) and “Copy install command”. They name
their result and use verbs. No action-label finding was recorded.

### Terminology table

| Concept | Terms currently used | Required single term |
| --- | --- | --- |
| Input | API flow, multi-step requests, client traffic, API traffic | API flow |
| Output | scenario patch, Markdown and YAML files, sample files | scenario patch; define its two files once |
| Secret handling | redact/redacted, mask/masked, replace | mask/masked |
| Recording permission | capture rules, capture policy | capture rules |
| Reused response data | saved response values, variable, extracted | saved response value; explain `${variable}` once |

## 4. Demo and sandbox

**Result: PASS.** From the first screen, one click opened
`https://api-scenario-patch.sociobot.in/demo/?demo=1`. The first 390 px viewport already
showed a realistic `asp demo` terminal run with checkout-retry file paths. Below it, the
pre-populated patch showed a masked card number, a saved `order_id`, and a second request.

The persistent banner read “Demo — sample data, nothing is saved” and offered Reset demo and
Start for real. Generate changed the presentation, Reset removed that state, focused the run
button, and announced “Demo reset. The bundled sample is ready.” Start for real returned to
the landing page.

A fresh live context had no cookies, localStorage, sessionStorage, or IndexedDB entries before
or after the flow. The only Cache Storage entry was the same-origin service-worker shell
`asp-site-v4`; no sample edits exist to persist. The request log contained only the product
origin and no console errors. Offline reload of `/demo/` succeeded after the first visit.

The CLI demo also passed from an empty temporary working directory. It wrote
`checkout-flow.yml` and `checkout-flow.md` to a new `/tmp/asp-demo-*` directory and left the
working directory empty.

## 5. Claims

Every command in `.factory/claims.json` was run independently from clean clone
`/tmp/api-scenario-patch-review2-clean-L0qh3o`.

| Claim id | Listed command result | Coverage assessment |
| --- | --- | --- |
| `demo-command-output` | PASS | File output proved; no-network copy remains unlisted (F-2-5) |
| `default-deny-capture` | PASS | Inadequate: only default config arrays (F-2-11) |
| `redact-before-files` | PASS | Inadequate: in-memory unit transform only (F-2-12) |
| `local-only-listener` | PASS | Public listen address was rejected |
| `deterministic-demo-output` | PASS | Two fresh demo outputs matched |
| `replay-double-opt-in` | PASS | Inadequate: only missing `--confirm` branch (F-2-13) |
| `no-third-party-browser-requests` | PASS | Whole browser demo flow stayed same-origin |
| `demo-isolated-storage` | PASS | Reset, cookies, localStorage, and sessionStorage checked |
| `no-account-hosted-workspace` | PASS | No account form or hosted-demo route observed |
| `offline-reload` | PASS | Fresh first visit followed by offline demo reload |

No listed command failed. The verdict still fails because F-2-4 through F-2-13 leave
material sentences unlisted or not observably proved by their declared command.

## 6. Earlier-review history

I read `.factory/review-1.md` and the current `.factory/handoff.md`, then checked every prior
finding against the live site and source.

| Earlier id | Current result | Evidence |
| --- | --- | --- |
| B1 | Fixed | Job, audience, action, and result are in both cold first screens. |
| B2 | Fixed | One-click `/demo/?demo=1`, persistent banner, reset/start controls, browser isolation, bundled sample, and `asp demo` all work. |
| B3 | Fixed structurally | `claims.json` exists and all ten commands pass; individual coverage defects are F-2-11–F-2-13. |
| B4 | **Not fully fixed; blocking again** | Current unlisted claims are F-2-4–F-2-10. |
| M1 | **Not fully fixed; blocking again** | Overlong sentences are gone, but current jargon is F-2-14–F-2-17. |
| M2 | **Not fully fixed; blocking again** | Mask/redact/replace remains inconsistent (F-2-18). |
| M3 | **Not fully fixed; blocking again** | Buttons are fixed; README “Development” remains context-free (F-2-19). |
| M4 | Fixed | All routes have title, description, canonical, OG/Twitter, favicon/touch icon, shared chrome, and attribution/version. |
| M5 | **Regressed; blocking again** | Destination heading focus works, but Back loses scroll (F-2-3). |

## 7. Structure, links, accessibility, and identity

The live root, demo, Privacy, Terms, and designed 404 each have `lang="en"`, one `h1`, one
`main`, route-specific title, meta description, canonical, OG/Twitter metadata, SVG favicon,
180 × 180 touch icon, shared header/footer, Privacy/Terms links, version, and Param Factory
credit. The OG image is 1200 × 630. An unknown URL returned the designed page with HTTP 404.
`robots.txt`, `sitemap.xml`, and the static-host fallback cover all routes. CSP, referrer,
permissions, HSTS, and nosniff headers were present.

All visible product links crawled successfully: home, demo, Privacy, Terms, and Source returned
200. The 404 document’s self-referential skip fragment naturally remains on the 404 response
and works within the loaded document; it is not a dead destination.

`/opt/fleet/lib/verify-url.sh` passed the live root with one `h1`, `lang`, `main`, complete alt
text, labelled buttons, and zero console/page errors. Live Axe found no serious or critical
issues on root, Privacy, Terms, or 404. The demo failure is F-2-2. Route heading focus works;
Back restoration fails under F-2-3.

The paper-cut API-flow artwork, ink/kraft/vermilion/acid palette, serif-plus-monospace pairing,
cut-paper edges, and stitched-patch motifs match `.factory/design.md`. This is recognizably
product-specific and not a generic centred-hero/three-card SaaS template.

## 8. Build and functional verification

- `npm test` — PASS: formatting, strict Clippy, 10 Rust tests, one doctest, static checks,
  loopback proxy integration, 10 claim tests, and 9 Playwright tests.
- `npm run build` — PASS: produced `dist/site` and `dist/bin/asp`.
- Initial site JS — 2.60 kB raw / 1.12 kB gzip; CSS — 12.53 kB raw / 3.75 kB gzip.
- Live cold root at mobile and desktop — HTTP 200, no console errors, no horizontal page
  overflow observed.
- Original asset provenance is recorded in `.factory/design.md`; the hero is 1,280 × 853,
  social image 1,200 × 630, and touch icon 180 × 180.

The repository’s untagged proxy integration does exercise the real job: default-deny bodies,
redaction, scalar extraction/substitution, notes, two output formats, concurrency limits, and
failure recovery. The claim-manifest findings are about the contract’s declared per-claim
verification, not an assertion that those implementation paths are absent.

## 9. Missed leverage

The obvious missing leverage is distribution, recorded as F-2-1: a CLI visitor expects one
install command that works outside the repository. A published crate or versioned release
binary would close the path from demo to real use.

No AI feature is warranted. The job is deterministic, privacy-sensitive recording and
transformation; model output would weaken reviewability. Hosted sync would also conflict with
the brief’s Git-native, no-shared-workspace premise. Markdown/YAML export already supplies the
expected portable artifact.

## What would make this perfect

Publish a working install path, make the demo terminal keyboard-scrollable, preserve scroll on
Back, list every material sentence as a claim, and make each claim command prove the complete
observable boundary it names. Then replace the remaining jargon and terminology drift, add
the missing demo Axe/history/install tests, and rerun this entire review from a fresh clone and
fresh browser contexts. There is not yet “nothing left to do.”
