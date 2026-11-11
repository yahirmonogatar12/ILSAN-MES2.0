# Control de producción en Control de proceso

Fork del comportamiento de las cinco pantallas originales a React, sin modificar Flask ni sus datos. `module.ts` registra ASSY, IMT, SMT, historial y salidas. Las rutas, permisos y alias se consumen desde el registro común; no se duplican menús ni pestañas.

- `PlansPage.tsx`: composición común de los tres planes, acciones de planificación, orden local, grupos/líneas y exportación. No ofrece iniciar, pausar o terminar producción; muestra el estado recibido y la edición no lo envía.
- `PlanForm.tsx`: alta/edición con campos y límites específicos; revisión BOM en ASSY/IMT. WO/PO de IMT/SMT permanecen de lectura en edición porque esos endpoints no los actualizan.
- `timeline.ts`: reglas originales de tiempos, descansos y acomodo round-robin por líneas, separadas del DOM. Conserva fechas de reloj local al guardar.
- `Reschedule.tsx`, `AssyTools.tsx`, `ImportPlans.tsx`: pendientes, WO, grupos SCAN, revisión de propuestas y archivo Excel congelado antes de confirmar.
- `ReportsPage.tsx`: historial remoto por columna y contraste de producción/OQC/almacén. Se conservan cero y N/A.
- `api.ts`: transporte central para cada variante; `model.ts` define reglas/esquemas y `demo.ts` simula operaciones sin solicitudes reales.

Los controles y tablas son compartidos; el cálculo de avance real, asignación de SCAN, numeración, consumo y restricciones permanecen en el servidor. Las escrituras no se reintentan automáticamente. El drag-and-drop usa `DataTable.rowProps`, con flechas como alternativa de teclado/táctil y guardado explícito del orden.

[Contratos y límites](../../../docs/CONTROL_PROCESO.md).

`PlanGroups.tsx` recupera las franjas, totales y destinos de grupo del ASSY original, y las divisiones por línea de IMT/SMT. Compone `DataGrid.grouping`; los encabezados no cuentan como registros. `moveToGroup` conserva el movimiento local hasta guardar, valida la fecha y también atiende la alternativa de formulario.
