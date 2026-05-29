## Problema

`client_software_links` es una tabla de unión pura: solo tiene `client_id` y `software_id`, sin `id` ni `created_at`. El helper `fetchAll` en `src/lib/importBundles.ts` intenta ordenar por `created_at`, falla, y como fallback intenta `id`, que tampoco existe → error `column client_software_links.id does not exist`.

## Solución

Modificar `fetchAll` en `src/lib/importBundles.ts` para ser tolerante a tablas sin columnas estándar:

1. Intentar ordenar por `created_at`.
2. Si falla por columna inexistente, intentar `id`.
3. Si también falla, hacer la consulta **sin `order()`** (paginación simple por `range`).

Esto permite exportar tablas de unión puras (como `client_software_links`) y cualquier otra tabla que no tenga ni `id` ni `created_at`, sin tocar el resto del flujo del bundle.

No se requieren cambios de esquema ni de UI.
