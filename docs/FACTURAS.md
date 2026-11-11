# Facturas: invoices, valorización y compras

Se migraron las cuatro pantallas de `LISTA_DE_MATERIALES.html`, tomando como referencia `material_invoices.py`, `material_compras.py`, `inventory_valuation.py`, sus servicios y sus scripts originales. Se utiliza el backend existente a través de `/backend`; el frontend no reconstruye costos, conciliación o inventario real.

## Navegación y autorización

Las pantallas pertenecen a **Control de material → Facturas**, participan en las pestañas globales y aparecen únicamente si el usuario tiene su permiso. El catálogo del editor de autoridad incorpora los cuatro descriptores automáticamente.

| Pantalla                   | Ruta React                          | Alias original                                     | Botón del permiso            |
| -------------------------- | ----------------------------------- | -------------------------------------------------- | ---------------------------- |
| Invoice Almacén            | `/material/invoice-almacen`         | `/material/invoices`, `/material/invoices/ALMACEN` | `Facturas / Invoice`         |
| Invoice Embarques          | `/material/invoice-embarques`       | `/material/invoices/EMBARQUES`                     | `Invoice Embarques`          |
| Valorización de inventario | `/material/valorizacion-inventario` | `/material/inventory_valuation`                    | `Valorización de inventario` |
| Lista de compras           | `/material/lista-compras`           | `/material/compras`                                | `Lista de compras`           |

Todos usan `pagina: LISTA_DE_MATERIALES`, `seccion: Control de material`. El rótulo Invoice Almacén conserva el permiso histórico Facturas / Invoice. No se cambian IDs o asignaciones existentes. Cada API vuelve a comprobar autorización; los módulos nuevos quedan ocultos sin permiso, incluso al restaurar pestañas.

## Distribución de las pantallas

Invoice Almacén, Invoice Embarques y Lista de compras recuperan la disposición del MES original: captura lateral, filtros/listado a la derecha y detalle debajo. `MasterDetailLayout` y `DetailPanel` son componentes compartidos; los campos, botones y tablas siguen usando la base común. Solo la revisión de la carga y las operaciones puntuales abren diálogos.

En escritorio, **Ampliar detalle** permite dedicar el área de trabajo al detalle y **Mostrar listado** recupera la captura/listado sin perder sus valores. Con ancho de hasta 980 px o alto de hasta 780 px, el detalle ocupa automáticamente el área disponible; **Ocultar detalle** devuelve al listado. Hasta 620 px de ancho, la captura comienza plegada y se abre desde Cargar invoice/Cargar lista de compras. Se mantiene el documento dentro del viewport y el desplazamiento de las tablas dentro de sus paneles. La paleta y densidad de estas tres pantallas recuperan los paneles y campos del original mediante estilos locales.

## Invoice Almacén / Embarques

Ambos comparten `InvoicesPage`, con ámbitos independientes `ALMACEN` y `EMBARQUES`. El ámbito viaja en cada URL de consulta, escritura, archivo y descarga y en el formulario multipart. Las claves incluyen usuario/modo, ámbito e ID. No se deduce el ámbito por el rol.

| Método         | Ruta bajo `/api/material_admin/invoices`     | Uso                                                                    |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| GET            | `/`                                          | Listado por `q`, `estado`, `fecha_inicio`, `fecha_fin`                 |
| POST           | `/preview`, `/upload`                        | `FormData`: `file`, `numero_invoice`, `tipo`, `ambito`                 |
| GET / DELETE   | `/:id`                                       | Detalle / eliminación, sujeta a vínculos activos                       |
| PATCH / DELETE | `/:id/lines/:line`                           | Edición de campos / eliminación de parte y packing permitido           |
| POST           | `/:id/apply`, `/:id/unapply`, `/:id/reapply` | Aplicación/desaplicación/reaplicación de costos de Almacén             |
| POST           | `/:id/close`                                 | `{cerrado: boolean}` para cierre o reapertura manual                   |
| POST           | `/:id/packing/:packing/manual-receipt`       | `{recibido, comentario}`, recepción documental de parte sin catálogo   |
| GET            | `/:id/partial-packing`                       | Destinos por `codigo_material_recibido` para confirmar pallet distinto |
| GET            | `/:id/file`                                  | Archivo original autenticado; `download=1` para descarga               |

Los abiertos se incluyen sin importar su fecha de carga, tanto en Almacén como en Embarques. Se consideran abiertos los no cerrados manualmente cuyo estado no es APLICADA ni CANCELADA, igual que la vista PENDIENTES del servidor. La búsqueda y el estado elegido siguen aplicándose; el rango de fechas limita los cerrados.

Con fechas y un estado que admite abiertos, el adaptador consulta en paralelo el listado por rango y PENDIENTES sin fechas, unifica por ID y ordena por fecha/ID descendentes. Así reutiliza el backend existente sin cambiar su contrato. Cada consulta admite hasta 300 registros: el resultado combinado puede superar 300, sin duplicados ni un segundo recorte. El total es el número mostrado, no el total histórico de la base; se conserva el aviso de límite. Si falla una de las consultas, se muestra el error del listado completo para no presentar una vista que omita pendientes.

Solo abiertos (PENDIENTES), los estados APLICADA/CANCELADA y los listados sin fechas utilizan una sola consulta. El rango inicial sigue siendo el día del operador. Al cerrar o reabrir, la invalidación común vuelve a consultar ambos conjuntos y actualiza su visibilidad.

El detalle conserva líneas, packing, links y recepciones manuales en pestañas internas. Contiene cantidades esperadas, recibidas, pendientes y aplicadas, excesos, diferencias de pallet, costos, unidades y auditoría. Puede abrir los lotes aplicados a un packing. Los links se limitan a los últimos 500 y el historial manual a 1,000 eventos, como el servidor original; se advierte cuando se alcanza el límite.

La edición envía `line_no`, `raw_part_num`, `numero_parte_sistema`, `descripcion`, `cantidad`, `uom`, `costo_unitario` y `costo_total`. Se rechazan cantidades no positivas, número de línea inválido y costos negativos/no numéricos antes de enviar. Las líneas vinculadas y las invoices canceladas no muestran las operaciones de edición. El backend conserva la última comprobación de concurrencia.

La recepción manual de una parte sin catálogo registra RECIBIDO/REVERTIDO sin inventariarla; nunca se borra el evento anterior. La confirmación de pallet distinto elige un packing válido y envía `items: [{codigo_material_recibido, packing_line_id, permitir_pallet_distinto: true, nota_aplicacion}]`. Los resultados omitidos se muestran y una aplicación de cero lotes no se presenta como vínculo confirmado.

En Embarques se ocultan las columnas de pallet en packing y en la vista previa, como en el original. Se conservan las operaciones documentales de la interfaz original y se ocultan las acciones de aplicación de Almacén y recepción manual. El adaptador también impide enviarlas desde ese ámbito. **Part Sys / `numero_parte_sistema` se presenta y transmite completo**, con guiones y versiones; se respeta el resultado del parser del servidor y no se modifica TARIMA para compensar ese campo.

## Excel: carga, visor y exportación

Se aceptan XLSX, XLSM, XLTX y XLTM no vacíos. La vista previa se obtiene del backend antes de guardar. La confirmación reutiliza el archivo y sus datos congelados; cambiar archivo descarta la vista previa. Duplicados por número o hash se muestran y bloquean la confirmación. Una escritura en curso bloquea confirmación/cierre y el guardia común de formulario impide un segundo envío, incluso ante dos eventos consecutivos. Las escrituras no se reintentan automáticamente.

Las plantillas conservan `INVOICE(CONVERTED)` y sus encabezados: Almacén usa TARIMA / PART NO / PART SYS / ITEM / QTY / UNIDAD / COSTO / TOTAL; Embarques usa PART SYS / ITEM / QTY / UNIDAD / COSTO / TOTAL.

`shared/lib/spreadsheet` y `SpreadsheetPreview` reutilizan la copia local de SheetJS del sistema original, sin CDN. La librería se solicita únicamente al previsualizar/exportar/crear plantilla. El visor **Excel original** lee el blob almacenado, permite cambiar hoja con pestañas y selector y usa INVOICE(CONVERTED) inicialmente cuando existe. Conserva posiciones vacías, valores formateados, celdas combinadas y dimensiones disponibles; muestra texto mediante React, sin HTML ni hipervínculos ejecutables. `WorksheetTable` conserva el orden del archivo, sin ordenar/filtrar sus celdas como registros. Comienza con 500 filas y permite ampliar la vista, con un límite de 10,000 filas, 100 columnas y 100,000 celdas por hoja; avisa del límite y permite descargar el archivo original completo. No pretende renderizar gráficos, imágenes u objetos incrustados de Excel. La lectura autenticada pasa por `core/http.requestFile`, que rechaza JSON/HTML de error en lugar de tratarlos como un Excel. El blob no permanece en caché al cerrar el visor.

Los listados y detalles exportan con SheetJS el conjunto cargado por la consulta general, incluyendo los campos definidos y tipos numéricos. No se limita la exportación a la página visible. Los filtros locales por columna no modifican ese Excel, igual que en los scripts originales; el botón lo indica. Los códigos numéricos textuales conservan ceros y versiones.

El Excel de invoices incluye el nombre de archivo; el de packing conserva Exceso y una hoja adicional Detallado con número/parte/cantidad de packing, código/cantidad de lote, pallet recibido/esperado y nota. El Excel de links también conserva la nota de pallet.

## Lista de compras

La captura lateral presenta los tres botones originales: **Carga inicial**, **Actualizar** y **Sincronizar**. El botón envía una instantánea explícita del modo, archivo y tipo a la vista previa; la confirmación utiliza exactamente esa captura.

**Ver Excel original** permite consultar el historial de cargas por tipo con `GET /api/material_admin/compras/cargas?tipo=...`. En el detalle, se muestran únicamente los archivos identificados por los `carga_id` de sus líneas: una transacción puede provenir de varias cargas. Si un archivo antiguo no aparece entre las últimas 300 cargas, se conserva el acceso por ID. `GET /compras/cargas/:id/file` entrega el original y `?download=1` permite descargarlo. No se reconstruye el archivo a partir de la transacción ni se usa un Excel de otra carga como reemplazo.

Utiliza `/api/material_admin/compras/transacciones`, `/transacciones/:numero`, `/estado-inicial`, `/preview`, `/upload` y `/transacciones/:numero/{close|unapply|reapply}`. Las transacciones se identifican por **número y tipo (LG/OVEN)**; el número se codifica para preservar `/`, `+`, `&` y guiones. El cierre usa `{tipo, cerrado}`; reaplicar/desaplicar conserva `tipo` en el cuerpo.

Los filtros generales incluyen búsqueda, tipo, estado y fechas opcionales, inicialmente vacías. El listado devuelve hasta 500 transacciones y los links hasta los últimos 500. El detalle mantiene las dieciséis columnas de compra y el historial de lotes vinculados, con unidades monetarias, cantidades compradas/recibidas/pendientes, proveedor, factura, modelo y categoría. El monto y la conciliación proceden del servidor.

- **INICIAL**: histórico cerrado, una vez por tipo. El estado inicial debe cargarse correctamente antes de habilitar una carga. Un estado desconocido no se trata como permiso para repetirla.
- **ACTUALIZACION**: añade los renglones nuevos previstos por el backend.
- **SINCRONIZACION**: refleja el Excel dentro de las transacciones que contiene. La vista previa muestra agregados, modificaciones, borrados y cambios de transacción, además de muestras y filas protegidas/con lotes/ambiguas recibidas del servidor. Se conserva la revisión antes de confirmar posibles eliminaciones.

La tabla de vista previa de compras es una muestra de hasta 50 renglones; los totales se muestran por separado. El parser y las reglas de protección/concurrencia permanecen en Flask.

## Valorización de inventario

`GET /api/material_admin/inventory/valuation` devuelve `{records,total,limit,offset}`. Se comienza con 500 filas y se pagina remotamente, sin una segunda paginación local. La tabla conserva catorce columnas, incluida unidad separada, fuente, estimado, invoice y transacción. Los filtros son `numero_parte`, `codigo_material_recibido`, `pallet_no`, `fuente_costo` e `include_zero_stock=1`.

El exportador original limita su Excel a 20,000 lotes y mantiene su propio esquema de columnas (incluye fecha de actualización). La interfaz avisa cuando la consulta excede ese límite; paginar el JSON no amplía el Excel.

`/summary` devuelve las agrupaciones completas por fuente y moneda con esos mismos filtros, sin paginación. Se mantiene en una consulta independiente para no repetirla al cambiar de página. No se suman monedas diferentes. `/export` recibe los filtros generales completos, sin `limit`/`offset`.

La simulación de costos utiliza `POST /backfill?dry_run=1&batch_size=500&preview_limit=5000`. Su vista previa informa candidatos, costos existentes/protegidos y posibles pendientes. La confirmación envía `dry_run=0` y aplica **un bloque global de hasta 500 lotes**, independientemente de los filtros del listado. No se ejecuta un bucle automático que aplique todos los bloques. La protección de costos INVOICE/LISTA_COMPRAS y la resolución histórica pertenecen al servidor.

## Pruebas y límites de validación

Las pruebas verifican las cuatro rutas/permisos, separación de ámbitos en query/multipart, Part Sys y TARIMA independientes, duplicados, respuestas/errores, edición, enlace de pallet, bloqueo de acciones de Almacén en Embarques, modos de compra, identidad número/tipo, cierre, lotes, muestras de sincronización, doble envío y páginas remotas/resumen. El visor se prueba con texto que parece HTML sin ejecutarlo.

El demo simula movimientos y cálculos, sin llamadas HTTP ni escrituras reales. Los parsers Excel, las transacciones MySQL, costos reales y efectos de desaplicar/sincronizar requieren pruebas contra un backend de pruebas; el frontend y los mocks no acreditan esos recorridos productivos. Consultar resultados y capturas en [VALIDACION.md](../VALIDACION.md).
