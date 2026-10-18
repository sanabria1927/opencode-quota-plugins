# Contributing

Thanks for your interest! Contributions, bug reports and provider requests are
welcome.

## Development setup

Requires **Node.js 20+** and **OpenCode V2**.

```sh
git clone https://github.com/sanabria1927/opencode-quota-plugins.git
cd opencode-quota-plugins
npm run install:all   # installs dependencies for each plugin
npm test              # runs the unit tests of all plugins
```

To try a plugin in OpenCode, add its absolute path to the `plugin` array of your
`~/.config/opencode/opencode.jsonc` (and `tui.json` / `tui.jsonc` if you use
them), then restart OpenCode.

## Project layout

Each plugin is a self-contained package with the same shape:

```
<plugin>/
  index.js         # server entrypoint (no-op)
  tui.js           # TUI entrypoint: export default { id, setup }
  lib/
    credentials.js # reads the OpenCode V2 credential store
    usage.js       # provider API + credential resolution + normalization
    format.js      # pure formatting helpers (no I/O)
  test/*.test.js   # unit tests (node:test)
```

`lib/format.js` and the normalization functions in `lib/usage.js` are pure and
easy to test; network calls accept an injected `fetch` or are stubbed with
`globalThis.fetch`.

## Guidelines

- Keep credentials out of the code: read them, never log or persist them.
- Add or update tests for behavior changes (`node --test`).
- Match the existing code style (no semicolons, 2-space indent, ESM).
- Keep each plugin independent — no cross-plugin imports.
- Update the relevant `README.md` and `CHANGELOG.md`.

## Commits and PRs

Small, focused commits are appreciated. Describe the provider/endpoint you
touched and how you tested it. Screenshots of the sidebar are very welcome.
