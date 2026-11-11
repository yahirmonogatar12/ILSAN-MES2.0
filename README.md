# ILSAN MES 2.0 — Frontend modular

La entrada principal presenta el portal corporativo con login, fotografía de la planta, User Info, System Link, Support y Calendar. El MES se abre desde System Link y el menú de usuario permite editar el perfil. [Rutas y contratos del portal](docs/LANDING.md).

**Control de proceso → Control de producción** incluye ASSY, IMT, SMT, Historial de operación por proceso y Control de salida de líneas, con sus permisos, orden, pendientes, importaciones y reportes. [Contratos y límites](docs/CONTROL_PROCESO.md).

**Control de producción → Retrabajo** incluye Solicitud de retrabajo, programación por IC, componentes, avance por áreas, trazabilidad y cancelación con avisos. [Contratos y límites](docs/RETRABAJO.md).

**Control de material → Facturas** incluye Invoice Almacén, Invoice Embarques, Valorización de inventario y Lista de compras, con permisos independientes, carga de Excel con vista previa, visor compartido y operaciones originales de conciliación/costeo. [Contratos y organización](docs/FACTURAS.md).

React + TypeScript + Vite, con el tema oscuro, logo e iconos del MES original. El catálogo está en la sección **Control de material**, con la base compartida de botones, campos, formularios, filtros, tablas, paginación y diálogos.

**Control de producción → Control de plan de producción** incluye Control de embarque, Part Planning LG, Proyección, Plan Proyectado y Crear Plan de producción. Conserva PO/WO, importaciones con revisión, proyección P/S/I y lotes, con permisos independientes y 500 registros por defecto. [Contratos y límites](docs/PLAN_PRODUCCION.md).

**Información básica** incluye **Administración de usuario** y **Administración de autoridad**, con usuarios, roles y permisos por departamento. El **Panel de Administración** agrega usuarios globales, roles y permisos, departamentos y auditoría, con acceso para superadmin. Las pantallas comparten tablas, campos y diálogos. [Contrato y organización del dominio](src/features/administration/README.md), [panel central](docs/ADMINISTRACION.md).

La barra de pestañas permite mantener abiertos varios módulos, cambiar sin perder filtros/paginación/captura y cerrarlos individualmente. Restaura la lista por usuario sin precargar pantallas inactivas. [Funcionamiento y reutilización](docs/PESTANAS.md).

**Control de material** también incluye **Historial de entradas**, **Historial de salidas**, **Historial de retornos** e **Inventario actual**, con consultas y Excel de las API existentes. Los historiales comparten pantalla y paginación remota; inventario ofrece resumen y detalle por lote. Todos comienzan en 500 filas. [Contratos y límites](docs/MOVIMIENTOS_MATERIAL.md).

**Material por áreas** incorpora SMD, Micom, IMD e IPM con entradas, salidas e inventario general/detallado, más chamber en Micom e inventario completo en IPM. Comparten pantalla, filtros remotos, exportación Excel y 500 filas por defecto. ASSY queda identificado como pendiente por acuerdo del usuario. [Consultas, permisos y límites](docs/MATERIAL_POR_AREAS.md).

**Información básica → Control de producción** incluye **Control de modelos SMT**, **Control de modelos**, **Control de BOM** y **Control de FPA**. Los dos catálogos comparten formulario y tabla; BOM incorpora revisiones, ECO/ECN y papelería; FPA conserva solicitudes, ajustes e historial mediante el proxy MES a MICOM. [Contratos, reutilización y límites](docs/CATALOGOS_PRODUCCION.md).

## Iniciar

Requiere Node.js 22.12 o posterior. Ejecutar `iniciar.cmd`, o desde esta carpeta:

```powershell
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5174/**. El puerto es fijo. **Ver demostración** funciona sin Flask/MySQL; sus datos y cambios permanecen en este navegador. El modo está identificado en pantalla y se puede abandonar con **Salir de demostración**.

En Administración los cambios demo duran hasta recargar; usuarios, roles y permisos comparten el mismo estado temporal y las contraseñas se descartan.

Los modelos, ECO y FPA demo también duran hasta recargar. El Excel de ECO se simula en ese modo; sus adjuntos se mantienen en memoria y utilizan el visor real. Las escrituras reales usan las API existentes y requieren una sesión autorizada.

## Conectar con Flask

Copiar `.env.example` a `.env.local` y definir la dirección del backend existente:

```dotenv
MES_API_TARGET=http://127.0.0.1:5000
```

Reiniciar Vite y entrar con una cuenta MES autorizada. El frontend utiliza el formulario de login y la cookie existentes; no copiar aquí MySQL, `SECRET_KEY` ni secretos del servidor. Este proyecto no inicia ni modifica el backend. Las operaciones realizadas en modo real sí actúan sobre sus datos según los permisos actuales.

## Cómo se reutiliza

- `shared/ui`: controles y contenedores sin dependencias de un negocio.
- `shared/hooks`: formularios, debounce, preferencias y overlays.
- `core`: autenticación, permisos, transporte y contrato de módulos.
- `features/<modulo>`: tipos, adaptador, reglas, consultas, columnas y composición de ese negocio.
- `app/registry.ts`: registro único que alimenta rutas, navegación y permisos.
- `styles/theme.css`: tokens del tema ILSAN; los estilos específicos permanecen dentro del módulo.

Materiales y su historial utilizan el mismo `DataTable`. Las pruebas también lo utilizan con clientes y máquinas. Las reglas de costos/vendedores permanecen en Materiales, fuera de la tabla y los campos compartidos.

`DataGrid` compone esa tabla con filtros de columna tipo Excel y paginación, conservando el estilo existente. Materiales, el historial y la plantilla para módulos nuevos comparten el selector con buscador y casillas.

## Crear otro módulo

```powershell
npm run module:new -- --name clientes --title "Control de clientes" --section informacion-basica --dry-run
npm run module:new -- --name clientes --title "Control de clientes" --section informacion-basica
```

El generador crea una pantalla de ejemplo funcional con los componentes comunes y la registra. Queda limitada a demostración hasta integrar su API y configurar el permiso real. No copia Materiales ni requiere editar `Shell`.

## Comprobar y compilar

```powershell
npm run check
npm run build
npm run preview
```

`check` verifica estructura, TypeScript, pruebas de componentes/contratos/flujos, herramientas y la compilación de un módulo generado. `build` genera `dist/`; `preview` permite comprobarlo en **http://127.0.0.1:4174/** con el proxy local. `npm run format` mantiene el formato del código y la documentación.

Para producción se debe servir `dist/`, hacer fallback de rutas a `index.html` y configurar `/backend` hacia Flask en el mismo origen. Los servidores de Vite son de desarrollo/verificación. El proyecto queda local; no se publica automáticamente.

## Funciones de Materiales

Búsqueda por parte/descripción/vendedor y clasificación; preferencias por usuario/modo; orden y paginación; ficha, alta, edición y baja lógica; vendedores/costos por moneda e historial. La exportación real es el Excel del servidor; la demostración exporta CSV identificado y neutraliza fórmulas en el texto.

El backend limita la consulta/exportación a 2,000 materiales; la pantalla lo advierte. Un costo vacío por vendedor equivale a cero, igual que en el módulo actual. Las pruebas locales no acreditan una validación con MySQL ni en planta.

## Documentación

- [Arquitectura y responsabilidades](docs/ARQUITECTURA.md)
- [Componentes compartidos y ejemplos](docs/COMPONENTES.md)
- [Guía para nuevos módulos](docs/NUEVO_MODULO.md)
- [Pruebas y límites de verificación](docs/PRUEBAS.md)
- [Contrato con Flask y despliegue](docs/INTEGRACION_FLASK.md)
- [Modelos SMT, modelos, BOM/ECO y FPA](docs/CATALOGOS_PRODUCCION.md)
- [Historiales e inventario de material](docs/MOVIMIENTOS_MATERIAL.md)
- [Convenciones para colaboradores](AGENTS.md)
- [Resultados de validación local](VALIDACION.md)
