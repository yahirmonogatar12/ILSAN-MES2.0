import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CheckboxField,
  DataGrid,
  DialogBody,
  DialogFooter,
  Modal,
  SelectField,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import { normalizeSearch } from "./model";
import { panelKeys } from "./usePanel";
import type { Department, PanelApi, PermissionArea } from "./panelTypes";

export function PermissionAreas({
  api,
  scope,
  departments,
  onClose,
  onSaved,
}: {
  api: PanelApi;
  scope: string;
  departments: Department[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const list = useQuery({
    queryKey: panelKeys.data(scope, "areas"),
    queryFn: ({ signal }) => api.areas(signal),
  });
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (action: "add" | "remove") => {
      await api.assignAreas(selected, department, action);
    },
    onSuccess: () => {
      setSelected([]);
      onSaved("Áreas de permisos actualizadas.");
    },
  });
  const rows = useMemo(
    () =>
      (list.data || []).filter((row) =>
        normalizeSearch(
          [row.pagina, row.seccion, row.boton, ...row.departamentos].join(" "),
        ).includes(normalizeSearch(search.trim())),
      ),
    [list.data, search],
  );
  const columns = useMemo<TableColumn<PermissionArea>[]>(
    () => [
      {
        id: "select",
        header: "ASIGNAR",
        width: 75,
        filterable: false,
        cell: (row) => (
          <CheckboxField
            aria-label={`Seleccionar permiso ${row.id}`}
            checked={selected.includes(row.id)}
            disabled={mutation.isPending || list.isFetching}
            onChange={(event) =>
              setSelected((previous) =>
                event.target.checked
                  ? [...previous, row.id]
                  : previous.filter((id) => id !== row.id),
              )
            }
          />
        ),
      },
      {
        id: "page",
        header: "PÁGINA",
        cell: (row) => row.pagina,
        sortValue: (row) => row.pagina,
      },
      {
        id: "section",
        header: "SECCIÓN",
        cell: (row) => row.seccion,
        sortValue: (row) => row.seccion,
      },
      {
        id: "permission",
        header: "PERMISO",
        cell: (row) => row.boton,
        sortValue: (row) => row.boton,
      },
      {
        id: "departments",
        header: "DEPARTAMENTOS",
        width: "27%",
        cell: (row) => row.departamentos.join(", ") || "Sin asignar",
        textValue: (row) => row.departamentos.join(", "),
      },
    ],
    [selected, mutation.isPending, list.isFetching],
  );
  return (
    <Modal
      title="Áreas de permisos"
      className="administration-panel-dialog"
      size="xl"
      busy={mutation.isPending}
      onClose={onClose}
    >
      <DialogBody>
        <div className="administration-panel-area-tools">
          <TextField
            label="Buscar permiso"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            initialFocus
          />
          <SelectField
            label="Departamento"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            options={[
              { value: "", label: "Seleccionar…" },
              ...[
                ...new Set([
                  ...departments
                    .filter((row) => row.activo)
                    .map((row) => row.nombre),
                  ...(list.data || []).flatMap((row) => row.departamentos),
                ]),
              ]
                .sort()
                .map((value) => ({ value, label: value })),
            ]}
          />
          <Button
            size="sm"
            disabled={
              !list.isSuccess ||
              list.isFetching ||
              mutation.isPending ||
              !rows.length
            }
            onClick={() =>
              setSelected((previous) => [
                ...new Set([...previous, ...rows.map((row) => row.id)]),
              ])
            }
          >
            Marcar visibles
          </Button>
          <Button
            size="sm"
            disabled={mutation.isPending || !selected.length}
            onClick={() => setSelected([])}
          >
            Limpiar selección
          </Button>
        </div>
        {mutation.error && (
          <Alert tone="danger">{mutation.error.message}</Alert>
        )}
        <DataGrid
          label="Áreas de permisos"
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          minWidth={850}
          layout="fixed"
          itemLabel="permisos"
          resetKey={search}
          loading={list.isPending}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      </DialogBody>
      <DialogFooter>
        <span className="administration-panel-selection">
          {selected.length} seleccionados
        </span>
        <Button
          size="sm"
          disabled={
            mutation.isPending ||
            !selected.length ||
            !department ||
            !list.isSuccess ||
            list.isFetching
          }
          onClick={() => mutation.mutate("remove")}
        >
          Quitar área
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={mutation.isPending}
          disabled={
            !selected.length ||
            !department ||
            !list.isSuccess ||
            list.isFetching
          }
          onClick={() => mutation.mutate("add")}
        >
          Asignar área
        </Button>
        <Button size="sm" disabled={mutation.isPending} onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </Modal>
  );
}
