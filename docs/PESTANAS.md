# Pestañas del workspace

La barra global permite mantener abiertos varios módulos de distintas secciones. Abrir uno existente lo selecciona sin duplicarlo. Cada pestaña tiene cierre propio; cerrar la activa selecciona una vecina, y cerrar la última deja `/mes/inicio` vacío hasta elegir otro módulo. `/inicio` corresponde al portal corporativo.

## Responsabilidades

| Archivo                             | Función                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `shared/ui/TabBar.tsx`, `tabs.css`  | Presentación controlada y teclado; no conocen módulos, rutas ni usuarios                 |
| `app/workspace/tabs.ts`             | Validación de preferencias y operaciones puras sobre IDs                                 |
| `app/workspace/useWorkspaceTabs.ts` | Sincronización con la URL, historial, apertura/cierre y preferencias por sesión          |
| `app/workspace/Workspace.tsx`       | Paneles independientes con permisos, carga diferida, suspensión y aislamiento de errores |
| `app/layout/Shell.tsx`              | Composición de navegación y barra global; selección de sección en el menú móvil          |

Los módulos se registran una sola vez en `app/registry.ts`; el workspace recibe sus descriptores y no importa implementaciones de negocios. No requieren cambios para admitir pestañas.

## Estado y rendimiento

Las preferencias se filtran por módulos autorizados antes de restaurar pestañas. Una revocación retira la pestaña, desmonta su contenido y elimina su ID guardado; concederla de nuevo inicia una captura nueva. La navegación usa la misma consulta de permisos que las rutas y las acciones. Ver [permisos](PERMISOS.md).

- Solo se carga el código de las pantallas visitadas. Al recargar, se restauran los nombres de pestañas, y sus pantallas permanecen sin montar hasta seleccionarlas.
- Una pestaña visitada utiliza `Activity` de React: al ocultarse conserva estado y DOM, y desconecta sus efectos. Al volver conserva captura, filtros, orden, tamaño/página y desplazamiento de la tabla.
- `ModuleAccess` permanece fuera de `Activity`, para que una invalidación de permisos también pueda retirar el contenido de un módulo oculto. Las API conservan su propia autorización.
- Cerrar una pestaña desmonta su contenido y descarta su captura local. La caché de consultas sigue las reglas comunes de TanStack Query; cerrar una pestaña no borra arbitrariamente datos que puedan compartirse.
- Un error se recupera dentro de su panel; no exige recargar las demás pestañas.
- `ResizeObserver` mantiene visible la pestaña seleccionada al cambiar el ancho del contenedor, incluyendo el plegado de la barra lateral. No se utiliza sondeo.

Se guarda `mes-v2:tabs:<scope>` con `{ ids, activeId }`. Se validan IDs contra los módulos disponibles, quitando duplicados y referencias desconocidas. No se almacenan registros, valores de formularios, contraseñas ni indicadores de pantallas montadas. Recargar conserva la lista de módulos, no la captura pendiente. El workspace se identifica por usuario/modo; cambiar de sesión desmonta los paneles anteriores.

## Teclado y móvil

La barra usa `tablist`, `tab`, `tabpanel`, selección y referencias accesibles. Flechas cambian entre pestañas; Inicio/Fin seleccionan los extremos; Suprimir cierra la seleccionada. El botón de cierre es un control separado, sin botones anidados. El título completo permanece en el tooltip aunque el texto visible se recorte.

`app/layout/KeyboardShortcuts.tsx` agrega atajos globales: Alt+1 secciones, Alt+2 lista de módulos, Alt+3 pestañas abiertas, Alt+4 primer campo del panel activo (fuera de tablas) y Alt+5 tabla del panel activo. `?` fuera de un campo de texto abre la ayuda con todos los atajos. Se ignoran con un diálogo abierto y con AltGr, que llega como Ctrl+Alt y escribe caracteres como @ o #. Con la vista dividida se usa el panel que tiene el foco.

En la barra de secciones, ←/→ cambian de sección y muestran su lista en el menú lateral; ↓ entra a esa lista. En el menú lateral y en el menú compacto, ↑/↓ recorren grupos y módulos, y Enter abre el módulo. `app/layout/keyboard.ts` localiza cada destino con las clases del layout; si cambian esas clases, actualizar sus selectores. Los anillos de foco de la barra y del menú se dibujan hacia dentro porque ambos recortan su desbordamiento.

La barra se desplaza horizontalmente cuando falta ancho. El documento conserva su tamaño y la tabla su scroll interno. En móvil, el selector **Sección** del menú permite abrir módulos de otras secciones aunque los botones grandes de la cabecera estén ocultos.

## Módulo en ventana propia

Una pestaña se abre en su propia ventana del navegador de dos formas: arrastrándola fuera de la barra de pestañas o con el botón **Abrir en ventana** junto a **Dividir**. La ventana carga la ruta del módulo con `?ventana` y `App` presenta solo `ModuleWindow`, sin cabecera, menús, pestañas, atajos ni asistente. Usa la misma sesión, el mismo modo y los mismos permisos (`ModuleAccess`), y el título de la ventana es el del módulo.

`Workspace.popOut` abre `window.open(ruta?ventana, "mes-<id>", "popup,…")` en el punto donde se soltó la pestaña y cierra la pestaña en el workspace. El nombre de la ventana hace que volver a sacar el mismo módulo reutilice su ventana. Si el navegador bloquea la ventana emergente, la pestaña se conserva y un aviso pide permitir las ventanas emergentes del sitio.

La ventana empieza con el módulo recién cargado: no hereda capturas, filtros ni páginas de la pestaña. Al cerrar la ventana el módulo regresa al MES como pestaña activa (también recién cargado): `popOut` revisa `window.closed` cada medio segundo. Si la página principal se recargó mientras la ventana seguía abierta, ese seguimiento se pierde y la ventana solo se cierra; el módulo se vuelve a abrir desde el menú.

## Al ampliar módulos

Los efectos deben devolver limpieza para temporizadores, eventos, conexiones u overlays. Al reanudar `Activity`, React reconecta los efectos: un efecto que reinicia captura o paginación debe comprobar que su criterio realmente cambió. `useClientTable` compara `resetKey` antes de volver a la primera página; una simple reactivación no debe reiniciarla.

Usar los diálogos compartidos: su limpieza retira el diálogo nativo y libera el scroll al ocultar el panel. Al regresar, el formulario conserva su captura en memoria. Los accesos por URL, alias y atrás/adelante del navegador pasan por el mismo controlador.

`src/test/workspace.test.tsx` comprueba conservación de estado/DOM/paginación, pausa de efectos, cierre y reapertura, restauración sin precargas, teclado, historial, alias y aislamiento de sesión. La revisión en navegador cubre además desplazamiento real, diálogos nativos y tamaños de escritorio/móvil.
