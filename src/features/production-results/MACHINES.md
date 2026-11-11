# Historial de máquinas de calidad

Nueve módulos de Control de resultados en el grupo `Historial de maquinas calidad`. Comparten los componentes y el adaptador de `production-results`.

## Rutas y permisos

La página del permiso es `LISTA_DE_CONTROL_DE_RESULTADOS` y la sección es `Historial de maquinas calidad`.

| Ruta React                         | Botón del permiso original              |
| ---------------------------------- | --------------------------------------- |
| /resultados/operadores-maquina     | Historial de Operadores por Maquina     |
| /resultados/maquina-ict            | Historial de maquina ICT                |
| /resultados/ict-pass-fail          | Historial de maquina ICT % Pass/Fail    |
| /resultados/maquina-fct            | Historial de maquina FCT                |
| /resultados/fct-pass-fail          | Historial de maquina FCT % Pass/Fail    |
| /resultados/cambios-parametros-ict | Historial de cambios de parametros ICT  |
| /resultados/maquina-vision         | Historial de maquina vision             |
| /resultados/vision-pass-fail       | Historial de maquina Vision % Pass/Fail |
| /resultados/prueba-electrica       | Historial de prueba electrica           |

Los descriptores conservan las rutas canónicas y los alias de las pantallas anteriores. El registro central determina la visibilidad y protege el acceso según los permisos del usuario.

## Componentes y contratos

- `machineViews.ts` define las columnas, filtros, endpoints, transformaciones y reglas de comparación/consolidación. `MachinePage` compone los historiales y `MachinePassPage` los reportes Pass/Fail.
- `ResultsTable` comparte filtros, estado de consulta, errores, descargas, paginación y virtualización con los módulos de inventario e input ya migrados.
- `ViewSpec.responseKey` admite `records`, `rows` y `pruebas`. Las listas directas siguen siendo válidas. `mapRows` recibe filas y filtros aplicados, y permite derivar las columnas de presentación de fallas/posiciones.
- `ViewSpec.params` admite parámetros fijos o calculados a partir de los filtros. Estos parámetros forman parte de la clave de consulta y permiten abrir detalles de registros distintos con seguridad.
- `manual`, `validate` y `progressPath` permiten consultar cambios de parámetros después de elegir fecha e ICT y mostrar el avance de lectura de archivos. El identificador de progreso es propio de cada consulta.
- `exportPage` selecciona el alcance de la exportación. `exportLimit` describe el límite del endpoint. `Report` conserva advertencias, metadatos y resumen cuando el servidor los entrega.
- `leadingColumns` y `extraColumns` permiten añadir selección y acciones a la tabla. La comparación usa barcode y timestamp como identidad de una ejecución. Resalta los campos modificados y conserva parámetros ausentes en una ejecución.
- `MachineDialogs` reutiliza el diálogo, filtros y tabla para los detalles. El preview de Visión presenta la imagen y sus controles a la izquierda, con las tarjetas de datos, fallas, estado y ruta a la derecha. Utiliza el componente compartido `ImageViewer` con el archivo descargado por el transporte autenticado. El botón Ver parámetros abre el detalle SHT y conserva el zoom del preview. Los archivos se solicitan por el identificador del registro.
- `FilterBar` admite `textarea` mediante `TextareaField` para pegar varias partes en el consolidado. El valor conserva sus saltos de línea.
- Las consultas privadas incluyen el ámbito de sesión, reciben `AbortSignal` y usan 500 filas por defecto. Los registros remotos se filtran por `cf_*` en los campos disponibles en cada endpoint. Las sugerencias del encabezado usan la página recibida.

## Funciones y APIs originales

| Pantalla         | Consulta                                                 | Detalle y exportación                                                                                                                                |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operadores       | GET /api/control_resultados/historial_operadores_maquina | `{records,total}`. Hasta 1,000 sesiones. Excel en /export                                                                                            |
| ICT              | GET /api/ict/data                                        | Paginación remota. /defects recibe barcode y ts. /export devuelve hasta 500 registros. /export-defects aplica resultado. /export-compare recibe POST |
| FCT              | GET /api/fct/data                                        | Paginación remota. /steps recibe source_path_hash y only_fail. /export devuelve hasta 50,000 registros                                               |
| Visión           | GET /api/vision/data                                     | Paginación remota. /image-info, /image-file y /parameters reciben id. /export conserva filtros de encabezado y las fallas                            |
| Paros de Visión  | GET /api/vision/stops                                    | Paginación remota, tiempos reales/provisionales, intentos y ajustes. Excel en /stops/export                                                          |
| Prueba eléctrica | GET /api/control_resultados/historial_prueba_electrica   | Paginación remota y Excel de la página consultada. Incluye resultado y operador                                                                      |
| ICT Pass/Fail    | GET /api/ict/pass-fail                                   | Resumen normal y detallado. /detail recibe el grupo, barcode y min_intentos. /export recibe modo. Consolidado en /consolidado/export                 |
| FCT Pass/Fail    | GET /api/fct/pass-fail                                   | /detail recibe fecha_jornada y grupo_linea/estacion/turno/numero_parte. Cada prueba permite abrir sus pasos. Excel en /export                        |
| Visión Pass/Fail | GET /api/vision/pass-fail-summary                        | Resumen por línea y parte, con totales y porcentajes. Excel en /export                                                                               |
| Cambios ICT      | GET /api/ict/param-changes                               | `{rows,warnings,meta}`, hasta 1,000 cambios. /progress recibe id y /export conserva fecha, hora, ICT, parte, componente y parámetro                  |

Las rutas abreviadas de las tres máquinas pertenecen a `/api/ict`, `/api/fct` y `/api/vision`, respectivamente.

En ICT, el modo normal muestra intentos crudos y el modo detallado conserva los conteos reales calculados por el backend. El consolidado agrupa por parte e ICT, cuenta fechas únicas y calcula porcentajes sobre las sumas de intentos. Los límites de jornada y las reglas de repetición/reparación pertenecen al servidor original.

Los resúmenes Pass/Fail recuperan la presentación original mediante `passFailColumns` y el componente compartido `PercentageBar`. ICT normal y Visión muestran una barra combinada con Pass dentro del segmento verde y Fail a la derecha. FCT muestra una barra individual en cada columna de porcentaje. Las etiquetas usan dos decimales y el símbolo %. ICT y Visión resaltan Pass desde 90% y Fail por encima de 10%. El detalle ICT conserva sus cuatro tasas y sus umbrales específicos.

`ResultsTable.columns` permite personalizar la presentación de columnas manteniendo el contrato de consulta y exportación de `ViewSpec`. `rowHeight` configura la altura CSS y la ventana virtual con el mismo valor. Los resúmenes Pass/Fail usan 44 px para alojar las barras de 28 px. Los filtros reciben porcentajes formateados y el ordenamiento utiliza sus valores numéricos.

La comparación solicita los parámetros de cada ejecución mediante barcode y ts. La exportación envía `{runs,only_diffs}` por POST a `/api/ict/export-compare`. El cierre de la ventana cancela las consultas observadas por sus componentes.

Cuando la resolución de imagen devuelve 404 con metadatos del registro, se conservan las fallas y la disponibilidad de parámetros SHT. El botón Reintentar imagen consulta nuevamente la resolución. Las respuestas de autorización conservan el tratamiento del transporte común.

## Verificación

`machines.test.ts` comprueba los contratos, filtros, alcances de exportación, descargas binarias, estado vacío de barcode corto, metadatos 404, agrupaciones y comparación de parámetros. `src/test/machine-results.test.tsx` comprueba permisos, 500 filas iniciales, selección de ejecuciones, detalle de archivos, filtro FAIL, posiciones SHT y pegado multilínea.

Los recorridos de navegador están en `output/playwright/machines-*.js`, las capturas en `output/playwright/machines-*.png` y los archivos descargados en `output/fixtures/machines-*`. Se ejecutaron con datos de demostración y respuestas HTTP controladas. La validación con archivos y datos de las máquinas del servidor real sigue pendiente.
