# Portal corporativo

La entrada pública de React reproduce la portada de Ilsan Electronics Monterrey México. Conserva la fotografía original de la planta, el logo, los textos de las seis tarjetas y la navegación User Info, System Link, Support y Calendar.

## Entrada y navegación

- /, /inicio y /login presentan el portal con o sin sesión.
- El login de la portada conserva al usuario en el portal. System Link permite abrir ILSAN MES mediante /mes.
- /mes recupera el módulo activo autorizado o abre el primero disponible. /ILSAN-ELECTRONICS conserva el acceso anterior al MES.
- Un enlace directo a un módulo conserva su destino después del login.
- Cerrar la última pestaña del workspace deja /mes/inicio como pantalla vacía. /inicio corresponde al portal.
- Salir del MES y Logout del portal terminan la sesión y presentan nuevamente el acceso.

LandingPage y PortalHeader pertenecen a app porque componen el acceso general a la aplicación. Los módulos de negocio continúan registrados exclusivamente en app/registry.ts.

## Sesión y perfil

Se reutiliza AuthProvider y el transporte de core/http. El formulario de acceso usa el POST /login original y recupera la sesión mediante GET /api/mi-perfil. Los mensajes de error del servidor se presentan en la cabecera y la contraseña del formulario se vacía al finalizar cada intento.

El menú de usuario presenta Mi Perfil, Configuración y Logout. Mi Perfil y Configuración abren el mismo diálogo compartido de edición.

POST /api/mi-perfil recibe nombre_completo, email, current_password, new_password y confirm_password. Usuario y rol se muestran como datos de referencia. Las validaciones reproducen el contrato del servidor, incluyendo el máximo de 120 caracteres del nombre y la longitud mínima de seis caracteres de la nueva contraseña.

Profile añade los campos opcionales email y editable. AuthGateway.saveProfile realiza la solicitud y AuthProvider.saveProfile actualiza la sesión en caché cuando la respuesta corresponde al usuario activo. Una respuesta tardía conserva el estado de una sesión que ya expiró. Las contraseñas del diálogo se vacían al terminar el envío.

GET /api/mi-perfil admite la ausencia de sesión durante la carga pública. Un 401 de POST /api/mi-perfil retira la sesión y los datos privados. Logout conserva la consulta observada de sesión mientras elimina las consultas privadas.

## Enlaces originales

Support abre /portal-tickets. Calendar abre /calendario. Defect Management conserva /defect-management, cuyo contenido pertenece al backend original.

El proxy de desarrollo y preview mantiene estas tres rutas, /static y /api/tickets en el servidor configurado por MES_API_TARGET. Esto permite que las pantallas originales conserven sus recursos, adjuntos, API y cookie de sesión en el mismo origen. La integración bajo un servidor de producción requiere esas rutas junto con el proxy /backend que ya utiliza el frontend.

## Presentación y reutilización

La portada utiliza los campos, botones, mensajes y diálogos compartidos. DisclosureMenu incorpora apertura por clic, cierre por Escape o al pulsar fuera y recuperación del foco. Se reutiliza para System Link y el menú de usuario.

System Link utiliza openOnHover y recupera el desplegable blanco con marcadores de lista. El menú de usuario conserva su cabecera verde, cuerpo oscuro, separadores e iconos de la referencia.

La barra de navegación permanece fija al alcanzar la cabecera durante el desplazamiento. ResizeObserver mide la altura real de la cabecera, incluyendo mensajes de acceso, y ajusta el espacio de la barra. En móvil la barra se fija al borde superior después de desplazar la cabecera.

Las tarjetas tienen fondo blanco y texto oscuro. La entrada del título, subtítulo y tarjetas reproduce la animación de desplazamiento y aparición del original. Los desplegables tienen una transición de apertura. Las animaciones respetan la preferencia de movimiento reducido.

Los estilos de la portada se limitan a landing-*. Las tarjetas forman tres columnas en escritorio, dos en pantallas intermedias y una en móvil. El portal tiene su propio desplazamiento vertical.

Los activos de public/brand provienen del MES original. La imagen ilsan-facility.png conserva el encuadre de la referencia y ilsan-logo.png sirve al portal y al favicon.

Las pruebas se encuentran en src/test/landing.test.tsx. Cubren las rutas públicas, login, acceso al MES, enlaces, edición del perfil, contraseñas, expiración, respuesta tardía y cierre de sesión. La revisión visual usa capturas en output/playwright/landing-*.
