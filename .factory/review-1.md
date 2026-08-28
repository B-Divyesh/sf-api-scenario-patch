# Adversarial first-read review 1

**Product:** API Scenario Patch  
**Reviewed:** 2026-08-28  
**Verdict:** **FAIL**

The product has more than three minor findings and three blocking findings. The paper-cut visual identity is product-specific and the deployed page had no console errors in the checks below, but that does not make the product clear or tryable from a cold visit.

## Method and first-screen result

I opened `https://api-scenario-patch.sociobot.in` in fresh Chromium contexts at 390 × 844 and 1440 × 900, before scrolling. Both returned HTTP 200 with no console errors. At 390 px the first demo button was 3,582 px below the top; at desktop it was 3,237 px below the top.

My cold reading was:

| Question | Cold answer | Result |
| --- | --- | --- |
| What does it do? | I can infer that it turns an API request flow into files for Git review, but “a patch worth reviewing” does not say what files or what is captured. | Partial |
| Who is it for? | I cannot identify a person or team from the first screen. | **Fail** |
| What should I click first? | The only apparent action is **Copy** beside a long install command. It does not say what installing produces. | **Fail** |

Exact first-screen copy that fails to answer these questions: “**Turn an API flow into a patch worth reviewing.**”, “**Capture a real, ordered request scenario from the client you already use. Secrets stay out. Context lands in Git.**”, and the unlabeled-result button “**Copy**”. The page never names the brief’s target, small API teams reviewing an ordered scenario in Git.

## Findings, ordered by severity

### B1 — The first screen does not provide a clear audience or first action

- **Quote:** “Turn an API flow into a patch worth reviewing.” / “Capture a real, ordered request scenario from the client you already use.” / “Copy”.
- **Why this loses a first-time visitor:** “API flow”, “request scenario”, “patch”, and “context” require interpretation. No sentence says this is for small API teams or says that the result is Markdown and YAML committed to a pull request. “Copy” only copies an installation command and is not a result-naming action.
- **Concrete fix:** use a ≤9-word headline such as **“Record API flows for Git review.”** Follow it with **“For small API teams reviewing multi-step requests without a shared API-client workspace.”** Put **“Try it with sample data”** beside **“Runs `asp demo` and shows its Markdown and YAML files.”** Make the real path a second action: **“Install asp”**.

### B2 — Required one-click CLI demo and sandbox are absent

- **Quote:** the only demo control is “**Build the safe patch**”, under “**Local recorded demo**”; the live site has no `/demo` or `?demo=1` entry point. `GET /demo` and `GET /demo/` both returned the 404 page.
- **Why this loses or misleads a visitor:** the control is more than three screen-heights below the mobile entry point, is not a command recording, and only reveals a fixed browser illustration. It does not demonstrate the shipped CLI doing its job with sample input. There is no persistent “Demo — sample data, nothing is saved” banner, **Reset demo**, or **Start for real** control.
- **Verification:** after clicking the control, the generated browser patch was visible and no local/session storage or foreign browser request was observed. That is not a CLI sandbox. In a temporary directory, `/work/repo/target/debug/asp demo` exited 2 with `error: unrecognized subcommand 'demo'`. There is no `examples/` directory and no `.factory/demo.md`.
- **Concrete fix:** ship realistic input under `examples/`; implement `asp demo` (or `asp --demo`) to work in a temporary directory and print the generated file paths; add a self-hosted terminal recording to the landing page. Add `/demo` or `?demo=1`, enter it in one click from the first screen, and show the persistent demo banner with functioning reset/start controls. Test that demo output is isolated and no real storage is read or written.

### B3 — The mandatory claims inventory and claim tests are missing

- **Quote:** `.factory/claims.json` does not exist. A fresh clone at commit `9fa4cdf7b7ae82a3b78d914bf029c27c3895a68f` also reported `claims.json MISSING in clean clone`.
- **Why this loses or misleads a visitor:** the landing page and README make privacy, offline, output, and replay promises without a claim entry or a test a verifier can run. The normal `npm test` suite passed (10 Rust unit tests, one doc test, five Playwright tests), but it contains no `@claim:` tags and cannot substitute for the required tests.
- **Concrete fix:** add `.factory/claims.json` and one clean-state test per claim. At minimum cover: denied-by-default capture; JSON redaction before disk; local-only listening; deterministic output; replay requiring both opt-ins; no hosted workspace/account/telemetry; no third-party browser requests; and offline reload after first visit. Every claim below must either have a manifest entry with an observable test or be removed.

### B4 — Unlisted claims are presented as facts

- **Quote and location:**

  | Location | Unlisted claim-like copy |
  | --- | --- |
  | Landing | “Free, open source, no account.” |
  | Landing | “Authorization, cookies, and bodies start denied.” |
  | Landing | “JSON-path rules redact before the patch touches disk.” |
  | Landing | “The proxy refuses public listeners.” |
  | Landing | “No timestamps or machine-specific paths.” |
  | Landing | “Config and command line must both opt in.” |
  | Landing | “It makes no network request and stores nothing.” |
  | Landing | “API Scenario Patch · MIT licensed · no telemetry” |
  | README | “There is no hosted workspace, account, or telemetry.” |
  | README | “The command writes `checkout-flow.yml` and `checkout-flow.md`.” |
  | README | “Authorization, proxy authorization, cookies, set-cookie, common API-key headers, query values, and all bodies are denied by default.” |
  | README | “Matching JSON paths are redacted before anything reaches disk.” |
  | README | “No command prompts, so the CLI is safe to use in CI.” |
  | README | “Credential-shaped names such as `api_key`, `access_token`, `password`, and `signature` remain redacted even if listed.” |
  | README | “A missing or empty variable stops recording before the listener starts.” |
  | README | “`--max-exchanges` reserves capacity before forwarding, so concurrent requests beyond the limit receive `429` and are not captured.” |
  | README | “It stores nothing, loads no third-party scripts or fonts, and works offline after the first visit.” |

- **Why this loses or misleads a visitor:** these are material security and behavior promises. Because there is no claims manifest, all are unlisted.
- **Concrete fix:** create a separate manifest entry and tagged observable test for each sentence, or delete/reduce the sentence. For example, the privacy test must intercept requests for the whole demo flow, and the offline test must reload a previously visited demo while the browser context is offline.

### M1 — Copy audit has overlong sentences and unexplained specialist terms

- **Quote:** “Route an existing API flow through it and commit the resulting deterministic YAML + Markdown: ordered requests, safely redacted observations, extracted variables, and reviewer notes.” (**25 words**, README).
- **Why this loses a first-time visitor:** it exceeds the 22-word cap and compresses four unfamiliar product concepts into one sentence.
- **Concrete fix:** “Route an existing API flow through asp. Commit a Markdown and YAML patch with requests, masked secrets, saved values, and notes.”

- **Quote:** “Extractions select string, number, or boolean response values and become `${variable}` in the observed response and later captured paths, headers, and bodies when values match.” (**25 words**, README).
- **Why this loses a first-time visitor:** it exceeds the cap and introduces “extractions”, “observed response”, and substitution behavior at once.
- **Concrete fix:** “Save a response value under a name. Later matching values appear as `${variable}` in captured requests and responses.”

- **Quote:** “`asp init` creates a default-deny policy.” / “JSON-path rules” / “Loopback only” / “Deterministic output” / “extractions”.
- **Why this loses a first-time visitor:** these are core behavior terms, not definitions. A person deciding whether to try the tool should not have to know proxy and serialization vocabulary.
- **Concrete fix:** say “records no bodies until you allow a route”, “JSON field rules”, “local-only listener”, “the same input makes the same files”, and “saved response values” on first mention; retain the technical names later in the reference documentation.

### M2 — The same product artifact has too many names

- **Quote:** “API flow”, “ordered request scenario”, “patch”, “review trail”, “safe slice”, “two plain files”, “review document”, and “scenario patch”.
- **Why this loses a first-time visitor:** it is unclear whether these are different inputs, output files, or stages. The brief calls the output a scenario patch; the UI should use one term consistently.
- **Concrete fix:** define and consistently use **“scenario patch”**: “A scenario patch is a Markdown and YAML record of one API flow.” Use “API flow” only for the input.

### M3 — Several headings and buttons do not stand alone

- **Quote:** “The contract”, “One narrow job”, “Watch the secret disappear.”, “Your next API review”, and README headings “Usage”, “Configuration”, and “Development”. Buttons: “Copy” (twice) and “Build the safe patch”.
- **Why this loses a first-time visitor:** headings announced out of context do not identify content; “Watch the secret disappear” describes an effect rather than the task. “Copy” does not say what will be copied, and “safe” is an untested adjective.
- **Concrete fix:** use “What asp records by default”, “Create a scenario patch in three steps”, “See a redacted checkout scenario”, “Start recording an API flow”, “Record a flow”, “Configure capture rules”, and “Build and test”. Rename buttons to “Copy install command”, “Generate sample scenario patch”, and “Copy scenario patch”.

### M4 — Required route metadata and standard-site elements are incomplete

- **Quote / evidence:** all checked routes (`/`, `/privacy/`, `/terms/`, `/404.html`) have `lang`, one `h1`, a title, description, favicon, and a designed 404. All have **zero** canonical links, Open Graph tags, Twitter-card tags, and Apple-touch icons. The home header offers only “How it works”, “See a patch”, and “Source”; it has no Demo or Privacy link. Legal pages do not retain that nav. The footer does not say “Built by Param Factory” or expose a version/build id.
- **Why this loses a first-time visitor:** shared routes feel disconnected, previews are unformed, and the expected demo route is absent.
- **Concrete fix:** add canonical, OG, Twitter, and 180px Apple-touch metadata to every route; provide the product’s 1200 × 630 derived image; add consistent header navigation (Home, Demo, Privacy) and the required footer attribution/build id on every route.

### M5 — Route changes do not move focus or announce the destination

- **Quote / evidence:** clicking the footer’s “Privacy” link reached `/privacy/` (HTTP 200), but `document.activeElement` was `BODY` and the page had zero `[aria-live]` elements. Browser Back did restore the prior landing scroll position (3,781 px in this check).
- **Why this loses a keyboard or screen-reader visitor:** the new page is not announced and focus remains unhelpfully at document body.
- **Concrete fix:** on each route load or client-side navigation, give the destination `h1` `tabindex="-1"`, focus it, and announce the route in a polite live region.

## Copy inventory

Word counts use whitespace-delimited visible words. Code commands and generated patch fields are excluded because they are command/sample data rather than prose sentences. Headings, labels, and controls are audited separately in M3.

### Landing page sentences

| Words | Sentence |
| ---: | --- |
| 1 | Offline. |
| 10 | The docs and local demo still work; install links may not. |
| 9 | Turn an API flow into a patch worth reviewing. |
| 12 | Capture a real, ordered request scenario from the client you already use. |
| 3 | Secrets stay out. |
| 4 | Context lands in Git. |
| 5 | Free, open source, no account. |
| 5 | It records less on purpose. |
| 6 | Authorization, cookies, and bodies start denied. |
| 17 | A reviewed config names the few paths worth preserving; JSON-path rules redact before the patch touches disk. |
| 5 | The proxy refuses public listeners. |
| 5 | No timestamps or machine-specific paths. |
| 8 | Config and command line must both opt in. |
| 3 | Keep your client. |
| 4 | Add a review trail. |
| 6 | `asp init` creates a default-deny policy. |
| 8 | Allow body routes, redactions, and named extractions explicitly. |
| 12 | Point curl, Bruno, Postman, or application traffic at the local reverse proxy. |
| 5 | No request editor to relearn. |
| 14 | YAML preserves structure; Markdown gives reviewers a readable change narrative with notes and variables. |
| 4 | Watch the secret disappear. |
| 7 | This browser-only example mirrors the CLI transform. |
| 8 | It makes no network request and stores nothing. |
| 14 | Run the example to redact a card value and carry `${order_id}` into step two. |
| 5 | Cutting the scenario into safe layers… |
| 6 | Enough evidence to discuss the flow. |
| 5 | Not enough to leak it. |
| 4 | Paste curl in Slack? |
| 4 | Step 2 reuses `${order_id}`. |
| 4 | Observed response: 409 Conflict. |
| 5 | Reviewer note: retry is intentional. |
| 6 | Leave the workspace out of it. |
| 9 | API Scenario Patch · MIT licensed · no telemetry. |

### README sentences

| Words | Sentence |
| ---: | --- |
| 13 | API Scenario Patch (`asp`) is a local reverse-proxy CLI for small API teams. |
| 25 | Route an existing API flow through it and commit the resulting deterministic YAML + Markdown: ordered requests, safely redacted observations, extracted variables, and reviewer notes. |
| 8 | There is no hosted workspace, account, or telemetry. |
| 10 | It is intentionally not a REST client or test framework. |
| 14 | Your existing client drives the scenario; `asp` records only what the config explicitly permits. |
| 7 | Prebuilt binaries are published with GitHub releases. |
| 4 | From source (Rust 1.82+): |
| 4 | Create a reviewed configuration: |
| 12 | Edit `upstream`, allowed body paths, redactions, and extractions, then start the proxy: |
| 10 | Send existing client traffic to `http://127.0.0.1:4317` instead of the upstream. |
| 7 | Press Ctrl+C once the flow is complete. |
| 6 | The command writes `checkout-flow.yml` and `checkout-flow.md`. |
| 17 | Authorization, proxy authorization, cookies, set-cookie, common API-key headers, query values, and all bodies are denied by default. |
| 9 | Matching JSON paths are redacted before anything reaches disk. |
| 6 | Inspect configuration without starting a listener: |
| 11 | Replay is intentionally gated in both the file and command line: |
| 10 | Set `[replay] enabled = true` in the reviewed config first. |
| 4 | `--help` documents exit behavior. |
| 19 | Exit code `0` is success, `2` is invalid input or a privacy-policy refusal, and `1` is a runtime/network failure. |
| 12 | No command prompts, so the CLI is safe to use in CI. |
| 6 | `asp init` writes a commented example. |
| 20 | Body rules are path prefixes (for example `/v1/orders`); JSON paths use a small, deterministic subset such as `$.user.token` and `$.items[*].secret`. |
| 25 | Extractions select string, number, or boolean response values and become `${variable}` in the observed response and later captured paths, headers, and bodies when values match. |
| 13 | Query parameter values are written as `${REDACTED_QUERY}` unless their names appear in `capture.query_parameters`. |
| 14 | Credential-shaped names such as `api_key`, `access_token`, `password`, and `signature` remain redacted even if listed. |
| 14 | This keeps the exceptional capture path explicit without allowing common query credentials into Git. |
| 22 | For secrets that can appear outside known JSON paths, reference an environment variable; the secret itself never belongs in the TOML file: |
| 19 | With `CHECKOUT_API_KEY` set, exact occurrences are written as `${API_KEY}` across captured paths, allowed query values, headers, and JSON bodies. |
| 11 | A missing or empty variable stops recording before the listener starts. |
| 17 | `--max-exchanges` reserves capacity before forwarding, so concurrent requests beyond the limit receive `429` and are not captured. |
| 7 | The static site is deployed from `dist/site`. |
| 16 | It stores nothing, loads no third-party scripts or fonts, and works offline after the first visit. |

## Checks that passed or were observed

- The live landing page had no console errors at 390 px or desktop; 390 px had no horizontal overflow.
- The live demo illustration made no foreign browser request, and local/session storage remained empty in that checked flow. After first load, the live service worker controlled an offline reload successfully. These observations do **not** satisfy the missing claim-test requirement.
- `npm ci` followed by `npm test` passed locally: formatting, clippy, Rust tests, static policy checks, CLI integration, site build, and 5 Playwright tests.
- All crawled visible destinations were reachable: home, Privacy, Terms, favicon, robots, sitemap, and the GitHub Source URL returned 200. `/demo` correctly exposes the missing demo as a 404 finding rather than a dead visible link.
- `lang`, title, description, favicon, main landmark, one h1, basic legal pages, service worker, and designed 404 were present. The paper-cut art and ink/paper visual system are distinct from a generic SaaS template.

