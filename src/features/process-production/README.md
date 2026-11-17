# Control de producción en Control de proceso

Fork del comportamiento de las cinco pantallas originales a React, sin modificar Flask ni sus datos. `module.ts` registra ASSY, IMT, SMT, historial y salidas. Las rutas, permisos y alias se consumen desde el registro común; no se duplican menús ni pestañas.

- `PlansPage.tsx`: composición común de los tres planes, acciones de planificación, orden local, grupos/líneas y exportación. La tabla abre la edición con doble clic (doble toque en pantallas táctiles) o Enter sobre la fila enfocada, sin columna de acciones. No ofrece iniciar, pausar o terminar producción; muestra el estado recibido y el guardado de campos no lo envía.
- `PlanForm.tsx`: alta/edición con campos y límites específicos; revisión BOM en ASSY/IMT. La edición incluye Cancelar plan y Reactivar plan, según su estado, con confirmación, bloqueo de envíos duplicados y reintento explícito ante errores. WO/PO de IMT/SMT permanecen de lectura en edición porque esos endpoints no los actualizan.
- `timeline.ts`: reglas originales de tiempos, descansos y acomodo round-robin por líneas, separadas del DOM. Conserva fechas de reloj local al guardar.
- `Reschedule.tsx`, `AssyTools.tsx`, `ImportPlans.tsx`: pendientes, WO, grupos SCAN, revisión de propuestas y archivo Excel congelado antes de confirmar.
- `ReportsPage.tsx`: historial remoto por columna y contraste de producción/OQC/almacén. Se conservan cero y N/A.
- `api.ts`: transporte central para cada variante; `model.ts` define reglas/esquemas y `demo.ts` simula operaciones sin solicitudes reales.

Los controles y tablas son compartidos; el cálculo de avance real, asignación de SCAN, numeración, consumo y restricciones permanecen en el servidor. Las escrituras no se reintentan automáticamente. El drag-and-drop usa `DataTable.rowProps` y requiere guardado explícito del orden. Mientras ese orden tenga cambios pendientes, se bloquea la edición hasta guardar o descartar.

El resaltado rojo de filas por tiempo extra se aplica a los planes ASSY.

El fondo habitual de la columna SEC. usa el color de acento del tema para los tres procesos.

Los planes distribuyen sus columnas en el ancho disponible, con un mínimo común de 1000 px para conservar el desplazamiento interno en pantallas pequeñas. Cuando la tabla dispone de 1200 px o menos, los encabezados se acortan con puntos suspensivos y conservan su texto completo al pasar el cursor. Los filtros permanecen a la derecha del encabezado.

[Contratos y límites](../../../docs/CONTROL_PROCESO.md).

`PlanGroups.tsx` recupera las franjas, totales y destinos de grupo del ASSY original, y las divisiones por línea de IMT/SMT. Compone `DataGrid.grouping`; los encabezados no cuentan como registros. `moveToGroup` conserva el movimiento local hasta guardar y valida la fecha al soltar sobre un grupo ASSY.
