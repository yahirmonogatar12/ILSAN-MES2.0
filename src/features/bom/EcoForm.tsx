import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@/shared/hooks/useForm";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  Alert,
  Button,
  DialogBody,
  FormActions,
  FormMessages,
  FormSection,
  Modal,
  SelectField,
  TextField,
  TextareaField,
} from "@/shared/ui";
import { normalizeDraft, validateEco } from "./model";
import type { BomApi, EcoDraft, EcoRow, Family } from "./types";

export function EcoForm({
  api,
  scope,
  model,
  models,
  demo,
  onClose,
  onCreated,
}: {
  api: BomApi;
  scope: string;
  model: string;
  models: string[];
  demo: boolean;
  onClose: () => void;
  onCreated: (eco: EcoRow) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [resolved, setResolved] = useState<{
    signature: string;
    data: Family;
  } | null>(null);
  const form = useForm<EcoDraft>({
    initialValues: {
      kind: "SINGLE",
      eco_no: `ECO-${new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 17)}`,
      part_no: model,
      family: "",
      suffixes: "",
      effective_at: new Date(
        Date.now() - new Date().getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16),
      item_name: "",
      notes: "",
    },
    validate: (values) =>
      validateEco(
        values,
        values.kind === "FAMILY" && resolved?.signature === signature(values)
          ? resolved.data.parts.map((part) => part.part_no)
          : [],
        file,
      ),
    onSubmit: async (values) => {
      const draft = normalizeDraft(values);
      const parts =
        draft.kind === "FAMILY" && resolved?.signature === signature(values)
          ? resolved.data.parts.map((part) => part.part_no)
          : [];
      const result = await api.importEco(draft, parts, file!);
      onCreated({
        id: result.eco_id,
        eco_no: draft.eco_no,
        part_no: draft.part_no || parts[0],
        bom_revision: result.bom_revision || "",
        effective_at: draft.effective_at,
        status: "DRAFT",
        origen: "MES",
      });
    },
  });
  function signature(draft: EcoDraft) {
    return `${draft.family.trim().toUpperCase()}|${draft.suffixes.trim()}`;
  }
  const draft = form.values;
  const resolution =
    resolved?.signature === signature(draft) ? resolved.data : null;
  const parts =
    draft.kind === "FAMILY"
      ? resolution?.parts.map((part) => part.part_no) || []
      : draft.part_no.trim()
        ? [draft.part_no.trim().toUpperCase()]
        : [];
  const revisionParts = useDebouncedValue(parts.join(",")).value;
  const revision = useQuery({
    queryKey: ["bom", scope, "next-revision", revisionParts],
    queryFn: ({ signal }) => api.nextRevision(revisionParts.split(","), signal),
    enabled: !!revisionParts,
  });
  const resolve = useMutation({
    mutationFn: async () => ({
      signature: signature(draft),
      data: await api.family(
        draft.family.trim().toUpperCase(),
        draft.suffixes.trim(),
      ),
    }),
    onSuccess: setResolved,
  });
  const download = useMutation({
    mutationFn: () => api.template(normalizeDraft(draft)),
  });
  return (
    <Modal
      title="Crear ECO"
      size="lg"
      className="bom-form"
      busy={form.pending || resolve.isPending || download.isPending}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset
          className="form-fieldset"
          disabled={form.pending || resolve.isPending || download.isPending}
        >
          <DialogBody>
            {demo && (
              <Alert tone="info">
                En demostración se simula la importación del Excel; los archivos
                no se envían al servidor.
              </Alert>
            )}
            <FormSection number="01" title="Alcance del cambio">
              <div className="form-grid">
                <SelectField
                  label="Tipo de ECO"
                  value={draft.kind}
                  options={[
                    { value: "SINGLE", label: "Un modelo" },
                    { value: "FAMILY", label: "Familia de modelos" },
                    { value: "NEW_BOM", label: "Nuevo BOM" },
                  ]}
                  onChange={(event) =>
                    form.setField(
                      "kind",
                      event.target.value as EcoDraft["kind"],
                    )
                  }
                />
                {draft.kind === "FAMILY" ? (
                  <>
                    <TextField
                      label="Familia"
                      value={draft.family}
                      onChange={(event) =>
                        form.setField("family", event.target.value)
                      }
                    />
                    <TextField
                      label="Sufijos / trabajo"
                      placeholder="01,02,03"
                      value={draft.suffixes}
                      onChange={(event) =>
                        form.setField("suffixes", event.target.value)
                      }
                    />
                    <Button
                      loading={resolve.isPending}
                      disabled={!draft.family.trim() || !draft.suffixes.trim()}
                      onClick={() => resolve.mutate()}
                    >
                      Resolver familia
                    </Button>
                  </>
                ) : (
                  <TextField
                    label="Modelo / número de parte"
                    required
                    suggestions={models}
                    initialFocus
                    value={draft.part_no}
                    onChange={(event) =>
                      form.setField("part_no", event.target.value)
                    }
                  />
                )}
              </div>
              {resolution && (
                <Alert tone={resolution.parts.length ? "info" : "warning"}>
                  Modelos resueltos:{" "}
                  {resolution.parts.map((part) => part.part_no).join(", ") ||
                    "ninguno"}
                  .
                  {resolution.missing.length > 0 &&
                    ` Sin coincidencia: ${resolution.missing.join(", ")}.`}
                </Alert>
              )}
              <div className="bom-inline-actions">
                <span>
                  Próxima revisión:{" "}
                  {revision.data || (revision.isFetching ? "calculando…" : "—")}
                </span>
                <Button
                  size="sm"
                  disabled={!parts.length}
                  loading={download.isPending}
                  onClick={() => download.mutate()}
                >
                  {demo
                    ? "Descargar ejemplo CSV"
                    : draft.kind === "NEW_BOM"
                      ? "Descargar plantilla"
                      : "Descargar BOM editable"}
                </Button>
              </div>
            </FormSection>
            <FormSection number="02" title="Datos del ECO y archivo">
              <div className="form-grid">
                <TextField
                  label="Número de ECO"
                  required
                  value={draft.eco_no}
                  onChange={(event) =>
                    form.setField("eco_no", event.target.value)
                  }
                />
                <TextField
                  label="Fecha efectiva"
                  type="datetime-local"
                  required
                  value={draft.effective_at}
                  onChange={(event) =>
                    form.setField("effective_at", event.target.value)
                  }
                />
                <TextField
                  label="Nombre del modelo"
                  value={draft.item_name}
                  onChange={(event) =>
                    form.setField("item_name", event.target.value)
                  }
                />
                <TextField
                  label="Excel modificado"
                  type="file"
                  required
                  accept=".xlsx,.xlsm"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <TextareaField
                  label="Notas"
                  rows={2}
                  containerClassName="span-2"
                  value={draft.notes}
                  onChange={(event) =>
                    form.setField("notes", event.target.value)
                  }
                />
              </div>
            </FormSection>
            <FormMessages
              errors={form.errors}
              error={
                form.error || resolve.error || download.error || revision.error
              }
            />
          </DialogBody>
          <FormActions
            pending={form.pending}
            onCancel={onClose}
            submitLabel="Validar Excel y crear borrador"
          />
        </fieldset>
      </form>
    </Modal>
  );
}
