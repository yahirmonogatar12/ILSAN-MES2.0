# Control de producción en Control de proceso

Se mantienen los cinco módulos del grupo original. El fork vive en `features/process-production` y utiliza React y los componentes comunes, sin copiar el DOM ni los listeners globales de los scripts antiguos.

## Rutas y permisos

Página `LISTA_CONTROL_DE_PROCESO`, sección `Control de produccion`, con botones exactos:

| Pantalla  | Botón de permiso                   | Ruta                           | Alias                                                                               |
| --------- | ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| ASSY      | Control de produccion ASSY         | `/proceso/produccion-assy`     | `/plan-main`, `/plan-main-assy-ajax`                                                |
| IMT       | Control de produccion IMT          | `/proceso/produccion-imt`      | `/plan-imd`, `/plan-main-imd-ajax`                                                  |
| SMT       | Control de produccion SMT Plan     | `/proceso/produccion-smt`      | `/plan-smt`, `/plan-main-smt-ajax`                                                  |
| Historial | Historial de operacion por proceso | `/proceso/historial-operacion` | `/historial-operacion-proceso-ajax`, `/control_proceso/historial_operacion_proceso` |
| Salidas   | Control de salida de lineas        | `/proceso/salida-lineas`       | `/control-salida-lineas-ajax`                                                       |

El botón **SMT Plan** es distinto del control de máquinas SMT del otro grupo original. Los descriptores ocultan cada módulo sin su permiso y bloquean sus URL/alias antes de consultar datos. La autorización del frontend no sustituye la del servidor.

## Planes

`PlansPage` compone filtros, tabla y controles. `usePlans` concentra consultas, captura, orden local, guardado y exportación. `planColumns` construye las columnas y usa un índice por lote para las acciones de orden. `PlanActions` y `PlanDialogs` componen las acciones y los diálogos del dominio.

El contrato público usa `Plan`, `PlanValues`, `PlanUpdate` y `PlanSequence`. `Api.action` vincula cada operación con su payload y `Api.extra` vincula la operación con su payload y respuesta. Los registros extensibles mantienen metadatos históricos. `contracts.ts` comprueba los campos tipados al recibir planes, WO, grupos SCAN y propuestas, tanto en el adaptador HTTP como en demostración. Las cantidades numéricas textuales, los nulos admitidos por Flask y los campos opcionales tienen tipos explícitos.

Bases: ASSY `/api/plan`, IMT `/api/plan-imd`, SMT `/api/plan-smt`.

- Consulta `GET base?start&end`, que devuelve un array. Se conservan lotes, WO/PO, fecha, grupo/secuencia, línea, turno, modelo, NP, cantidades, auditoría de revisión y campos específicos. IMT muestra P1–P4 como PANA A–D; SMT muestra SA–SE como SMT A–E. Los códigos de base de datos no se reemplazan por nombres de pantalla en los payloads.
- Alta `POST base`; edición `POST base/update`. Solo se muestran editables los campos admitidos por cada variante. ASSY no cambia fecha/NP desde update y su secuencia nueva la decide el servidor; IMT/SMT no actualizan WO/PO mediante update. QR admite 0–20 y array 0–100, conservando cero.
- ASSY consulta `GET /api/plan/bom-revisions?part_no` para la revisión asignada; IMT comparte ese catálogo. Una revisión no disponible se conserva. Si se cambia NP en IMT, se limpia a revisión automática; la asignación explícita se realiza tras guardar el nuevo NP, pues el validador del servidor consulta el lote existente.
- El estado operativo se consulta en la tabla. Los planes ASSY/IMT/SMT no ofrecen iniciar, pausar o terminar producción ni incluyen un diálogo para modificarlo; la edición filtra `status`, `pause_reason` y `end_reason` del payload. Cancelar/reactivar el plan sigue usando update con CANCELADO/PLAN, conservando el lote.
- Guardar orden: `POST base/save-sequences`, con `sequences`. ASSY envía grupo, secuencia, fechas/horas locales, duración efectiva y descansos; IMT/SMT envían lote/secuencia. Reordenar mediante arrastre, flechas o grupo primero cambia la captura local; requiere guardado explícito. Se impiden otras escrituras/exportación y cambios de consulta hasta guardar o descartar ese orden.
- `timeline.ts` porta las reglas de los scripts originales: inicio 07:30, descansos 09:30–09:45, 12:00–12:30 y 15:00–15:15. ASSY usa tiempo redondeado y 540 minutos productivos; IMT/SMT usan ceil y cierre 17:30. Los cancelados no aportan tiempo. Acomodo ASSY ordena líneas M, D, H y las reparte round-robin entre grupos; conserva todos los campos del registro. Las fechas se guardan como reloj local, sin conversión UTC; un fin posterior a medianoche avanza el día de calendario.
- Exportar `POST base/export-excel`, con todos los planes de la consulta/línea seleccionada y sus cálculos, no solo la página de 500. Se reutiliza el transporte binario central con POST; Flask mantiene el formato del Excel original.

## Distribución visual del MES original

ASSY presenta bandas **GRUPO 1, GRUPO 2…**, total de horas productivas y estado NORMAL/TIEMPO EXTRA, con secuencia roja, separadores y zonas de arrastre, incluidos grupos vacíos. Los cancelados permanecen visibles, tachados y sin aportar tiempo. IMT y SMT tienen las franjas originales por línea (PANA A–D / SMT A–E), con cantidad de planes, Plan y Output; la vista por líneas de ASSY también usa secciones por línea. Las fechas se distinguen cuando la consulta abarca varios días.

`PlanGroups.tsx` compone esta presentación sobre `DataGrid.grouping`, sin duplicar tablas. El nombre y resumen de la franja permanecen visibles al desplazar horizontalmente. Se retira la columna redundante GRUPO; el número lo identifica la banda. Las secciones conservan filtros y páginas de 500 registros; la decoración no altera el total ni añade registros a exportación. El selector de grupos hace visibles los destinos; los grupos ya asignados se conservan aunque se reduzca ese número, hasta una acción explícita de acomodo/movimiento.

Soltar sobre la banda o zona de un grupo ASSY mueve el lote al final de ese grupo en la misma fecha. `moveToGroup` valida el destino y conserva cantidades, trazabilidad y otros planes. Los cambios siguen locales hasta Guardar orden; flechas y Mover de grupo ofrecen alternativas al arrastre. No se reprograma un lote a otra fecha mediante este gesto.

## Reprogramación e importaciones

Pendientes: ASSY/SMT `GET base/pending`; IMT `GET /api/plan-imd/pending-reschedule`. El usuario selecciona lotes y confirma `POST base/reschedule` con `lot_nos` y `new_working_date`. El servidor calcula pendientes y crea sublotes; conserva trazabilidad y actualiza el original. El frontend no asigna números de lote reales ni envía cantidades recalculadas para sustituir esa regla.

IMT/SMT importan por `POST base/import-excel`, multipart `file` y `working_date`. La revisión congela archivo y fecha, permite ver el original y requiere confirmación. Los resultados y omisiones se conservan. En SMT, `lado` admite vacío/BOTTOM/TOP: BOTTOM genera TOP ligado con cero QR y el mismo array/cantidad; el importador omite filas TOP independientes. El alta manual TOP existe, pero no establece por sí sola un vínculo a BOTTOM. No se implementan las columnas propuestas `grupo`/`modo_top=MANUAL` para Excel ni se afirma que ese diseño pendiente exista.

ASSY importa WO por `GET /api/work_orders?include_import_status=1&desde&hasta` y `POST /api/work_orders/import`, con IDs numéricos originales e `import_date`. Las ya importadas se bloquean y se muestran sus lotes; los errores parciales no se ocultan.

## SCAN y propuestas ASSY

`AssyTools` selecciona `AssyWorkOrders`, `AssyScanLots` o `AssyProposals`. Cada herramienta gestiona su operación y comparte `useAssyFilters`, los controles comunes y los constructores de payloads de `requests.ts`. `ProposalComparison` presenta las diferencias. Cerrar o suspender una comparación cancela su lectura y descarta una respuesta tardía. Al reactivar la pantalla se libera el indicador de comparación pendiente.

El guardado de orden bloquea cambios posteriores de arrastre, flechas, grupo y autoacomodo hasta resolver la escritura. Una falla conserva el orden capturado para el reintento explícito. Los payloads parciales de secuencias conservan la ausencia de datos de tiempo cuando esos campos no están presentes.

`GET /api/plan/input-main/scan-lots`: `date_from`, `date_to`, `line`, `part_no`, `limit=500`. Devuelve grupos por línea/parte y opciones de plan. La asignación usa `/assign-lot` con línea, parte, período, lote destino y `allow_extend` explícito. Se filtran planes compatibles y pendientes. Crear desde SCAN usa `/create-plan`, con fecha confirmada. Las operaciones se ejecutan en Flask; no se generan escaneos artificiales en modo real.

`GET /api/plan/propuestas-ia` lista propuestas. Comparar llama explícitamente `POST /api/plan/propuesta-ia/diff`; muestra antes/después, campos aplicables, bloqueos, lotes nuevos y lotes fuera de propuesta. Solo los cambios elegidos se envían a `/aplicar-cambios` con `proposal_id` y `cambios`. Insertar lotes nuevos usa `/api/plan/importar-propuesta-ia` y otra confirmación. No se insertan automáticamente al aplicar cambios. Se conservan errores/omisiones y las restricciones de lotes iniciados del servidor.

## Reportes

- Historial: `GET /api/historial-operacion-proceso`, con `start`, `end`, `proceso`, filtros remotos `cf_fecha`, `cf_linea`, `cf_wo`, `cf_lote`, `cf_part_no`, `cf_modelo`, `cf_plan`, `cf_input`, `cf_output`, `cf_status`. El servidor filtra antes del límite de 5,000; la tabla pagina en 500 localmente. SMT/IMT conservan OUTPUT=N/A; ASSY conserva el output numérico, incluido cero. Excel `/export` usa los mismos filtros.
- Salidas: `GET /api/control-salida-lineas`, con `fecha_desde`, `fecha_hasta`, `part_number`. Conserva producción, cajas, liberación OQC, entradas, pendientes, estados, lotes y resumen del servidor. Consulta hasta 500 filas; Excel `/export` hasta 5,000. Filtros de encabezado locales no sustituyen los generales del exportador.

## Comprobaciones y límites

Las pruebas cubren permisos de las cinco vistas/alias, payloads de cada base, estados, orden, reprogramación, revisión, multipart, BOTTOM/TOP, QR/array cero, SCAN, propuestas, importación WO parcial, filtros/exportaciones y reporte N/A. La revisión nativa y resultados de build están en `VALIDACION.md`. Demo, respuestas HTTP controladas y XLSX locales permiten revisar la interfaz; los parsers Python, las transacciones SQL, los lotes y el consumo real de estaciones requieren validación integrada con el servidor. No se modificó Flask para efectuar este fork.
