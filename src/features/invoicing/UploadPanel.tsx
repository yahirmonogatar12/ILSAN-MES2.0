import { useState } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  Card,
  FormMessages,
  SelectField,
  TextField,
} from "@/shared/ui";
import { fileIssue } from "./model";
import { UploadDialog, type UploadProps } from "./UploadDialog";
import type { PurchaseMode } from "./types";

/** The capture stays beside the list; only the server preview/confirmation opens a dialog. */
type CaptureProps =
  | Omit<Extract<UploadProps, { kind: "invoice" }>, "onClose" | "prepared">
  | Omit<Extract<UploadProps, { kind: "purchase" }>, "onClose" | "prepared">;
export function UploadPanel(
  props: CaptureProps & {
    template?: React.ReactNode;
    disabled?: boolean;
  },
) {
  const [prepared, setPrepared] = useState<UploadProps["prepared"]>();
  const [fileVersion, setFileVersion] = useState(0);
  const form = useForm({
    initialValues: {
      file: null as File | null,
      number: "",
      type: props.kind === "purchase" ? "LG" : "",
      mode: "ACTUALIZACION" as PurchaseMode,
    },
    validate: (values) => {
      const issue = fileIssue(values.file);
      if (issue) return [issue];
      if (
        props.kind === "purchase" &&
        values.mode === "INICIAL" &&
        props.initial[values.type as "LG" | "OVEN"]
      )
        return [
          "Ya existe una carga inicial para este tipo. Usa Actualizar o Sincronizar.",
        ];
      return [];
    },
    onSubmit: async (values) => {
      if (props.disabled) return;
      if (props.kind === "invoice") {
        const upload = {
          file: values.file!,
          numero_invoice: values.number,
          tipo: values.type,
        };
        setPrepared({
          upload,
          preview: await props.api.preview(props.scope, upload),
        });
      } else {
        const upload = {
          file: values.file!,
          tipo: values.type as "LG" | "OVEN",
          modo: values.mode,
        };
        setPrepared({ upload, preview: await props.api.preview(upload) });
      }
    },
  });
  const busy = form.pending || !!prepared || props.disabled;
  return (
    <>
      <Card
        title={props.kind === "invoice" ? "Cargar invoice" : "Cargar lista"}
        className="invoicing-upload"
      >
        <form onSubmit={form.handleSubmit} className="invoicing-upload-form">
          {props.kind === "invoice" && (
            <TextField
              label="Número de invoice"
              maxLength={255}
              placeholder="Detectar desde Excel"
              value={form.values.number}
              disabled={busy}
              onChange={(event) => form.setField("number", event.target.value)}
            />
          )}
          {props.kind === "invoice" ? (
            <TextField
              label="Tipo"
              maxLength={255}
              value={form.values.type}
              disabled={busy}
              onChange={(event) => form.setField("type", event.target.value)}
            />
          ) : (
            <SelectField
              label="Tipo"
              value={form.values.type}
              disabled={busy}
              options={[
                { value: "LG", label: "LG" },
                { value: "OVEN", label: "OVEN" },
              ]}
              onChange={(event) => form.setField("type", event.target.value)}
            />
          )}
          <TextField
            key={fileVersion}
            label="Archivo Excel"
            type="file"
            accept=".xlsx,.xlsm,.xltx,.xltm"
            disabled={busy}
            onChange={(event) =>
              form.setField("file", event.target.files?.[0] ?? null)
            }
          />
          <div className="invoicing-toolbar">
            {props.kind === "invoice" ? (
              <>
                <Button
                  type="submit"
                  variant="primary"
                  loading={form.pending}
                  disabled={busy}
                >
                  Cargar
                </Button>
                {props.template}
              </>
            ) : (
              (
                [
                  ["INICIAL", "Carga inicial"],
                  ["ACTUALIZACION", "Actualizar"],
                  ["SINCRONIZACION", "Sincronizar"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  variant={mode === "INICIAL" ? "success" : "primary"}
                  disabled={
                    busy ||
                    (mode === "INICIAL" &&
                      props.initial[form.values.type as "LG" | "OVEN"])
                  }
                  onClick={() => void form.submit({ ...form.values, mode })}
                >
                  {label}
                </Button>
              ))
            )}
          </div>
          <FormMessages errors={form.errors} error={form.error} />
        </form>
      </Card>
      {prepared && (
        <UploadDialog
          {...(props as UploadProps)}
          prepared={prepared}
          onClose={() => setPrepared(undefined)}
          onLoaded={(result) => {
            setPrepared(undefined);
            form.setField("file", null);
            if (props.kind === "invoice") form.setField("number", "");
            setFileVersion((v) => v + 1);
            props.onLoaded(result);
          }}
        />
      )}
    </>
  );
}
