# API Scenario Patch

Record API flows for Git review. `asp` makes a scenario patch: a Markdown and YAML record of one multi-step API flow.

Run the isolated sample first:

```sh
asp demo
```

The bundled checkout retry writes `checkout-flow.md` and `checkout-flow.yml` in a new temporary directory. It does not contact an API or use your traffic.

## Install

From source (Rust 1.82+):

```sh
cargo install --path cli
```

## Record a flow

Create a reviewed capture policy, then run the local proxy:

```sh
asp init --config scenario-patch.toml
asp record --config scenario-patch.toml --output checkout-flow
```

Point your existing API client at `http://127.0.0.1:4317`. Press Ctrl+C after the flow. The command writes `checkout-flow.yml` and `checkout-flow.md`.

## Capture rules

Request and response bodies start off. Allow a route before its body is written. Sensitive headers and credential-shaped query values remain excluded. JSON field rules replace values before the scenario patch is written. The listener accepts loopback addresses only.

Save a response value under a name. Later matching values appear as `${variable}` in captured requests and responses. Replay requires `replay.enabled = true` in the config and `asp replay ... --confirm`.

## Website demo and privacy

Open `/demo/` or `/?demo=1` for the bundled browser view. Demo mode has no account and does not save sample data. The static site makes no third-party browser requests and works offline after its first visit.

## Development

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
