## Objetivo

Crear una **lista central de Planes de Comisión** (catálogo / plantillas) que pueda ser administrada de forma independiente. Desde el formulario de Afiliado se podrá **seleccionar uno o más planes existentes** del catálogo en lugar de crear todos los campos manualmente cada vez. La tarjeta para crear/editar un plan en el catálogo será visualmente igual a la actual dentro del afiliado, para que la experiencia sea idéntica.

## Cambios

### 1. Base de datos (nueva tabla)

Nueva tabla `commission_plan_templates` con los **mismos campos** que ya tiene `affiliate_commission_plans`, pero **sin** `affiliate_id` y con un campo extra `name` (para identificar la plantilla en la lista). Campos:

- `name` (obligatorio), `description`, `plan_start_date`, `currency`
- `client_id`, `brand`, `country_ids[]`
- `baseline` + `baseline_currency`
- `cpa` + `cpa_currency`
- `rev_share_pct`
- `cpl` + `cpl_currency`
- `wager` + `wager_currency`
- `conversion_type`, `cap`

Vínculo plantilla ↔ afiliado: agregar columna **`template_id` (nullable)** en `affiliate_commission_plans` para recordar de qué plantilla salió cada plan asignado (no rompe lo existente).

RLS: lectura para usuarios autenticados, escritura solo `admin`/`super_admin` (mismo patrón que las otras tablas).

### 2. Nueva página: "Planes de Comisión"

- Ruta: `/planes-comision`, nuevo ítem en el sidebar.
- Lista en tabla: Nombre, Operador, Marca, CPA, Rev Share, Moneda, Fecha de inicio, acciones (editar / eliminar).
- Botón "Nuevo plan" abre un diálogo con la **misma tarjeta** que se usa hoy dentro del afiliado (todos los campos: descripción, fecha, moneda, GEOs, operador, marca, baseline, CPA, rev share, CPL, wager, condición, CAP) + un campo "Nombre" arriba.
- Buscador por nombre / operador / marca.

### 3. Cambio en el formulario de Afiliado

En la sección "Comisiones" del afiliado, además del actual botón "Agregar plan" (manual), se añade un **selector "Asignar desde catálogo"** que permite elegir una o varias plantillas existentes. Al elegir una plantilla:

- Se crea una fila de plan en el afiliado con los campos **pre-rellenados** desde la plantilla.
- Queda `template_id` guardado para trazabilidad.
- Los campos siguen siendo editables en el contexto del afiliado (overrides locales), por lo que no se pierde flexibilidad.

El comportamiento actual de crear planes manuales se mantiene intacto.

### 4. Detalles técnicos

- **Archivos nuevos**:
  - `src/pages/CommissionPlans.tsx` (nueva página, reutiliza la UI de la tarjeta de plan).
  - Migración SQL para `commission_plan_templates` + columna `template_id` en `affiliate_commission_plans`.
- **Archivos modificados**:
  - `src/App.tsx` → registrar la ruta `/planes-comision`.
  - `src/components/AppSidebar.tsx` → añadir entrada de menú.
  - `src/pages/Afiliados.tsx` → cargar plantillas, añadir selector "Asignar desde catálogo", al elegir → push a `plans` con datos de la plantilla.
- **Refactor opcional pequeño**: extraer la tarjeta de "Plan de comisión" a un componente compartido `CommissionPlanCard` para no duplicar código entre la nueva página y el afiliado. Recomendado.
- No se modifica el edge function `affiliates-manage` (sigue recibiendo `commission_plans` con los mismos campos; solo se añade `template_id` opcional).

## Resumen

1. Nueva tabla `commission_plan_templates` (catálogo de planes reutilizables).
2. Nueva página "Planes de Comisión" con la misma tarjeta que ya conoces del afiliado.
3. En el afiliado: nuevo selector "Asignar desde catálogo" que pre-rellena un plan con los datos de una plantilla; el resto se mantiene igual.

¿Apruebas este plan para proceder?
