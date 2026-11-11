# Acceso a módulos por rol

## Asignación

1. Abrir **Información básica → Administración de autoridad**.
2. Crear o editar un rol del alcance del administrador y abrir **Permisos de ...**.
3. En **Módulos migrados**, marcar las pantallas que podrá abrir el rol y guardar.
4. En **Administración de usuario**, editar el usuario y asignarle ese rol.

Un usuario con varios roles recibe la unión de sus permisos. Desmarcar un módulo en un rol no quita el acceso concedido por otro. `superadmin` conserva el acceso total que define Flask. Los roles reservados y las restricciones por departamento permanecen a cargo del backend original.

La vista de módulos obtiene títulos, ubicación y ternas de permisos de los descriptores registrados, mediante `core/modules/ModuleCatalog`. No duplica un listado de pantallas en Administración ni importa otros features. Solo muestra opciones presentes en el catálogo asignable del servidor. Si falta una pantalla, comprobar el permiso y su alcance en el sistema original; el frontend no inventa IDs ni concede permisos por semejanza de nombres.

**Marcar visibles / Limpiar visibles** afecta únicamente a los módulos mostrados por la búsqueda, conservando permisos del sistema anterior y otros módulos ocultos por el filtro. **Todos los permisos** mantiene el catálogo original completo del alcance, incluidos permisos por acción como crear/aprobar ECO. Solo se envían IDs asignables; Flask conserva los permisos ajenos al área de un delegado.

## Visibilidad y rutas

- Los módulos sin permiso no aparecen en la barra lateral ni en las pestañas restauradas. Una sección sin módulos autorizados tampoco aparece en la cabecera o el selector móvil del modo real.
- Abrir directamente una URL o su alias no monta la pantalla ni consulta sus datos si falta autorización.
- Cuando se revoca un acceso, la pestaña y su contenido se desmontan y se retiran de las preferencias. Volver a concederlo no recupera la captura anterior.
- Sin módulos autorizados, `/inicio` muestra **Sin módulos asignados**. Una consulta de permisos pendiente o fallida no expone opciones; el error ofrece reintento.
- Ocultar controles es presentación. Las API Flask siguen siendo la autoridad para cada lectura, descarga y escritura.

## Consulta compartida

`GET /obtener_permisos_usuario_actual` devuelve `{usuario, rol, permisos: {pagina: {seccion: string[]}}}`. `core/auth/api.ts` valida esa estructura; el hook comprueba que `usuario` coincide con el perfil conectado. La comparación de `pagina`, `seccion` y `boton` es exacta, sin cambiar acentos, mayúsculas ni la ubicación histórica de los permisos.

`usePermissions` y `usePermission` comparten la consulta `['permission', scope]`. Navegación, guardias y acciones leen el mismo resultado, sin una solicitud por módulo. Las lecturas conservan `AbortSignal`, las cookies y el manejo común de 401. No se almacenan concesiones en localStorage.

La consulta se actualiza al guardar usuarios/roles/permisos, al recuperar foco y cada 60 segundos mientras la aplicación está visible. La actualización periódica corresponde solo al observador del workspace, no a cada acción. Cambios en otra sesión se reflejan en el próximo refresco; las API autorizan cada operación independientemente de esta caché visual. Un error de refresco retira la navegación y el contenido hasta recuperar la consulta.

## Demostración y comprobaciones

La demostración mantiene acceso total para explorar el frontend y ofrece el catálogo de los módulos migrados del registro, incluidos los cuatro de Facturas. Editar roles demo no restringe al usuario de demostración ni modifica usuarios reales.

`src/test/permissions.test.tsx` comprueba ocultamiento, secciones, preferencias, URL directa y alias, revocación activa/inactiva, nueva concesión sin captura anterior, error de refresco, usuario incorrecto, respuesta inválida, superadmin, comparación exacta, abortos y preservación de permisos anteriores al guardar una selección filtrada. Los flujos existentes de consulta sin escritura también usan la respuesta agregada de permisos.

La revisión de navegador utiliza una sesión aislada y respuestas controladas, además del editor demo. No cambia asignaciones reales de usuarios ni roles. Resultados y capturas en [VALIDACION.md](../VALIDACION.md).
