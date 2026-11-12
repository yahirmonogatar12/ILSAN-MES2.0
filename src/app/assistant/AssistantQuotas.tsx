import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { assistantKeys } from "@/core/assistant/config";
import type { Quota } from "@/core/assistant/types";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DataGrid,
  FormMessages,
  SelectField,
  TextField,
  type TableColumn,
} from "@/shared/ui";
import type { AssistantSession } from "./useAssistantSession";
import { labels } from "./i18n";
const initial = {
  subject_type: "user" as "user" | "role",
  subject_key: "",
  requests: "",
  tokens: "",
  artifacts: "",
};
const limit = (value: string) => (value.trim() ? Number(value) : null);
export function AssistantQuotas({ session }: { session: AssistantSession }) {
  const client = useQueryClient(),
    t = labels(session.language);
  const query = useQuery({
    queryKey: ["assistant", session.scope, "quotas"],
    queryFn: ({ signal }) => session.api.quotas(signal),
  });
  const form = useForm({
    initialValues: initial,
    validate: (values) => [
      ...(!values.subject_key.trim() ? ["Escribe el usuario o rol."] : []),
      ...([values.requests, values.tokens, values.artifacts].some(
        (value) =>
          value.trim() &&
          (!Number.isSafeInteger(Number(value)) || Number(value) < 0),
      )
        ? ["Los límites deben ser enteros mayores o iguales a cero."]
        : []),
    ],
    onSubmit: async (values) => {
      await session.api.saveQuota({
        subject_type: values.subject_type,
        subject_key: values.subject_key.trim(),
        daily_request_limit: limit(values.requests),
        daily_token_limit: limit(values.tokens),
        daily_artifact_limit: limit(values.artifacts),
      });
      await Promise.all([
        query.refetch(),
        client.invalidateQueries({
          queryKey: assistantKeys.bootstrap(session.scope),
        }),
      ]);
    },
  });
  const columns: TableColumn<Quota>[] = [
    {
      id: "type",
      header: "Tipo",
      cell: (row) => (row.subject_type === "user" ? "Usuario" : "Rol"),
    },
    { id: "key", header: "Usuario / rol", cell: (row) => row.subject_key },
    {
      id: "requests",
      header: "Solicitudes / día",
      cell: (row) => row.daily_request_limit ?? "Predeterminada",
    },
    {
      id: "tokens",
      header: "Tokens / día",
      cell: (row) => row.daily_token_limit ?? "Predeterminada",
    },
    {
      id: "files",
      header: "Archivos / día",
      cell: (row) => row.daily_artifact_limit ?? "Predeterminada",
    },
    {
      id: "actions",
      header: "Acciones",
      filterable: false,
      cell: (row) => (
        <Button
          size="sm"
          icon={<Pencil size={13} />}
          disabled={form.pending}
          onClick={() =>
            form.setValues({
              subject_type: row.subject_type,
              subject_key: row.subject_key,
              requests:
                row.daily_request_limit == null
                  ? ""
                  : String(row.daily_request_limit),
              tokens:
                row.daily_token_limit == null
                  ? ""
                  : String(row.daily_token_limit),
              artifacts:
                row.daily_artifact_limit == null
                  ? ""
                  : String(row.daily_artifact_limit),
            })
          }
        >
          Editar
        </Button>
      ),
    },
  ];
  return (
    <section className="assistant-quotas" aria-label={t.limits}>
      <form className="assistant-quota-form" onSubmit={form.handleSubmit}>
        <SelectField
          label="Tipo"
          value={form.values.subject_type}
          disabled={form.pending}
          options={[
            { value: "user", label: "Usuario" },
            { value: "role", label: "Rol" },
          ]}
          onChange={(event) =>
            form.setField(
              "subject_type",
              event.target.value === "role" ? "role" : "user",
            )
          }
        />
        <TextField
          label="Usuario / rol"
          required
          maxLength={120}
          value={form.values.subject_key}
          disabled={form.pending}
          onChange={(event) => form.setField("subject_key", event.target.value)}
        />
        <TextField
          label="Solicitudes / día"
          type="number"
          min={0}
          step={1}
          value={form.values.requests}
          disabled={form.pending}
          onChange={(event) => form.setField("requests", event.target.value)}
        />
        <TextField
          label="Tokens / día"
          type="number"
          min={0}
          step={1}
          value={form.values.tokens}
          disabled={form.pending}
          onChange={(event) => form.setField("tokens", event.target.value)}
        />
        <TextField
          label="Archivos / día"
          type="number"
          min={0}
          step={1}
          value={form.values.artifacts}
          disabled={form.pending}
          onChange={(event) => form.setField("artifacts", event.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={form.pending}
        >
          {t.save}
        </Button>
        <FormMessages errors={form.errors} error={form.error} />
      </form>
      {query.error && <Alert tone="danger">{query.error.message}</Alert>}
      <DataGrid
        label="Cuotas del asistente"
        rows={query.data ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        layout="fixed"
        minWidth={650}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    </section>
  );
}
