# Integración con MESILSANLOCAL

El backend y las tablas no se modifican. El frontend usa las rutas actuales mediante el proxy `/backend` de Vite, conservando la cookie de sesión.

**Facturas** incorpora Invoice Almacén / Embarques, Valorización de inventario y Lista de compras. Los adaptadores consumen `/api/material_admin/invoices`, `/inventory/valuation` y `/compras` con los ámbitos, campos multipart y permisos originales. Previsualización y confirmación son pasos separados; no se reinterpretan archivos ni se recalcula inventario real en React. Ver [contratos y límites de Facturas](FACTURAS.md).

Los cuatro módulos administrativos de **Control de material** consumen `/api/material_admin/history/:tipo` y `/api/material_admin/inventory/*`, con paginación `limit`/`offset`, filtros remotos `cf_` y exportadores Excel existentes. No utilizan el inventario de embarques ni realizan movimientos de almacén. [Contrato completo](MOVIMIENTOS_MATERIAL.md).

Los contratos adicionales de **Control de modelos SMT, Control de modelos, Control de BOM y Control de FPA** están documentados en [Catálogos de producción](CATALOGOS_PRODUCCION.md), incluidos hashes de concurrencia, importación multipart, revisiones/ECO, permisos por acción y el proxy MES hacia MICOM. Permanecen bajo Información básica → Control de producción, igual que en el original.

| Método              | Ruta Flask                                                    | Uso                                                    |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| POST                | `/login`                                                      | Formulario `username/password`; respuesta AJAX JSON    |
| GET                 | `/logout`                                                     | Cierre de sesión y cookie                              |
| GET                 | `/api/mi-perfil`                                              | Perfil y rol                                           |
| POST                | `/verificar_permiso_dropdown`                                 | Permiso parametrizado por módulo                       |
| GET                 | `/obtener_permisos_usuario_actual`                            | Permisos compartidos para navegación, rutas y acciones |
| GET                 | `/api/informacion_basica/control_material/materiales`         | Listado con `q` y `clasificacion`                      |
| GET                 | `/api/informacion_basica/control_material/materiales/detalle` | Detalle por query param `numero_parte`                 |
| GET                 | `/api/informacion_basica/control_material/catalogos`          | Clasificaciones, propiedades, unidades y monedas       |
| POST / PUT / DELETE | `/api/informacion_basica/control_material/materiales`         | Alta, edición y baja lógica                            |
| GET                 | `/api/informacion_basica/control_material/costos/historial`   | Historial por material y vendedor opcional             |
| GET                 | `/api/informacion_basica/control_material/export`             | Excel filtrado generado por Flask                      |
| GET                 | `/api/admin-usuarios-depto/contexto`                          | Alcance, departamentos, roles asignables y cargos      |
| GET                 | `/api/admin-usuarios-depto/usuarios`                          | Array completo de usuarios del alcance                 |
| POST                | `/api/admin-usuarios-depto/guardar_usuario`                   | Crear/editar por username; roles y estado              |
| GET                 | `/api/gestion-roles-depto/contexto`                           | Alcance de autoridad                                   |
| GET                 | `/api/gestion-roles-depto/roles`                              | Roles activos editables, sin admin/superadmin          |
| POST                | `/api/gestion-roles-depto/guardar-rol`                        | Crear/editar rol, departamento y descripción           |
| GET                 | `/api/gestion-roles-depto/permisos-disponibles`               | Catálogo página/sección/opciones del alcance           |
| GET                 | `/api/gestion-roles-depto/permisos-rol/:id`                   | IDs asignados al rol                                   |
| POST                | `/api/gestion-roles-depto/guardar-permisos`                   | Reemplazo de permisos dentro del alcance               |

Administración permanece en Información básica. Sus dos permisos son `LISTA_INFORMACIONBASICA → Administración de usuario → Administración de usuario/Administración de autoridad`. No usa las rutas del panel superadmin. Las lecturas de contexto/listas reciben `AbortSignal`; las mutaciones no se reintentan. La API reemplaza todos los roles de un usuario, pero para permisos de un rol delegado conserva las asignaciones de otras áreas. Detalles en [Administración](../src/features/administration/README.md).

El permiso de Materiales permanece en `features/materials/config.ts`: `LISTA_INFORMACIONBASICA → Control de material → Control de material`.

La ubicación del frontend es **Control de material**, con ruta `/material/materiales`. La dirección anterior `/informacion-basica/materiales` redirige a ella. Esta organización del menú no cambia el contrato de API ni el permiso existente en Flask.

El listado y Excel actuales tienen un límite de 2,000 materiales. El frontend lo advierte; su paginación local no permite consultar filas fuera de ese límite. Los indicadores de página usan la consulta recibida, sin inventar el total de toda la base.

Se conserva la semántica del módulo: número de parte inmutable al editar; caracteres del código preservados; costo vacío por vendedor equivale a cero; USD/MXN/KRW, cuatro decimales y longitud conjunta de vendedores; baja lógica y conservación de históricos en el servidor.

El modo demostración utiliza su adaptador local y exporta CSV identificado como demostración. El modo real utiliza el Excel del servidor con los filtros completos, independientemente de la página visible.

`npm run dev` y `npm run preview` incluyen el proxy local. Para producción, servir `dist/`, hacer fallback de rutas React a `index.html` y configurar `/backend` hacia Flask en el mismo origen. Si la cookie del servidor exige HTTPS, el acceso del frontend también debe usar HTTPS. No copiar credenciales MySQL ni `SECRET_KEY` al frontend.
