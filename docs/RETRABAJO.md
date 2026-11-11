# Solicitud de retrabajo

El MES define la solicitud y cada área conserva su flujo original. Esta migración agrega el frontend React; no registra salidas de Embarques, escaneos ni impresiones desde esta pantalla.

## Permiso y ruta

`LISTA_CONTROLDEPRODUCCION / Retrabajo / Solicitud de retrabajo`. Ruta `/produccion/retrabajo`, alias `/control_produccion/retrabajo`. El permiso alimenta visibilidad, URL, pestañas y restauración; sin permiso no se monta la pantalla ni se consultan datos.

## Consultas

- `GET /api/retrabajo`: `desde`, `hasta`, `codigo`, `estado`. El listado devuelve `records` con hasta 500 solicitudes, ordenadas por ID descendente. El filtro de estado se aplica en el backend sobre ese conjunto de 500; no hay un total remoto ni paginación de un historial ilimitado.
- Si hay código, se omiten las fechas y se conserva el caso de QR/caja. Flask busca coincidencias de folio/NP, QR anteriores/nuevos, folio de salida o caja. Se informa en pantalla que la búsqueda abarca todo el historial.
- `GET /api/retrabajo/export`: mismos filtros generales, hasta 5,000 solicitudes. La exportación no utiliza los filtros locales de encabezado; el botón lo indica.
- `GET /api/retrabajo/<id>`: resumen, orígenes, programaciones, componentes, salidas y escaneos. El detalle presenta cuatro pestañas con sus filtros y 500 filas iniciales. Conserva QR SMD/ASSY anteriores/nuevos, cajas, FPA, lote de impresión, autores y fechas.

La tabla principal usa `DataGrid` compartida. Su resumen cuenta todas las filas tras aplicar filtros de columna y antes de paginar. No se transforma una respuesta vacía o inválida en registros inventados.

## Alta

`POST /api/retrabajo`, con `Idempotency-Key`. Payload: `np_origen`, `np_destino`, `tipo_material`, `origenes`, `programaciones`, `componentes`, `comentarios`. NP mantiene el formato original de tres letras y ocho dígitos. Cantidades son enteros no negativos por campo; los orígenes enviados tienen cantidad positiva y su suma debe estar entre 1 y 999. Material: ASSY o IMD_SMD. Componentes: ASSY, SMD o IMD, con ubicación y NP anterior/nuevo opcionales.

El cambio de etiquetas se deriva de NP origen distinto de NP destino. Sin cambio de NP, debe existir programación o componentes. El preview de áreas refleja Embarques, MICOM, impresión, reprogramación/cambio de etiquetas y reparación por tipo de componente; el avance real llega del servidor.

`GET /api/raw/modelos` ofrece sugerencias, sin impedir captura manual si falla el catálogo. `GET /api/retrabajo/programacion?part_no=...` consulta el BOM destino. Se elige una programación por IC; si hay alternativas para la misma ubicación se muestra un selector. Cambiar el destino invalida selecciones anteriores. Una respuesta tardía de otro NP no contamina la captura actual; una consulta pendiente o fallida impide crear con programación.

El mismo payload normalizado reutiliza la clave al reintentar manualmente, incluso si se editó y luego se volvió a la captura anterior. Cambiar el payload produce otra clave. Mientras guarda se bloquean envío, captura y cierre. No hay reintentos automáticos ni escrituras desde efectos; el backend valida números registrados y programación vigente y realiza las integraciones originales.

## Cancelación

`POST /api/retrabajo/<id>/cancelar`, sin cuerpo inventado. Se ofrece solo para `status=ACTIVA`, previa confirmación. Flask cancela solicitud/lote de impresión y ajusta MICOM a lo consumido; las salidas y escaneos se conservan. La respuesta incluye `record` y `avisos`; los avisos permanecen visibles en el detalle aunque la cancelación haya terminado correctamente.

## Validación

Pruebas de contratos, normalización y cantidades, búsqueda histórica, abortos, clave idempotente, doble envío, carrera del BOM, programación por IC, componentes y cancelación con avisos. La demostración usa registros temporales y no contacta al backend. La integración transaccional con MySQL/MICOM, impresión y salidas reales requiere un entorno autorizado de pruebas. Ver `VALIDACION.md`.
