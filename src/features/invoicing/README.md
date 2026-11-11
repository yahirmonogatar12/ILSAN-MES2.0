# Facturas

Dominio de cuatro pantallas de **Control de material → Facturas**:

| Pantalla                   | Ruta                                | Permiso original (`LISTA_DE_MATERIALES → Control de material`) |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Invoice Almacén            | `/material/invoice-almacen`         | `Facturas / Invoice`                                           |
| Invoice Embarques          | `/material/invoice-embarques`       | `Invoice Embarques`                                            |
| Valorización de inventario | `/material/valorizacion-inventario` | `Valorización de inventario`                                   |
| Lista de compras           | `/material/lista-compras`           | `Lista de compras`                                             |

`module.ts` aporta cuatro descriptores; el registro común resuelve navegación, permisos y pestañas. Los ámbitos de invoice comparten pantalla, detalle y captura. `api.ts` incorpora `ambito` a todas sus operaciones, incluido archivo y multipart. Un permiso de Almacén no concede el de Embarques.

- `types.ts`: contratos de adaptadores, filtros, filas y capturas.
- `model.ts`: parámetros y validaciones; los códigos conservan barras, guiones y versiones.
- `api.ts`: transporte exclusivo mediante `core/http`, validación de respuestas y abortos.
- `columns.tsx`: esquemas, proporciones y presentación de cantidades; no interpreta Excel ni calcula inventario real.
- `components.tsx`: invalidación por sesión, exportación del conjunto cargado, confirmaciones con protección contra doble envío y resultados parciales.
- `UploadDialog`: captura, vista previa del servidor y confirmación usando el mismo archivo/tipo/ámbito/modo congelados. Compras presenta cambios de sincronización, muestras de eliminaciones y cambios de transacción.
- `InvoiceDetail`, `LineForm`, `PalletLink`, `PurchaseDetail`, `BackfillDialog`: composición específica del negocio sobre tablas, campos, ventanas y pestañas comunes.
- `InvoiceFile`: archivo autenticado con caché descartada al cerrar; utiliza `SpreadsheetPreview` compartido.
- `demo.ts`: datos y operaciones simulados, importados solo en demostración. No envía solicitudes HTTP ni ejecuta el parser real de Flask.

Las tablas locales usan `DataGrid`; valorización utiliza `DataTable` y paginación remota. Comienzan en 500 filas, conservan el estilo ILSAN y contienen su desplazamiento. Los Excel de las tablas locales incluyen el conjunto recibido con los filtros generales, independientemente de la página y selección local por columna, igual que el original. La exportación de valorización usa el exportador Flask con los filtros generales y sin paginación.

Los alias originales permanecen disponibles. Contratos, límites y escenarios de prueba en [Facturas](../../../docs/FACTURAS.md); resultados en [VALIDACION.md](../../../VALIDACION.md).
