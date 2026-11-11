import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Pencil } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DataGrid,
  DialogBody,
  DialogFooter,
  EmptyState,
  KeyValueGrid,
  Modal,
  SelectField,
} from "@/shared/ui";
import { formatCost } from "./model";
import { historyColumns } from "./columns";
import { materialKeys } from "./config";
import type { Material, MaterialsApi, VendorCost } from "./types";

export function MaterialDetail({
  record,
  onClose,
  onEdit,
  onHistory,
}: {
  record: Material;
  onClose: () => void;
  onEdit: () => void;
  onHistory: () => void;
}) {
  const fields = [
    { label: "Clasificación", value: record.clasificacion },
    { label: "Propiedad", value: record.propiedad_material },
    { label: "Unidad de empaque", value: record.unidad_empaque },
    { label: "Unidad de medida", value: record.unidad_medida },
    { label: "Fecha de registro", value: record.fecha_registro },
    { label: "Registrado por", value: record.usuario_registro },
  ];
  if (record.fecha_modificacion)
    fields.push(
      { label: "Última modificación", value: record.fecha_modificacion },
      { label: "Modificado por", value: record.usuario_modificacion || "—" },
    );
  return (
    <Modal
      className="materials-detail"
      title={record.numero_parte}
      subtitle="Ficha del material"
      size="lg"
      onClose={onClose}
    >
      <DialogBody>
        <div className="detail-description">
          {record.especificacion_material}
        </div>
        <KeyValueGrid items={fields} />
        <div className="section-divider" />
        <h3 className="detail-heading">Vendedores y costos vigentes</h3>
        {!record.costos.length ? (
          <p className="muted">Sin vendedores registrados.</p>
        ) : (
          <div className="detail-costs">
            {record.costos.map((cost) => (
              <div key={cost.vendedor}>
                <span>{cost.vendedor}</span>
                <strong>{formatCost(cost)}</strong>
              </div>
            ))}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button icon={<Clock3 size={16} />} onClick={onHistory}>
          Historial de costos
        </Button>
        <Button variant="primary" icon={<Pencil size={16} />} onClick={onEdit}>
          Editar material
        </Button>
      </DialogFooter>
    </Modal>
  );
}

export function CostHistory({
  record,
  gateway,
  scope,
  onClose,
}: {
  record: Material;
  gateway: MaterialsApi;
  scope: string;
  onClose: () => void;
}) {
  const [vendor, setVendor] = useState("");
  const client = useQueryClient();
  const history = useQuery({
    queryKey: materialKeys.history(scope, record.numero_parte, vendor),
    queryFn: ({ signal }) =>
      gateway.history(record.numero_parte, vendor, signal),
  });
  const completeHistory =
    client.getQueryData<VendorCost[]>(
      materialKeys.history(scope, record.numero_parte, ""),
    ) || [];
  const vendors = [
    ...new Set([
      ...record.vendedores,
      ...completeHistory.map((cost) => cost.vendedor),
      ...(history.data || []).map((cost) => cost.vendedor),
    ]),
  ];
  return (
    <Modal
      className="materials-history"
      title="Historial de costos"
      subtitle={record.numero_parte}
      size="lg"
      onClose={onClose}
    >
      <DialogBody>
        <div className="history-filter">
          <SelectField
            label="Vendedor"
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            options={[
              { value: "", label: "Todos los vendedores" },
              ...vendors.map((name) => ({ value: name, label: name })),
            ]}
          />
          <span className="muted">
            {history.data ? `${history.data.length} registros` : "Consultando…"}
          </span>
        </div>
        <DataGrid
          label="Historial de costos"
          rows={history.data || []}
          columns={historyColumns}
          rowKey={(_, index) => index}
          paginate={false}
          minWidth={550}
          loading={history.isPending}
          loadingText="Consultando historial…"
          error={history.error}
          onRetry={() => void history.refetch()}
          emptyState={
            <EmptyState
              title="Sin historial de costos"
              message="Los cambios de costo aparecerán aquí."
              icon={<Clock3 size={27} />}
            />
          }
        />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar historial</Button>
      </DialogFooter>
    </Modal>
  );
}

export function DeleteMaterial({
  record,
  gateway,
  onClose,
  onDeleted,
}: {
  record: Material;
  gateway: MaterialsApi;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const mutation = useMutation({
    mutationFn: () => gateway.remove(record.numero_parte),
    onSuccess: onDeleted,
  });
  return (
    <ConfirmDialog
      title="Dar de baja material"
      description="Confirma esta operación antes de continuar."
      confirmLabel="Dar de baja"
      pendingLabel="Dando de baja…"
      pending={mutation.isPending}
      error={mutation.error}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
    >
      <p className="delete-text">
        ¿Quieres dar de baja <strong>{record.numero_parte}</strong>?
      </p>
      <p className="muted">
        El material dejará de aparecer en el catálogo activo. El servidor
        conserva su historial y sus referencias.
      </p>
    </ConfirmDialog>
  );
}
