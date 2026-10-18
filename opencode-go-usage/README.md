# opencode-go-usage

Plugin TUI de OpenCode que muestra el uso de OpenCode Go en el sidebar.

## Qué muestra

- Mes, ventana de 5 horas y ventana semanal: barra, porcentaje y tiempo hasta
  el reinicio (`resetsAt` de cada ventana). Límites: $12/5h, $30/semana y
  $60/mes según la
  [doc oficial](https://opencode.ai/v2/docs/console/go/).

Además registra dos comandos:

- `/go-usage` — refresca y muestra el resumen de todas las cuentas en un toast
  (útil si el sidebar no está visible).
- `/go-accounts` — abre un menú para **elegir la cuenta activa de OpenCode Go**.
  Usa el mecanismo nativo de OpenCode (`credential.activate`), así que además
  cambia qué cuenta usa OpenCode para sus peticiones. En la paleta de comandos
  también aparece una entrada «OpenCode Go: activar <cuenta>» por cada cuenta
  guardada inactiva, y el sidebar marca la activa con `●` y las demás con `○`.

## Credenciales (multi-cuenta)

El sidebar muestra **solo la cuenta en uso** (la activa). `/go-accounts` cambia
cuál es la activa, de modo que el panel pasa a mostrar esa otra. Si no hay
ninguna marcada como activa (p. ej. cuentas de env/archivos, sin concepto de
"activa"), se muestran todas.

Las cuentas del store V2 llevan `id` y `active`; las de env/archivos no tienen
`id` (no son conmutables y se muestran sin marcador). La activa se marca con `●`.

Resolución por precedencia, sin exponer keys:

1. Env: `OPENCODE_GO_API_KEYS="keyA,keyB"` o `OPENCODE_GO_API_KEY` + `OPENCODE_GO_API_KEY_2`.
2. **Store V2 de OpenCode**: todas las credenciales de la integración
   `opencode-go` (las activas primero). Es la fuente que usa OpenCode V2 y de
   donde salen las dos cuentas. Este paso es el que reemplaza al `auth.json`
   legado.
3. Archivos legados: `OPENCODE_GO_AUTH_FILES="fileA,fileB"` o
   `OPENCODE_GO_AUTH_FILE` + `OPENCODE_GO_AUTH_FILE_2`
   (cada archivo con forma `{"opencode-go":{"key":"..."}}`), o
   `~/.local/share/opencode/auth.json` -> `opencode-go.key`.

Labels: `OPENCODE_GO_LABELS="Personal,Trabajo"` o `OPENCODE_GO_LABEL` +
`OPENCODE_GO_LABEL_2`. En el store se usa el label de cada credencial
(`OpenCode Go 2` -> `Go 2`). Con una sola cuenta se omite el label para
conservar la UI anterior. Keys duplicadas se deduplican.

Nunca se escribe ni se imprime la key.

Ejemplo segunda cuenta:

```sh
# Opción archivo: crea ~/.config/opencode/auth-go-b.json con forma
# {"opencode-go":{"key":"PEGAR_KEY_B"}} y arranca así:
OPENCODE_GO_AUTH_FILE_2=~/.config/opencode/auth-go-b.json opencode
# Opción env (solo en el entorno del proceso de OpenCode):
OPENCODE_GO_API_KEY_2="PEGAR_KEY_B" opencode
```

## Endpoint usado

`GET https://opencode.ai/zen/go/v1/usage` con `Authorization: Bearer <key>`.

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
