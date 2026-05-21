## Objetivo

Para los afiliados con **remuneración fija** (`fixed_remuneration_min_ftd > 0`), tratar ese valor como el objetivo de CPAs del afiliado y reflejarlo automáticamente en el card "Objetivos". Además, aclarar visualmente que los importes de remuneración fija y de objetivos no se suman.

## Cambios

### `src/components/AffiliateGoals.tsx`

1. **Cargar dato del afiliado**: añadir una consulta a `affiliates` para traer `fixed_remuneration_min_ftd` y `fixed_remuneration_currency`.
2. **Auto-rellenar el formulario "Nuevo objetivo"**:
   - Si el afiliado tiene `fixed_remuneration_min_ftd > 0`, inicializar `draft.ftd_target` con ese número.
   - Pre-llenar `draft.notes` con un texto tipo: "Objetivo derivado de la remuneración fija del afiliado." (editable).
   - Esto sólo ocurre cuando el draft está vacío (no machaca ediciones del usuario).
3. **Banner informativo dentro del card "Objetivos"** (visible siempre, encima del formulario y de la tabla):
   - Si el afiliado tiene remuneración fija: mensaje resaltado (estilo `Alert` / borde `accent`) — "Este afiliado tiene remuneración fija con un objetivo de **X CPAs/mes**. Los objetivos definidos aquí y la remuneración fija no se suman: la remuneración fija ya incluye el cumplimiento del objetivo de CPAs."
   - Si no tiene remuneración fija: mensaje breve estándar — "Los objetivos no se suman a otras remuneraciones del afiliado."
4. **Indicador en la fila del objetivo derivado**: cuando un objetivo guardado coincida con el `fixed_remuneration_min_ftd` (mismo número, scope general, sin operador/marca), mostrar un badge "Fijo" para identificarlo (sólo visual, no bloquea edición ni borrado).

### Sin cambios de base de datos

No se crea ningún registro automáticamente en `affiliate_goals`. El auto-fill es sólo en el formulario; el admin decide si guardarlo. Así evitamos duplicados y mantenemos el dato vivo si cambia la remuneración fija.

## Resumen

- El formulario de "Nuevo objetivo" arranca pre-llenado con el mínimo de CPAs/mes definido en la remuneración fija (si aplica).
- Banner aclaratorio dentro del card Objetivos avisando que objetivos y remuneración fija no se suman.
- Cambios sólo en `AffiliateGoals.tsx`. Sin migraciones.