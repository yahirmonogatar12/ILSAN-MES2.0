# Control de Scrap

**Control de proceso → Control de material Scrap → Control de Scrap**. La ruta es `/proceso/scrap` y mantiene los alias del MES original. El menú y la ruta usan `LISTA_CONTROL_DE_PROCESO / Control de material Scrap / Control de Scrap`.

- El módulo consulta y exporta los registros que capturan las apps de escaneo.
- `GET /api/control-scrap` devuelve hasta 5 000 registros en `data`. El rango inicia en el día local de planta y admite filtro de área y búsquedas de texto `cf_*` por encabezado.
- `GET /api/control-scrap/export` usa los mismos parámetros de la consulta aplicada. Los identificadores se conservan como texto y la cantidad cero se muestra como tal.
- Las búsquedas de columna se conservan por sesión de usuario y modo del MES. `DataTable` mantiene encabezados fijos y scroll interno. La paginación compartida inicia en 500 filas y la tabla solo monta las filas cercanas al viewport.
- La demo carga sus ejemplos y el exportador local bajo demanda. Los registros reales y su autorización se resuelven en el servidor Flask.

Las pruebas de contrato, permisos y filtros están incluidas en `npm run check`.
