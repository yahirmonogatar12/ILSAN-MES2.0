import {
  Button,
  DialogBody,
  DialogFooter,
  Modal,
  type TableColumn,
} from "@/shared/ui";
import { ResultsTable } from "./ResultsTable";
import type { Row, ViewSpec } from "./types";
export function RecordFacts({
  record,
  labels,
}: {
  record: Row;
  labels?: Record<string, string>;
}) {
  return (
    <dl className="production-results-facts">
      {Object.entries(record).map(([key, value]) => (
        <div key={key}>
          <dt>{labels?.[key] ?? key.replaceAll("_", " ")}</dt>
          <dd>
            {value == null || value === ""
              ? "—"
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function TableDialog({
  spec,
  onClose,
  extraColumns,
  subtitle,
}: {
  spec: ViewSpec;
  onClose: () => void;
  extraColumns?: readonly TableColumn<Row>[];
  subtitle?: string;
}) {
  return (
    <Modal
      title={spec.title}
      subtitle={subtitle}
      size="xl"
      onClose={onClose}
      className="production-results-dialog"
    >
      <DialogBody>
        <ResultsTable spec={spec} extraColumns={extraColumns} />
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
