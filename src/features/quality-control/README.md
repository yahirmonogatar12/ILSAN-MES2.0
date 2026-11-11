# Control de calidad

Doce descriptores en `module.ts` registran las pantallas en la sección **Control de calidad**. Las rutas, menús y pestañas usan el permiso exacto de cada botón de `LISTA_CONTROL_DE_CALIDAD`. Las páginas se cargan bajo demanda.

| Ruta bajo `/calidad` | Grupo                     | Operaciones                                                             |
| -------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `/maquinas`          | Control de maquinas       | Consulta, alta, edición, activación, desactivación, eliminación y Excel |
| `/material-smt`      | Historial de material     | Historial SMT con línea, máquina, parte, resultado y barcode            |
| `/material-imd`      | Historial de material     | Historial IMD con material, contenedor, tipo y resultado                |
| `/material-assy`     | Historial de material     | Historial ASSY, incluida ubicación                                      |
| `/uso-pasta`         | Historial de Sub Material | Ciclos de pasta, estado, tiempos, cantidad y operador                   |
| `/uso-mask`          | Historial de Sub Material | Asignaciones de metal mask a planes                                     |
| `/uso-squeegee`      | Historial de Sub Material | Asignaciones de ambos squeegees de un plan                              |
| `/interlock`         | Interlock History         | Paros y pestaña de Escáner ICT                                          |

## Contratos conservados

Las rutas `/liberacion-lqc` y `/liberacion-oqc` pertenecen a **Inspeccion de calidad**. Las rutas `/ppm-lqc` y `/ppm-oqc` pertenecen a **PPM's**. Cada una conserva el alias y permiso de su botón original.

- Máquinas usa `/api/control_calidad/stations_qa`. La creación envía `POST`, la edición `PUT`, el cambio de estado `PATCH /:id/active` y la eliminación `DELETE /:id`. El código se puede repetir en líneas diferentes. La combinación de código y línea se valida en el servidor. La interfaz confirma las activaciones, desactivaciones y eliminaciones.
- Los historiales usan `/api/smt-historial`, `/api/historial-material/:area`, `/api/historial-sub-material/:tipo` y `/api/process-interlock[/vision]`. Cada uno conserva `/data`, `/opciones` y `/export`.
- Las consultas de historial envían fechas, filtros generales y `cf_*` por encabezado al servidor. La paginación inicia con `per_page=500`. El Excel usa los mismos criterios aplicados y conserva el límite de 10 000 filas del backend.
- El tiempo detenido es el total que devuelve el servidor para todos los paros filtrados. Se conserva el control de detecciones cortas de NOT_SCANNED y los rechazos breves de SCAN_REJECTED. Escáner ICT incluye los escaneos repetidos y su clasificación de Vision.
- El día inicial usa la hora de planta de México. Los timestamps recibidos se muestran con el formato del servidor. Los campos de estaciones identificados como UTC mantienen esa etiqueta.

## Composición

`HistoryView` compone los seis historiales de material y los dos paneles de interlock a partir de los contratos de `model.ts`. Los filtros de columna se conservan por usuario, modo e historial. Las dos pestañas de interlock mantienen su consulta y filtros independientes. `DataTable` y `Pagination` son compartidos, y se montan únicamente las filas cercanas al viewport.

Máquinas usa `DataGrid`, `StationForm` y los diálogos comunes. Su Excel aplica la búsqueda general y el tipo que admite Flask. Los filtros adicionales de la tabla de máquinas se aplican al conjunto cargado.

`useQuality` centraliza las claves privadas por sesión. `api.ts` usa el transporte HTTP y las descargas autenticadas comunes. `demo.ts` se carga bajo demanda y mantiene ejemplos temporales para revisar los flujos.

Las pruebas de contratos, permisos y flujo se ejecutan con `npm run check`. La revisión visual y sus límites se documentan en `VALIDACION.md`.

## Liberaciones y PPM

- LQC consulta `/api/lqc/lineas` y `/api/lqc/datos`. Conserva el día operativo de 07:30 a 07:30, selección de línea o todas las líneas, turno, curva por hora, búsqueda, resumen y detalle histórico. El resumen general agrupa por fecha y parte. El de una línea conserva el lote. Las repeticiones proceden de la marca histórica del servidor. La búsqueda local comparte el conjunto ya cargado y el Excel usa las fechas, línea, turno, búsqueda y vista consultados.
- OQC consulta `/api/oqc/liberaciones` y exporta mediante `/export`. Inicia con fechas vacías. Conserva los límites del servidor de 300 cajas iniciales, 5 000 con filtros y 10 000 en Excel. La interfaz informa cuando el conjunto está truncado. La tabla mantiene las nueve columnas originales.
- PPM LQC y OQC consultan `/api/control_calidad/ppms/:etapa`. Las métricas, tendencia anual, periodo consultado, Top 5 y semanas proceden del servidor. OQC conserva la selección día, semana o mes. La meta global se guarda mediante `POST /:etapa/target` y se invalida únicamente la consulta de esa etapa. El frontend envía cero como cero y muestra la cifra confirmada por Flask.
- Los reportes PPM usan pestañas para mantener una sola tabla activa con desplazamiento interno. En móvil se selecciona la gráfica anual o el Top 5 para dar espacio a cada una. `MetricChart` es compartido con la curva horaria de LQC y expone los valores mediante foco y puntero.
- IQC se retiró del registro mientras su implementación esté pendiente.
