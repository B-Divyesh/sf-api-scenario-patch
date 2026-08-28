# API Scenario Patch

API Scenario Patch (`asp`) is a local reverse-proxy CLI for small API teams. Route an
existing API flow through it and commit the resulting deterministic YAML + Markdown:
ordered requests, safely redacted observations, extracted variables, and reviewer notes.
There is no hosted workspace, account, or telemetry.

It is intentionally not a REST client or test framework. Your existing client drives
the scenario; `asp` records only what the config explicitly permits.

## Install

Prebuilt binaries are published with GitHub releases. From source (Rust 1.82+):

```sh
cargo install --path cli
```

## Usage

Create a reviewed configuration:

```sh
asp init --config scenario-patch.toml
```

Edit `upstream`, allowed body paths, redactions, and extractions, then start the proxy:

```sh
asp record --config scenario-patch.toml --output checkout-flow
# Send existing client traffic to http://127.0.0.1:4317 instead of the upstream.
# Press Ctrl+C once the flow is complete.
```

The command writes `checkout-flow.yml` and `checkout-flow.md`. Authorization, proxy
authorization, cookies, set-cookie, and all bodies are omitted unless explicitly
allowed. Matching JSON paths are redacted before anything reaches disk.

Inspect configuration without starting a listener:

```sh
asp check --config scenario-patch.toml
asp check --config scenario-patch.toml --json
```

Replay is intentionally gated in both the file and command line:

```sh
# Set [replay] enabled = true in the reviewed config first.
asp replay checkout-flow.yml --config scenario-patch.toml --confirm
```

`--help` documents exit behavior. Exit code `0` is success, `2` is invalid input or a
privacy-policy refusal, and `1` is a runtime/network failure. No command prompts, so the
CLI is safe to use in CI.

## Configuration

`asp init` writes a commented example. Body rules are path prefixes (for example
`/v1/orders`); JSON paths use a small, deterministic subset such as `$.user.token` and
`$.items[*].secret`. Extractions select response paths and become `${variable}` in later
captured request paths and bodies when values match exactly.

## Development

```sh
npm install
npm test
npm run build        # release binary + site -> dist/
npm run build:site   # static landing/docs only -> dist/site/
npm run dev          # local Vite site
cargo test --manifest-path cli/Cargo.toml
cargo package --manifest-path cli/Cargo.toml --allow-dirty
```

The static site is deployed from `dist/site`. It stores nothing, loads no third-party
scripts or fonts, and works offline after the first visit.

## License

MIT. See [LICENSE](LICENSE).
