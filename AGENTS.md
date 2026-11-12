# Guía de trabajo — ILSAN MES 2.0

Este es un frontend independiente. Trabajar dentro de esta carpeta; el backend Flask de MESILSANLOCAL conserva su contrato y datos.

## Estructura obligatoria

- `src/shared`: componentes, hooks y utilidades sin conocimiento de negocios, sesión o módulos.
- `src/core`: autenticación, transporte HTTP, permisos y contratos de módulos. No importar `features` ni `app`.
- `src/features/<modulo>`: contrato, adaptador, reglas, columnas/campos, consultas y composición de un negocio. No importar otros módulos ni `app`.
- `src/app`: proveedores, rutas y layout ILSAN. Solo `app/registry.ts` registra imports de `features/*/module`.
- Registrar cada módulo una vez en `app/registry.ts`, con `id` y `path` literales únicos. No duplicar rutas o menús en el layout.

## Reutilización y estilos

- Usar `Button`, `IconButton`, campos, `Modal`, `ConfirmDialog`, `DataGrid`, `DataTable`, `Pagination`, `FilterBar`, `Card` y `Page` de `@/shared/ui`. `DataGrid` agrega filtros por columna al mismo estilo de tabla; no sustituir el tema ILSAN al ampliar su comportamiento.
- No introducir `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>` o `<table>` nativos fuera de sus componentes propietarios compartidos. Una variante nueva se agrega al componente común.
- La lógica de negocio pertenece al módulo; extender los componentes con propiedades/composición, sin importar tipos de Materiales en `shared`.
- Consultar `shared/lib/date`, `parse` y `text` antes de agregar utilidades. Compartir las conversiones equivalentes y conservar las validaciones específicas del dominio en su módulo. Usar `structuredClone` directamente para las copias profundas.
- Conservar la identidad ILSAN: tema oscuro gris/azul y logo/iconos existentes. `styles/theme.css` concentra los tokens.
- Estilos específicos bajo `.<nombre-carpeta>-...`. En Materiales: `.materials-module`, `.materials-form`, `.materials-detail` y `.materials-history`.

## Datos y permisos

- Todas las solicitudes pasan por `@/core/http`; no copiar login, cookies ni manejo de 401 a un módulo.
- Consultas privadas deben incluir `useAuth().scope` en sus claves. Conservar abortos y no repetir mutaciones automáticamente.
- La autorización del frontend no reemplaza la del servidor. Antes de habilitar un módulo real, configurar el permiso exacto del backend.
- El generador crea ejemplos con `demoOnly: true`. Mantener esa protección hasta integrar y verificar la API real.

## Documentación y comprobaciones

- Leer `docs/ARQUITECTURA.md`, `docs/COMPONENTES.md` y `docs/NUEVO_MODULO.md` para ampliar la base.
- Mantener los contratos TypeScript y documentar cambios de API pública y nuevos componentes.
- Para nuevo módulo: `npm run module:new -- --name ... --title ...`; `--dry-run` permite revisar el destino sin escribir.
- Ejecutar `npm run check` y `npm run build` al cerrar cambios de estructura. Las pruebas nuevas deben comprobar contratos o comportamiento, no repetir la implementación.
- Para cambios visuales, revisar escritorio y móvil y respetar el estilo existente. Reportar el límite de validación si el servidor real no está disponible.
- No publicar, desplegar ni generar instaladores salvo que la solicitud lo incluya.
