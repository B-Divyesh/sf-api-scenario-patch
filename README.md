# API Scenario Patch

Record API flows for Git review. `asp` makes a scenario patch: Markdown and YAML files for one multi-step API flow.

Run the isolated sample first:

```sh
asp demo
```

The bundled checkout retry writes `checkout-flow.md` and `checkout-flow.yml` in a new temporary directory. It does not contact an API or use your traffic.

## Install

Install with Rust 1.82 or later:

```sh
cargo install --git https://github.com/B-Divyesh/sf-api-scenario-patch.git --locked
```

## Record a flow

Choose what `asp` may record. Then start `asp` on your computer:

```sh
asp init --config scenario-patch.toml
asp record --config scenario-patch.toml --output checkout-flow
```

Set your API client's proxy to `http://127.0.0.1:4317`. Press Ctrl+C after the flow. `asp` writes `checkout-flow.yml` and `checkout-flow.md` after it stops.

## Capture rules

Request and response bodies start off. Allow a route before its body is written. `asp` leaves out authorization headers, cookies, API keys, and query values named password, secret, signature, or token. JSON field rules mask values before output files are written. The proxy listens only on this computer.

Save a response value under a name. Later matching values appear as `${variable}` in captured requests and responses. Replay requires `replay.enabled = true` in the config and `asp replay ... --confirm`.

## Website demo and privacy

Open `/demo/` or `/?demo=1` for the bundled browser view. Demo mode has no account and does not save sample data. The static site has no forms or analytics. It makes no third-party browser requests and works offline after its first visit.

## Build and test locally

```sh
npm ci
npm test
npm run build
npm run test:claim -- demo-command-output
cargo package --manifest-path cli/Cargo.toml --allow-dirty
```

The factory deploys `dist/site` as a static site. See `.factory/demo.md` for the demo sandbox and `.factory/claims.json` for claim verification.

## License

MIT. See [LICENSE](LICENSE).
