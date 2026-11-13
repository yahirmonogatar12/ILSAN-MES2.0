import { useRef, useState } from "react";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  SpreadsheetPreview,
  TextField,
} from "@/shared/ui";
import { useProcess } from "./useProcess";
import { validDate } from "./model";
import type { Kind, Row } from "./types";
export function ImportPlans({
  kind,
  date,
  onClose,
  onDone,
}: {
  kind: Kind;
  date: string;
  onClose: () => void;
  onDone: (result: Row) => void;
}) {
  const context = useProcess(),
    fileRef = useRef<{ file: File; date: string } | null>(null),
    [review, setReview] = useState(false),
    [view, setView] = useState(false);
  const form = useForm({
    initialValues: { file: null as File | null, date },
    validate: (value) =>
      value.file &&
      /\.(xlsx|xls)$/i.test(value.file.name) &&
      validDate(value.date)
        ? []
        : ["Selecciona un Excel (.xlsx o .xls) y una fecha válida."],
    onSubmit: async (value) => {
      if (!review) {
        fileRef.current = { file: value.file!, date: value.date };
        setReview(true);
        return;
      }
      if (!fileRef.current)
        throw new Error("Selecciona el archivo nuevamente.");
      onDone(
        await context.api.upload(
          kind,
          fileRef.current.file,
          fileRef.current.date,
        ),
      );
    },
  });
  return (
    <>
      <Modal
        title={`Importar Excel ${kind}`}
        size="lg"
        className="process-production-form"
        busy={form.pending}
        closeOnBackdrop={false}
        onClose={onClose}
      >
        <form onSubmit={form.handleSubmit}>
          <DialogBody>
            {!review ? (
              <>
                <TextField
                  label="Archivo Excel"
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={form.pending}
                  onChange={(event) =>
                    form.setField("file", event.target.files?.[0] ?? null)
                  }
                />
                <TextField
                  label="Fecha de operación"
                  type="date"
                  required
                  disabled={form.pending}
                  value={form.values.date}
                  onChange={(event) =>
                    form.setField("date", event.target.value)
                  }
                />
              </>
            ) : (
              <Alert>
                Archivo: {fileRef.current?.file.name} · Fecha:{" "}
                {fileRef.current?.date}. Se crearán los planes al confirmar.
              </Alert>
            )}
            {kind === "SMT" && (
              <Alert>
                En la columna lado: vacío = una cara; BOTTOM genera su TOP
                ligado. El importador omite las filas TOP independientes y lo
                informa en el resultado.
              </Alert>
            )}
            <FormMessages errors={form.errors} error={form.error} />
          </DialogBody>
          <DialogFooter>
            <Button disabled={form.pending} onClick={onClose}>
              Cancelar
            </Button>
            {review && (
              <>
                <Button
                  disabled={form.pending}
                  onClick={() => {
                    setReview(false);
                    fileRef.current = null;
                    form.setField("file", null);
                  }}
                >
                  Cambiar archivo
                </Button>
                <Button disabled={form.pending} onClick={() => setView(true)}>
                  Ver Excel original
                </Button>
              </>
            )}
            <Button type="submit" variant="primary" loading={form.pending}>
              {review ? "Confirmar importación" : "Revisar archivo"}
            </Button>
          </DialogFooter>
        </form>
      </Modal>
      {view && fileRef.current && (
        <Modal
          title="Excel original"
          size="xl"
          className="process-production-sheet"
          onClose={() => setView(false)}
        >
          <DialogBody>
            <SpreadsheetPreview
              blob={fileRef.current.file}
              name={fileRef.current.file.name}
            />
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setView(false)}>Cerrar</Button>
          </DialogFooter>
        </Modal>
      )}
    </>
  );
}
