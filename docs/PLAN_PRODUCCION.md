# Control de plan de producción

Se migran las cinco pantallas del grupo original. Los cálculos de proyección, propuestas y capacidad de producción continúan en Flask; el frontend captura parámetros, presenta resultados y confirma operaciones.

## Rutas y permisos

Todos usan `pagina: LISTA_CONTROLDEPRODUCCION` y `seccion: Control de plan de produccion`, conservando la escritura exacta del sistema anterior.

| Pantalla / botón de permiso | Ruta React                    | Alias original                                                 |
| --------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Control de embarque         | `/produccion/embarques`       | `/control_produccion/control_embarque`, `/Control de embarque` |
| Part Planning LG            | `/produccion/part-planning`   | `/part-planning-ajax`                                          |
| Proyeccion                  | `/produccion/proyeccion`      | `/proyeccion-ajax`                                             |
| Plan Proyectado             | `/produccion/plan-proyectado` | `/plan-proyectado-ajax`                                        |
| Crear Plan de produccion    | `/produccion/crear-plan`      | `/control_produccion/crear_plan`                               |

El registro alimenta menú, pestañas, restauración y guardia de URL. Una denegación impide montar la pantalla y consultar datos. Crear WO desde una PO requiere además el permiso de Crear Plan; sin él la acción tampoco aparece. Los permisos del frontend no sustituyen la validación de Flask.

## Purchase Orders y Work Orders

`OrdersPage` compone la pantalla sobre `useOrders`, `orderColumns` y `OrderDialogs`. Las consultas y la selección pertenecen al hook, las acciones de fila a las columnas y las capturas a los diálogos. Las acciones reutilizan los payloads tipados de `requests.ts`.

`types.ts` define órdenes, partes de proyección, inventario, lotes proyectados y propuestas de schedule. `PlanningApi.action` relaciona el nombre de la operación con sus campos obligatorios y su respuesta. `contracts.ts` valida las respuestas al entrar al módulo y construye los resultados tipados. Las capturas dinámicas pasan por los constructores de `requests.ts` antes de llegar al adaptador.

- PO: `GET /api/po/listar`, `POST /api/po/crear`. Filtros de fecha y estado remotos; cliente sobre la consulta cargada. Se conservan códigos, modelo, cliente/proveedor, cantidades, entrega y auditoría.
- WO: `GET /api/wo/listar` con `incluir_planificadas=true`; `GET /api/raw/modelos` devuelve códigos de modelo. Alta por `POST /api/work_orders`, edición por `POST /api/wo/actualizar`, baja por `DELETE /api/wo/eliminar` y estado por `PUT /api/wo/<codigo>/estado`. Solo CREADA ofrece edición, eliminación y selección para importar al plan.
- Crear plan desde WO: `POST /api/work_orders/import`, con IDs numéricos en `wo_ids` y `import_date`. Se conservan las observaciones por cada WO cuando hay éxito parcial.
- Importar plan Excel: `POST /importar_excel_plan_produccion`, multipart `file` y `fecha_operacion`. Requiere revisión y confirmación; conserva errores de filas devueltos por el servidor.
- Excel WO: `GET /api/wo/exportar`, con las fechas aplicadas. El backend exporta el período completo, sin aplicar estado/modelo ni filtros de columna; el botón lo informa. PO exporta el conjunto de la consulta cargada.
- El JavaScript anterior menciona convertir PO a WO mediante una ruta ausente del backend actual. La nueva acción crea una WO con `codigo_po` mediante el endpoint existente. No inventa una conversión de estado de PO ni invoca esa ruta ausente.

## Plan LG y proyección

`GET /api/part-planning/plan`: `date_from`, `date_to`, `part`, `only_shortage`, `page` y `page_size`. Se permite un intervalo de hasta 120 días de diferencia. Se mantienen los ceros y los vacíos distintos, `qty`, `sched`, inventario, `proj` y el total de partes.

La API limita cada respuesta a 200 partes. El adaptador calcula el intervalo requerido para una página lógica de 500, solicita las páginas de 200 que lo cubren y recorta los extremos. La página lógica 2 toma los 100 registros finales de la página remota 3, la 4 y la 5 completas. Se conservan 500/500/101 partes para un total de 1,101. Abortos y filtros acompañan todas las solicitudes. Si total o fechas cambian durante la composición se pide actualizar.

La respuesta comprueba fechas ISO, orden del intervalo, fechas de columnas, paginación, identificadores y cantidades de cada parte. La página y el intervalo deben coincidir con la solicitud. Se rechazan partes repetidas dentro de una página o entre las páginas remotas combinadas. El inventario puede ser `null` cuando Flask no tiene captura para una parte. Los ceros, valores de proyección nulos, cantidades textuales y metadatos adicionales conservan su representación.

Proyección presenta tres filas P/S/I por parte, con metadatos agrupados. La tabla compartida renderiza una ventana de altura fija y mantiene grupos completos de tres. Las 500 partes continúan cargadas y accesibles al desplazarse; no se agregan 1,500 filas al DOM simultáneamente. La paginación cuenta partes. El Excel identificado como **Exportar página** contiene todas las partes de la página lógica, independientemente de la ventana visible.

Capturas:

Inventario y la fila **S** se editan directamente en las celdas, sin modal. Enter o Tab guardan, salir de la celda guarda y Escape cancela una captura sin enviar cambios. Las filas **P**, **I** y los totales conservan sus cálculos del servidor. Cantidades inválidas no se envían; se conservan el borrador y los errores para corregirlos o reintentar explícitamente. El componente compartido mantiene la captura y el bloqueo de una escritura al virtualizar la fila, y evita envíos duplicados por Enter/blur.

La barra compacta **Línea de schedule / Turno de schedule** permite elegir el contexto de las siguientes capturas. Sin línea explícita se usa `inv.line` de la parte; el turno inicial es DIA. Solo una cantidad positiva exige línea. Cero o celda vacía retiran el schedule; inventario vacío equivale a cero. La escritura invalida las consultas del dominio y vuelve a consultar los cálculos del servidor sin desmontar el editor ni quitar el foco a la siguiente celda. Los refrescos de la misma página permiten seguir capturando; durante un cambio de página con datos provisionales se bloquea la edición.

- `POST /api/part-planning/inventory/field`: `part_no`, `field`, `value`. Campos LGEMM, ISEMM, SVC, DIF, pendiente, rework, SMT e IMD. Se admiten enteros, incluido cero. El servidor fija la semana de referencia y decide el inventario inicial.
- `POST /api/part-planning/schedule`: `part_no`, `sched_date`, `sched_qty`, `linea`, `turno`. Cantidad vacía o no positiva retira la captura; una positiva exige línea y turno. El servidor valida líneas y partes.
- Historial: `GET /api/part-planning/imports?limit=100`, con carga, error y reintento visibles.

Importaciones LG:

1. `POST /api/part-planning/import/preview` con archivo y año opcional. Resumen, muestra, advertencias y hash del archivo.
2. La revisión congela el mismo objeto File, año, modo y opción de ceros.
3. `POST /api/part-planning/import/confirm` envía ese archivo y `file_sha256`, con modo `upsert`, `only_positive` o `only_new` y `include_zero`. Cambiar archivo/opciones invalida la revisión anterior.

Inventario Part 10 usa `POST /api/part-planning/inventory/import`; sincronización usa `POST /api/part-planning/schedule/sync-excel`. Ambas requieren confirmación. La sincronización informa que puede retirar capturas ausentes en el alcance del archivo. El visor del original utiliza el componente compartido y el lector local de Excel cargado bajo demanda.

## Propuestas de schedule

`POST /api/part-planning/schedule/proponer` genera un borrador a petición explícita. Se muestran propuestas, diferencias respecto al schedule, omisiones y capacidad. Selección, fecha, línea, turno y cantidad se revisan localmente; cantidad debe respetar el múltiplo de empaque. La suma de horas de la selección se actualiza sin ejecutar otro planificador en el navegador.

Aplicar: `POST /api/part-planning/schedule/proponer/aplicar`, con `proposal_id`, `version` y todos los ítems identificados por `item_id`, incluidos los desmarcados con `included:false`. Rechazar usa `/rechazar` con motivo. Ambas operaciones se confirman. Un 409 bloquea cualquier nuevo envío de ese borrador hasta generar otro. Cerrar la revisión no aplica ni rechaza automáticamente.

## Plan proyectado

`GET /api/plan-proyectado?fecha` conserva lotes, capacidad y líneas activas. Generación desde proyección, faltantes y schedule usa `/generate`, `/generate-faltantes` y `/generate-schedule`; `/acomodar-ia` asigna según las reglas del servidor. Cada acción requiere confirmación. Las generaciones reemplazan pendientes de la fecha y conservan confirmados.

`/add`, `/update`, `/delete` permiten agregar y modificar lotes, capturar físico/comentario y retirar registros. En pendientes se permite cantidad, línea y turno; en confirmados solo físico/comentario. Cancelar un confirmado resta su cantidad del schedule y conserva historial según Flask. `/config` administra líneas activas; `/confirm` numera los pendientes y suma al schedule con validación de capacidad en el servidor. La UI no produce números de lote reales por su cuenta.

## Validación y alcance

Contratos, payloads, permisos, paginación, revisión congelada, guardia de doble envío, ciclo WO, lotes y conflicto de propuestas tienen pruebas automatizadas. La revisión visual se registra en `VALIDACION.md`. El modo demo reproduce operaciones temporales y no contacta Flask; el análisis LG/Part 10, el Excel del plan, los cálculos SQL y las transacciones reales requieren validación integrada con un backend de pruebas y archivos representativos.
