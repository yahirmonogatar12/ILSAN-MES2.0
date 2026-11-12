# Comprobaciones

| Comando                      | Qué verifica                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `npm run typecheck`          | TypeScript estricto y variables/parámetros sin uso.                                 |
| `npm test`                   | Contratos HTTP, reglas del módulo, UI compartida y flujo de Materiales.             |
| `npm run test:tools`         | Generación sin sobrescrituras/traversal y detección de dependencias indebidas.      |
| `npm run check:architecture` | Límites entre capas, componentes nativos duplicados, estilos de módulo y metadatos. |
| `npm run check:scaffold`     | Generar, registrar y compilar un módulo independiente con la plantilla actual.      |
| `npm run check`              | Todas las comprobaciones anteriores.                                                |
| `npm run build`              | Comprobación de estructura, TypeScript y build de producción.                       |
| `npm run format`             | Formato uniforme del código y documentación.                                        |

## Pruebas incluidas

- Utilidades compartidas y sus adaptadores de módulos. Se comprueban medianoche de planta, calendario del operador, años bisiestos, corte LQC, fechas opcionales/obligatorias y límite de 120 días. También se cubren consultas por código y pendientes, errores propios, cantidades no finitas, texto plano/JSON y búsquedas con acentos, espacios y locale.

- Secciones visuales compartidas: orden dentro de grupos antes de paginar, totales del conjunto filtrado, encabezados repetidos sin contar como registros, destinos vacíos, índices/eventos de fila. ASSY comprueba total productivo sin cancelados, estado EXTRA, arrastre a un grupo vacío sin escritura inmediata, guardado explícito y rechazo de fechas distintas. IMT/SMT conservan sus bandas por línea y 500 filas predeterminadas.

- Retrabajo: búsqueda histórica por QR/caja preservando caso, cantidades/orígenes/áreas, programación por IC, invalidación de selección al cambiar NP, aborto y respuestas tardías del BOM, clave idempotente por payload, doble envío, componentes, trazabilidad y avisos tras cancelar.
- Fork de Control de proceso: seis permisos nuevos incluyendo retrabajo y sus alias; tres bases API, estados, secuencias locales, orden explícito, fechas de reloj local, BOTTOM/TOP, QR/array cero, revisión BOM, multipart y exportación binaria POST. Reprogramación, WO con errores parciales, asignación SCAN sin extensión implícita, comparación/aplicación IA sin inserciones automáticas y reportes N/A/resúmenes del servidor. Composición compartida de resumen antes de paginar y atributos/eventos de fila.

- Edición directa de celdas: Enter/Tab/blur, Escape, conservación del foco, formato de miles, bloqueo y envío único, error sin reintento automático por blur, recuperación manual, borrador y guardado pendientes al virtualizar, y actualización externa sin perder una captura. Proyección comprueba inventario negativo, cero/vacío, línea/turno de schedule y ausencia de modal.

- Planificación de producción: permisos independientes de las cinco rutas, creación WO desde PO condicionada al permiso de Crear Plan, contratos PO/WO y acciones del plan, agregación de 500/500/101 partes sin saltos/duplicados, cambios durante consulta, archivo LG/año/hash congelados y doble envío. Alta/edición/importación WO y retiro de acciones al planificarse; propuestas con ID/versión/selección y bloqueo tras un 409. Lotes demo comprueban confirmación, restricciones y cancelación. La tabla compartida comprueba celdas combinadas y desplazamiento al último grupo de 1,500 filas con ventana DOM acotada.

- Material administrativo: contratos de entradas/salidas/retornos, resumen/lotes y exportaciones, filtros remotos/fechas/versiones/cero, respuestas inválidas y permisos. Flujo de tres pestañas con página conservada, búsqueda fuera de la primera página y retirada de filtros sin coincidencias; inventario de resumen a lotes con N/A, stock y validación del rango. Cada permiso de vista denegado bloquea la consulta de datos.

- Modelos SMT/RAW: payloads de alta/edición/baja, hash con fila original completa, nulos/cero/auditoría, búsqueda remota y líneas por familia; flujo demo con dos pestañas.
- BOM/ECO: consulta por revisión/clasificación, tres variantes multipart sin Content-Type manual, alcance de familia, KS de lectura y reglas de aprobación/inmutabilidad; importación demo → diferencias → aprobación y denegación de acciones.
- Diferencias ECO: valores Antes/Después con cero, nombres de campo conocidos/desconocidos, ubicación/maker/proveedor, categorías separadas y modelo de contexto solo para un alcance inequívoco.
- FPA: filtros/paginación/exportación, códigos completos, cantidades/consumo/motivo, idempotencia en reintento manual sin repetir automáticamente, solicitud/ajuste demo y acciones denegadas por permisos.

- Pestañas: conservación de captura, DOM, tamaño/página y pausa de efectos; cierre activo/inactivo/última, reapertura, teclado, historial, alias, restauración sin precargas y separación por usuario/expiración de sesión.

- Administración: permisos exactos, contexto departamental, contraseña nueva/opcional, protección de cuentas/roles, payloads de usuarios/roles/permisos, errores 403 y catálogo inválido. Flujo demo integrado de rol → usuario → edición → selección de permisos con búsqueda; una falla al cargar permisos bloquea el guardado hasta recuperarse.

- Contratos de login, cookies, permisos, errores JSON/HTML, cancelación y códigos de parte con barras/guiones.
- Facturas: ámbitos y permisos independientes, filtros de abiertos, códigos completos, multipart, duplicados, edición, pallet distinto, recepción documental y restricciones de Embarques. Compras conserva modos, identidad número/tipo, cambios de sincronización y guardia de doble envío. Valorización verifica paginación/resumen, exportación y un bloque de costos global. Los Excel conservan el conjunto cargado, cero, versiones, exceso y hoja de lotes. El visor conserva combinaciones, posiciones vacías, dimensiones y valores formateados, cambia hojas sin HTML ejecutable y acota hojas enormes. Se comprueba la captura lateral con modo explícito, el detalle en línea, los originales asociados a cada tipo de compra y los endpoints/abortos de archivos por carga; los adjuntos rechazan JSON/páginas de error.
- Visibilidad por permisos: menú/secciones y pestañas restauradas filtrados, URL directa/alias bloqueados sin cargar pantallas, revocación activa/inactiva y nueva concesión sin recuperar captura anterior. Consulta única compartida, respuesta de otro usuario/inválida, error de refresco, superadmin y selección de módulos sin perder permisos del sistema anterior.
- Reglas de vendedores/costos y ciclo local de alta, edición, historial y baja.
- Botones: una acción auxiliar no envía un formulario y una carga bloquea clics.
- Campos: identificadores únicos, etiquetas y errores asociados.
- Diálogos: identificadores independientes, foco y protección durante una escritura.
- Formularios: validación inyectada, conservación de captura y prevención de doble envío.
- Tabla: distintos modelos de datos, orden numérico/fechas, paginación y estados de carga/error.
- Filtros por columna: valores de otras páginas, búsqueda, selección múltiple, vacíos, combinación AND/OR, agregar resultados, cancelar/Escape/clic fuera y recuperación cuando no hay coincidencias.
- Aplicación: Materiales usa los componentes compartidos de extremo a extremo; un permiso denegado no monta sus acciones y la expiración retira la pantalla.
- Herramientas: un nombre inválido o módulo existente no sobrescribe código; se comprueban rutas repetidas, límites de imports y estilos fuera de su namespace.

- Material por áreas: ámbitos y permisos de SMD/Micom/IMD/IPM/ASSY; ocho esquemas, inventario sin fechas, periodos de movimientos, filtros remotos por vista, paginación 500/500/101 y tamaños de API; exportación completa con los mismos criterios. ASSY informa pendiente sin pedir una API inexistente.

## Límites de las pruebas

Vitest usa jsdom, con cuatro workers de threads y aislamiento por archivo. La espera de consultas asíncronas de Testing Library es de cinco segundos para permitir la compilación inicial de rutas lazy en equipos Windows ocupados. No se reintentan ni se omiten pruebas. Su preparación simula `showModal`, que no dispone de la capa modal nativa del navegador. La contención de foco, el scroll, los overlays y el diseño se revisan además en navegador real.

En la prueba de importación ECO, jsdom no sincroniza la validez interna del archivo requerido con el `FileList` de `userEvent.upload`: se envía el evento del formulario y se comprueba además la validación del dominio. La selección y el envío nativos se verificaron separadamente en navegador real, con un XLSX local y adaptador demo. Esto no valida el análisis del Excel por openpyxl ni la escritura de un ECO real.

Los contratos HTTP se comprueban con respuestas controladas y el modo demostración no contacta Flask. La integración con credenciales reales, MySQL y exportación Excel requiere el backend disponible y un entorno autorizado de pruebas.

CI ejecuta `npm ci`, `npm run check` y `npm run build` cuando este proyecto se use como repositorio. No publica ni despliega la aplicación.
