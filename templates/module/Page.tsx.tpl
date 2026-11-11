import { useState } from "react";
import { List, Plus } from "lucide-react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  Card,
  DataGrid,
  DialogBody,
  FilterBar,
  FormActions,
  FormMessages,
  Modal,
  Page,
  TextField,
  type FilterField,
  type TableColumn,
} from "@/shared/ui";
import type { ExampleRecord } from "./types";
import "./module.css";

const defaults = { q: "" };
const fields: FilterField<typeof defaults>[] = [
  { key: "q", label: "Buscar", type: "search" },
];
const columns: TableColumn<ExampleRecord>[] = [
  {
    id: "nombre",
    header: "Nombre",
    sortValue: (row) => row.nombre,
    cell: (row) => <span className="example-name">{row.nombre}</span>,
  },
];

/** Working example: replace local state with an adapter + domain query hook. */
export default function GeneratedPage() {
  const [records, setRecords] = useState<ExampleRecord[]>([]);
  const [filters, setFilters] = useState(defaults);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = records.filter((row) =>
    row.nombre.toLocaleLowerCase().includes(appliedSearch.toLocaleLowerCase()),
  );
  return (
    <Page
      title={__TITLE_JSON__}
      icon={<List size={19} />}
      className="__NAME__-module"
    >
      <Alert tone="warning">
        Ejemplo local: los registros son temporales y se pierden al recargar.
        Conecta la API del módulo antes de habilitarlo en modo real.
      </Alert>
      <FilterBar
        fields={fields}
        values={filters}
        defaults={defaults}
        onChange={(patch) =>
          setFilters((previous) => ({ ...previous, ...patch }))
        }
        onSubmit={() => setAppliedSearch(filters.q)}
        onReset={() => {
          setFilters(defaults);
          setAppliedSearch("");
        }}
      />
      <Card
        fill
        title="Registros"
        badge={records.length}
        actions={
          <Button
            variant="success"
            icon={<Plus size={15} />}
            onClick={() => setCreating(true)}
          >
            Nuevo registro
          </Button>
        }
      >
        <DataGrid
          label={__TITLE_JSON__}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          resetKey={appliedSearch}
        />
      </Card>
      {creating && (
        <ExampleForm
          onClose={() => setCreating(false)}
          onSave={(record) => {
            setRecords((previous) => [...previous, record]);
            setCreating(false);
          }}
        />
      )}
    </Page>
  );
}

function ExampleForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (record: ExampleRecord) => void;
}) {
  const form = useForm({
    initialValues: { nombre: "" },
    validate: (values) => (values.nombre.trim() ? [] : ["Escribe un nombre."]),
    onSubmit: async (values) =>
      onSave({ id: crypto.randomUUID(), nombre: values.nombre.trim() }),
  });
  return (
    <Modal title="Nuevo registro" onClose={onClose} busy={form.pending}>
      <form onSubmit={form.handleSubmit}>
        <DialogBody>
          <TextField
            label="Nombre"
            required
            initialFocus
            value={form.values.nombre}
            onChange={(event) => form.setField("nombre", event.target.value)}
          />
          <FormMessages errors={form.errors} error={form.error} />
        </DialogBody>
        <FormActions pending={form.pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
