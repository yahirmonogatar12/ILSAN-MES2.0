# Arquitectura del frontend ILSAN MES 2.0

La interfaz y la infraestructura son compartidas. Cada módulo aporta su contrato, reglas, consultas, columnas y campos. Reutilizar significa componer esas piezas; no convertir todos los procesos de planta en un formulario universal.

## Capas y dependencias

```text
src/
  app/
    registry.ts           Único registro de módulos y secciones
    providers.tsx         QueryClient, sesión y notificaciones
    layout/               Logo, navegación y estilos ILSAN
    pages/                Acceso a la aplicación
  core/
    auth/                 Perfil, login/logout y proveedor de sesión
    modules/              Contratos y guardia de permisos
    runtime.ts            Modo real/demo, scope y evento de expiración
    runtime/              Indicador de demostración
    http.ts               Transporte, cookies, abortos, errores y descargas
  shared/
    ui/                   Componentes reutilizables sin tipos de negocio
      table/              Tabla, filtros por columna, paginación y orden local
    hooks/                Formularios, debounce, preferencias y overlays
    lib/                  Calendario, conversiones, búsquedas y preferencias
  features/
    materials/
      module.ts           Metadatos: ruta, sección, icono y permiso
      types.ts            Datos y contrato del adaptador
      api.ts              Adaptador del backend existente
      demo.ts             Implementación local del mismo contrato
      config.ts           Permiso, filtros y claves de consulta
      model.ts            Validaciones y transformaciones del negocio
      useMaterials.ts     Consultas y estado del módulo
      columns.tsx         Columnas y acciones de Materiales e historial
      MaterialsPage.tsx   Composición de componentes compartidos
      MaterialForm.tsx    Campos propios del material
      MaterialDialogs.tsx Ficha, historial y baja
      materials.css       Estilos limitados a este módulo
  styles/                 Tokens y reset global
  test/                   Preparación y pruebas de integración
templates/module/         Plantilla independiente para nuevos módulos
tools/                    Generador y comprobaciones de estructura
```

Reglas:

- `shared` no importa `core`, `app` ni `features`.
- `core` no importa `app` ni `features`.
- Un `feature` utiliza `core`, `shared` y archivos de su propia carpeta. No importa otro módulo.
- `app/registry.ts` es el único lugar de `app` que registra módulos de negocio.
- El layout recibe descriptores; no conoce los campos, APIs ni reglas de Materiales.

`npm run check:architecture` inspecciona imports y JSX con un parser, comprueba namespaces CSS, rutas/IDs duplicados y componentes nativos repetidos. Un módulo real con `permission: null` se rechaza; ese valor solo se admite en ejemplos `demoOnly`. Es una comprobación de estructura, no una auditoría de seguridad del backend.

## Utilidades compartidas

`shared/lib/date.ts` concentra `PLANT_TIME_ZONE`, `today(date?)`, `localDate(date?)`, `validDate(value)` y `rangeIssue(start?, end?, maxDays?)`. `today` obtiene el día de planta y `localDate` usa el calendario del operador. `validDate` comprueba formato ISO y existencia del día, incluido el año cero admitido por los validadores generales existentes. `rangeIssue` compara límites presentes y aplica un máximo opcional de días transcurridos. Cada módulo conserva la obligatoriedad de fechas, la validación de sus campos y sus excepciones. LQC mantiene el corte operativo de las 07:30, Material por áreas exige un año positivo en sus historiales y Facturas permite consultar pendientes sin fechas.

`shared/lib/parse.ts` expone `number`, `isRecord` y `record`. `number` usa la conversión nativa de `Number` y devuelve cero para resultados no finitos. `isRecord` admite objetos no nulos y excluye arreglos. `record` devuelve ese objeto o lanza el mensaje común de registro inválido. Los decodificadores con errores o restricciones propios conservan sus adaptadores.

`isNumericValue` e `isNullableText` comprueban valores del JSON original sin convertirlos. `requiredText` y `requiredNumber` comprueban y convierten capturas obligatorias. `positiveIntegerList` comprueba listas de identificadores y recibe el mensaje del dominio. Las interfaces de cada módulo describen los campos estables y los decodificadores comprueban esa forma antes de entregar datos a la pantalla.

`shared/lib/text.ts` ofrece `text` para conversión simple, `jsonText` para serializar objetos, `containsText(value, search, locale?)` para coincidencias que conservan acentos y `normalizeSearch` para búsquedas sin acentos. Los consumidores deciden el recorte de espacios y la serialización previa. Los modelos mantienen sus exportaciones públicas mediante reexportaciones de estas utilidades. Las copias profundas usan `structuredClone` directamente.

## Recorrido de un módulo

La entrada pública de /, /inicio y /login presenta el portal corporativo. El acceso al workspace se realiza mediante /mes desde System Link. Las rutas directas de módulos conservan su destino después de autenticar. El portal reutiliza AuthProvider, los controles compartidos y las API de sesión y perfil. [Contratos del portal](LANDING.md).

1. `AuthProvider` consulta la sesión o prepara una sesión de demostración.
2. `App` obtiene las rutas desde `registry.ts`.
3. El workspace filtra los descriptores con los permisos del usuario. `Shell` recibe únicamente módulos autorizados para construir secciones, grupos, enlaces y pestañas.
4. `ModuleAccess` comprueba el permiso antes de montar el módulo. El servidor vuelve a autorizar cada operación.
5. React carga la pantalla con `lazy`/`Suspense`. Un fallo de render queda aislado por `ErrorBoundary`.
6. El hook del módulo consulta su adaptador. Los datos privados se identifican por modo y usuario.
7. La pantalla entrega filas/columnas a `DataTable`, filtros a `FilterBar` y valores a los campos compartidos.

`app/workspace` conserva los módulos abiertos en paneles independientes. La pestaña activa sigue la URL; las otras pantallas visitadas mantienen estado con `Activity` y pausan sus efectos. Los nombres de pestañas restaurados no cargan código hasta visitarlos. El control visual `TabBar` pertenece a `shared/ui`; no conoce sesión ni navegación. Ver [pestañas y ciclo de vida](PESTANAS.md).

## Sesión y consultas

Las pantallas se cargan por ruta con `React.lazy`; abrir un módulo no carga las otras pantallas. Los adaptadores de demostración de Materiales, Administración, modelos, BOM y FPA usan `import()` y sus registros de ejemplo solo se descargan al utilizar ese modo. El módulo importado se comparte entre las pantallas del mismo dominio. El visor PPTX original es un recurso local opcional que se solicita solamente al abrir ese formato.

La búsqueda de usuarios conserva el conjunto de filas mientras no cambien sus datos o el texto buscado; abrir un diálogo no fuerza a reconstruir las opciones de filtros y el orden de toda la tabla. El editor de permisos reutiliza el catálogo de IDs y un `Set` para comprobar pertenencia, evitando búsquedas repetidas sobre listas completas. La tabla solo renderiza las filas de la página activa; no confundir esta paginación local con paginación de consultas en el servidor.

`useAuth()` expone `profile`, `mode`, `scope`, `login`, `logout` y la consulta de permisos. `scope` diferencia modo y usuario; debe formar parte de todas las claves privadas:

```ts
const { scope } = useAuth();
useQuery({
  queryKey: ["clientes", scope, "list", filters],
  queryFn: ({ signal }) => api.list(filters, signal),
});
```

El transporte conserva la cookie del servidor y el formulario de login existente. Una respuesta 401 de una API privada retira la sesión y sus consultas. Las contraseñas no se almacenan en preferencias. Los abortos siguen siendo abortos, y las mutaciones no se reintentan automáticamente.

`requestFile(path, nombre, signal?, allowHtml?, init?)` también admite `RequestInit` para exportadores binarios que reciben POST/JSON. Conserva el mismo control de sesión, errores, tipo de archivo y nombre seguro; `saveDownload` realiza la descarga. Los consumidores existentes de GET no cambian. No sustituir este transporte por un fetch propio en un módulo.

`core/auth/usePermission` comparte una consulta agregada por sesión entre navegación, rutas y acciones; evalúa cada terna exacta sobre el mismo resultado, sin solicitar cada permiso por separado. `core/modules/ModuleCatalog` aporta metadatos del registro al editor de permisos sin imports entre features. Ver [asignación y visibilidad](PERMISOS.md). `core/http` distingue JSON de `FormData`, deja que el navegador construya el límite multipart y centraliza descargas binarias y errores `success:false` / `ok:false`.

## Estilos

- `styles/theme.css`: paleta, tipografía y tokens `--mes-*`.
- `styles/base.css`: reset y comportamiento básico del documento.
- `shared/ui/styles.css`: botones, campos, tarjetas, tablas y diálogos comunes.
- `app/layout/styles.css`: barra superior, lista lateral, pestañas y acceso.
- `features/<nombre>/*.css`: únicamente selectores bajo `.<nombre>-...`.

Los estilos del módulo se importan desde su pantalla y se cargan con ella. Los portales usan namespaces propios en la raíz del diálogo: por ejemplo, `materials-form`. Cambiar una columna o un formulario no exige modificar el layout ni el CSS de otros módulos.

El workspace ocupa la altura del viewport. El listado principal se compone con `Page` y `Card fill`: filtros, acciones y paginación permanecen visibles mientras `.table-overflow` es la única región de desplazamiento del contenido. La cadena flex usa `min-height: 0` para que las filas no aumenten el alto del documento.

La barra lateral utiliza el patrón del MES original: grupos con título en negrita, separadores, opciones con sangría y selección azul sólida. El botón de la cabecera pliega la lista en escritorio; el botón de menú abre la navegación en móvil. Tanto el aspecto como el comportamiento pertenecen a `app/layout`, y los grupos y opciones siguen proviniendo de los descriptores registrados.

## Extensiones previstas

`features/invoicing` reúne las cuatro pantallas de Facturas. Almacén y Embarques comparten pantalla y detalles con adaptador parametrizado por ámbito; compras y valorización comparten confirmaciones, exportación y componentes del mismo dominio. El visor y la infraestructura Excel pertenecen a `shared`, con motor local opcional bajo demanda. Los cuatro descriptores participan automáticamente en permisos y pestañas. Ver [Facturas](FACTURAS.md).

`features/administration` agrupa usuarios, roles, departamentos y auditoría como un mismo dominio. Exporta seis descriptores con autorización independiente. Las pantallas delegadas de Información básica comparten formularios con el panel central. Los contratos HTTP y las claves de consulta distinguen ambos alcances. Un dominio puede aportar varias pantallas sin importar otro feature. Ver su [documentación](../src/features/administration/README.md).

Los descriptores admiten `requiredRoles` para capacidades reservadas a roles del sistema. `allowsRoles` comprueba el rol principal y los secundarios del perfil. `Workspace` oculta las opciones sin acceso y `ModuleAccess` aplica el mismo criterio antes de montar el componente. Un descriptor con `permission: null` requiere una lista literal no vacía de roles o `demoOnly: true`. El panel central requiere `superadmin`. Los endpoints Flask conservan su autorización definitiva.

`features/model-catalog` aplica ese mismo patrón a modelos SMT y RAW: dos descriptores, una pantalla y formulario comunes, adaptador parametrizado y reglas específicas en el dominio. `features/bom` concentra componentes, ECO, diferencias y papelería; `features/fpa` consume el proxy MES de solicitudes MICOM. Los tres dominios comparten controles, permisos, consultas y pestañas, sin importar código entre ellos. Ver [contratos de estas cuatro pantallas](CATALOGOS_PRODUCCION.md).

`features/material-ledger` agrupa tres historiales y el inventario administrativo, con cuatro descriptores. Comparten adaptador, columnas y controlador de consultas/paginación remota. El inventario agrega una vista de resumen local sobre el conjunto recibido. El modo de búsqueda de columna remota pertenece a la tabla compartida; los parámetros `cf_` y reglas de almacén permanecen en el adaptador del dominio. Ver [contratos y composición](MOVIMIENTOS_MATERIAL.md).

- Tabla local con filtros tipo Excel: `DataGrid` compone `DataTable` + filtros + `useClientTable` + `Pagination`, conservando el estilo ILSAN. Usar el conjunto completo de registros cargados.
- Tabla paginada por servidor: `DataTable` + `Pagination` controladas con datos del hook de API; no usar `useClientTable` sobre una sola página remota.
- Una operación especial puede renderizar contenido propio en `Card`, `Modal` o una celda. No es obligatorio forzarla al CRUD del ejemplo.
- Una variante común nueva se agrega a `shared`, con sus propiedades, documentación y pruebas. Una regla exclusiva de un proceso permanece en su `feature`.
