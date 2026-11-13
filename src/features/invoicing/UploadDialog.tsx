import { useMemo, useRef, useState } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  SelectField,
  TabBar,
  TextField,
} from "@/shared/ui";
import { LINES, PURCHASE_LINES, makeColumns, type ColumnSpec } from "./columns";
import { amount, fileIssue, object, rows, text } from "./model";
import { ResultNotice } from "./components";
import type {
  DataRow,
  InvoiceApi,
  InvoicePreview,
  InvoiceScope,
  InvoiceUpload,
  PurchaseApi,
  PurchaseMode,
  PurchasePreview,
  PurchaseUpload,
} from "./types";
export type UploadProps = {
  onClose: () => void;
  onLoaded: (result: DataRow) => void;
  prepared?: {
    upload: InvoiceUpload | PurchaseUpload;
    preview: InvoicePreview | PurchasePreview;
  };
} & (
  | { kind: "invoice"; scope: InvoiceScope; api: InvoiceApi }
  | {
      kind: "purchase";
      api: PurchaseApi;
      initial: { LG: boolean; OVEN: boolean };
    }
);
export function UploadDialog(props: UploadProps) {
  const [preview, setPreview] = useState<
    InvoicePreview | PurchasePreview | null
  >(props.prepared?.preview ?? null);
  const [tab, setTab] = useState("sample");
  const frozen = useRef<InvoiceUpload | PurchaseUpload | null>(
    props.prepared?.upload ?? null,
  );
  const form = useForm({
    initialValues: {
      file: null as File | null,
      number: "",
      type: props.kind === "purchase" ? "LG" : "",
      mode: "ACTUALIZACION" as PurchaseMode,
    },
    validate: (values) => {
      if (preview)
        return ("duplicado" in preview && preview.duplicado) ||
          ("bloqueado_inicial" in preview && preview.bloqueado_inicial)
          ? ["La carga está bloqueada; revisa los avisos."]
          : [];
      const issue = fileIssue(values.file);
      return issue
        ? [issue]
        : props.kind === "purchase" &&
            values.mode === "INICIAL" &&
            props.initial[values.type as "LG" | "OVEN"]
          ? [
              "Ya existe una carga inicial para este tipo. Usa Actualizar o Sincronizar.",
            ]
          : [];
    },
    onSubmit: async (values) => {
      if (preview) {
        if (!frozen.current) throw new Error("Selecciona de nuevo el archivo.");
        const result =
          props.kind === "invoice"
            ? await props.api.upload(
                props.scope,
                frozen.current as InvoiceUpload,
              )
            : await props.api.upload(frozen.current as PurchaseUpload);
        props.onLoaded(result);
        return;
      }
      const upload =
        props.kind === "invoice"
          ? {
              file: values.file!,
              numero_invoice: values.number,
              tipo: values.type,
            }
          : {
              file: values.file!,
              tipo: values.type as "LG" | "OVEN",
              modo: values.mode,
            };
      frozen.current = upload;
      const result =
        props.kind === "invoice"
          ? await props.api.preview(props.scope, upload as InvoiceUpload)
          : await props.api.preview(upload as PurchaseUpload);
      setPreview(result);
      setTab("sample");
    },
  });
  const invoice = props.kind === "invoice";
  const invoiceScope = props.kind === "invoice" ? props.scope : null;
  const sync =
    preview && "sync" in preview && object(preview.sync) ? preview.sync : null;
  const tables = useMemo(() => {
    const sample = preview
      ? invoice
        ? rows(preview.lines)
        : rows(preview.sample)
      : [];
    const specs: ColumnSpec[] = invoice
      ? [
          ...(invoiceScope === "ALMACEN"
            ? [["pallet_no", "PALLET", 70] as ColumnSpec]
            : []),
          ...LINES,
        ]
      : [
          ["numero_transaccion", "TRANSACCIÓN", 130],
          ...PURCHASE_LINES.filter((spec) =>
            [
              "numero_parte",
              "numero_parte_sistema",
              "descripcion",
              "cantidad",
              "costo_unitario",
              "costo_total",
              "fecha_compra",
            ].includes(spec[0]),
          ),
        ];
    const items = [
      { id: "sample", label: "Vista previa", records: sample, specs },
    ];
    if (sync)
      for (const [key, label] of [
        ["faltantes_muestra", "Eliminaciones previstas"],
        ["renombradas_muestra", "Cambios de transacción"],
        ["bloqueadas", "Con lotes"],
        ["protegidas", "Histórico conservado"],
        ["ambiguas", "Ambiguas"],
      ]) {
        if (Array.isArray(sync[key]) && sync[key].length) {
          const records = sync[key].map((value: unknown) =>
            object(value) ? value : { detalle: text(value) },
          );
          const fields = [
            ...new Set(records.flatMap((row: DataRow) => Object.keys(row))),
          ];
          items.push({
            id: key,
            label,
            records,
            specs: fields.map(
              (field) =>
                [
                  field,
                  (
                    {
                      numero_transaccion: "TRANSACCIÓN",
                      numero_parte: "PARTE",
                      anterior: "ANTERIOR",
                      nueva: "NUEVA",
                      detalle: "DETALLE",
                    } as Record<string, string>
                  )[field] || field.replaceAll("_", " ").toUpperCase(),
                  100,
                ] as ColumnSpec,
            ),
          });
        }
      }
    return items;
  }, [preview, invoice, sync, invoiceScope]);
  const active = tables.find((item) => item.id === tab) || tables[0];
  const columns = useMemo(() => makeColumns(active.specs), [active.specs]);
  const blocked =
    !!preview && (!!preview.duplicado || preview.bloqueado_inicial === true);
  return (
    <Modal
      title={
        preview
          ? invoice
            ? `Vista previa · ${text(preview.numero_invoice)}`
            : "Vista previa de compras"
          : invoice
            ? `Cargar invoice · ${props.scope === "ALMACEN" ? "Almacén" : "Embarques"}`
            : "Cargar lista de compras"
      }
      onClose={props.onClose}
      busy={form.pending}
      size={preview ? "xl" : "lg"}
      className={preview ? "invoicing-dialog" : "invoicing-form"}
    >
      <form
        onSubmit={form.handleSubmit}
        className={preview ? "invoicing-dialog-form" : undefined}
      >
        <DialogBody>
          {!preview ? (
            <div className="invoicing-fields">
              {invoice ? (
                <>
                  <TextField
                    label="Número de invoice"
                    placeholder="Detectar desde Excel"
                    maxLength={255}
                    value={form.values.number}
                    onChange={(event) =>
                      form.setField("number", event.target.value)
                    }
                  />
                  <TextField
                    label="Tipo"
                    hint="Debe coincidir con equivalentes."
                    maxLength={255}
                    value={form.values.type}
                    onChange={(event) =>
                      form.setField("type", event.target.value)
                    }
                  />
                </>
              ) : (
                <>
                  <SelectField
                    label="Tipo"
                    value={form.values.type}
                    options={[
                      { value: "LG", label: "LG" },
                      { value: "OVEN", label: "OVEN" },
                    ]}
                    onChange={(event) =>
                      form.setField("type", event.target.value)
                    }
                  />
                  <SelectField
                    label="Modo de carga"
                    value={form.values.mode}
                    options={[
                      {
                        value: "INICIAL",
                        label: "Inicial · histórico cerrado",
                        disabled:
                          props.initial[form.values.type as "LG" | "OVEN"],
                      },
                      {
                        value: "ACTUALIZACION",
                        label: "Actualizar · agregar renglones nuevos",
                      },
                      {
                        value: "SINCRONIZACION",
                        label: "Sincronizar con Excel",
                      },
                    ]}
                    onChange={(event) =>
                      form.setField("mode", event.target.value as PurchaseMode)
                    }
                  />
                  {form.values.mode === "SINCRONIZACION" && (
                    <Alert tone="warning">
                      La sincronización puede agregar, modificar, mover y
                      eliminar renglones de las transacciones incluidas en el
                      archivo. Revisa los cambios antes de confirmar.
                    </Alert>
                  )}
                </>
              )}
              <TextField
                label="Archivo Excel"
                type="file"
                accept=".xlsx,.xlsm,.xltx,.xltm"
                disabled={form.pending}
                onChange={(event) =>
                  form.setField("file", event.target.files?.[0] || null)
                }
              />
            </div>
          ) : (
            <>
              <ResultNotice result={preview} />
              {preview.warnings.map((warning, index) => (
                <Alert tone="warning" key={index}>
                  {warning}
                </Alert>
              ))}
              {blocked && (
                <Alert tone="warning">
                  {preview.duplicado
                    ? "La invoice o el archivo ya existen en este ámbito. No se puede confirmar otra carga."
                    : "Este tipo ya tiene una carga inicial. Usa Actualizar."}
                </Alert>
              )}
              {amount(preview.partes_sin_sistema) > 0 && (
                <Alert tone="warning">
                  Hay partes sin registro en el sistema; quedarán como
                  diferencias.
                </Alert>
              )}
              {sync && (
                <Alert tone="warning">
                  Se agregarán {amount(preview.lineas_nuevas)}, modificarán{" "}
                  {amount(sync.modificadas)}, eliminarán{" "}
                  {amount(sync.faltantes)} y moverán {amount(sync.renombradas)}{" "}
                  renglones. Se conservan{" "}
                  {Array.isArray(sync.protegidas) ? sync.protegidas.length : 0}{" "}
                  del histórico y{" "}
                  {Array.isArray(sync.bloqueadas) ? sync.bloqueadas.length : 0}{" "}
                  con lotes aplicados. Solo se comparan las transacciones del
                  archivo.
                </Alert>
              )}
              {!invoice && (
                <p className="invoicing-note">
                  La tabla muestra una muestra de hasta 50 renglones del
                  servidor; la carga procesa los totales indicados.
                </p>
              )}
              {tables.length > 1 && (
                <TabBar
                  id="purchase-preview"
                  label="Cambios de compras"
                  items={tables}
                  activeId={active.id}
                  onChange={setTab}
                />
              )}
              <DataGrid
                key={active.id}
                label="Renglones de vista previa"
                rows={active.records}
                columns={columns}
                rowKey={(_, index) => index}
                minWidth={1000}
                layout="fixed"
              />
            </>
          )}
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={props.onClose}>
            Cancelar
          </Button>
          {preview && (
            <Button
              disabled={form.pending}
              onClick={() => {
                if (props.prepared) {
                  props.onClose();
                  return;
                }
                setPreview(null);
                form.setField("file", null);
              }}
            >
              Cambiar archivo
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={form.pending}
            disabled={blocked}
          >
            {preview ? "Confirmar carga" : "Previsualizar"}
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
