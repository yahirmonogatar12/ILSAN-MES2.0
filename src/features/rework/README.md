# Solicitud de retrabajo

Ruta `/produccion/retrabajo`, alias `/control_produccion/retrabajo`. Pertenece a Control de producción → Retrabajo. Conserva el permiso original `LISTA_CONTROLDEPRODUCCION / Retrabajo / Solicitud de retrabajo` para consulta, creación y cancelación.

`Page.tsx` compone filtros, resumen y tabla; `RequestForm.tsx` captura orígenes, programación vigente y componentes con clave idempotente por payload; `Detail.tsx` presenta avance y cuatro tablas de trazabilidad. `model.ts` reúne reglas puras, `api.ts` adapta el contrato Flask y `demo.ts` se carga solo en demostración. No importa FPA ni otros features: las integraciones MICOM, impresión, embarques y escaneos siguen a cargo del backend.

Se reutilizan controles, formularios, permisos, pestañas, tabla con filtros y 500 filas iniciales, diálogos y exportación verde. Los contadores reciben todas las filas filtradas antes de paginar mediante `DataGrid.summary`. El formulario evita perder captura por un clic en el fondo con `Modal.closeOnBackdrop=false`.

[Contratos y límites](../../../docs/RETRABAJO.md). Las pruebas locales verifican payloads, abortos, idempotencia, carrera de BOM, trazabilidad y cancelación con avisos.
