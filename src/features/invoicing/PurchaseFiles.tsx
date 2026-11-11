import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  DataGrid,
  DialogBody,
  DialogFooter,
  Modal,
  SelectField,
} from "@/shared/ui";
import { useInvoicing } from "./components";
import { makeColumns, reserveWidth } from "./columns";
import { PurchaseFile } from "./InvoiceFile";
import type { DataRow } from "./types";

/** Transactions may contain lines from several loads. Never substitute an unrelated workbook. */
export function PurchaseFiles({
  type = "",
  loadIds,
  onClose,
}: {
  type?: string;
  loadIds?: number[];
  onClose: () => void;
}) {
  const auth = useInvoicing();
  const [kind, setKind] = useState(type);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useQuery({
    queryKey: auth.key("purchase-files", kind),
    queryFn: ({ signal }) => auth.purchases.loads(kind, signal),
    enabled: loadIds === undefined || loadIds.length > 0,
  });
  const records = useMemo(() => {
    const records = query.data?.records ?? [];
    return loadIds
      ? loadIds.map(
          (id) =>
            records.find((row) => Number(row.id) === id) ?? {
              id,
              tipo: kind,
              archivo_nombre: `Carga #${id}`,
            },
        )
      : records;
  }, [query.data, loadIds, kind]);
  const columns = useMemo(
    () => [
      ...reserveWidth(
        makeColumns([
          ["archivo_nombre", "ARCHIVO ORIGINAL", 250],
          ["tipo", "TIPO", 65],
          ["fecha_carga", "FECHA DE CARGA", 150],
          ["usuario_carga", "USUARIO", 90],
          ["total_lineas", "LÍNEAS", 65],
        ]),
        18,
      ),
      {
        id: "view",
        header: "EXCEL",
        filterable: false,
        width: "18%",
        cell: (row: DataRow) => (
          <Button size="sm" onClick={() => setSelected(Number(row.id))}>
            Ver Excel original
          </Button>
        ),
      },
    ],
    [],
  );
  return (
    <>
      <Modal
        title="Archivos Excel originales"
        subtitle={
          loadIds
            ? "Archivos de las cargas que aportaron líneas a esta transacción."
            : "Historial de archivos cargados en compras."
        }
        size="xl"
        onClose={onClose}
        className="invoicing-dialog"
      >
        <DialogBody>
          {!type && (
            <SelectField
              label="Tipo"
              value={kind}
              options={[
                { value: "", label: "Todos" },
                { value: "LG", label: "LG" },
                { value: "OVEN", label: "OVEN" },
              ]}
              onChange={(event) => setKind(event.target.value)}
            />
          )}
          {query.error && loadIds && (
            <Alert tone="warning">
              No se pudieron consultar los nombres. Puedes abrir los archivos
              por su número de carga.
            </Alert>
          )}
          {!loadIds && records.length >= 300 && (
            <Alert tone="info">
              Se muestran las últimas 300 cargas. Los archivos anteriores
              asociados a una transacción se pueden abrir desde su detalle.
            </Alert>
          )}
          <DataGrid
            label="Archivos originales de compras"
            rows={records}
            columns={columns}
            rowKey={(row) => Number(row.id)}
            loading={query.isLoading}
            error={loadIds ? undefined : query.error}
            onRetry={() => void query.refetch()}
            minWidth={760}
            layout="fixed"
            emptyState={
              <p className="invoicing-note">
                No hay archivos originales asociados.
              </p>
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </Modal>
      {selected !== null && (
        <PurchaseFile id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
