# Planificación de producción

Cinco módulos en Control de producción → Control de plan de producción. Los descriptores de `module.ts` proporcionan rutas, alias originales y permisos exactos al registro y al sistema de pestañas.

- `OrdersPage.tsx`: composición común para Purchase Orders y Work Orders; `Page.tsx` y `WorkOrdersPage.tsx` son entradas de carga por ruta.
- `PivotPage.tsx`: Plan LG y Proyección P/S/I, con paginación remota de 500 partes y representación de filas visibles. `ProjectionPage.tsx` configura la segunda variante.
- Proyección usa `EditableCell` / `useCellEditor` compartidos para capturar inventario y schedule en la propia celda, con Enter/Tab/blur, Escape, validación, recuperación de errores y contexto de línea/turno visible; no abre un formulario modal por cantidad.
- `ProjectedPage.tsx`: lotes del día, generación, edición, capacidad, confirmación y cancelación.
- `ImportDialog.tsx`: revisión y confirmación de archivos LG, inventario, schedule y plan WO; visor Excel compartido.
- `ProposalDialog.tsx`: propuesta del servidor, selección/ajustes locales, diferencias, omisiones y capacidad, aplicación/rechazo por ID y versión.
- `api.ts`: único adaptador HTTP; `demo.ts` se importa solo en demostración. `model.ts` reúne esquemas, validaciones y utilidades del dominio; `components.tsx` compone formularios y reportes con UI compartida.

No se duplican controles nativos, tabla, paginación, login, transporte ni permisos. Las consultas usan `production-planning` y el ámbito de sesión; una escritura invalida las consultas del dominio y no se reintenta automáticamente.

[Contratos, funcionamiento y límites](../../../docs/PLAN_PRODUCCION.md). Las pruebas están junto al módulo. El demo simula datos y operaciones; no analiza los archivos con el parser Flask ni escribe en MySQL.
