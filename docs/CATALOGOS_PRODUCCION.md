# Modelos SMT, modelos, BOM y FPA

Las cuatro pantallas están en **Información básica → Control de producción**, igual que en el menú original. No corresponden al botón superior independiente Control de producción. Sus descriptores en `app/registry.ts` alimentan navegación, permisos y pestañas; no se agregaron rutas particulares al layout.

| Pantalla               | Ruta React                        | Dominio                  |
| ---------------------- | --------------------------------- | ------------------------ |
| Control de modelos SMT | `/informacion-basica/modelos-smt` | `features/model-catalog` |
| Control de modelos     | `/informacion-basica/modelos`     | `features/model-catalog` |
| Control de BOM         | `/informacion-basica/bom`         | `features/bom`           |
| Control de FPA         | `/informacion-basica/fpa`         | `features/fpa`           |

## Componentes y carga

Se reutilizan `Page`, `Card fill`, tablas, filtros, paginación, botones, campos, formularios y diálogos. Los dos catálogos de modelos comparten pantalla, formulario y adaptador parametrizados por tipo. No hay imports entre features ni dependencias nuevas de paquetes.

Las pantallas y los adaptadores demo se cargan con `import()`. Las consultas usan claves con modo/usuario (`scope`) y `AbortSignal`; las escrituras no se reintentan automáticamente. FPA y el historial ECO paginan en el servidor. SMT, RAW y el BOM seleccionado usan `DataGrid` sobre las filas cargadas. La tabla solo renderiza la página visible y mantiene su scroll dentro de la tarjeta.

Las tablas paginadas arrancan con el valor compartido `DEFAULT_PAGE_SIZE = 500`. El selector común ofrece 10, 25, 50, 100, 200 y 500; una selección manual permanece durante la vida de la pestaña. Los módulos nuevos heredan ese valor sin configurarlo por pantalla. Esto no amplía los límites del conjunto consultado: por ejemplo, el historial ECO sin filtros mantiene los últimos 200 del servidor, y al aplicar filtros utiliza páginas de 500 por defecto.

`core/auth/usePermission` comparte caché y contrato entre la entrada al módulo y sus acciones. Todos usan `LISTA_INFORMACIONBASICA`, sección exacta `Control de produccion` (sin acento en el contrato). Los botones de vista son los títulos de la tabla anterior; BOM agrega `Crear ECO` / `Aprobar ECO`, y FPA `Solicitar etiquetas FPA` / `Ajustar cantidades FPA`. El servidor vuelve a autorizar cada operación.

## Modelos

| Método | Ruta Flask                        | Contrato                                                                  |
| ------ | --------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/control-modelos/api/data`       | `{columns, rows, total}`, hasta 2,000 filas SMT                           |
| POST   | `/control-modelos/api/rows`       | Campos planos del alta SMT                                                |
| PUT    | `/control-modelos/api/rows/:hash` | `{original, changes}`                                                     |
| DELETE | `/control-modelos/api/rows/:hash` | `{original}`                                                              |
| GET    | `/api/mysql/data`                 | `table=raw`, `limit=2000`, `offset=0`, `search`; `{columns, rows, total}` |
| POST   | `/api/mysql/create`               | `{data}`, con `Usuario` de la sesión frontend                             |
| POST   | `/api/mysql/update`               | `{original, new}`                                                         |
| POST   | `/api/mysql/delete`               | `{table:"raw", id}`                                                       |
| POST   | `/api/mysql/familia-lineas`       | `{familia, lineas}`, CSV de líneas; vacío elimina restricciones           |

El hash SMT depende de la fila original completa. Se preservan nulos, tipos numéricos y campos de auditoría; solamente se excluye `__rowhash` del objeto original enviado. No reconstruirlo desde el formulario. El servidor mantiene la creación automática del padre RAW y el catálogo KS.

IDs, hashes y auditoría no son editables. La captura vacía o sin cambios no se envía. RAW convierte únicamente sus campos numéricos; cero sigue siendo cero. El servidor determina el esquema real.

La búsqueda de SMT es local. RAW consulta el servidor con debounce. Cuando el total supera el conjunto recibido, la pantalla advierte del límite; paginar o filtrar por columna no obtiene las filas que faltan. La búsqueda remota de RAW permite acotar otro conjunto.

## BOM y ECO

| Método | Ruta Flask                              | Uso                                                                                          |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/listar_modelos_bom`                   | Modelos disponibles                                                                          |
| GET    | `/api/bom/revisions?modelo=...`         | Revisiones del modelo                                                                        |
| POST   | `/listar_bom`                           | `{modelo, classification, bom_revision}`; revisión vacía se envía como `null`                |
| GET    | `/exportar_excel_bom`                   | Mismos criterios, Excel del servidor                                                         |
| GET    | `/api/ecos`                             | Filtros `eco_no`, `part_no`, `status`, `origen`, `date_from`, `date_to`, `page`, `page_size` |
| GET    | `/api/ecos/export`                      | Historial completo con filtros, sin página                                                   |
| GET    | `/api/ecos/:id` y `/:id/diff`           | Detalle MES y diferencias por componente/campo                                               |
| GET    | `/api/ecn-ks/:id`                       | Detalle KS de lectura, separado de las acciones MES                                          |
| GET    | `/api/bom/resolve-family`               | `family`, `suffixes`; modelos resueltos y sufijos faltantes                                  |
| GET    | `/api/bom/next-eco-revision`            | `scope_parts`, separados por coma                                                            |
| GET    | `/api/bom/download-excel`               | `part_no`, y `mode=new_bom` cuando corresponde                                               |
| GET    | `/api/bom/download-excel-family`        | `family`, `suffixes`                                                                         |
| POST   | `/api/ecos/from-excel`                  | Multipart de un modelo o BOM nuevo                                                           |
| POST   | `/api/ecos/from-excel-family`           | Multipart de familia                                                                         |
| POST   | `/api/ecos/:id/items/import`            | Reemplazar ítems de un borrador, multipart `file`                                            |
| POST   | `/api/ecos/:id/approve` y `/:id/cancel` | Aprobar/cancelar borrador                                                                    |
| DELETE | `/api/ecos/:id`                         | Eliminar ECO no aprobado                                                                     |

Los imports envían `file`, `eco_no`, `effective_at`, `item_name`, `notes`; un modelo agrega `part_no`, BOM nuevo agrega también `bom_mode=NEW_BOM`, y familia usa `family_prefix` / `scope_parts`. El servidor analiza el Excel con openpyxl y calcula la revisión. Se admiten XLSX/XLSM; no se descarga una biblioteca de hojas de cálculo al navegador.

El flujo es descargar BOM/plantilla → editar Excel → importar como borrador → revisar alcance y diferencias → aprobar. Las rutas antiguas de edición directa del BOM devuelven 409 y no se presentan como acciones. La selección de modelo/revisión/clasificación y los cambios mediante ECO usan las API activas del original.

El listado de componentes usa el modo compartido `layout="fixed"`, con proporciones por columna y un ancho mínimo de 1,080 px. En escritorio se ven todas las columnas; los textos largos se acomodan completos en varias líneas. Cuando el espacio disponible es menor que ese mínimo, la tabla conserva desplazamiento horizontal interno sin ensanchar la página.

Sin filtros, el historial ECO entrega los últimos 200 registros aunque su total sea mayor. La pantalla lo indica y solicita aplicar filtros para navegar el historial completo. Con filtros utiliza paginación remota y el total entregado por el servidor. KS no admite las acciones ni adjuntos del detalle MES.

El historial usa `Modal size="xl"` (hasta 1,400 px) y la tabla compartida con `layout="fixed"`, ocho columnas proporcionales y mínimo de 900 px. En escritorio se ven también Estado, Aprobado por y Acciones sin desplazar la tabla. En pantallas pequeñas, el desplazamiento horizontal queda dentro de ella; modelos/familias y otros valores largos se muestran completos en varias líneas.

La composición del historial limita su altura al viewport y reserva el espacio de encabezado, filtros, paginación y pie; solo la tabla desplaza sus filas. Esto evita añadir otro scroll al cuerpo del diálogo cuando se reciben los 200 cambios o una página remota extensa.

El detalle también usa el tamaño `xl`. Sus datos principales ocupan una fila en escritorio y las diferencias se separan en pestañas con sus cantidades; si hay modificaciones de ingeniería, esa categoría aparece primero. Las pestañas conservan filtros, orden y página mediante el `TabBar` compartido y `Activity`. Las columnas se reparten por porcentaje para ver ubicación, maker y proveedor, o Antes/Después, en la misma vista de escritorio. Los valores anteriores y propuestos se distinguen por encabezado y color; los nombres de campos conocidos se muestran en español, conservando cualquier campo desconocido y el valor cero.

Una diferencia antigua sin `part_no` utiliza el modelo del ECO solo cuando el alcance identifica inequívocamente un único modelo. No se atribuyen filas ambiguas a un modelo de una familia. La interfaz muestra el diff persistido del servidor; no recalcula ni modifica su comparación de revisiones. Origen, aprobador, notas, alcance, ítems y papelería permanecen disponibles debajo de las diferencias.

Un ECO aprobado es inmutable. Solo un borrador puede aprobarse, cancelarse o reemplazar sus ítems; un ECO no aprobado puede eliminarse. Cargar detalle/diferencias o permisos debe completarse sin error antes de habilitar acciones. La confirmación de aprobación incluye el resumen de diferencias.

## Papelería

| Método       | Ruta Flask                               | Uso                                   |
| ------------ | ---------------------------------------- | ------------------------------------- |
| GET / POST   | `/api/ecos/:id/files`                    | Listar / adjuntar un `file` multipart |
| GET / DELETE | `/api/ecos/:id/files/:fileId`            | Leer / eliminar archivo               |
| GET          | `/api/ecos/:id/files/:fileId?download=1` | Descargar conservando nombre          |
| GET          | `/api/bom/papeleria?part_no=...`         | Último ECO del modelo con archivos    |

Formatos HTML/HTM, PPT/PPTX y PDF, hasta 50 MiB por archivo. Varios adjuntos se envían secuencialmente; los completados se retiran de la cola incluso si otro falla. Añadir requiere Crear ECO y sigue permitido en aprobados, como en el original; eliminarlos de un aprobado permanece bloqueado.

`FilePreview` recibe un `Blob` autenticado del consumidor. HTML usa un iframe con `sandbox=""`; PDF usa el visor nativo. PPTX carga únicamente al abrirlo el script local original `public/vendor/pptx-preview.umd.js`. PPT antiguo se descarga para abrir en PowerPoint. Los blob URLs se liberan al cerrar y el caché binario se descarta al desmontar el visor. No se necesita CDN.

## FPA

| Método | Ruta Flask                                 | Contrato                                                                                                  |
| ------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| GET    | `/api/control-fpa/requests`                | `folio`, `fpaPartNumber`, `requester`, `status`, `dateFrom`, `dateTo`, `page`, `pageSize`; `{data, meta}` |
| GET    | `/api/control-fpa/requests/:id`            | `{data}` con ítems, intentos de impresión y eventos                                                       |
| POST   | `/api/control-fpa/requests`                | `{fpaPartNumber, pgmMicom, micomQuantity, pgmComp, compQuantity}`, cabecera `Idempotency-Key`             |
| PATCH  | `/api/control-fpa/requests/:id/quantities` | `{reason, micomQuantity?, compQuantity?}`                                                                 |
| GET    | `/api/control-fpa/export`                  | Filtros completos sin paginación; Excel                                                                   |

Se conserva el proxy Flask hacia MICOM. El solicitante se toma de la sesión del servidor; React no envía uno editable. Cantidades enteras entre 0 y 999, al menos una positiva; códigos completos con parte y lote/checksum (hasta 24 caracteres por línea). Un ajuste requiere motivo y respeta el consumo. El frontend muestra las cantidades solicitadas, consumidas, confirmadas y restantes sin recalcular los estados del servidor.

Una captura FPA conserva su clave idempotente cuando se reintenta manualmente sin cambios después de un error de red. Modificar la captura genera otra clave. No se agregó impresión ni consumo desde esta pantalla.

MICOM limita cada respuesta del listado FPA a 200 solicitudes. Para presentar una página de 500, el adaptador calcula el intervalo exacto y reúne hasta tres páginas físicas de 200, conservando filtros, cancelación y total. Las páginas posteriores toman también el tramo inicial correcto de la página física compartida; no se salta el registro 501 ni se duplican resultados en la tabla. Si el total es menor, no se consultan páginas innecesarias. El contrato del servidor permanece igual.

## Verificación y demostración

Los contratos se contrastaron con las rutas e interfaces originales de MESILSANLOCAL y las validaciones FPA de MICOM. `production-contracts.test.ts` verifica payloads, multipart, errores, límites, hash, idempotencia y permisos; `production-flows.test.tsx` cubre altas/edición/baja de modelos, líneas por familia, solicitud/ajuste FPA y borrador/aprobación ECO, además de denegación de acciones con respuestas controladas.

Los catálogos, FPA y ECO demo duran hasta recargar. La importación ECO demo simula las diferencias y no analiza el Excel; sus plantillas/exportaciones son CSV. Los adjuntos demo se mantienen en memoria y sí utilizan el visor real. No se simulan las escrituras auxiliares del backend SMT sobre RAW/KS ni el consumo/impresión real de FPA.

Se revisan además selección de archivo y modales nativos, escritorio y móvil con navegador real. Los resultados y capturas están en [VALIDACION.md](../VALIDACION.md). No se hicieron escrituras reales en MySQL/MICOM, aprobación productiva, despliegue ni pruebas de impresión; esas validaciones no quedan acreditadas por los mocks o la demostración.
