# OpenCode Quota Plugins

[![CI](https://github.com/sanabria1927/opencode-quota-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/sanabria1927/opencode-quota-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![OpenCode V2](https://img.shields.io/badge/OpenCode-v2-blue.svg)](https://opencode.ai)

TUI plugins for [OpenCode](https://opencode.ai) **V2** that show your remaining
quota/usage for several providers directly in the **sidebar**, plus toast
summaries from slash commands and the command palette.

> Unofficial community plugins — not affiliated with OpenCode, OpenAI, or Cline.

| Plugin | Provider | Slash commands |
| --- | --- | --- |
| [`opencode-go-usage`](./opencode-go-usage) | OpenCode Go (Zen) | `/go-usage`, `/go-accounts` |
| [`codex-quota`](./codex-quota) | Codex / ChatGPT | `/codex-quota` |
| [`cline-quota`](./cline-quota) | ClinePass (Cline) | `/cline-usage` |

## Features

- **Sidebar widget** with a progress bar, percent and reset countdown for each
  window (5-hour, weekly, monthly).
- **Toast summaries** from slash commands or the command palette.
- **Reads the active OpenCode V2 credential store**
  (`context.client.credential.list()`), so it uses exactly the credentials
  `/connect` manages. Environment variables and legacy `auth.json` files are
  supported as fallbacks. Keys are **never logged, printed, or written**.
- **Multi-account (OpenCode Go)**: shows only the account currently in use and
  can switch the active account natively (`/go-accounts` →
  `credential.activate` — the same mechanism `/connect` uses).
- **Zero configuration** once the credentials exist; each plugin refreshes on
  its own cadence.

## Requirements

- OpenCode **V2** (developed and tested against `v2.0.32`).
- Node.js **20+** (the plugins use the global `fetch`).

## Install

Each plugin is a self-contained local directory. Clone the repo, install the
dependencies of all plugins, and add their absolute paths to the `plugin` array
of your OpenCode configuration (`~/.config/opencode/opencode.jsonc`, and also
`tui.json` / `tui.jsonc` if you use them):

```sh
git clone https://github.com/sanabria1927/opencode-quota-plugins.git
cd opencode-quota-plugins
npm run install:all   # installs each plugin's dependencies
```

```jsonc
{
  "plugin": [
    "/abs/path/opencode-quota-plugins/opencode-go-usage",
    "/abs/path/opencode-quota-plugins/codex-quota",
    "/abs/path/opencode-quota-plugins/cline-quota"
  ]
}
```

Restart OpenCode. Credentials come from OpenCode's own store — create them with
`/connect` (each plugin also honors the environment variables documented in its
own `README.md`).

## Credentials

Resolution order, for every plugin (first match wins):

1. **Environment variables** (see each plugin's README) — handy for scripts/CI.
2. **OpenCode V2 credential store** — `context.client.credential.list()`, the
   credentials created by `/connect` (the recommended path).
3. **Legacy `auth.json` files** (`~/.local/share/opencode/auth.json`,
   `~/.codex/auth.json`) — read-only fallback for older installs.

Credentials are only ever read. Nothing is persisted, logged, or echoed.

## Per-provider notes

### OpenCode Go — `opencode-go-usage`
- `GET https://opencode.ai/zen/go/v1/usage`. Limits: **$12 / 5h**, **$30 / week**,
  **$60 / month**.
- Multiple accounts: the sidebar shows only the account in use; run
  `/go-accounts` to switch (native `POST /api/credential/{id}/activate`).

### Codex — `codex-quota`
- `POST https://chatgpt.com/backend-api/codex/responses`, reading the
  `x-codex-*-used-percent` / `x-codex-*-reset-after-seconds` headers.
- Periodic refresh is **5 minutes** (not 60 s) to avoid `HTTP 429` from the
  backend.

### ClinePass — `cline-quota`
- `GET https://api.cline.bot/api/v1/users/me/plan/usage-limits` (windows
  `five_hour` / `weekly` / `monthly`) and `/users/me/plan` for the plan name.

See each plugin's own `README.md` for the full credential resolution order and
implementation details.

## Project layout

```
opencode-quota-plugins/
├── opencode-go-usage/   # OpenCode Go  (server + TUI + lib + tests)
├── codex-quota/         # Codex         (server + TUI + lib + tests)
├── cline-quota/         # ClinePass     (server + TUI + lib + tests)
├── .github/workflows/   # CI: tests on Node 20 / 22 / 24
└── package.json         # helper scripts (install:all, test)
```

Every plugin shares the same shape: `index.js` (server entrypoint), `tui.js`
(`export default { id, setup }`), `lib/` (`credentials`, `usage`, `format`) and
`test/` (`node:test` unit tests).

## Development

```sh
npm run install:all   # install dependencies for every plugin
npm test              # run the unit tests of every plugin
```

Node.js 20+ is required. `lib/format.js` and the normalization helpers in
`lib/usage.js` are pure and fully unit-tested; network access is stubbed with an
injected `fetch`.

## Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please
**never commit credentials, tokens, or personal configuration**.

## Security

See [SECURITY.md](./SECURITY.md). Report vulnerabilities privately, not in a
public issue.

## License

[MIT](./LICENSE) © 2026 sanabria1927

---

## Español

Plugins de TUI para **OpenCode V2** que muestran en el **sidebar** la cuota/uso
restante de varios proveedores: **OpenCode Go**, **Codex (ChatGPT)** y
**ClinePass (Cline)**. Son plugins no oficiales de la comunidad.

| Plugin | Proveedor | Comandos |
| --- | --- | --- |
| [`opencode-go-usage`](./opencode-go-usage) | OpenCode Go (Zen) | `/go-usage`, `/go-accounts` |
| [`codex-quota`](./codex-quota) | Codex / ChatGPT | `/codex-quota` |
| [`cline-quota`](./cline-quota) | ClinePass (Cline) | `/cline-usage` |

**Características**

- Widget en el sidebar con barra, porcentaje y cuenta atrás de reinicio por
  ventana (5 h, semanal, mensual).
- Resúmenes en toast desde los comandos `/go-usage`, `/codex-quota`,
  `/cline-usage` o la paleta de comandos.
- Lee las credenciales del **store de OpenCode V2** (las que gestiona
  `/connect`), con variables de entorno y `auth.json` legado como respaldo.
  **Nunca registra, imprime ni escribe las claves.**
- **Multi-cuenta (OpenCode Go)**: muestra solo la cuenta en uso y permite
  cambiarla (`/go-accounts`) con el mecanismo nativo de OpenCode.

**Instalación**: clona el repo, ejecuta `npm run install:all` y añade la ruta
absoluta de cada plugin al arreglo `plugin` de tu configuración de OpenCode
(`~/.config/opencode/opencode.jsonc`, y también `tui.json` / `tui.jsonc` si los
usas). Luego reinicia OpenCode. Consulta el `README.md` de cada plugin para el
detalle del orden de credenciales.

**Desarrollo**:

```sh
npm run install:all   # dependencias de todos los plugins
npm test              # tests unitarios de todos los plugins
```

**Licencia**: [MIT](./LICENSE) © 2026 sanabria1927.
