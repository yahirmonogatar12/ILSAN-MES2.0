# Panel de Administración

La sección **Panel de Administración** integra cuatro módulos del dominio `administration`.

| Ruta                   | Funciones                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/panel`         | Directorio global, búsqueda por usuario, nombre, correo y cargo, estado y departamento, alta, edición, roles, activación, desactivación y desbloqueo |
| `/admin/roles`         | Alta y edición de roles, nivel, departamento, permisos por módulo o catálogo completo, selección por grupo, sincronización y exportación             |
| `/admin/departamentos` | Alta, edición, estado, eliminación y asignación N:M de permisos a departamentos                                                                      |
| `/admin/auditoria`     | Consulta por fechas, usuario, módulo, acción, resultado y límite, detalle antes/después, exportación y actividad reciente                            |

`/admin/permisos-dropdowns` redirige a `/admin/roles`. Las pantallas delegadas de Información básica conservan sus adaptadores y alcance departamental.

## Acceso

Los cuatro descriptores declaran `requiredRoles: ["superadmin"]`. La navegación y `ModuleAccess` aplican el mismo criterio sobre `profile.rol` y `profile.roles`, incluyendo un superadmin secundario. La sección desaparece para las demás cuentas y un acceso por URL muestra acceso restringido antes de montar el módulo o consultar datos administrativos.

El modo de demostración permite explorar los módulos con datos transitorios. Flask mantiene la autorización definitiva de sus endpoints.

## Contratos nativos

`panelApi.ts` usa exclusivamente `core/http`.

- Usuarios usan `/admin/listar_usuarios`, `/admin/guardar_usuario`, `/admin/cambiar_estado_usuario` y `/admin/desbloquear_usuario`. El contexto del formulario se obtiene del endpoint existente `/api/admin-usuarios-depto/contexto`. El catálogo global de roles completa las opciones para preservar asignaciones históricas.
- Roles usan `/admin/listar_roles`, `/admin/crear_rol`, `/admin/actualizar_rol/<id>` y `/admin/eliminar_rol/<id>`. El nivel de roles nuevos es de 1 a 7. Los roles de nivel 8 a 10 permiten editar su descripción y mantienen los campos de sistema protegidos.
- Permisos usan `/admin/listar_permisos_dropdowns`, `/admin/obtener_permisos_dropdowns_rol/<id>`, `/admin/actualizar_permisos_dropdowns_rol` y `/admin/sincronizar_permisos_dropdowns`. El guardado envía `{rol_id, permisos_ids}`.
- Departamentos usan `/admin/listar_departamentos`, `/admin/crear_departamento`, `/admin/actualizar_departamento/<id>` y `/admin/eliminar_departamento/<id>`. El renombrado conserva la propagación que implementa Flask sobre usuarios y roles.
- Áreas usan `/admin/api/permisos-departamentos` y `/admin/api/permiso-departamentos-masivo`. El guardado envía `{permiso_ids, departamento, accion}`, con acción `add` o `remove`.
- Auditoría usa `/admin/buscar_auditoria`, `/admin/detalle_auditoria/<id>` y `/admin/actividad_reciente`. El formulario envía `fecha_inicio`, `fecha_fin`, `usuario`, `modulo`, `accion`, `resultado` y `limite`.

La auditoría consulta 500 registros por defecto y permite hasta 5000. **Exportar consulta** corresponde a los registros cargados con esos criterios. Esta exportación se genera con el motor Excel compartido para conservar los filtros de acción y resultado, que el exportador original omite. El detalle acepta JSON serializado o expandido y enmascara claves sensibles de los objetos JSON.

## Composición y rendimiento

`UserForm` y `PermissionEditor` se reutilizan en ambos alcances mediante contratos mínimos de adaptador. `PanelRoleForm` implementa el nivel del contrato global. Tablas, filtros por columna, paginación, formularios, botones, confirmaciones, notificaciones y diálogos pertenecen a `shared`.

Los módulos y sus datos de demostración se cargan bajo demanda. Cada consulta privada contiene el scope de sesión y acepta `AbortSignal`. El editor central agrega `:panel` al scope para separar el catálogo global del catálogo delegado. Una escritura invalida los registros globales, las vistas delegadas, los permisos y el perfil. Las mutaciones mantienen `retry: false`.

Las tablas conservan 500 filas por página. Auditoría virtualiza filas de 42 px. Las pantallas comienzan directamente con los filtros o el listado y aprovechan el espacio disponible para las tablas. El documento ocupa el viewport y las tablas concentran el desplazamiento. En pantallas pequeñas los filtros usan el diálogo compartido.

## Borrado definitivo de usuarios pendiente

El código original de `app/api/admin/usuarios.py`, en `borrar_usuario`, elimina `rol_permisos_botones` de todos los roles asociados al usuario antes de borrar su cuenta. Esto quita permisos compartidos por otras cuentas.

El panel migrado ofrece la desactivación y el cierre de sesiones. El borrado definitivo queda pendiente de corregir ese endpoint. La migración del frontend conserva el backend existente.

## Validación

Las pruebas de `panel.test.tsx` comprueban acceso por URL, ocultamiento, roles secundarios, contratos originales, formularios compartidos, errores, niveles de sistema, filtros, datos históricos y demostración. La revisión visual y funcional usa respuestas controladas en navegador, con las mutaciones interceptadas.
