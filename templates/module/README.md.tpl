# __TITLE_TEXT__

Módulo generado con componentes compartidos. Ruta: __PATH_TEXT__.

El ejemplo permite alta, búsqueda, orden y paginación de registros temporales. No escribe en Flask ni MySQL. `demoOnly: true` impide usarlo como módulo real antes de integrarlo.

Antes de conectarlo:

1. Definir el contrato del dominio en `types.ts`.
2. Crear su `api.ts` con `@/core/http`, sin copiar autenticación.
3. Crear un hook de consultas con claves que incluyan `useAuth().scope`.
4. Reemplazar el estado local de `Page.tsx` y sus columnas/campos por los reales.
5. Configurar el permiso exacto en `module.ts`. Con una API verificada y pruebas, retirar `demoOnly`.
6. Mantener estilos bajo `.__NAME__-module` y agregar pruebas del contrato y flujo propio.

La ruta y los menús ya están registrados en `src/app/registry.ts`. No editar `Shell` ni duplicar botones, tablas, filtros, diálogos o campos.
