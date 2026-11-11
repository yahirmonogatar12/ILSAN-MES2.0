# Historiales de material e inventario actual

Migración de los módulos administrativos de consulta de `MESILSANLOCAL/app/api/control_material/material_admin.py`, sus plantillas `material_admin_history_ajax.html` / `material_admin_inventory_ajax.html` y `material_admin_inventory.js`.

## Ubicación y permisos

Las cuatro pantallas pertenecen a **Control de material → Control de material**. Sus rutas y permisos se registran una vez en `app/registry.ts`; el layout y las pestañas globales no conocen su lógica.

| Pantalla              | Ruta React                     | Alias anterior                       |
| --------------------- | ------------------------------ | ------------------------------------ |
| Historial de entradas | `/material/historial-entradas` | `/material/historial_admin/entradas` |
| Historial de salidas  | `/material/historial-salidas`  | `/material/historial_admin/salidas`  |
| Historial de retornos | `/material/historial-retornos` | `/material/historial_admin/retornos` |
| Inventario actual     | `/material/inventario-actual`  | `/material/inventario_actual`        |

Cada descriptor requiere `pagina: LISTA_DE_MATERIALES`, `seccion: Control de material`, `boton: <título exacto>`. Son permisos distintos del catálogo de Materiales previamente migrado; no se concede acceso a uno por poder abrir otro. La aplicación comprueba el permiso antes de montar la pantalla y Flask vuelve a autorizar consultas y archivos.

## Contratos HTTP

| Método | Ruta Flask                                 | Respuesta / uso                         |
| ------ | ------------------------------------------ | --------------------------------------- |
| GET    | `/api/material_admin/history/entradas`     | `{data, total, limit, offset}`          |
| GET    | `/api/material_admin/history/salidas`      | `{data, total, limit, offset}`          |
| GET    | `/api/material_admin/history/retornos`     | `{data, total, limit, offset}`          |
| GET    | `/api/material_admin/history/:tipo/export` | Excel del historial filtrado completo   |
| GET    | `/api/material_admin/inventory/summary`    | Array agregado por número de parte      |
| GET    | `/api/material_admin/inventory/lots`       | `{data, total, limit, offset}`          |
| GET    | `/api/material_admin/inventory/export`     | Excel de `view=summary` o `view=detail` |

Todas las solicitudes usan `core/http`, sesión y cookies existentes; las lecturas reciben `AbortSignal`. No hay nuevas rutas de escritura ni modificaciones al backend. Los adaptadores validan la forma de las filas y los metadatos de página. Exportar usa `downloadFile`, sin navegar fuera de las pestañas ni tratar un error JSON/HTML como archivo Excel.

## Historiales

Los tres historiales comparten `HistoryPage` y `useLedgerPage`; cada uno conserva filtros y página independientes al cambiar entre pestañas globales.

- Fechas `fecha_inicio` y `fecha_fin`, búsqueda `texto`, paginación `limit`/`offset` y filtros de columna `cf_<campo>`.
- El rango inicial es el día del operador. Se envían fechas de calendario sin convertirlas a UTC; se rechaza un inicio posterior al final. Las fechas vacías conservan la consulta abierta del backend original.
- El tamaño inicial es 500; `offset = (page - 1) * pageSize`. El total viene del servidor. No se aplica una segunda paginación local a una página remota.
- Los filtros de columna buscan texto sobre todo el conjunto, no solo sobre las filas visibles. Se combinan con los filtros generales y se conservan en el Excel. Se pueden retirar incluso si no hay coincidencias.
- El orden cronológico se mantiene como lo entrega el servidor. No se presenta como orden global una ordenación de la página local.

Entradas conserva parte, especificación, código recibido, lote, invoice, transacción, IQC, cuarentena, cantidad, empaque, ubicación, fecha/hora, vendedor, costos/moneda, cancelación y usuario. Salidas conserva fecha/hora, proceso, códigos, parte, cantidad, lote, especificación, departamento, vendedor y usuario. Retornos conserva fecha/hora, códigos, parte, lote, empaque, cantidad devuelta, especificación y motivo. Los Excel mantienen además los campos definidos por sus exportadores originales.

Fecha y hora se muestran por separado cuando existe una columna Hora; no se pierde la hora en listados que contienen solo el timestamp. Los costos se muestran con cuatro decimales, como en el original. Cero y valores vacíos se distinguen. Los códigos con barras, guiones y versiones se transmiten intactos.

## Inventario actual

`Resumen` utiliza `DataGrid` con el conjunto agregado recibido, filtros locales tipo Excel y páginas de 500. `Detalle por lote` utiliza `RemoteLedger`, la misma tabla y el mismo paginador con consultas remotas.

- Filtros comunes: `numero_parte`, `ubicacion`, `include_zero_stock`.
- Solo detalle: `codigo_material_recibido`, `only_na`, filtros remotos `cf_<campo>` y `limit`/`offset`.
- `use_dates` es estado del frontend. Cuando está activo, se requieren ambas fechas y se envían `fecha_inicio`/`fecha_fin`; en inventario actual se omiten, aunque el formulario conserve fechas de captura.
- La opción de incluir registros sin existencias usa `include_zero_stock=true`, igual que el control original llamado Incluir salidas. `only_na=true` conserva la selección del backend de lotes vacíos/N/A.
- Pulsar el número de parte del resumen abre el detalle con el número completo recibido, incluida su versión; limpia la búsqueda de etiqueta y de columnas y vuelve a la primera página.
- Entradas/salidas por periodo solo se muestran en el resumen cuando el rango está aplicado. Stock, cuarentena, lotes y unidades se muestran como los calcula el servidor; React no reconstruye inventario real a partir de los historiales.

El resumen devuelve hasta 5,000 materiales. El detalle JSON puede paginar por todos los lotes del conjunto, pero su Excel está limitado a 5,000 lotes. El frontend muestra los límites cuando se alcanzan; no presenta una página de 500 como si fuera el total de toda la base.

El Excel de resumen utiliza los filtros generales, igual que en el original; su selección local por columna no se convierte en filtros SQL no soportados por la API. El detalle sí envía los filtros remotos de columna al exportador. Los historiales exportan todas las coincidencias, sin `limit` ni `offset`.

## Composición y carga

`features/material-ledger` comparte contrato, adaptador, reglas, esquemas y controlador de paginación entre sus cuatro descriptores. No importa otros features. `Page` / `Card fill` y el panel de inventario transmiten el espacio disponible a la tabla; la página queda dentro del viewport. Las columnas se distribuyen por porcentaje y mantienen un mínimo legible, con desplazamiento horizontal en ventanas más estrechas. Los filtros de encabezado permanecen a la derecha.

El nuevo modo `DataTable.columnSearches` / `onColumnSearchChange` compone el popup genérico `ColumnSearch` para APIs que admiten texto por columna. El componente no conoce `cf_`, permisos ni almacén; el adaptador de material construye esos parámetros. El modo local `DataGrid` conserva su selector de valores existente.

Las pantallas se cargan por ruta. El demo es un `import()` separado; no se descarga al usar datos reales. Las consultas incluyen modo/usuario y criterios. Se conservan las filas anteriores durante la lectura de otra página, con estado de carga visible y bloqueo de exportación/paginación hasta completar esa lectura.

## Demostración y validación

El modo demo no contacta al backend: utiliza movimientos y lotes simulados, permite consultas/paginación/filtros y descarga CSV identificado con `demostracion`, con texto de fórmulas neutralizado. No simula la contabilidad histórica completa ni acredita los cálculos SQL de inventario real.

Las pruebas comprueban contratos de las tres rutas, paginación, fechas, etiquetas/versiones, filtros remotos y exportaciones completas; validación de respuestas y errores de permisos; navegación entre historiales y filtros fuera de la página; resumen → lotes, N/A, cero y validación del periodo. Las cuatro rutas se prueban con permiso denegado sin consultar datos.

Los resultados de TypeScript, arquitectura, pruebas y revisión de escritorio/móvil están en [VALIDACION.md](../VALIDACION.md). La lectura con credenciales reales y los Excel generados por Flask requieren un entorno de pruebas con el servidor disponible; demo/mocks no acreditan esos recorridos contra MySQL.
