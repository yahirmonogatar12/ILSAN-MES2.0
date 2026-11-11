# Historiales e inventario de material

Un dominio de consulta para cuatro módulos de **Control de material**, bajo el grupo Control de material:

| Pantalla              | Ruta                           |
| --------------------- | ------------------------------ |
| Historial de entradas | `/material/historial-entradas` |
| Historial de salidas  | `/material/historial-salidas`  |
| Historial de retornos | `/material/historial-retornos` |
| Inventario actual     | `/material/inventario-actual`  |

`module.ts` exporta cuatro descriptores con permisos independientes. Los historiales usan la misma `HistoryPage`, con esquemas de columnas propios y tres entradas pequeñas de carga por ruta. `InventoryPage` ofrece resumen y detalle por lote, con navegación desde el número de parte completo, incluida su versión.

- `types.ts`: contratos de filtros, filas y paginación.
- `api.ts`: adaptador de `/api/material_admin`, solo lecturas y descargas a través de `core/http`.
- `model.ts`: parámetros, validación de periodos y presentación de valores. No calcula stock real.
- `columns.tsx`: esquemas, proporciones, formato y acceso desde el resumen al lote.
- `useLedgerPage.ts` y `RemoteLedger.tsx`: consulta/paginación remota y composición de tabla, filtros y paginador. Las filas anteriores permanecen mientras se carga una página; exportar y paginar se bloquean durante esa transición.
- `demo.ts`: datos simulados y CSV, importado únicamente al usar demostración.

Se reutilizan los controles comunes, filtros de búsqueda, `DataGrid`/`DataTable`, `Pagination`, `TabBar`, tarjetas y pestañas globales. Las consultas privadas contienen `scope`; las pantallas inactivas suspenden sus efectos mediante el workspace. Los listados paginados comienzan en 500 filas.

Los permisos exactos son `LISTA_DE_MATERIALES → Control de material → <título de la pantalla>`. No confundirlos con el permiso del catálogo de Materiales de Información básica. El servidor vuelve a verificar cada lectura/exportación.

El resumen admite filtros locales tipo Excel sobre hasta 5,000 materiales recibidos. Los historiales y lotes usan búsqueda por columna **en el servidor**, con `cf_<campo>` y coincidencia de texto antes de paginar. El Excel de historiales conserva esos filtros y exporta el conjunto completo. El Excel de resumen usa los filtros generales, igual que el original; el detalle exporta hasta 5,000 lotes. Las limitaciones se indican en pantalla cuando corresponde.

Contratos, fechas, límites y verificación en [Movimientos de material](../../../docs/MOVIMIENTOS_MATERIAL.md). Pruebas en `contracts.test.ts` y `flows.test.tsx`. No incluye registro de movimientos, ajustes, cancelaciones ni escrituras de inventario.
