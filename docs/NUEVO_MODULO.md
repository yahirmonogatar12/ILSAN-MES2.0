# Crear un módulo

## Generación

Desde la raíz del proyecto:

```powershell
npm run module:new -- --name clientes --title "Control de clientes" --section informacion-basica --dry-run
npm run module:new -- --name clientes --title "Control de clientes" --section informacion-basica --group "Catálogos"
```

`--name` acepta minúsculas, números y guiones. El generador rechaza rutas como `../otra`, módulos existentes, secciones desconocidas y registros sin sus marcadores. `--dry-run` no escribe archivos.

Crea `src/features/clientes/` con `module.ts`, `Page.tsx`, `types.ts`, `module.css` y un README del módulo. Actualiza únicamente los bloques del generador en `src/app/registry.ts`. No modifica `Shell` ni el módulo Materiales.

El ejemplo generado **funciona en demostración**: alta temporal, búsqueda, tabla ordenable con filtros por columna tipo Excel y paginación. Usa `DataGrid` compartida, sin cambiar la apariencia de la tabla. Sus registros se pierden al recargar. Usa `demoOnly: true`; no queda habilitado como operación real antes de conectar su API y permiso.

El generador admite las secciones `informacion-basica`, `material`, `produccion`, `proceso`, `calidad`, `resultados`, `reporte`, `configuracion` y `administracion`.

## Integración con una API real

1. Definir los tipos del negocio en `types.ts` y un contrato de adaptador.
2. Crear `api.ts`, usando `request` de `@/core/http`. Conservar `signal` en las consultas cancelables y comprobar la respuesta del servidor antes de usarla.
3. Crear `model.ts` para validaciones y transformaciones. Las validaciones del navegador complementan las del servidor.
4. Crear un hook de consultas, por ejemplo `useClientes.ts`. Sus claves incluyen `useAuth().scope` y los filtros. Separar ese hook de la presentación.
5. Entregar columnas a `DataGrid` para filtrado/paginación local del conjunto cargado, o a `DataTable` para una consulta paginada por servidor. Usar `textValue` en celdas propias y `filterable: false` en acciones. Los campos y botones permanecen compartidos.
6. Declarar el permiso exacto de Flask en `module.ts`; comprobar la autorización del endpoint de cada escritura.
7. Verificar contratos y flujo con un entorno de pruebas; retirar `demoOnly` cuando el módulo real esté listo.

Las acciones generales de una tabla se entregan a `FilterBar.actions`. Para una captura o filtros propios, usar `TableToolbar` con `children` y `actions`. La tabla se contiene en `Card fill label="Nombre del listado"`, con su etiqueta accesible en `DataGrid` o `DataTable`. La plantilla del generador aplica esta distribución.

```ts
export const clientesModule: ModuleDefinition = {
  id: "clientes",
  path: "/informacion-basica/clientes",
  title: "Control de clientes",
  sectionId: "informacion-basica",
  group: "Catálogos",
  icon: Users,
  permission: {
    pagina: "PAGINA_REAL_DEL_BACKEND",
    seccion: "SECCION_REAL",
    boton: "PERMISO_REAL",
  },
  component: lazy(() => import("./Page")),
};
```

El descriptor se registra una sola vez. App genera la ruta; Shell obtiene de él la navegación y ModuleAccess aplica el permiso. Un módulo de otra sección cambia `sectionId` y ruta; no requiere editar el layout.

El registro también incorpora el módulo al [sistema de pestañas](PESTANAS.md), sin configuración adicional: una instancia por módulo, estado conservado al cambiar, efectos pausados mientras está oculto y desmontaje al cerrar. Limpiar los efectos y reiniciar formularios/listados solo ante cambios reales de sus criterios, no ante cada reconexión de efectos.

Si se mueve un módulo, `legacyPaths: ["/ruta/anterior"]` en su descriptor conserva las direcciones previas mediante redirección a `path`. Las rutas y sus alias deben ser únicos; no se duplican pantallas ni permisos.

## Estilos

Importar `./module.css` desde la pantalla. Todos sus selectores empiezan por `.clientes-`, por ejemplo `.clientes-module .nombre`. Si un formulario usa un portal, entregar `className="clientes-form"` a `Modal` y comenzar sus selectores por esa clase. Cambiar colores comunes mediante tokens ILSAN, sin copiar otro tema.

## Comprobaciones

```powershell
npm run check
npm run build
```

`check:scaffold` crea un módulo de clientes independiente en `output/scaffold-check/<id>/`, comprueba sus límites y lo compila. Los ejemplos usados para verificar el generador no se agregan a la navegación del proyecto real.

Para un cambio visible, comprobar escritorio y móvil; para una escritura real, verificar también el backend de pruebas. Las pruebas del frontend no acreditan por sí solas una validación en planta.
