import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  CheckboxField,
  DataTable,
  DialogBody,
  DialogFooter,
  FormMessages,
  FormSection,
  IconButton,
  Modal,
  SelectField,
  TextField,
  TextareaField,
  type TableColumn,
} from "@/shared/ui";
import {
  emptyDraft,
  normalizePart,
  ORIGINS,
  plannedAreas,
  programmingGroups,
  requestPayload,
  validPart,
  validateRequest,
} from "./model";
import type {
  ComponentDraft,
  ComponentType,
  RequestDraft,
  ReworkApi,
  ReworkDetail,
} from "./types";
export function RequestForm({
  api,
  scope,
  onClose,
  onCreated,
}: {
  api: ReworkApi;
  scope: string;
  onClose: () => void;
  onCreated: (record: ReworkDetail) => void;
}) {
  const attempts = useRef(new Map<string, string>());
  const form: ReturnType<typeof useForm<RequestDraft>> = useForm<RequestDraft>({
    initialValues: emptyDraft(),
    validate: (values): string[] =>
      validateRequest(
        values,
        programming.isSuccess &&
          !programming.isFetching &&
          !programming.isError,
      ),
    onSubmit: async (values) => {
      const payload = requestPayload(values),
        signature = JSON.stringify(payload);
      let key = attempts.current.get(signature);
      if (!key) {
        key = crypto.randomUUID();
        attempts.current.set(signature, key);
      }
      onCreated(await api.create(payload, key));
    },
  });
  const part = normalizePart(form.values.np_destino);
  const models = useQuery({
    queryKey: ["rework", scope, "models"],
    queryFn: ({ signal }) => api.models(signal),
  });
  const programming = useQuery({
    queryKey: ["rework", scope, "programming", part],
    queryFn: ({ signal }) => api.programming(part, signal),
    enabled: form.values.programmingEnabled && validPart(part),
  });
  const groups = useMemo(
    () => programmingGroups(programming.data ?? []),
    [programming.data],
  );
  const enabled = form.values.programmingEnabled;
  useEffect(() => {
    if (
      !enabled ||
      !programming.isSuccess ||
      programming.isFetching ||
      form.values.programmingPart === part
    )
      return;
    form.setValues((previous) =>
      !previous.programmingEnabled ||
      normalizePart(previous.np_destino) !== part
        ? previous
        : {
            ...previous,
            programmingPart: part,
            programaciones: groups.map((group) => ({
              ic_location: group.location,
              programming_label: group.options[0].programming_label,
            })),
          },
    );
  }, [
    enabled,
    part,
    programming.isSuccess,
    programming.isFetching,
    groups,
    form.values.programmingPart,
    form.setValues,
  ]);
  const updateComponent = (
    key: string,
    field: keyof ComponentDraft,
    value: string,
  ) =>
    form.setField(
      "componentes",
      form.values.componentes.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    );
  const componentIndex = (row: ComponentDraft) =>
    form.values.componentes.findIndex((item) => item.key === row.key) + 1;
  const componentColumns: TableColumn<ComponentDraft>[] = [
    {
      id: "tipo",
      header: "TIPO",
      width: "15%",
      cell: (row) => (
        <SelectField
          aria-label={`Tipo del componente ${componentIndex(row)}`}
          disabled={form.pending}
          value={row.tipo}
          options={["ASSY", "SMD", "IMD"].map((value) => ({
            value,
            label: value,
          }))}
          onChange={(event) =>
            updateComponent(
              row.key,
              "tipo",
              event.target.value as ComponentType,
            )
          }
        />
      ),
    },
    ...(
      [
        ["ubicacion", "UBICACIÓN", 100],
        ["np_anterior", "NP ANTERIOR", 64],
        ["np_nuevo", "NP NUEVO", 64],
      ] as const
    ).map(([field, header, maxLength]) => ({
      id: field,
      header,
      width: "25%",
      cell: (row: ComponentDraft) => (
        <TextField
          aria-label={`${header} del componente ${componentIndex(row)}`}
          disabled={form.pending}
          maxLength={maxLength}
          value={row[field]}
          onChange={(event) =>
            updateComponent(row.key, field, event.target.value.toUpperCase())
          }
        />
      ),
    })),
    {
      id: "remove",
      header: "QUITAR",
      width: "10%",
      cell: (row) => (
        <IconButton
          label={`Quitar componente ${row.ubicacion || "sin ubicación"}`}
          tone="danger"
          disabled={form.pending}
          icon={<Trash2 size={15} />}
          onClick={() =>
            form.setField(
              "componentes",
              form.values.componentes.filter((item) => item.key !== row.key),
            )
          }
        />
      ),
    },
  ];
  const payload = requestPayload(form.values),
    previewAreas = plannedAreas(payload);
  function selectProgramming(location: string, label: string | null) {
    form.setField(
      "programaciones",
      [
        ...form.values.programaciones.filter(
          (item) => item.ic_location !== location,
        ),
        ...(label ? [{ ic_location: location, programming_label: label }] : []),
      ].sort((a, b) => a.ic_location.localeCompare(b.ic_location)),
    );
  }
  return (
    <Modal
      title="Nueva solicitud de retrabajo"
      size="lg"
      className="rework-form"
      busy={form.pending}
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <FormSection title="Material a retrabajar">
            <div className="rework-form-grid">
              <TextField
                label="NP origen"
                required
                initialFocus
                maxLength={11}
                value={form.values.np_origen}
                suggestions={models.data?.filter(validPart)}
                placeholder="EBR########"
                disabled={form.pending}
                onChange={(event) =>
                  form.setField("np_origen", event.target.value.toUpperCase())
                }
              />
              <TextField
                label="NP destino"
                required
                maxLength={11}
                value={form.values.np_destino}
                suggestions={models.data?.filter(validPart)}
                placeholder="EBR########"
                disabled={form.pending}
                onChange={(event) => {
                  const next = event.target.value.toUpperCase();
                  form.setValues((previous) => ({
                    ...previous,
                    np_destino: next,
                    ...(normalizePart(previous.np_destino) !==
                    normalizePart(next)
                      ? { programmingPart: "", programaciones: [] }
                      : {}),
                  }));
                }}
              />
              <SelectField
                label="Tipo de material"
                value={form.values.tipo_material}
                disabled={form.pending}
                options={[
                  { value: "ASSY", label: "ASSY (SMD + ASSY)" },
                  { value: "IMD_SMD", label: "IMD-SMD (solo SMD)" },
                ]}
                onChange={(event) =>
                  form.setField(
                    "tipo_material",
                    event.target.value as RequestDraft["tipo_material"],
                  )
                }
              />
            </div>
            {models.isError && (
              <Alert tone="warning">
                No se pudieron cargar las sugerencias. Puedes capturar el número
                de parte completo.
              </Alert>
            )}
          </FormSection>
          <FormSection title="Origen del material">
            <div className="rework-form-grid">
              {ORIGINS.map((origin) => (
                <TextField
                  key={origin.value}
                  label={origin.label}
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  placeholder="0"
                  disabled={form.pending}
                  value={form.values.cantidades[origin.value]}
                  onChange={(event) =>
                    form.setField("cantidades", {
                      ...form.values.cantidades,
                      [origin.value]: event.target.value,
                    })
                  }
                />
              ))}
            </div>
            <p className="rework-total">
              Cantidad total:{" "}
              <strong>
                {payload.origenes.reduce((sum, row) => sum + row.cantidad, 0)}
              </strong>{" "}
              / 999
            </p>
          </FormSection>
          <FormSection title="Programación">
            <CheckboxField
              label="Lleva programación (etiquetas MICOM)"
              disabled={form.pending}
              checked={enabled}
              onChange={(event) =>
                form.setValues((previous) => ({
                  ...previous,
                  programmingEnabled: event.target.checked,
                  programmingPart: "",
                  programaciones: [],
                }))
              }
            />
            {enabled &&
              (!validPart(part) ? (
                <Alert>Captura primero un NP destino válido.</Alert>
              ) : programming.isPending || programming.isFetching ? (
                <p role="status">Consultando BOM vigente…</p>
              ) : programming.isError ? (
                <Alert tone="danger">
                  {programming.error.message}{" "}
                  <Button size="sm" onClick={() => void programming.refetch()}>
                    Reintentar programación
                  </Button>
                </Alert>
              ) : groups.length === 0 ? (
                <Alert>El BOM vigente de {part} no tiene MICOM.</Alert>
              ) : (
                <div className="rework-programming">
                  {groups.map((group) => {
                    const selected = form.values.programaciones.find(
                      (item) => item.ic_location === group.location,
                    );
                    return (
                      <div key={group.location}>
                        <CheckboxField
                          label={`Incluir ${group.location}`}
                          checked={!!selected}
                          disabled={form.pending}
                          onChange={(event) =>
                            selectProgramming(
                              group.location,
                              event.target.checked
                                ? group.options[0].programming_label
                                : null,
                            )
                          }
                        />
                        <SelectField
                          aria-label={`Programación ${group.location}`}
                          disabled={form.pending || !selected}
                          value={
                            selected?.programming_label ??
                            group.options[0].programming_label
                          }
                          options={group.options.map((option) => ({
                            value: option.programming_label,
                            label: `${option.programming_label} · ${option.micom_part_no}`,
                          }))}
                          onChange={(event) =>
                            selectProgramming(
                              group.location,
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
          </FormSection>
          <FormSection
            title="Cambio de componentes"
            actions={
              <Button
                size="sm"
                disabled={form.pending}
                onClick={() =>
                  form.setField("componentes", [
                    ...form.values.componentes,
                    {
                      key: crypto.randomUUID(),
                      tipo: "ASSY",
                      ubicacion: "",
                      np_anterior: "",
                      np_nuevo: "",
                    },
                  ])
                }
              >
                Agregar componente
              </Button>
            }
          >
            {form.values.componentes.length > 0 ? (
              <DataTable
                label="Componentes por cambiar"
                rows={form.values.componentes}
                columns={componentColumns}
                rowKey={(row) => row.key}
                layout="fixed"
                minWidth={600}
              />
            ) : (
              <p className="rework-empty">Sin cambios de componentes.</p>
            )}
          </FormSection>
          <TextareaField
            label="Comentarios"
            maxLength={2000}
            value={form.values.comentarios}
            disabled={form.pending}
            onChange={(event) =>
              form.setField("comentarios", event.target.value)
            }
          />
          <FormSection title="Áreas que recibirán la solicitud">
            <div className="rework-badges">
              {previewAreas.map((area) => (
                <span key={area} className="rework-badge">
                  {area}
                </span>
              ))}
            </div>
          </FormSection>
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <DialogFooter>
          <Button disabled={form.pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={form.pending}
            loadingLabel="Creando solicitud…"
          >
            Crear solicitud
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
