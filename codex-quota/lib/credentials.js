// Lectura de credenciales del store V2 de OpenCode.
//
// En OpenCode V2 las credenciales guardadas (las que crea `/connect`) viven en
// el store del servidor, NO en ~/.local/share/opencode/auth.json (que es el
// archivo legado y se queda obsoleto). El plugin recibe `context.client`, el
// cliente del servidor, cuya API `credential.list()` devuelve las credenciales
// con su valor y el flag `active`.
//
// Este módulo nunca imprime, registra ni escribe el valor de una credencial.

// Busca el primer arreglo dentro de una respuesta sin asumir la forma exacta
// (el cliente puede envolver el cuerpo en `data`, `items`, etc.).
function firstArray(value, depth = 0) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object" || depth > 4) return undefined
  for (const key of ["data", "items", "credentials", "entries", "connections"]) {
    const found = firstArray(value[key], depth + 1)
    if (found) return found
  }
  return undefined
}

/**
 * Lista las credenciales guardadas en el store V2. Devuelve [] si el cliente no
 * expone `credential.list` o si la llamada falla (nunca lanza).
 */
export async function listStoredCredentials(context) {
  try {
    const credential = context?.client?.credential
    if (!credential || typeof credential.list !== "function") return []
    const result = await credential.list({})
    const entries = firstArray(result) ?? []
    return entries.filter((entry) => entry && typeof entry === "object")
  } catch {
    return []
  }
}

/** Credenciales de una integración, con las activas primero. */
export async function storedCredentials(context, integrationID) {
  const all = await listStoredCredentials(context)
  return all
    .filter((entry) => entry.integrationID === integrationID)
    .sort((a, b) => Number(b.active === true) - Number(a.active === true))
}
