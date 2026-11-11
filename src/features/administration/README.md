# Administración de usuarios y autoridad

El dominio también integra el [Panel de Administración global](../../../docs/ADMINISTRACION.md) con usuarios, roles y permisos, departamentos y auditoría. Sus adaptadores centrales y controles de acceso se describen en esa guía.

Dos pantallas dentro de **Información básica → Administración de usuario**:

- `/informacion-basica/usuarios`: consulta, búsqueda por usuario/nombre, filtros por columna, alta y edición; departamento, cargo, correo, estado, contraseña y asignación de roles.
- `/informacion-basica/autoridades`: consulta y filtros de roles, alta/edición y permisos agrupados por página y sección, con búsqueda, selección individual, por grupo y global.

Ambas pertenecen al dominio `administration`, con descriptores, rutas y permisos independientes. Comparten contratos y adaptadores de usuarios/roles sin dependencias entre features. La navegación se obtiene de `app/registry.ts`; el layout no conoce estos negocios.

## Responsabilidades

El editor abre **Módulos migrados** con los permisos exactos del registro común. Permite buscar y marcar/limpiar solo los visibles, conservando la selección del sistema anterior. **Todos los permisos** mantiene el catálogo original del alcance. Los usuarios heredan la unión de permisos de sus roles. Navegación y pestañas ocultan módulos no autorizados; ver [permisos](../../../docs/PERMISOS.md).

| Archivo                                                | Responsabilidad                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `module.ts`, `config.ts`                               | Rutas, permisos exactos, claves privadas por sesión y nombres de páginas      |
| `types.ts`                                             | Contratos originales de usuarios, roles, contexto y permisos                  |
| `api.ts`                                               | API delegada Flask mediante `core/http`, validación de lecturas y cancelación |
| `demo.ts`                                              | Usuarios, roles y permisos coherentes entre ambas pantallas, sin HTTP         |
| `model.ts`                                             | Validaciones, transformación de payloads, alcance y selección de permisos     |
| `useAdministration.ts`                                 | Consultas y actualización de datos, sesión y permisos tras guardar            |
| `Page.tsx`, `AuthoritiesPage.tsx`                      | Composición de pantallas con tablas y controles compartidos                   |
| `UserForm.tsx`, `RoleForm.tsx`, `PermissionEditor.tsx` | Captura específica del dominio sobre campos/diálogos compartidos              |
| `module.css`                                           | Ajustes bajo `.administration-`, sin modificar la identidad ILSAN             |

## Contrato y restricciones

Se utilizan `admin_usuarios_depto.py` y `gestion_roles_depto.py` del original; no el panel exclusivo del superadministrador. Los permisos de ambas pantallas usan `LISTA_INFORMACIONBASICA`, sección `Administración de usuario`, y su botón correspondiente.

- El servidor sigue autorizando cada operación y limita los departamentos, roles y permisos disponibles. El navegador utiliza el contexto recibido; nunca deduce el alcance por el nombre del rol del perfil.
- El usuario es inmutable al editar. Crear exige contraseña; editar con contraseña vacía omite ese campo. No se conservan contraseñas en registros, preferencias ni cachés de consultas.
- El endpoint de usuarios hace upsert por nombre. El formulario evita crear un nombre que ya está en el listado cargado; el backend conserva su semántica ante concurrencia.
- `admin` está protegido. Cuando un usuario tiene roles que el administrador actual no puede asignar, se bloquea su edición para evitar perderlos: esta API reemplaza todos sus roles y no ofrece una actualización parcial.
- Un delegado captura dentro de su departamento. El superadministrador puede seleccionar el departamento de un usuario y definir el del rol; vacío significa transversal para roles. El departamento de un rol existente se conserva al editar.
- Los nombres `admin` y `superadmin` están reservados para roles. Esta API crea roles con nivel 3 y no actualiza el nivel existente; el frontend no ofrece cambiarlo.
- Los permisos asignados se cargan antes de habilitar su edición. Una respuesta errónea o inválida no se interpreta como una selección vacía.
- Solo se envían IDs disponibles. Para delegados, Flask reemplaza los permisos de su área y conserva los de otras áreas asignados previamente por el superadministrador. Un filtro de búsqueda cambia la vista, sin descartar la selección oculta.
- No existen eliminación de usuarios/roles ni clonación en estas APIs. La baja de usuarios se realiza mediante su estado activo.
- Al guardar se invalidan los datos del dominio y los permisos del usuario conectado. Una falla de actualización posterior no se presenta como una escritura fallida ni causa un reenvío automático.

## Demostración y verificación

El adaptador demo usa memoria del frontend: los cambios entre usuarios y roles se ven al navegar, y se reinician al recargar. Las contraseñas se descartan. Materiales conserva su adaptador independiente.

`administration.test.ts` verifica contratos, reglas y errores; `flows.test.tsx` cubre el flujo integrado sin red y la recuperación de permisos tras un error, conservando asignaciones de otras áreas. Ejecutar `npm run check` y `npm run build` desde la raíz.

La integración real utiliza las cookies existentes y las API originales; las pruebas controladas y demo no acreditan escrituras en MySQL. No se modificó Flask ni se ejecutaron altas o cambios de permisos reales.
