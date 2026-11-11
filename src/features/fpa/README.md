# Control de FPA

Ruta `/informacion-basica/fpa`, en **Información básica → Control de producción**. Se conecta al proxy MES `/api/control-fpa`, que conserva la integración con MICOM. No llama directamente a MICOM ni agrega impresión desde el navegador.

`Page.tsx` compone filtros, tabla con paginación remota, detalle e historial de intentos/eventos. `FpaForms.tsx` compone captura y ajuste con campos/diálogos compartidos. `model.ts` valida cantidades, códigos y motivos; `types.ts` define el contrato; `api.ts` adapta el proxy y `demo.ts` se carga únicamente en demostración.

La consulta usa folio, parte FPA, solicitante, estado y fechas. La exportación utiliza los filtros completos, sin limitarse a la página visible. Las claves privadas incluyen `scope`. Permisos separados: `Control de FPA`, `Solicitar etiquetas FPA` y `Ajustar cantidades FPA`, bajo `LISTA_INFORMACIONBASICA → Control de produccion`.

El tamaño inicial de página es 500, compartido con el resto del sistema. Como MICOM limita cada respuesta a 200, `api.ts` reúne el intervalo necesario de páginas físicas y devuelve una página lógica completa, manteniendo el total y el `AbortSignal`. Las opciones menores o iguales a 200 utilizan una sola consulta. Las pruebas cubren el límite entre las páginas lógicas y una última página parcial.

Una solicitud requiere parte FPA y al menos una cantidad positiva. Las cantidades son enteros de 0 a 999; un código solicitado contiene número de parte y lote/checksum separados por espacio, hasta 24 caracteres cada línea. El servidor determina el solicitante desde la sesión. Los ajustes requieren motivo y no pueden quedar por debajo del consumo existente.

El alta envía `Idempotency-Key`: un reintento manual de la misma captura conserva la clave; cambiar el contenido genera otra. No hay reintentos automáticos de escrituras. El detalle muestra solicitado, consumido, confirmado, restante, intentos de impresión y eventos tal como los devuelve el servidor.

Pruebas de contrato, permisos, idempotencia y flujo demo en `production-contracts.test.ts` y `production-flows.test.tsx`. Ver [rutas y límites de verificación](../../../docs/CATALOGOS_PRODUCCION.md).
