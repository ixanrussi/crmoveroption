## Causa de las recargas constantes

Encontré el motivo. En dos páginas se ejecuta `window.location.reload()` después de guardar:

- `src/pages/Afiliados.tsx` línea 486 — tras crear/editar un afiliado
- `src/pages/Clientes.tsx` línea 325 — tras crear/editar un cliente

Esto fuerza una **recarga completa del navegador** cada vez que pulsas "Guardar". Resultado:
- Se pierde el scroll, los filtros aplicados, las pestañas abiertas, búsquedas en curso, etc.
- Si estabas a punto de añadir otro registro o seguir editando algo más, todo el contexto desaparece.
- Da la sensación de "el sistema se actualiza solo todo el rato".

No hay `setInterval`, ni `refetchInterval`, ni realtime que recargue las páginas de Afiliados/Clientes. La única suscripción realtime activa es la campanita de notificaciones (`NotificationsBell`), que solo refresca su propio listado, no la página.

## Solución propuesta

Reemplazar ambos `window.location.reload()` por una recarga **en memoria** de los datos de la tabla:

1. En `Afiliados.tsx`: después de `setOpen(false)`, llamar a `load()` (la función que ya existe y trae la lista de afiliados desde Supabase). Sin recarga del navegador.
2. En `Clientes.tsx`: lo mismo — llamar a `load()` en lugar de `window.location.reload()`.

Con esto:
- La lista se actualiza con los datos nuevos al instante.
- Filtros, scroll, búsquedas y demás contexto se mantienen intactos.
- La página solo "se refresca" cuando tú decides recargarla manualmente.

No tocaré el resto de comportamiento (creación, edición, validaciones, toasts) — solo el modo de refrescar la lista.

## Archivos a modificar

- `src/pages/Afiliados.tsx` (1 línea)
- `src/pages/Clientes.tsx` (1 línea)
