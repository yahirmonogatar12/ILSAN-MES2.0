# Control de BOM y ECO

Ruta `/informacion-basica/bom`, en **Información básica → Control de producción**. Reutiliza la tabla, filtros, formularios, confirmaciones y pestañas compartidos.

- `Page.tsx`: consulta de componentes por modelo, revisión y clasificación; filtros de columna, exportación y acceso a papelería.
- `EcoForm.tsx`: ECO de un modelo, familia o BOM nuevo; resolución de familia, plantilla e importación de Excel como borrador.
- `EcoHistory.tsx`: historial MES/KS, filtros y paginación remotos. Sin filtros, el servidor entrega solo los últimos 200 cambios.
- `EcoDetail.tsx`: alcance, diferencias, ítems, reemplazo del Excel de un borrador y acciones autorizadas. Los cambios de KS son de lectura.
- `EcoDifferences.tsx`: pestañas de añadidos/modificados/eliminados y cambios administrativos, con tablas proporcionales, campos legibles y comparación Antes/Después. Reutiliza `TabBar`, `Activity` y `DataGrid` para conservar filtros y página al cambiar de categoría.
- `Files.tsx`: adjuntos HTML/PPT/PPTX/PDF, descarga y composición del `FilePreview` compartido.
- `model.ts`: validación y reglas de acciones; `types.ts`: DTO/contrato; `api.ts`: adaptación de Flask; `demo.ts`: simulación temporal sin llamadas al servidor.

Permisos separados: `Control de BOM`, `Crear ECO` y `Aprobar ECO`, bajo `LISTA_INFORMACIONBASICA → Control de produccion`. Un error de permiso bloquea la acción. Los ECO aprobados son inmutables; se conserva la posibilidad del original de añadirles papelería. No se pueden borrar sus adjuntos.

El backend actual bloquea la modificación directa del BOM y exige crear ECO. El frontend utiliza ese flujo: importar Excel → revisar diferencias → confirmar aprobación. La aprobación real y las revisiones se resuelven en el servidor; React no modifica las tablas por su cuenta.

Las consultas incluyen `scope` y sus criterios; las mutaciones no se repiten automáticamente. Tras una modificación se invalidan las consultas del dominio. Las subtablas usan `DataGrid`; el historial remoto usa `DataTable` y `Pagination`, sin filtrar solamente una página como si fuera el historial completo.

La demostración simula el contenido del Excel y exporta CSV. No acredita el análisis con openpyxl ni una aprobación real sobre MySQL. Ver [contratos, archivos y límites](../../../docs/CATALOGOS_PRODUCCION.md) y las pruebas `production-contracts.test.ts` / `production-flows.test.tsx`.
