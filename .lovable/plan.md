
## Objetivo

Crear una página de análisis por operador accesible desde el listado de Operadores (botón **"Ver análisis"** en cada fila), que use **Routy** en tiempo real como fuente de datos y `brand_cpa_goals` como objetivos.

## Acceso

- Ruta nueva: `/clientes/:id/analisis` (registrada en `App.tsx`, protegida por `ProtectedRoute`).
- En `src/pages/Clientes.tsx`, agregar acción **"Ver análisis"** (icono `BarChart3`) en la tabla, junto a Editar/Eliminar, que navega a la ruta.

## Estructura de la página

Header con nombre/logo del operador, selector de período (mes en curso por defecto, con flechas para navegar meses) y selector de marca (`Todas` + cada marca del operador).

### 1. Card de Objetivo del operador (estilo `BrandGoals`)

- Reusar la visualización exacta de `GlobalIndicator` + `DailyDots` de `BrandGoals.tsx` (anillo SVG con % del mes, esperado al día, barra, puntitos diarios verde/amarillo/naranja/rojo).
- **Objetivo total** = suma de `brand_cpa_goals.cpa_target` para el período, filtrando por las marcas del operador (`clients.brands`).
- **Actual** = suma de `cpaCount` de Routy filtrando `accountId = clients.routy_account_id` y `brand ∈ clients.brands` (si hay filtro de marca activo, restringir a esa marca).
- Si se selecciona una marca: el card se enfoca en esa marca (objetivo de esa sola marca, actual de esa marca).

### 2. Desglose por marca (colapsable)

Igual que `BrandGoals` pero filtrado al operador: una fila por marca del cliente con objetivo editable, barra de progreso, y puntos diarios.

### 3. Card de Tendencia (nuevo, también reusable en home)

- Promedio diario del mes en curso = `actual / dayOfMonth`.
- **Proyección cierre de mes** = `promedio_diario * daysInMonth`.
- **Comparativo vs mes anterior**: traer total del mes anterior (Routy con `from/to` del mes anterior) y mostrar `proyección vs total_mes_anterior` con delta % y flecha ↑/↓.
- Mostrar tres números: Actual MTD · Proyección fin de mes · Mes anterior (con delta).
- Métricas: **FTDs (cpaCount)** y **Comisión total (cpaCommission + revShareCommission)** en dos sub-cards.

### 4. Comparativos semana/mes anterior

Mini cards con FTDs y Comisión:
- **Esta semana vs semana anterior** (lunes-domingo): delta absoluto y %.
- **Este mes vs mes anterior** (mismo rango de días, ej. día 1 al día N): delta y %.

### 5. Tabla de afiliados que entregan resultado

- Agrupar filas Routy por `tracker` (= `affiliates.unique_id`, p.ej. `OVO-00123`).
- Resolver nombre con `affiliates` (join por `unique_id`).
- Columnas: Afiliado · Marca · FTDs · Comisión · Última actividad.
- Filtros locales: marca y rango de días (todo el mes / últimos 7 / últimos 30 / día específico).
- Orden por FTDs desc; click en fila → `/afiliados/:id/performance` (si existe) o popover con detalle.

### 6. Tendencia global en la home

Agregar el mismo card **Tendencia** en `Dashboard.tsx` (sin filtro de operador): proyección global de FTDs y Comisión con comparativo vs mes anterior. Componente reutilizable.

## Datos y queries

Toda la data viene de la edge function existente `routy-proxy` (ya pivota por brand/accountId/tracker/date). No requiere cambios en el backend ni migraciones.

Llamadas necesarias por carga (en paralelo):
1. Mes en curso completo, `accountId = client.routy_account_id`.
2. Mes anterior completo, mismo accountId (para tendencia y comparativo mensual).
3. Semana actual y semana anterior, mismo accountId (comparativo semanal).
4. `brand_cpa_goals` del período actual filtrados por `brand IN client.brands`.
5. `affiliates` (id, unique_id, fixed_name) para resolver nombres de los trackers presentes.

El desglose por día se obtiene agrupando localmente las filas del mes (cada fila trae `date`), evitando 30 llamadas separadas.

## Detalles técnicos

- **Archivos nuevos**:
  - `src/pages/ClienteAnalisis.tsx` — página principal.
  - `src/components/operator/OperatorGoalCard.tsx` — refactor extraído de `GlobalIndicator`/`DailyDots`.
  - `src/components/TrendCard.tsx` — card de tendencia reutilizable (acepta `currentMTD`, `previousMonthTotal`, `daysInMonth`, `dayOfMonth`, `label`, `format`).
  - `src/components/operator/OperatorAffiliatesTable.tsx`.
- **Archivos modificados**:
  - `src/App.tsx` — nueva ruta.
  - `src/pages/Clientes.tsx` — botón "Ver análisis" en cada fila.
  - `src/pages/Dashboard.tsx` — montar `<TrendCard>` global.
  - `src/components/BrandGoals.tsx` — extraer `DailyDots` y `GlobalIndicator` a `OperatorGoalCard` y reimportarlos para no duplicar.
- **Sin cambios** en `supabase/`, `src/integrations/supabase/types.ts` ni migraciones.
- Caching: usar `useMemo` y cancelación con flag `cancelled`. Loading skeletons por sección.

## Edge cases

- Operadores sin `routy_account_id` → mostrar aviso: "Vincula la cuenta Routy en la ficha del operador para ver el análisis".
- Operadores sin marcas o sin `brand_cpa_goals` → mostrar la sección de tendencia/afiliados igual; el card de objetivo muestra "Sin objetivo definido".
- Tracker no encontrado en `affiliates` → mostrar el tracker crudo en la tabla.
