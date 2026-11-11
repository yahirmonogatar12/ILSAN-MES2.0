import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Button,
  DialogBody,
  FormActions,
  FormMessages,
  FormSection,
  IconButton,
  Modal,
  SelectField,
  TextField,
  TextareaField,
} from "@/shared/ui";
import { EMPTY_MATERIAL, materialToPayload, validateMaterial } from "./model";
import type {
  Catalogs,
  Material,
  MaterialPayload,
  MaterialsApi,
} from "./types";

interface Props {
  record: Material | null;
  catalogs: Catalogs;
  gateway: MaterialsApi;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}
/** Business-specific fields composed from shared controls and form orchestration. */
export function MaterialForm({
  record,
  catalogs,
  gateway,
  onClose,
  onSaved,
}: Props) {
  const form = useForm<MaterialPayload>({
    initialValues: record
      ? materialToPayload(record)
      : { ...EMPTY_MATERIAL, vendedores: [] },
    validate: validateMaterial,
    onSubmit: async (values) => {
      await gateway.save(values, !!record);
      await onSaved(
        record
          ? "Material actualizado correctamente."
          : "Material registrado correctamente.",
      );
    },
  });
  const draft = form.values;
  function updateVendor(
    index: number,
    field: "vendedor" | "costo" | "moneda",
    value: string,
  ) {
    form.setField(
      "vendedores",
      draft.vendedores.map((vendor, i) =>
        i === index ? { ...vendor, [field]: value } : vendor,
      ),
    );
  }
  return (
    <Modal
      className="materials-form"
      title={record ? "Editar material" : "Nuevo material"}
      subtitle={
        record
          ? `Actualiza la información de ${record.numero_parte}.`
          : "Agrega un material al catálogo maestro."
      }
      size="lg"
      onClose={onClose}
      busy={form.pending}
    >
      <form onSubmit={form.handleSubmit}>
        <fieldset className="form-fieldset" disabled={form.pending}>
          <DialogBody>
            <FormSection
              number="01"
              title="Datos del material"
              description="Los campos con * son obligatorios."
            >
              <div className="form-grid">
                <TextField
                  name="numero_parte"
                  label="Número de parte"
                  required
                  maxLength={512}
                  initialFocus={!record}
                  value={draft.numero_parte}
                  readOnly={!!record}
                  onChange={(event) =>
                    form.setField("numero_parte", event.target.value)
                  }
                  placeholder="Ej. RC0603FR-0710KL"
                  hint={record ? "Identificador del material." : undefined}
                />
                <TextField
                  name="clasificacion"
                  label="Clasificación"
                  maxLength={512}
                  suggestions={catalogs.clasificaciones}
                  value={draft.clasificacion}
                  onChange={(event) =>
                    form.setField("clasificacion", event.target.value)
                  }
                  placeholder="Selecciona o escribe"
                />
                <TextareaField
                  name="especificacion_material"
                  label="Especificación del material"
                  required
                  rows={3}
                  maxLength={512}
                  initialFocus={!!record}
                  containerClassName="span-2"
                  value={draft.especificacion_material}
                  onChange={(event) =>
                    form.setField("especificacion_material", event.target.value)
                  }
                  placeholder="Descripción, características y especificaciones técnicas"
                />
                <TextField
                  name="propiedad_material"
                  label="Propiedad"
                  maxLength={512}
                  suggestions={catalogs.propiedades}
                  value={draft.propiedad_material}
                  onChange={(event) =>
                    form.setField("propiedad_material", event.target.value)
                  }
                  placeholder="Selecciona o escribe"
                />
                <div className="form-grid units-grid">
                  <TextField
                    name="unidad_empaque"
                    label="Unidad de empaque"
                    maxLength={50}
                    suggestions={catalogs.unidades_empaque}
                    value={draft.unidad_empaque}
                    onChange={(event) =>
                      form.setField("unidad_empaque", event.target.value)
                    }
                    placeholder="Ej. Carrete"
                  />
                  <TextField
                    name="unidad_medida"
                    label="Unidad de medida"
                    maxLength={10}
                    suggestions={catalogs.unidades_medida}
                    value={draft.unidad_medida}
                    onChange={(event) =>
                      form.setField("unidad_medida", event.target.value)
                    }
                    placeholder="EA"
                  />
                </div>
              </div>
            </FormSection>
            <div className="section-divider" />
            <FormSection
              number="02"
              title="Vendedores y costos"
              description="Define un costo y una moneda por vendedor."
              actions={
                <Button
                  size="sm"
                  icon={<Plus size={15} />}
                  onClick={() =>
                    form.setField("vendedores", [
                      ...draft.vendedores,
                      { vendedor: "", costo: "", moneda: "USD" },
                    ])
                  }
                >
                  Agregar vendedor
                </Button>
              }
            >
              {!draft.vendedores.length ? (
                <div className="vendor-empty">
                  <CircleHelp size={18} />
                  <p>
                    Puedes registrar el material sin vendedores y agregarlos
                    después.
                  </p>
                </div>
              ) : (
                <div className="vendor-rows">
                  {draft.vendedores.map((vendor, index) => (
                    <div className="vendor-row" key={index}>
                      <TextField
                        label={`Vendedor ${index + 1}`}
                        maxLength={100}
                        value={vendor.vendedor}
                        onChange={(event) =>
                          updateVendor(index, "vendedor", event.target.value)
                        }
                        placeholder="Nombre del vendedor"
                      />
                      <TextField
                        label="Costo unitario"
                        aria-label={`Costo del vendedor ${index + 1}`}
                        inputMode="decimal"
                        type="number"
                        min="0"
                        max="99999999.9999"
                        step="0.0001"
                        value={vendor.costo ?? ""}
                        onChange={(event) =>
                          updateVendor(index, "costo", event.target.value)
                        }
                        placeholder="0.0000"
                      />
                      <SelectField
                        label="Moneda"
                        aria-label={`Moneda del vendedor ${index + 1}`}
                        value={vendor.moneda}
                        onChange={(event) =>
                          updateVendor(index, "moneda", event.target.value)
                        }
                        options={catalogs.monedas.map((currency) => ({
                          value: currency,
                          label: currency,
                        }))}
                      />
                      <IconButton
                        tone="danger"
                        label={`Quitar vendedor ${index + 1}`}
                        icon={<Trash2 size={17} />}
                        onClick={() =>
                          form.setField(
                            "vendedores",
                            draft.vendedores.filter((_, i) => i !== index),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              {draft.vendedores.length > 0 && (
                <p className="field-note">
                  Un costo vacío se registra como 0. Se admiten hasta 4
                  decimales.
                </p>
              )}
            </FormSection>
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
        </fieldset>
        <FormActions
          pending={form.pending}
          onCancel={onClose}
          icon={<Plus size={16} />}
          submitLabel={record ? "Guardar cambios" : "Registrar material"}
        />
      </form>
    </Modal>
  );
}
