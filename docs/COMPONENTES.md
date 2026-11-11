# Catálogo de componentes compartidos

Importar los controles desde `@/shared/ui`. Los componentes no conocen Materiales, sus APIs ni los nombres de sus columnas. Conservan el tema ILSAN.

## Acciones y mensajes

| Componente                     | Propiedades principales                                                   | Comportamiento                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Button`                       | `variant`, `size`, `icon`, `loading`, `loadingLabel`, propiedades nativas | `type="button"` por defecto; `loading` bloquea clics. Variantes: primary, secondary, success, danger, ghost, plain. |
| `IconButton`                   | `label`, `icon`, `tone`, propiedades de Button                            | Exige nombre accesible; sirve para acciones de fila, cerrar y limpiar.                                              |
| `Alert`                        | `tone`, `children`                                                        | Info, warning, danger o success. Los errores usan `role="alert"`.                                                   |
| `Loading`                      | `text`                                                                    | Indicador de carga sin textos de negocio fijos.                                                                     |
| `ErrorState`                   | `error`, `title`, `onRetry`                                               | Mensaje y acción de recuperación opcional.                                                                          |
| `EmptyState`                   | `title`, `message`, `icon`, `action`                                      | Cada módulo define el texto y la acción; no asume que existe un material.                                           |
| `ErrorBoundary`                | `fallback`, `resetKey`                                                    | Aísla fallos inesperados de render; quien lo usa decide la recuperación.                                            |
| `ToastProvider` / `useToast()` | mensaje                                                                   | Notificación temporal común; requiere el proveedor de la aplicación.                                                |

```tsx
<Button variant="success" icon={<Plus size={15} />} onClick={openCreate}>
  Nuevo registro
</Button>
<Button type="submit" variant="primary" loading={pending} loadingLabel="Guardando…">
  Guardar cambios
</Button>
```

`ExportButton` comparte la apariencia verde (`success`), el icono de descarga y el texto predeterminado Exportar Excel. Acepta las propiedades de `Button`, salvo `variant`: cada módulo entrega su `onClick`, `loading`, `disabled` y, cuando corresponde, texto/icono/tamaño propios. Usarlo para exportaciones nuevas en listados y diálogos; la consulta y generación del archivo permanecen en el módulo. Las exportaciones de CSV/ejemplo en demo usan el mismo componente.

`DisclosureMenu` presenta un menú desplegable a partir de `label` y `children`. `align` permite alinearlo a izquierda o derecha y `className` adapta su presentación al consumidor. Se abre por clic y se cierra al pulsar una acción, fuera del menú o Escape. Conserva la navegación nativa de enlaces y botones y recupera el foco del desplegable al cerrar con Escape.

`openOnHover` habilita la apertura al entrar con un puntero de ratón y conserva el menú mientras se recorren sus enlaces. Los clics del ratón mantienen abierto el menú durante ese recorrido. Enter, Espacio y la interacción táctil conservan la apertura y cierre por activación. La opción está desactivada por defecto.

## Campos y formularios

`TextField`, `TextareaField` y `SelectField` aceptan las propiedades nativas del control, además de `label`, `hint`, `error` y `containerClassName`. Generan IDs únicos y asocian etiqueta, ayuda y error. `initialFocus` permite que un diálogo sitúe el foco en ese campo.

- `TextField.suggestions`: valores de un datalist; admite texto libre.
- `TextField` también admite `type="file"`, `accept` y `multiple`; el consumidor conserva `File` y aplica las reglas del formato. No asignar `value` a una captura de archivo.
- `SelectField.options`: `{value, label, disabled?}[]`.
- `CheckboxField`: casilla en línea con `label`, `hint`, `error`, `checked`, `onChange` y propiedades nativas; ID y descripción asociados. Sirve para selección de roles, permisos o cualquier opción booleana sin conocer sus reglas de negocio.
- Un campo numérico conserva una cadena de captura; el módulo valida y transforma su valor para su contrato real.
- `FormSection`: título, descripción, numeración opcional y acciones.
- `FormActions`: cancelar/guardar, estado pendiente y texto de guardado.
- `FormMessages`: lista de validaciones y error del guardado.
- `useForm<T>`: valores, `setField`, validación inyectada, envío asíncrono y bloqueo de doble envío. `submit(snapshot?)` permite acciones distintas sobre una captura explícita sin depender de un `setState` pendiente; `handleSubmit` conserva el envío habitual del formulario. No consulta una API por sí mismo.

```tsx
const form = useForm({
  initialValues: { nombre: "" },
  validate: (values) => (values.nombre.trim() ? [] : ["Escribe el nombre."]),
  onSubmit: (values) => api.save(values),
});

<TextField
  label="Nombre"
  required
  value={form.values.nombre}
  onChange={(event) => form.setField("nombre", event.target.value)}
/>;
```

## Tablas y paginación

Una columna es `TableColumn<T>`: `id`, `header`, `cell(row)` y, si se ordena, `sortValue(row)`. También admite `align`, `className`, `width` y `minWidth`. Cada celda puede componer texto, badges, enlaces o controles comunes.

Para una tabla local con filtros por columna, usar `DataGrid`. Compone la misma `DataTable` y la paginación existentes, conservando su apariencia:

```tsx
<DataGrid
  label="Clientes"
  rows={clientes}
  columns={columns}
  rowKey={(row) => row.id}
  initialSort={{ columnId: "nombre", direction: "asc" }}
  itemLabel="clientes"
/>
```

- Entregar **todos los registros cargados**. Filtra antes de ordenar y paginar; el selector incluye valores de otras páginas.
- Cada filtro permite buscar valores, marcar varios, seleccionar todos los resultados, agregar resultados a un filtro existente y quitarlo. Entre columnas aplica AND; dentro de una columna aplica OR. Las celdas vacías aparecen como `(Vacías)`.
- `textValue(row)` define el texto filtrable cuando `cell` contiene un componente propio. Para texto/números simples puede omitirse. `filterable: false` deshabilita el filtro, por ejemplo en Acciones.
- `initialPageSize` utiliza `DEFAULT_PAGE_SIZE` (500 filas) por defecto. `PAGE_SIZE_OPTIONS` ofrece 10, 25, 50, 100, 200 y 500; las tablas remotas reutilizan los mismos valores. `paginate={false}` sirve para historiales cortos. `resetKey` reinicia la página cuando cambian los criterios de consulta externos.
- Los filtros activos se muestran sobre la tabla y se pueden quitar aunque no haya coincidencias. Cancelar, Escape o pulsar fuera no aplica cambios; el foco regresa al botón del filtro.
- Los filtros se mantienen durante la pantalla actual. No se guardan datos ni selección de valores en preferencias.

`DataTable` continúa disponible como presentación controlada. `filters`, `filterOptions` y `onColumnFilterChange` permiten conectar el mismo selector a una consulta remota. En ese caso el módulo aplica los filtros en el servidor y proporciona las opciones completas; no usar `DataGrid` sobre una sola página remota.

Para una API que admite texto libre por columna, `DataTable` recibe `columnSearches: Record<string, string>` y `onColumnSearchChange(id, texto)`. `ColumnSearch` muestra el criterio, una lista de valores cargados y las acciones Aplicar, Quitar filtro y Cancelar. La lista usa las filas recibidas, incluidas las virtualizadas, o las opciones que el módulo suministra en `filterOptions`. Elegir un valor completa el criterio enviado al servidor. Se puede escribir cualquier otro texto para buscar en todo el historial. Enter aplica y Escape o clic fuera cancela y restaura el foco. El consumidor conserva criterios, reinicia página, consulta el servidor y exporta con esos mismos criterios. Los encabezados permanecen disponibles con consultas vacías para retirar un filtro.

`TableColumn.searchValue(fila)` adapta una sugerencia a la representación esperada por la API, como una duración en segundos. `searchLabel` permite indicar la semántica del criterio. `textValue` entrega el valor real de celdas con formato y evita interpretar el marcador visual de una celda vacía como contenido.

```tsx
interface Cliente { id: string; nombre: string; pedidos: number }
const columns: TableColumn<Cliente>[] = [
  { id: "nombre", header: "Nombre", cell: row => row.nombre, sortValue: row => row.nombre },
  { id: "pedidos", header: "Pedidos", cell: row => row.pedidos, sortValue: row => row.pedidos },
];
const table = useClientTable(clientes, columns, {
  initialSort: { columnId: "nombre", direction: "asc" },
  resetKey: JSON.stringify(filters),
});

<DataTable
  label="Clientes"
  rows={table.rows}
  columns={columns}
  rowKey={row => row.id}
  sorting={table.sorting}
  onSortChange={table.setSort}
/>
<Pagination
  page={table.page}
  pageSize={table.pageSize}
  total={table.total}
  onPageChange={table.setPage}
  onPageSizeChange={table.setPageSize}
  itemLabel="clientes"
/>
```

`DataTable` recibe `loading`, `loadingText`, `error`, `onRetry`, `fetching`, `emptyState`, `minWidth` y `maxHeight`. No hace solicitudes, exporta archivos ni decide permisos. Para datos remotos, pasar directamente las filas de la página y conectar `Pagination` al estado del servidor. `useClientTable` expone `allRows` (todas las filas ordenadas) y `rows` (la página actual).

Para filas agrupadas, `TableColumn.cellSpan(row, index)` puede devolver `rowSpan` y/o `colSpan`; un valor cero omite la celda cubierta. El consumidor garantiza grupos coherentes al ordenar o filtrar. `DataTable.virtualRows={{ rowHeight: 26, groupSize: 3 }}` limita el DOM a una ventana con margen y conserva grupos completos. La altura debe coincidir con el CSS real, incluyendo bordes; no usarlo con contenido de altura variable ni grupos parciales. Los datos y `aria-rowcount` conservan el conjunto completo. Exportar desde el modelo, no desde el DOM. Las tablas sin estas propiedades conservan su funcionamiento anterior.

`layout="fixed"` permite ajustar todas las columnas al ancho disponible. Cada columna puede declarar `width` en porcentaje (sumar 100%) o píxeles; sin anchos declarados se distribuyen por igual. Los textos se acomodan completos en varias líneas y los controles de orden/filtro permanecen a la derecha del texto, centrados verticalmente y sin saltar abajo. `minWidth` define el ancho mínimo legible: por debajo, el desplazamiento horizontal permanece dentro de `.table-overflow`. `DataGrid` recibe estas mismas propiedades. El modo predeterminado sigue siendo `auto`, para los catálogos que necesitan dimensionar sus columnas por contenido.

`TableRowActions` recibe acciones con `id`, `label`, `icon`, `onClick`, `disabled` y `tone`. Permite mostrar la carga de una fila sin copiar botones de editar/eliminar en cada tabla.

`DataGrid.summary(filas)` compone un resumen sobre todas las filas filtradas, antes de paginar, y lo oculta durante carga/error. Sirve para contadores por estado sin replicar los filtros de la tabla. `DataTable.rowProps(fila, índice)` entrega atributos y eventos HTML a la fila del renderizador compartido, por ejemplo `draggable`, eventos de arrastre y una clase. `DataGrid` lo transmite. El consumidor conserva el orden en datos, impide mezclas inválidas y decide cuándo persistir; no debe deducir registros leyendo el DOM.

`DataTable` y `DataGrid` admiten `grouping: TableGrouping<T>` para dividir una misma tabla en secciones, sin crear tablas o scrolls adicionales. `key(fila)` identifica la sección y `order` define su orden. `header({key, rows, visibleRows})` compone la franja; `rows` contiene todas las filas filtradas de esa sección, incluso las de otras páginas. `showEmpty` permite declarar destinos vacíos. `headerProps` y `dropTarget({key, rows, visibleRows})` agregan atributos/eventos de fila y contenido de una zona de arrastre opcional. Cada módulo aporta sus nombres, totales, colores y reglas de movimiento.

La agrupación mantiene los registros contiguos antes de paginar; el orden elegido se aplica dentro de cada sección. Encabezados, separadores y destinos vacíos no cuentan como registros. Una sección partida por la paginación repite su encabezado con el total del conjunto filtrado. Los filtros de columna ocultan destinos vacíos para mostrar solo coincidencias. `DataTable.groupingRows` permite proporcionar ese conjunto completo al controlar la paginación desde fuera; `DataGrid` lo conecta automáticamente. La agrupación visual tiene altura variable y desactiva `virtualRows`; no combinar spans que crucen secciones. El Excel sigue generándose desde los registros, sin añadir filas decorativas al payload de negocio.

`Modal.closeOnBackdrop` vale `true` por defecto. Una captura extensa puede ponerlo en `false` para evitar que un clic fuera descarte datos. El botón de cierre y Escape conservan el comportamiento común, y `busy` protege todos los cierres durante una escritura.

### Edición directa de celdas

`useCellEditor()` crea una sesión de captura por tabla. `EditableCell` recibe ese `editor`, un `cellId` estable y único, `value`, `label`, `onSave`, `formatValue` opcional, `disabled` y `onCancel`. Compone `TextField`; no conoce permisos, endpoints, cantidades ni reglas de un módulo.

Al enfocar muestra el valor sin formato y permite escribir o pegar. Enter guarda; Tab o salir de la celda guardan y conservan la navegación nativa; Escape descarta la captura sin enviar una solicitud. `onSave(texto)` valida y persiste en el módulo, y puede devolver el texto canónico guardado. Las celdas en escritura quedan de solo lectura. Un Enter seguido de blur no duplica la operación; un error se conserva y no se reintenta al perder el foco. Editar de nuevo o pulsar Enter permite el reintento explícito. La celda señala el error y lo expone por etiqueta/ayuda; el módulo puede mostrar además el mensaje junto a la tabla y limpiar ese aviso con `onCancel`.

La sesión conserva borradores, errores y escrituras pendientes cuando una fila sale de la ventana virtual, sin realizar mutaciones al desmontarse. Una actualización externa respeta una captura sin guardar; Escape vuelve al último valor recibido. Instanciar el editor en el panel del módulo y usar una identidad que incluya parte/campo/fecha según el dominio. Los permisos y la actualización de consultas permanecen en el consumidor. No habilita automáticamente edición de otras columnas ni pegado de bloques multicelda.

## Filtros

`FilterBar<T>` recibe `fields`, `values`, `defaults`, `onChange`, `onSubmit`, `onReset` y `pending`. `title` permite agregar un encabezado cuando se necesite. Los valores de sus campos son cadenas y admite los tipos search, text, select, date, number y checkbox. Un campo define `key`, `label`, opciones o placeholder, icono y longitud máxima. Los campos numéricos admiten `min` y `step`. El checkbox usa las cadenas `"1"` y `"0"` para sus estados marcado y desmarcado. `suggestions` conecta un datalist al campo de texto o búsqueda, admite texto libre y conserva las sugerencias en el diálogo compacto.

Los campos se distribuyen según el ancho disponible de la tarjeta mediante consultas de contenedor, incluyendo el espacio que deja la barra lateral. En ventanas de hasta 500 px de alto, o de hasta 560 px de ancho y 700 px de alto, aparece el botón **Filtros**: abre los mismos campos en un diálogo, conserva sus valores y cierra al consultar. Esto reserva altura para las filas sin quitar acceso a filtros o limpieza. Al volver a una ventana más amplia reaparece el formulario normal.

La barra muestra y permite retirar filtros activos. La persistencia y el momento de consultar pertenecen al hook del módulo: puede usar `usePersistentState` y `useDebouncedValue`. Esta separación permite consultas manuales, búsqueda con debounce o filtrado local.

## Contenedores y diálogos

- `Page`: título opcional, icono, banner, contenido y pie; ocupa el espacio disponible del módulo. No sabe de sesión ni de API. Omitir `title` evita repetir en el contenido el nombre que ya muestra la navegación, sin dejar espacio de encabezado.
- `Card`: título, icono, contador opcional, acciones y contenido. Usar `fill` en la tarjeta del listado principal: la tabla toma el alto restante y conserva su scroll interno, con encabezado, filtros y paginación fuera de esa área de desplazamiento. La plantilla de módulos ya usa este patrón.
- `Modal`: título, subtítulo, `size="md"|"lg"|"xl"`, `busy`, `onClose` y contenido. Los tamaños limitan el ancho a 490, 780 y 1,400 px respectivamente, siempre dentro del viewport. `xl` sirve para listados con muchas columnas, como el historial ECO. Usa diálogo nativo, IDs únicos y restauración de foco; bloquea cierre durante una escritura.
- `DialogBody` y `DialogFooter`: zonas comunes de un diálogo.
- `ConfirmDialog`: confirmación parametrizada, carga y error; no elimina datos por sí mismo. `confirmVariant` permite usar la variante común `success` para aprobaciones; conserva `danger` por defecto.
- `KeyValueGrid`: ficha de pares `{label, value}`.

Los overlays comparten `useBodyScrollLock`, para que cerrar un diálogo anidado no libere el scroll de otro que sigue abierto.

El layout de la sesión está limitado a `100dvh`; `Page` y `Card fill` transmiten el espacio disponible con `min-height: 0`. No asignar alturas en `vh` al listado principal ni agregar scroll a la página. Con hasta 800 px de alto se compactan cabecera, espacios, celdas y paginación para mostrar más filas; se conserva el tema y todas las columnas. Las acciones y la paginación se distribuyen según el ancho real de la tarjeta. El workspace no incluye pie de sesión ni bloque inferior de ayuda/usuario en la navegación; Materiales omite el pie explicativo. Si otro módulo usa el pie opcional de `Page`, se oculta en ventanas de hasta 700 px de alto para dejar sitio al listado. Los formularios y las fichas conservan su desplazamiento dentro del diálogo.

## Cuándo crear una pieza nueva

`ActionGroup` recibe `label` y acciones `{id, label, onClick, disabled?}`. Presenta botones en escritorio y un selector nativo compacto en móvil, preservando los mismos callbacks y restricciones. El consumidor decide cuáles acciones están autorizadas; el componente no conoce permisos ni negocios. En los detalles de Facturas, la exportación se sitúa en el pie móvil para dejar más altura a la tabla.

`SpreadsheetPreview` recibe `{blob, name}` autenticados por el consumidor. Compone pestañas/selector de hojas y `WorksheetTable`, elige INVOICE(CONVERTED) cuando existe y conserva combinaciones, posiciones, dimensiones y texto formateado del archivo. `shared/lib/worksheet` crea un modelo de celdas seguro y acotado. Se muestran inicialmente 500 filas y se amplía por bloques; el límite es 10,000 filas / 100 columnas / 100,000 celdas. No usa filtros ni ordenamiento que desplacen las celdas originales. La descarga completa queda a cargo del consumidor. `shared/lib/spreadsheet` carga una sola vez el motor local opcional y ofrece exportación de varias hojas a partir de valores tipados. No conoce invoices, permisos o consultas del backend. `core/http.requestFile` centraliza la lectura autenticada de adjuntos con abortos y rechazo de JSON/HTML de error; `downloadFile` reutiliza esa lectura.

`MasterDetailLayout({side,sideLabel?,list,detail?})` distribuye captura/listado y un detalle opcional dentro de la altura disponible. `DetailPanel({title,subtitle?,onClose,children})` reutiliza `Card`, `DialogBody` y `DialogFooter` sin abrir un diálogo. Dentro de `MasterDetailLayout` ofrece ampliar/restaurar el listado. En ventanas estrechas o de poca altura se prioriza el detalle; ocultarlo devuelve al listado conservado. Hasta 620 px de ancho, la captura se despliega con un `details/summary` nativo y comienza cerrada para reservar altura al listado. Ambos son independientes del dominio y se estilizan desde el módulo consumidor.

`FilePreview` recibe `{blob: Blob, name: string}`. No conoce APIs ni permisos; el consumidor obtiene el archivo autenticado. Muestra HTML/HTM en un iframe aislado sin scripts, PDF con el visor nativo y PPTX con el visor local opcional cargado bajo demanda. PPT informa que debe descargarse/convertirse. Libera los object URLs y el contenido al desmontarse, muestra carga/errores y limita el scroll al visor. Ver [papelería de ECO](CATALOGOS_PRODUCCION.md#papelería).

`TabBar` es una barra de pestañas controlada: `id` prefija IDs accesibles, `label` nombra la lista, `items` aporta `{id, label, title?, icon?}`, `activeId` indica la selección y `onChange`/`onClose` ejecutan acciones del consumidor. `tabIds(id, item.id)` genera las referencias del botón y su panel. Incluye teclado, truncamiento, tooltips y desplazamiento horizontal; no monta contenidos ni almacena estado de negocio. [Ejemplo aplicado al workspace](PESTANAS.md).

Si dos módulos necesitan la misma interacción, ampliar una pieza compartida o agregar otra con contrato tipado. Si cambia únicamente la regla, los campos o los datos de un negocio, resolverlo dentro de su módulo. No agregar condiciones como `if (modulo === "materiales")` a los componentes compartidos.

## Gráficas

`MetricChart` recibe `title`, `labels` y series con `label`, `values` y `color`. `bars` representa la primera serie como barras y mantiene las demás como líneas. Conserva una escala finita cuando los valores son cero, ajusta las etiquetas al espacio disponible y permite consultar los valores exactos con puntero o foco de teclado. Los datos y la selección de series pertenecen al módulo consumidor.

`PercentageBar` recibe un nombre accesible `label`, segmentos con `value`, `tone` (`positive` o `negative`) y `label` opcional, además de una etiqueta lateral `sideLabel`. Acota cada ancho entre 0 y 100 y trata los valores no finitos como cero. Mantiene las etiquetas proporcionadas por el consumidor. Permite barras combinadas y barras de un segmento. El módulo calcula los porcentajes, su formato y sus umbrales.

### Filtros con varias líneas

`FilterField.autoFocus` sitúa el foco inicial en un campo de texto o búsqueda al montar la barra de escritorio. Permite iniciar una captura con lector y enviar el código mediante Enter. La presentación compacta conserva el foco del primer campo al abrir su diálogo.

`FilterBar` acepta `type="textarea"` en `FilterField`. Compone `TextareaField` con etiqueta, valor controlado, placeholder y maxLength. Conserva los saltos de línea al consultar, por ejemplo al pegar una lista de números de parte para un reporte consolidado. La validación y el formato de envío pertenecen al módulo.

## Visor de imágenes

`ImageViewer` recibe `blob`, `alt` y los callbacks opcionales `onLoad` y `onError`. Ajusta la imagen al área disponible y ofrece zoom de 100% a 600% en pasos de 20%, botones, rueda, arrastre con puntero y desplazamiento mediante flechas. Reset y la tecla Inicio restablecen el encuadre. Cada cambio de imagen reinicia la vista y libera el object URL anterior. El consumidor gestiona la consulta autenticada y el reintento de descarga.

`Modal` admite un `icon` opcional junto al título y subtítulo. Los datos y controles específicos se componen en su contenido.
