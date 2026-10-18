# opencode-cline-quota

> Parte de [`opencode-quota-plugins`](https://github.com/sanabria1927/opencode-quota-plugins) · MIT

Plugin TUI de OpenCode que muestra la cuota de ClinePass en el sidebar.

## Qué muestra

- Plan activo (Cline Pass Monthly, …).
- Ventana de 5 horas: barra, porcentaje y, si el API la trae, hora de reinicio.
- Ventana semanal: barra, porcentaje y reinicio.
- Ventana mensual: barra, porcentaje y reinicio.

Además registra el comando `/cline-usage` que refresca y muestra el resumen
en un toast (útil si el sidebar no está visible).

## Credenciales

La API key se resuelve en este orden:

1. `CLINE_API_KEY` en el entorno del proceso de OpenCode.
2. **Store V2 de OpenCode**: la credencial de la integración `cline-pass`
   (la activa primero). Es la que deja `/connect`, no el `auth.json` legado.

Nunca se escribe ni se imprime la key.

## Endpoints usados

`GET https://api.cline.bot/api/v1/users/me/plan/usage-limits`
(`data.limits[]` con `type` en `five_hour` / `weekly` / `monthly`, `percentUsed`
y `resetsAt`) y `GET /api/v1/users/me/plan` para el nombre del plan.

## Instalación

Añadir la ruta absoluta de este directorio al arreglo `plugin` de la
configuración (`~/.config/opencode/opencode.jsonc` y/o `~/.config/opencode/tui.json`).
El componente TUI (`./tui`) se carga de forma automática junto al plugin.
Luego `npm install` en este directorio (las dependencias no las provee el host).

## Contrato V2

El loader TUI de OpenCode V2 exige que el módulo `./tui` exporte por defecto
un objeto con `id` (string no vacío) y `setup` (función). El `setup` recibe el
contexto V2 y usa `context.ui.slot({ append: "sidebar.content", ... })`,
`context.keymap.layer(...)` (montada en el slot `app`, que provee el scope
Solid), `context.ui.toast.show(...)` y `context.client.credential.list()`
para leer la credencial activa del store.
