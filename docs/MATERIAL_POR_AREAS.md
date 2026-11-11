# Material por áreas

La migración conserva las consultas de `app/api/control_material/material_areas.py`, la plantilla `material_area_ajax.html` y los ocho esquemas de `material_areas.js`. Son consultas de solo lectura de las tablas que alimentan las aplicaciones de planta. El frontend no reconstruye existencias ni registra movimientos.

## Pantallas y permisos

| Ruta              | Módulo                    | Estado                                          |
| ----------------- | ------------------------- | ----------------------------------------------- |
| `/material/smd`   | Control de material SMD   | Entradas, salidas e inventario                  |
| `/material/micom` | Control de material Micom | Entradas, salidas, inventario virgen y chamber  |
| `/material/imd`   | Control de material IMD   | Entradas, salidas e inventario                  |
| `/material/assy`  | Control de material ASSY  | Pendiente, confirmado por el usuario            |
| `/material/ipm`   | Control de material IPM   | Entradas, salidas, inventario virgen y completo |

Cada descriptor utiliza `pagina: LISTA_DE_MATERIALES`, `seccion: Material por áreas`, `boton: Control de material <área>`. Se respeta exactamente **Micom** en el permiso. El grupo está bajo la sección Control de material. El catálogo de autoridad, menú, rutas y pestañas globales incorporan los cinco descriptores sin modificar el layout. Un usuario sin permiso no ve el módulo ni consulta sus datos.

ASSY solo tenía una entrada de menú sin acción en el original. No figura entre las áreas de Flask y `/api/material/assy` devuelve 404 (también lo verifica su suite original). Se acordó mostrarlo como consulta pendiente; no se inventan tablas, registros ni endpoints. Tampoco se usa el historial de cambios de material de Calidad como reemplazo, porque pertenece a otro proceso.

## Consultas

Se abre Inventario general. El selector Consulta cambia automáticamente entre entradas/salidas e inventarios disponibles; Modo alterna General/Detallado solo para inventarios. Las fechas capturadas se aplican a movimientos con Consultar; inventario representa stock actual y no envía fechas.

| Vista API                          | Uso                     | Campos relevantes                                                                                         |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `entradas`                         | Entradas sin cancelados | Fecha, hora, código, parte, lote, cantidad, unidad, ubicación, cliente, especificación, usuario           |
| `salidas`                          | Salidas sin cancelados  | Fecha, hora, código, parte, lote, cantidad, unidad, modelo, departamento, proceso, línea, usuario         |
| `inventario`                       | Stock por lote          | Parte, lote, código, entrada, salida, stock, unidad, ubicación, fecha recibo, especificación              |
| `inventario_general`               | Stock por parte         | Parte, especificación, unidad, stock total, lotes y etiquetas con stock                                   |
| `inventario_chamber` / `_general`  | Micom programado        | Lote chamber o programación, parte, especificación y stock; fecha/usuario en detalle y conteos en general |
| `inventario_completo` / `_general` | IPM armado              | Lote completo o Part No IPM, especificación y stock; fecha/usuario en detalle y conteos en general        |

Las columnas y cantidades provienen del servidor. Los códigos conservan texto, guiones, barras y ceros; la unidad se presenta en su propia columna cuando corresponde. No se suman únicamente las filas de la página: `piezas` representa el total filtrado del servidor.

## HTTP y paginación

- GET `/api/material/:area?vista=...&start=...&end=...&cf_<columna>=...&page=...&per_page=...` devuelve `{success,rows,total,piezas,page,per_page,total_pages}`.
- GET `/api/material/:area/export` recibe los mismos filtros, sin página/tamaño, y devuelve el XLSX original del backend. Su límite es 50,000 filas; la interfaz lo comunica si el total es mayor.
- La API admite 100, 200, 500 y 1000 filas. La tabla usa **500 por defecto**, con `Pagination.pageSizeOptions` ajustado al contrato; no ofrece tamaños que Flask reemplazaría silenciosamente por 1000.
- Los filtros remotos por columna aplican sobre todas las páginas y admiten solo claves de la vista activa. Se conservan por vista y por usuario/modo/área. Cambiar un filtro, vista, modo o tamaño reinicia la página.
- El servidor puede corregir la página si el total disminuye. Se respeta su página devuelta y se valida que la respuesta corresponda al tamaño solicitado.
- Las claves de React Query incluyen sesión/modo, área, vista, criterios, página y tamaño. Las solicitudes conservan abortos. Solo se retienen filas durante una transición entre páginas con los mismos criterios; no se muestran columnas o registros de otra vista como resultado nuevo.
- Exportar se bloquea durante cambios/cargas/errores para conservar el conjunto aplicado. Una fecha escrita sin consultar no cambia el Excel de la consulta vigente.

## Componentes y rendimiento

Las cuatro pantallas activas son instancias de la misma `AreaPage`. Se reutilizan `Page`, `Card`, `FilterBar`, campos, `DataTable`, filtros remotos, `Pagination`, mensajes y el `ExportButton` verde. Una sola configuración define la disponibilidad y columnas de cada vista; no hay imports entre features ni copias del tema. Los archivos se cargan por ruta y el adaptador demo queda fuera de la carga inicial. Solo se renderiza la página recibida.

El contenedor se limita al viewport y la tabla desplaza su contenido internamente. Las columnas usan proporciones: caben en escritorio; en pantallas pequeñas el scroll horizontal queda dentro de la tabla. Los filtros compactos reutilizan el diálogo común en móvil.

## Validación

Las pruebas comprueban los contratos de las cuatro áreas, ocho vistas, tamaños admitidos, stock sin fechas, periodos de movimientos, filtros por vista, exportación completa, códigos y decimales, respuestas inválidas y abortos. La demo cubre 1,101 filas y las páginas 500/500/101. Las pruebas de pantalla verifican permisos exactos en las cinco rutas, ASSY sin consultas, filtros de otras páginas, persistencia entre modos/pestañas y consultas especiales de Micom/IPM.

La verificación local utiliza demo y respuestas HTTP controladas. La lectura con cuentas reales contra las tablas de planta requiere validación integrada con el servidor; este cambio no escribe ni migra registros de MySQL.
