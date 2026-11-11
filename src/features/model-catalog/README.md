# Control de modelos SMT y Control de modelos

Dos pantallas del mismo dominio, ubicadas en **Información básica → Control de producción**:

| Descriptor           | Ruta                              | Datos                                        |
| -------------------- | --------------------------------- | -------------------------------------------- |
| `modelCatalogModule` | `/informacion-basica/modelos-smt` | Catálogo SMT con hash de concurrencia        |
| `modelsModule`       | `/informacion-basica/modelos`     | Catálogo RAW y líneas permitidas por familia |

`CatalogPage` compone `DataGrid`, búsqueda, acciones y diálogos comunes. `CatalogForm` construye los campos a partir de las columnas recibidas; `model.ts` decide cuáles son editables y valida los números de RAW. IDs, hashes y auditoría no son campos de captura. No se elimina el valor cero ni se modifican las filas originales para construir la identidad de una edición.

`types.ts` define `CatalogApi`; `api.ts` adapta Flask y `demo.ts` mantiene datos temporales, cargados solo en demostración. Las consultas incluyen `scope`, tipo de catálogo y búsqueda. Cambiar de pestaña conserva estado; cerrar la pestaña desmonta la pantalla. El adaptador SMT mantiene intactos los valores originales, incluidos nulos y auditoría, necesarios para el hash del servidor.

SMT usa `/control-modelos/api/data` y `/control-modelos/api/rows[/hash]`. RAW usa `/api/mysql/data`, `/create`, `/update`, `/delete` y `/familia-lineas`. La búsqueda de RAW es remota con debounce; la de SMT es local. Ambos cargan hasta 2,000 filas y muestran el límite cuando corresponde. Los filtros tipo Excel operan sobre ese conjunto cargado.

Los permisos conservan `LISTA_INFORMACIONBASICA → Control de produccion → Control de modelos SMT/Control de modelos`. El servidor autoriza las escrituras y conserva sus reglas de creación de modelo padre/catálogo KS; no se duplican en React.

Ver [contratos, límites y validación](../../../docs/CATALOGOS_PRODUCCION.md). Pruebas: `production-contracts.test.ts` y `production-flows.test.tsx`.
