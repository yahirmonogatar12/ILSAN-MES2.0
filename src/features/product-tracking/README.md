# Product Tracking

Dos módulos en Control de reporte, dentro del grupo Product Tracking. Reutilizan filtros, pestañas, tablas, paginación, descargas y diálogos compartidos.

| Pantalla                       | Ruta                      | Permiso                        |
| ------------------------------ | ------------------------- | ------------------------------ |
| Production Tracking By Process | /reporte/product-tracking | Production Tracking By Process |
| Trazabilidad de PCB            | /reporte/trazabilidad-pcb | Trazabilidad de PCB            |

La página del permiso es `LISTA_DE_CONTROL_DE_REPORTE` y la sección es `Product Tracking`. Los descriptores conservan las rutas originales como alias. El registro central determina navegación, autorización y pestañas de trabajo.

## Responsabilidades

- `api.ts` conserva los endpoints Flask y utiliza `core/http` para JSON, multipart y descargas. `useTracking` proporciona el adaptador por modo y el ámbito de sesión.
- `types.ts` define etapas, piezas y reportes. `model.ts` valida respuestas, criterios y archivos. Los códigos se mantienen como cadenas y solo se recortan los espacios exteriores.
- `columns.tsx` compone la presentación y los estados del servidor. `config.ts` define filtros y columnas de cada consulta de trazabilidad.
- Las páginas mantienen criterios aplicados y borradores independientes. La exportación corresponde a los criterios aplicados. Cada consulta privada incluye el ámbito de sesión y recibe AbortSignal.
- `demo.ts` se carga únicamente en demostración. Incluye los códigos `0001/A+02&B`, `QA-PCB-0001` y `0000000001`, y permite leer archivos de ejemplo con el motor Excel compartido.

## Production Tracking By Process

La vista Una pieza consulta las etapas y presenta un grupo por pieza. Conserva barcode anterior, reemplazo, QR/barcode pendiente de vincular, historial reconstruido, etapas N/A y el bloque de retorno por exceso. El servidor determina los estados, las fechas y los conteos.

Varias piezas envía el archivo original al servidor mediante FormData con el campo `file`. Se aceptan .xlsx y .xlsm de hasta 10 MB. El servidor lee todas las celdas y hojas, elimina duplicados y toma hasta 5000 códigos. La tabla muestra códigos encontrados y pendientes, con columnas por etapa. Elegir otro archivo descarta el resultado anterior y cancela su consulta observada.

| Operación       | Método y endpoint                                           |
| --------------- | ----------------------------------------------------------- |
| Una pieza       | GET /api/production_tracking/buscar?codigo=...              |
| Exportar pieza  | GET /api/production_tracking/buscar/export?codigo=...       |
| Consultar Excel | POST /api/production_tracking/lote                          |
| Exportar lote   | POST /api/production_tracking/lote con file y formato=excel |

Las consultas de archivo usan retry=false. La exportación vuelve a consultar el mismo archivo mediante el endpoint original.

## Trazabilidad de PCB

Conserva las vistas Por PCB, Por lote de producción y Por lote de proveedor. Cada vista mantiene sus filtros, resultados y paginación al cambiar de pestaña.

La consulta por PCB carga el historial de verificaciones del primer registro con input_main_id, con el mismo proceso que devuelve Flask. El botón Historial de verificaciones lo presenta en un diálogo con tabla propia. Los materiales conservan toda la altura disponible en la vista principal.

La vista por lote de producción consulta automáticamente al abrirla. La fecha inicial usa el día de México y se ajusta una vez a fecha_hoy si el servidor informa otro día. La edición de una fecha y la acción Limpiar conservan la elección del usuario.

| Consulta           | Endpoint                            | Límite visible | Límite del Excel |
| ------------------ | ----------------------------------- | -------------- | ---------------- |
| Materiales de PCB  | /api/trazabilidad_pcb/por_pcb       | 3000           | 20000            |
| Lote de producción | /api/trazabilidad_pcb/materiales    | 3000           | 20000            |
| Lote de proveedor  | /api/trazabilidad_pcb/por_proveedor | 5000           | 50000            |
| Verificaciones     | /api/trazabilidad_pcb/historial_pcb | 200            | —                |

Las tres exportaciones usan la ruta de consulta seguida de /export. Los filtros conservan los nombres pcb, proceso, lot_no, part_no, material, fecha_inicio y fecha_fin según la vista. El historial recibe input_main_id y proceso. Las respuestas de negocio con status=error se presentan como errores.

## Tablas y comprobaciones

Las tablas utilizan 500 filas por defecto. Los resultados de lote y trazabilidad se virtualizan con filas de 32 px. El historial por pieza usa agrupación y mantiene el desplazamiento dentro de la tabla. Los filtros de columna y el ordenamiento pertenecen a DataGrid.

En pantallas pequeñas, la captura de archivo se compacta después de consultar para ampliar la tabla. Cambiar archivo vuelve a mostrar el mismo control y conserva el archivo seleccionado.

Las pruebas del contrato están en tracking.test.ts y los recorridos de aplicación en src/test/product-tracking.test.tsx. Los reportes originales son app/api/control_reporte/production_tracking.py y app/api/control_resultados/trazabilidad_pcb.py.
