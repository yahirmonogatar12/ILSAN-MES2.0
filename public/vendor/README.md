# Recursos de documentos opcionales

`pptx-preview.umd.js` es una copia sin cambios del visor ya incluido en `MESILSANLOCAL/app/static/js/lib/pptx-preview.umd.js`.

SHA-256: `98BCF8FBB5EFB42DFF406EEEA7E7B9D7497A388955582E5B1815489C63C75FE2`.

No pertenece al grafo inicial de JavaScript. `shared/ui/FilePreview` lo solicita desde el mismo origen únicamente al abrir un archivo PPTX. `shared/lib/loadScript` comparte la carga y permite reintentar si falla; no utiliza CDN. Su API se mantiene igual a la del módulo BOM original (`pptxPreview.init(...).preview(arrayBuffer)`).

Al actualizarlo, comprobar previsualización en escritorio/móvil, retirar referencias a versiones antiguas del despliegue y conservar los avisos de licencia incluidos por su proveedor. La copia original no declara una versión que permita identificarla aquí con certeza.

## SheetJS

`xlsx.full.min.js` es una copia sin cambios de `MESILSANLOCAL/app/static/js/lib/xlsx.full.min.js`, con los avisos originales. Versión declarada por su API: `0.18.5`; tamaño: 881,727 bytes. SHA-256: `C9506197CAF809A075B6DEE1DA0D36FB19DA7158FFE8A88E7B0C96C5D8623C99`.

`shared/lib/spreadsheet` la carga desde el mismo origen únicamente al exportar, generar una plantilla o abrir el visor de Excel. No se importa en el JavaScript inicial ni utiliza respaldo CDN. El visor representa valores como texto mediante los componentes comunes. Mantener las licencias y verificar lectura/exportación al actualizar esta dependencia opcional.
