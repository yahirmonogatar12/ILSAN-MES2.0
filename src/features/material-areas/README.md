# Material por áreas

Cinco descriptores en Control de material → Material por áreas: SMD, Micom, IMD, ASSY e IPM. El usuario confirmó que ASSY debe quedar pendiente, como en el MES original; su pantalla es informativa y no solicita una API inexistente.

Los cuatro módulos activos comparten una sola `AreaPage`, su configuración de columnas/vistas y el adaptador HTTP. No se duplican botones, campos, tablas, paginación, autenticación o permisos. Cada pestaña conserva su área, consulta, filtros y página.

- `module.ts`: rutas originales `/material/{smd|micom|imd|assy|ipm}` y ternas exactas del permiso.
- `config.ts` / `columns.tsx`: ocho esquemas del sistema original y presentación de columnas, con unidad separada de cantidades.
- `model.ts`: consultas permitidas por área, fechas, filtros por columna, tamaño de página y validación de respuestas.
- `api.ts`: GET `/api/material/:area` y `/export`, mediante `core/http`; el backend y sus tablas no se modifican.
- `Page.tsx`: composición de `FilterBar`, `Card`, `DataTable`, `Pagination` y `ExportButton` compartidos. Solo las cuatro áreas conectadas montan consultas.
- `demo.ts`: carga bajo demanda; 1,101 registros de prueba por área, paginación, filtro de todas las filas y exportación XLSX local.

Se abre inventario general con 500 filas. Las opciones de página son 100, 200, 500 y 1000, las admitidas por esta API. Las fechas solo se envían para movimientos; la exportación conserva todos los filtros y omite la paginación. Los filtros de columna se guardan por usuario/modo, área y vista. Micom añade chamber e IPM inventario completo, ambos en general/detallado.

Ver [contratos y validación](../../../docs/MATERIAL_POR_AREAS.md).
