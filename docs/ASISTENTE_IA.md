# Asistente de IA

El icono flotante utiliza el robot original de ILSAN. Aparece en el espacio de trabajo autenticado cuando la sesión tiene permiso para usar el asistente. El panel se carga con `React.lazy` al abrirlo por primera vez.

## Distribución del código

- `app/assistant/AssistantLauncher.tsx` controla el acceso y la carga diferida.
- `app/assistant/AssistantWorkspace.tsx` compone el panel, historial y pestañas administrativas.
- `app/assistant/useAssistantSession.ts` coordina conversaciones, adjuntos y preferencias.
- `app/assistant/useChatStream.ts` procesa la respuesta activa, sus reintentos y su cancelación.
- `core/assistant/` contiene contratos tipados, adaptador HTTP, decodificadores y demostración.
- `shared/lib/serverEvents.ts` decodifica SSE incremental.
- `shared/ui/RichText.tsx` presenta texto Markdown con las tablas compartidas y enlaces HTTP o HTTPS.

La interfaz compone los botones, campos, diálogos, tablas, gráficos y visores compartidos. La integración utiliza el transporte de `core/http.ts`, las cookies de sesión y el tratamiento común de expiración.

## Acceso

Las reglas pertenecen a la página `MAIN_TEMPLATE`, sección `Asistente IA`.

| Acción                                     | Permiso                   |
| ------------------------------------------ | ------------------------- |
| Mostrar y usar el chat                     | Usar asistente IA         |
| Regenerar archivos                         | Generar archivos IA       |
| Consultar conversaciones de otros usuarios | Auditar conversaciones IA |
| Editar límites por usuario o rol           | Administrar cuotas IA     |

Las acciones administrativas requieren tanto el permiso actual como la capacidad comunicada por `/api/ai/bootstrap`. El backend autoriza cada operación. El catálogo compartido de permisos conserva su actualización periódica.

La revocación del acceso desmonta el panel, aborta la respuesta activa y elimina sus consultas. Las claves privadas incluyen el modo y el usuario de `useAuth().scope`. Las preferencias locales guardan idioma y tamaño del panel. Los mensajes se conservan en el backend.

## Contrato del backend existente

| Operación                      | Método y ruta                                                     |
| ------------------------------ | ----------------------------------------------------------------- |
| Capacidades, modelo y consumo  | GET `/api/ai/bootstrap`                                           |
| Historial y creación           | GET / POST `/api/ai/conversations`                                |
| Archivar, idioma y eliminación | PATCH / DELETE `/api/ai/conversations/{id}`                       |
| Mensajes anteriores            | GET `/api/ai/conversations/{id}/messages?limit=100&before_id=...` |
| Archivos de la conversación    | GET `/api/ai/conversations/{id}/artifacts`                        |
| Adjuntar                       | POST `/api/ai/conversations/{id}/upload`                          |
| Respuesta SSE                  | POST `/api/ai/conversations/{id}/messages/stream`                 |
| Descargar o visualizar         | GET `/api/ai/artifacts/{id}/download`                             |
| Regenerar                      | POST `/api/ai/artifacts/{id}/regenerate`                          |
| Auditoría                      | GET `/api/ai/audit/conversations`                                 |
| Mensajes auditados             | GET `/api/ai/audit/conversations/{id}/messages`                   |
| Cuotas                         | GET / PATCH `/api/ai/audit/limits`                                |

El proxy existente antepone `/backend`. La configuración del proveedor y la clave de IA permanecen en el servidor. El aviso de configuración se muestra cuando el backend informa `configured: false`.

Cada envío comunica contenido, UUID de cliente, idioma, adjuntos y contexto de la pestaña activa. Los archivos se envían como multipart y conservan el identificador que devuelve el servidor. Se aceptan los mismos formatos del original, hasta 100 adjuntos de 20 MB cada uno.

El contexto de la pestaña proviene de `useActiveModule`, publicado por el workspace desde sus descriptores. Conserva el título y el ID del módulo aunque cambien las etiquetas o atributos del HTML. La ruta proviene del router.

Los decodificadores rechazan cuotas, consumo, tamaños e identificadores inválidos con un error explícito. Admiten enteros representados como texto, conservan cero como cuota válida y permiten valores nulos para heredar límites. Los mensajes e identificadores de cuotas requieren un entero positivo. Los metadatos numéricos históricos ausentes conservan sus valores predeterminados.

## Respuestas y recuperación

Se procesan confirmaciones, texto incremental, avances de herramientas, archivos, visualizaciones, consumo diario, errores y finalización. El lector soporta UTF-8 dividido entre paquetes, delimitadores CRLF, comentarios y datos multilínea.

Un envío activo bloquea el siguiente. El cierre del panel conserva la respuesta en curso. Detener, cerrar la sesión o revocar el permiso aborta la conexión.

Un reintento manual consulta primero la conversación para recuperar la respuesta original. Si recibió ACK, utiliza el identificador exacto de la respuesta y consulta su página de historial cuando quedó fuera de los últimos 100 mensajes. Conserva el texto parcial mientras el servidor sigue procesando y permite volver a consultar su estado.

Una respuesta completada se recupera desde el historial. Si el servidor confirma que la respuesta identificada por ACK terminó en `failed`, `cancelled` o `interrupted`, el reintento explícito inicia otro envío con UUID nuevo. Mientras el estado original sea incierto se conserva su identidad. Cuando el servidor todavía no recibió el mensaje, se vuelve a enviar el UUID original y un 409 recupera el historial. Los adjuntos y el contexto permanecen asociados al intento. Un error al recuperar el historial permite reintentar la lectura.

`chatRecovery.ts` concentra la identificación de la respuesta y la recuperación de su página. El bloqueo de operaciones también cubre esta consulta, que se cancela al desmontar la sesión.

Los archivos generados usan rutas construidas desde su identificador. Excel y CSV reutilizan `SpreadsheetPreview`, las imágenes utilizan `ImageViewer` y los demás documentos utilizan `FilePreview`. La descarga se cancela al abandonar su vista y descarta respuestas tardías.

Los indicadores de avance por área y calidad utilizan los gráficos y barras compartidos. El texto del asistente se renderiza como contenido de React. Las tablas Markdown reutilizan `DataTable`.

## Demostración y alcance

El modo demostración utiliza conversaciones en memoria separadas por sesión y muestra explícitamente que las respuestas son de ejemplo. El modo real consume las APIs de IA existentes.

Las propuestas generadas pueden descargarse como archivos. El editor avanzado del original para modificar y aplicar una propuesta de planificación sigue pendiente de migración.

## Comprobaciones

Las pruebas cubren permisos, carga diferida, envío, adjuntos, historial, confirmación de eliminación, cuotas nulas o cero, cancelación, reintentos, reconciliación 409, aislamiento de sesión y archivos privados. Las pruebas del lector cubren fragmentación y abortos, y las de texto comprueban el escape de HTML.

La revisión de navegador utiliza respuestas HTTP controladas. La comprobación de respuestas con el proveedor real requiere una sesión autorizada y el servicio de IA configurado.
