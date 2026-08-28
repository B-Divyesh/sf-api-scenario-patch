# Demo sandbox

Browser demo: `https://api-scenario-patch.sociobot.in/demo/` or `https://api-scenario-patch.sociobot.in/?demo=1`.

CLI demo: run `asp demo`. It creates a unique directory under the operating system temporary directory and writes `checkout-flow.md` plus `checkout-flow.yml` there.

It uses the bundled checkout retry in `examples/checkout-retry/`. It does not start a listener, make a network request, read a capture configuration, or write real user data.

The browser route presents the same bundled sample. It does not use browser storage. Its persistent banner says `Demo — sample data, nothing is saved`.

**Reset demo** resets the browser presentation. **Start for real** returns to the landing page. Leaving the route discards the presentation state.
