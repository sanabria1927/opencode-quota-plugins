# opencode-codex-quota

Plugin TUI de OpenCode que muestra la cuota de Codex (ChatGPT) en el sidebar.

## Qué muestra

- Ventana primaria (5h) y secundaria (semanal): barra, porcentaje y tiempo
  hasta el reinicio, leídos de los headers `x-codex-*-used-percent` y
  `x-codex-*-reset-after-seconds`.

Además registra el comando `/codex-quota` que refresca y muestra el resumen
en un toast (útil si el sidebar no está visible).

## Refresco automático

Igual estructura que `commandcode-usage` y `opencode-go-usage`: refresca al
arrancar y tras cada ejecución de sesión (con debounce de 3 s). El intervalo
periódico es de 5 min (no 60 s) porque cada sondeo hace un POST real que gasta
cuota y el backend responde `HTTP 429` si se sondea seguido. Si un sondeo
falla y ya hay un dato bueno, el sidebar conserva el dato anterior en vez de
mostrar el error.

## Credenciales

Se resuelven en este orden:

1. `OPENCODE_CODEX_ACCESS_TOKEN` (+ `OPENCODE_CODEX_ACCOUNT_ID` opcional).
2. **Store V2 de OpenCode**: la credencial `openai` tipo OAuth (la activa
   primero). Es la que OpenCode mantiene fresca mediante su refresh token; este
   paso es el que reemplaza al `auth.json` legado, que caduca.
3. `~/.codex/auth.json` → `tokens.access_token` / `tokens.account_id`
   (las que mantiene frescas el CLI con `codex login`; se puede apuntar
   a otro archivo con `OPENCODE_CODEX_CLI_AUTH_FILE` o `CODEX_HOME`).
4. `~/.local/share/opencode/auth.json` → `openai.access` / `openai.accountId`
   (legado; caducan y devuelven HTTP 401 al expirar).

Nunca se escriben ni imprimen. Se puede apuntar a otro archivo con
`OPENCODE_CODEX_AUTH_FILE` (o `OPENCODE_AUTH_PATH`).

## Endpoint usado

`POST https://chatgpt.com/backend-api/codex/responses` (petición mínima
`reply ok`, `store: false`) con `Authorization: Bearer <access>` más lista de
modelos en `/backend-api/codex/models`.

## Instalación

Añadir la ruta absoluta de este directorio al arreglo `plugin` de la
configuración (`~/.config/opencode/opencode.jsonc` y/o
`~/.config/opencode/tui.json`). El componente TUI (`./tui`) se carga de forma
automática junto al plugin. Luego `npm install` en este directorio (las
dependencias no las provee el host).

## Contrato V2

El loader TUI de OpenCode V2 exige que el módulo `./tui` exporte por defecto
un objeto con `id` (string no vacío) y `setup` (función). El `setup` recibe el
contexto V2 y usa `context.ui.slot({ append: "sidebar.content", ... })`,
`context.keymap.layer(...)` (montada en el slot `app`, que provee el scope
Solid) y `context.ui.toast.show(...)`.
