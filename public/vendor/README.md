# Recursos de documentos opcionales

`pptx-preview.umd.js` es una copia sin cambios del visor ya incluido en `MESILSANLOCAL/app/static/js/lib/pptx-preview.umd.js`.

SHA-256: `98BCF8FBB5EFB42DFF406EEEA7E7B9D7497A388955582E5B1815489C63C75FE2`.

No pertenece al grafo inicial de JavaScript. `shared/ui/FilePreview` lo solicita desde el mismo origen únicamente al abrir un archivo PPTX. `shared/lib/loadScript` comparte la carga y permite reintentar si falla; no utiliza CDN. Su API se mantiene igual a la del módulo BOM original (`pptxPreview.init(...).preview(arrayBuffer)`).

Al actualizarlo, comprobar previsualización en escritorio/móvil, retirar referencias a versiones antiguas del despliegue y conservar los avisos de licencia incluidos por su proveedor. La copia original no declara una versión que permita identificarla aquí con certeza.

## SheetJS

`xlsx-0.20.3.full.min.js` es la distribución completa de SheetJS CE 0.20.3, descargada sin modificaciones de su proveedor. Conserva los avisos de licencia y copyright incluidos en el archivo. [Distribución oficial](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js), [instrucciones de instalación](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).

El archivo ocupa 951,904 bytes y su SHA-256 es `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`. La prueba del motor comprueba su versión, hash y aviso de licencia, y recorre lectura y escritura de XLSX, XLS, XLSB, ODS y lectura de CSV.

La regla del archivo en `.gitattributes` conserva sus bytes al hacer checkout en Windows. Una actualización del recurso requiere actualizar la URL local, la versión esperada, el hash de la prueba y esa regla.

Esta versión incluye las correcciones de prototype pollution y ReDoS indicadas por el proveedor. [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363).

`shared/lib/spreadsheet` la carga desde el mismo origen al exportar, generar una plantilla o abrir el visor. La URL incluye la versión y el adaptador comprueba la versión cargada. El recurso se sirve localmente y se carga bajo demanda.

El visor valida el tamaño del Blob antes de cargar el motor o solicitar su ArrayBuffer. El máximo es 20 MiB y se muestra como 20 MB en la interfaz. El lector mantiene `cellHTML` y `cellFormula` desactivados y conserva estilos, dimensiones, hojas y combinaciones. El límite visual de 100 columnas y 100,000 celdas se aplica al renderizado. El límite de entrada mide el archivo comprimido y no representa un presupuesto de memoria descomprimida.
