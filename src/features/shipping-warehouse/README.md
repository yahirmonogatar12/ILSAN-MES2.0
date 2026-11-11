# Almacén de Embarques

El grupo **Almacén de Embarques** se registra en **Control de proceso** mediante siete descriptores en `module.ts`. Cada ruta utiliza el permiso de su botón en `LISTA_CONTROL_DE_PROCESO / Almacén de Embarques`. Las pantallas se cargan bajo demanda y conservan la navegación por pestañas del MES.

| Ruta bajo `/proceso/embarques` | Operaciones                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `/entradas`                    | Historial, detalle por caja, ajustes manuales y por archivo, recepción de invoices                   |
| `/salidas`                     | Historial, detalle por caja, ajustes y asignación total o parcial de departure                       |
| `/retorno`                     | Entradas y salidas de retorno, captura de Exceso u OS&D, selección y generación de PDF de salidas    |
| `/movimientos`                 | Edición en fila, revisión de diferencias, motivo, eliminación con contraseña e historial de cambios  |
| `/inventario`                  | Existencias por parte, comparación del CSV físico, cierre e historial con recuperación de borradores |
| `/catalogo`                    | Alta, edición y baja de partes con las restricciones de inventario y movimientos del servidor        |
| `/pendientes-qa`               | Pendientes de entrada y liberación, detalle por caja y exportación de ese detalle                    |

## Integración

- `api.ts` usa el transporte autenticado común y conserva los contratos de Flask bajo `/api/almacen-embarques`. La captura de retornos usa `/api/shipping/material/returns`. Las exportaciones consultan al servidor con los filtros generales vigentes.
- Confirmar un invoice requiere el permiso **Invoice Embarques** de **Control de material**. La recepción envía todas sus partes y sus identificadores de packing en una sola solicitud. La cantidad se puede confirmar completa o capturar explícitamente, incluido cero.
- Los ajustes por CSV o Excel y el cierre por CSV validan el archivo antes de confirmar. Se envía el identificador del borrador devuelto por el servidor. El historial de cierres permite recuperar el borrador disponible de la sesión. Flask aplica las reglas de existencias, auditoría y períodos.
- `components.tsx` reúne filtros, consultas con alcance de sesión, columnas y formularios del grupo sobre los componentes compartidos. `HistoryPage.tsx` compone entradas y salidas. Retornos y QA muestran los dos listados en escritorio y usan pestañas en espacios reducidos. Las tablas parten de 500 filas por página dentro del límite de cada consulta del servidor.

## Verificación local

`npm run check` ejecuta las pruebas de contrato y permisos junto con las del resto del frontend. `npm run build` genera el frontend de producción. El modo demo usa datos temporales en memoria y permite probar los flujos sin conectar con Flask.
