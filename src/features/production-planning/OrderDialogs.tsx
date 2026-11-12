import { FormDialog } from "./components";
import { ImportDialog } from "./ImportDialog";
import { text, today, WO_STATES } from "./model";
import { actionPayloads } from "./requests";
import type { Action, Field, Row } from "./types";
import type { OrdersController } from "./useOrders";
export function OrderDialogs({ state }: { state: OrdersController }) {
  const { kind, auth, dialog, setDialog, selected, models, done, canCreateWO } =
    state;
  const row = dialog && "row" in dialog ? dialog.row : undefined;
  let formFields: Field[] = [],
    values: Row = {},
    operation: Action = "create-wo",
    title = "";
  if (dialog?.type === "new" && kind === "po") {
    title = "Registrar Purchase Order";
    operation = "create-po";
    values = {
      nombre_po: "",
      fecha_registro: today(),
      modelo: "",
      cliente: "LG_REFRIS",
      proveedor: "",
      total_cantidad_entregada: "",
      cantidad_entregada: "0",
      fecha_entrega: "",
      codigo_entrega: "",
      estado: "PLAN",
    };
    formFields = [
      { key: "nombre_po", label: "Nombre de PO", required: true },
      {
        key: "fecha_registro",
        label: "Fecha de registro",
        type: "date",
        required: true,
      },
      {
        key: "modelo",
        label: "Modelo",
        required: true,
        suggestions: models.data,
      },
      {
        key: "cliente",
        label: "Cliente",
        required: true,
        type: "select",
        options: [
          { value: "LG_REFRIS", label: "LG_REFRIS" },
          { value: "LG_ESTUFAS", label: "LG_ESTUFAS" },
        ],
      },
      { key: "proveedor", label: "Proveedor" },
      {
        key: "total_cantidad_entregada",
        label: "Cantidad planeada",
        type: "number",
        min: 0,
        step: 1,
        required: true,
      },
      {
        key: "cantidad_entregada",
        label: "Cantidad entregada",
        type: "number",
        min: 0,
        step: 1,
      },
      { key: "fecha_entrega", label: "Fecha de entrega", type: "date" },
      { key: "codigo_entrega", label: "Código de entrega" },
    ];
  } else if (dialog && ["new", "linked-wo", "edit"].includes(dialog.type)) {
    const editing = dialog.type === "edit";
    title = editing
      ? `Editar WO · ${text(row?.codigo_wo)}`
      : dialog.type === "linked-wo"
        ? `Crear WO vinculada a ${text(row?.codigo_po)}`
        : "Registrar Work Order";
    operation = editing ? "update-wo" : "create-wo";
    values = {
      codigo_wo: text(row?.codigo_wo),
      modelo: text(row?.codigo_modelo ?? row?.modelo),
      codigo_po: text(row?.codigo_po),
      cantidad_planeada: text(
        row?.cantidad_planeada ?? row?.total_cantidad_entregada,
      ),
      fecha_operacion: today(),
      usuario_creador: auth.profile?.username ?? "",
    };
    formFields = [
      ...(editing
        ? [{ key: "codigo_wo", label: "Código WO", readOnly: true }]
        : []),
      {
        key: "modelo",
        label: "Modelo",
        required: true,
        suggestions: models.data,
      },
      {
        key: "cantidad_planeada",
        label: "Cantidad planeada",
        type: "number",
        required: true,
        min: 1,
        step: 1,
      },
      { key: "codigo_po", label: "Código PO" },
      ...(!editing
        ? [
            {
              key: "fecha_operacion",
              label: "Fecha de operación",
              type: "date" as const,
              required: true,
            },
          ]
        : []),
    ];
  } else if (dialog?.type === "state") {
    title = `Cambiar estado · ${text(row?.codigo_wo)}`;
    operation = "state-wo";
    values = {
      codigo_wo: row?.codigo_wo,
      estado: row?.estado,
      modificador: auth.profile?.username,
    };
    formFields = [
      {
        key: "estado",
        label: "Estado",
        type: "select",
        options: WO_STATES.map((value) => ({ value, label: value })),
      },
    ];
  } else if (dialog?.type === "remove") {
    title = `Eliminar WO · ${text(row?.codigo_wo)}`;
    operation = "delete-wo";
    values = { codigo_wo: row?.codigo_wo };
  } else if (dialog?.type === "bulk") {
    title = "Crear plan con WO seleccionadas";
    operation = "import-wos";
    values = { import_date: today(), wo_ids: [...selected] };
    formFields = [
      {
        key: "import_date",
        label: "Fecha de operación",
        type: "date",
        required: true,
      },
    ];
  }
  return (
    <>
      {dialog &&
        dialog.type !== "import" &&
        (dialog.type !== "linked-wo" ||
          (canCreateWO.data && !canCreateWO.isError)) && (
          <FormDialog
            title={title}
            description={
              dialog.type === "remove"
                ? "Se eliminará esta WO. Solo se permite eliminar órdenes en estado CREADA."
                : dialog.type === "bulk"
                  ? `Se generarán lotes para ${selected.size} órdenes. Los duplicados y errores se mostrarán en el resultado.`
                  : undefined
            }
            fields={formFields}
            initial={values}
            label={
              dialog.type === "remove"
                ? "Eliminar WO"
                : dialog.type === "bulk"
                  ? "Confirmar creación de plan"
                  : "Guardar"
            }
            onClose={() => setDialog(null)}
            onDone={done}
            onSubmit={(data) =>
              auth.api.action(operation, actionPayloads[operation](data))
            }
          />
        )}
      {dialog?.type === "import" && (
        <ImportDialog
          kind="wo-excel"
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
    </>
  );
}
