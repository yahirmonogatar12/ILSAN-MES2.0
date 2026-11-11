# Control de resultados

Diecinueve módulos registrados en la sección `resultados`. Los descriptores de `module.ts` conservan las rutas de origen para abrir enlaces antiguos y usan los permisos exactos de `LISTA_DE_CONTROL_DE_RESULTADOS`.

Los nueve historiales del grupo Historial de maquinas calidad, sus contratos, detalles y límites se describen en [MACHINES.md](MACHINES.md).

## Pantallas y permisos

| Pantalla                          | Ruta React                       | Sección del permiso   | Botón del permiso                 |
| --------------------------------- | -------------------------------- | --------------------- | --------------------------------- |
| IMD-SMD TERMINADO                 | /resultados/imd-smd-terminado    | Control de inventario | IMD-SMD TERMINADO                 |
| Inventario reparacion SMD         | /resultados/reparacion-smd       | Control de inventario | Inventario reparacion SMD         |
| Inventario reparacion ASSY        | /resultados/reparacion-assy      | Control de inventario | Inventario reparacion ASSY        |
| Inventario Exceso                 | /resultados/inventario-exceso    | Control de inventario | Inventario Exceso                 |
| Entradas Exceso                   | /resultados/entradas-exceso      | Control de inventario | Entradas Exceso                   |
| Salidas Exceso                    | /resultados/salidas-exceso       | Control de inventario | Salidas Exceso                    |
| Historial de input SMT            | /resultados/input-smt            | Consultar resultados  | Historial de produccion SMT       |
| Historial de input IMD            | /resultados/input-imd            | Consultar resultados  | Historial de produccion IMD       |
| Historial de input ensamble       | /resultados/input-ensamble       | Consultar resultados  | Historial de produccion ensamble  |
| Historial de verificacion display | /resultados/verificacion-display | Consultar resultados  | Historial de verificacion display |

El registro central aplica la visibilidad y protege las rutas con los mismos permisos. Los nombres de permiso de los tres historiales de input conservan la palabra `produccion` del backend.

## Composición y reutilización

- `views.ts` define columnas, campos, valores iniciales y endpoints de cada consulta.
- `ResultsTable.tsx` compone los filtros, tabla, errores, exportación y paginación compartidos. `DataGrid` filtra y ordena listas cargadas completas. Los historiales paginados utilizan `DataTable` y criterios remotos `cf_*`.
- `InventoryPage.tsx` comparte las tres vistas de reparación entre SMD y ASSY. El inventario terminado incluye inventario general, ubicaciones, movimientos y snapshots históricos.
- `ClosureView.tsx` implementa la plantilla, carga de CSV, comparación, confirmación e historial del cierre de exceso. En pantallas pequeñas la captura se abre en el diálogo compartido para dejar altura a la comparación.
- `api.ts` valida respuestas y utiliza el transporte y las descargas autenticadas de `core`. `useResults.ts` incluye el ámbito de sesión en todas las claves privadas.
- La selección de un CSV invalida inmediatamente el lote anterior. Las mutaciones usan el bloqueo de envío de `useForm`. El cierre confirmado actualiza las consultas de inventario y el historial. Los cierres pendientes se retoman con el identificador entregado por el servidor.
- Los listados usan 500 filas por página inicialmente. Las tablas extensas montan las filas cercanas al área visible. Los encabezados, la paginación y las barras conservan su posición fuera del desplazamiento de filas.
- `demo.ts` se carga bajo demanda en modo demostración y conserva sus cambios durante la sesión de la página. Incluye inventarios, historiales paginados, CSV de cantidades o barcodes y cierres pendientes/confirmados.

Para agregar una vista del mismo negocio, definir su contrato en `views.ts`, integrar su respuesta en `api.ts` y componerla con `ResultsTable`. Un módulo navegable requiere su descriptor literal y registro único. Las funciones de negocio permanecen dentro de esta carpeta.

## Contratos del backend original

| Consulta                  | Endpoint                                                                                             | Respuesta y alcance                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Terminado general         | GET /api/inventario_general                                                                          | `{status, items}`, hasta 2,000 filas                                                                       |
| Ubicaciones               | GET /api/ubicacion                                                                                   | `{status, items}`, hasta 5,000 filas                                                                       |
| Movimientos terminado     | GET /api/movimientos                                                                                 | `{status, items}`, hasta 5,000 filas, inicio predeterminado en el día de México                            |
| Snapshots                 | GET /api/snapshot_inventario/fechas, /general, /ubicacion                                            | Fechas con hora o cadenas antiguas. Los datos usan `fecha` y `q`                                           |
| Reparación                | GET /api/reparacion_{smd,assy}/{stock,movimientos,defectos}                                          | `{status, items}`. Stock y defectos hasta 2,000 filas. Movimientos devuelve la consulta completa           |
| Exportación reparación    | GET /api/reparacion_{smd,assy}/{stock,movimientos,defectos}/export                                   | XLSX del servidor. Stock y defectos hasta 10,000 filas                                                     |
| Exceso actual             | GET /api/inventario_exceso/inventory                                                                 | `{success, items, totalParts, totalQuantity}`, hasta 2,000 filas                                           |
| Sincronización de salidas | POST /api/inventario_exceso/exits/sync                                                               | Sincroniza y actualiza el inventario. Intento inicial y reintento visible                                  |
| Historiales exceso        | GET /api/inventario_exceso/{entradas,salidas}                                                        | Array directo. Hasta 300 filas inicialmente y 5,000 con filtros. Excel en `/export`                        |
| Input y display           | GET /api/control_resultados/historial_produccion_{smt,imd,ensamble}, /historial_verificacion_display | `{success, rows, total, page, per_page, total_pages}`. 500 por defecto en React, máximo 1,000 del servidor |
| Excel input y display     | Los mismos endpoints con /export                                                                     | Página consultada, con las mismas fechas, horas, textos y criterios de encabezado                          |
| Contexto de cierre        | GET /api/inventario_exceso/cierre/bootstrap                                                          | `metadata`, `preview.rows`, `preview.summary`, `history`                                                   |
| Plantilla de cierre       | GET /api/inventario_exceso/cierre/template                                                           | CSV con `part_number,current_qty`                                                                          |
| Validación                | POST /api/inventario_exceso/cierre/preview                                                           | Multipart `closure_file`. Devuelve `valid`, `batchId`, errores, comparación e historial                    |
| Confirmación              | POST /api/inventario_exceso/cierre/confirm                                                           | JSON `{batchId}`. El servidor valida el inventario y conserva el historial                                 |
| Detalle de cierre         | GET /api/inventario_exceso/cierre/history/{id}                                                       | `{batch,payload}`. Un lote `pending` admite confirmación                                                   |
| Exportación de cierre     | GET /api/inventario_exceso/cierre/history/{id}/export                                                | CSV del cierre confirmado                                                                                  |

El inventario terminado genera XLSX desde sus registros cargados mediante el motor compartido bajo demanda. Las demás exportaciones utilizan los endpoints del servidor. Los límites originales aparecen en pantalla al alcanzarse. Las sugerencias de encabezado de los historiales remotos corresponden a la página cargada, y el criterio se envía al servidor para consultar todo el historial.

Los códigos de parte, QR, barcode, lote y ubicación conservan sus cadenas originales. Los campos numéricos se formatean únicamente en sus columnas. ASSY incluye la columna adicional `linea_salida_pcb`.

## Verificación

`contracts.test.ts` cubre endpoints, filtros, exportaciones, abortos, formas de respuesta, snapshots, carga multipart, validación y reanudación del cierre. `src/test/production-results.test.tsx` cubre permisos, rutas, paginación, filtros de encabezado y bloqueo de doble confirmación.

Ejecutar `npm run check`, `npm run build` y `npm run format:check` desde la raíz. La evidencia de navegador y descargas de esta migración está en `output/playwright/results-*`, `output/fixtures/results-*` y `output/results-*.log`. Consultar `VALIDACION.md` para el alcance comprobado y el estado de validación con datos reales.
