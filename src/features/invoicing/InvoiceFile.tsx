import { useMutation, useQuery } from "@tanstack/react-query";
import { saveDownload } from "@/core/http";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  ErrorState,
  Loading,
  Modal,
  SpreadsheetPreview,
} from "@/shared/ui";
import { useInvoicing } from "./components";
import type { InvoiceScope } from "./types";
export function InvoiceFile({
  scope,
  id,
  onClose,
}: {
  scope: InvoiceScope;
  id: number;
  onClose: () => void;
}) {
  return <OriginalExcelFile id={id} scope={scope} onClose={onClose} />;
}
export function PurchaseFile({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  return <OriginalExcelFile id={id} onClose={onClose} />;
}
function OriginalExcelFile({
  id,
  scope,
  onClose,
}: {
  id: number;
  scope?: InvoiceScope;
  onClose: () => void;
}) {
  const auth = useInvoicing();
  const file = useQuery({
    queryKey: auth.key("file", scope || "purchase", id),
    queryFn: ({ signal }) =>
      scope
        ? auth.invoices.file(scope, id, signal)
        : auth.purchases.file(id, signal),
    gcTime: 0,
  });
  const download = useMutation({
    mutationFn: async () => {
      if (file.data) saveDownload(file.data.blob, file.data.name);
      else if (scope) await auth.invoices.download(scope, id);
      else await auth.purchases.download(id);
    },
  });
  return (
    <Modal
      title="Excel original"
      subtitle={file.data?.name}
      size="xl"
      onClose={onClose}
      className="invoicing-dialog"
    >
      <DialogBody>
        {file.isPending ? (
          <Loading text="Cargando archivo…" />
        ) : file.error ? (
          <ErrorState error={file.error} onRetry={() => void file.refetch()} />
        ) : (
          file.data && <SpreadsheetPreview {...file.data} />
        )}
        {download.error && (
          <Alert tone="danger">{download.error.message}</Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <Button loading={download.isPending} onClick={() => download.mutate()}>
          Descargar original
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
