# OpenCode Quota Plugins

TUI plugins for [OpenCode](https://opencode.ai) V2 that show your remaining
quota/usage for several providers directly in the sidebar.

Unofficial community plugins — not affiliated with OpenCode, OpenAI, or Cline.

| Plugin | Provider | Slash commands |
| --- | --- | --- |
| [`opencode-go-usage`](./opencode-go-usage) | OpenCode Go (Zen) | `/go-usage`, `/go-accounts` |
| [`codex-quota`](./codex-quota) | Codex / ChatGPT | `/codex-quota` |
| [`cline-quota`](./cline-quota) | ClinePass (Cline) | `/cline-usage` |

## Features

- **Sidebar widget** with progress bars, percent and reset countdown for each
  window (5-hour, weekly, monthly).
- **Toast summaries** from slash commands or the command palette.
- **Reads the active OpenCode V2 credential store**
  (`context.client.credential.list()`), so it uses the credentials `/connect`
  manages. Environment variables and legacy `auth.json` files are supported as
  fallbacks. Keys are **never logged or printed**.
- **Multi-account (OpenCode Go)**: shows only the account currently in use and
  can switch the active account natively (`/go-accounts` →
  `credential.activate`, the same mechanism `/connect` uses).

## Requirements

- OpenCode **V2** (tested on `v2.0.32`).
- Node.js 18+ (the plugins use the global `fetch`).

## Install

Each plugin is a local directory. Clone this repo, install its dependencies,
and add the absolute paths to the `plugin` array of your OpenCode
configuration (`~/.config/opencode/opencode.jsonc`, and also `tui.json` /
`tui.jsonc` if you use them):

```jsonc
{
  "plugin": [
    "/abs/path/opencode-quota-plugins/opencode-go-usage",
    "/abs/path/opencode-quota-plugins/codex-quota",
    "/abs/path/opencode-quota-plugins/cline-quota"
  ]
}
```

```sh
cd opencode-go-usage && npm install
cd ../codex-quota      && npm install
cd ../cline-quota      && npm install
```

Restart OpenCode. Credentials come from OpenCode's own store — create them with
`/connect` (each plugin also honors the env vars documented in its README).

## Per-provider notes

### OpenCode Go — `opencode-go-usage`
- `GET https://opencode.ai/zen/go/v1/usage`. Limits: **$12 / 5h**, **$30 / week**,
  **$60 / month**.
- Multiple accounts: the sidebar shows only the active account; run
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

## Contributing

Issues and PRs are welcome. Please never commit credentials; the plugins are
designed to read them from OpenCode's store or the environment only.

## License

[MIT](./LICENSE)

---

## Español

Plugins de TUI para **OpenCode V2** que muestran en el sidebar la cuota/uso
restante de varios proveedores: **OpenCode Go**, **Codex (ChatGPT)** y
**ClinePass (Cline)**. Son plugins no oficiales de la comunidad.

**Características**

- Widget en el sidebar con barra, porcentaje y cuenta atrás de reinicio por
  ventana (5 h, semanal, mensual).
- Resúmenes en toast con comandos `/go-usage`, `/codex-quota`, `/cline-usage`.
- Lee las credenciales del **store de OpenCode V2** (las que gestiona
  `/connect`), con variables de entorno y `auth.json` legado como respaldo.
  **Nunca registra ni imprime las claves.**
- **Multi-cuenta (OpenCode Go)**: muestra solo la cuenta en uso y permite
  cambiarla (`/go-accounts`) con el mecanismo nativo de OpenCode.

**Instalación**: clona el repo, ejecuta `npm install` dentro de cada plugin y
añade su ruta absoluta al arreglo `plugin` de tu configuración de OpenCode.
Luego reinicia OpenCode. Consulta el `README.md` de cada plugin para el detalle
de credenciales.

**Licencia**: [MIT](./LICENSE).
