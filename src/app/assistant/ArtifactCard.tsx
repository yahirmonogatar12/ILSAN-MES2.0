import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, RefreshCw } from "lucide-react";
import { saveDownload } from "@/core/http";
import { assistantKeys } from "@/core/assistant/config";
import { mergeById } from "@/core/assistant/model";
import type { Artifact, AssistantApi, Thread } from "@/core/assistant/types";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  FilePreview,
  ImageViewer,
  Loading,
  Modal,
  SpreadsheetPreview,
} from "@/shared/ui";
import type { labels } from "./i18n";

type Labels = ReturnType<typeof labels>;
export function ArtifactCard({
  artifact,
  api,
  scope,
  conversation,
  canGenerate,
  t,
}: {
  artifact: Artifact;
  api: AssistantApi;
  scope: string;
  conversation: string;
  canGenerate: boolean;
  t: Labels;
}) {
  const client = useQueryClient();
  const [preview, setPreview] = useState(false);
  const activeDownload = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      activeDownload.current?.abort();
    };
  }, []);
  const download = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      activeDownload.current = controller;
      try {
        const file = await api.file(artifact, false, controller.signal);
        if (alive.current && !controller.signal.aborted)
          saveDownload(file.blob, file.name);
      } finally {
        if (activeDownload.current === controller)
          activeDownload.current = null;
      }
    },
  });
  const regenerate = useMutation({
    mutationFn: () => api.regenerate(artifact.id),
    onSuccess: (created) => {
      if (!alive.current) return;
      client.setQueryData<Thread>(
        assistantKeys.thread(scope, conversation),
        (thread) =>
          thread
            ? { ...thread, artifacts: mergeById(thread.artifacts, [created]) }
            : thread,
      );
      void client.invalidateQueries({
        queryKey: assistantKeys.bootstrap(scope),
      });
    },
  });
  const ready = artifact.status === "ready";
  return (
    <article className="assistant-artifact">
      <div className="assistant-artifact-heading">
        <FileText size={18} />
        <strong>{artifact.title || artifact.filename}</strong>
        <span>{artifact.type.toUpperCase()}</span>
      </div>
      <small>
        {artifact.filename} ·{" "}
        {Math.ceil(artifact.size_bytes / 1024).toLocaleString()} KB
        {artifact.row_count
          ? " · " + artifact.row_count.toLocaleString() + " " + t.rows
          : ""}
      </small>
      {artifact.source && (
        <small>
          {t.source} · {artifact.source}
        </small>
      )}
      <div className="assistant-artifact-actions">
        {ready && (
          <>
            <Button
              size="sm"
              icon={<Eye size={14} />}
              onClick={() => setPreview(true)}
            >
              Vista previa
            </Button>
            <Button
              size="sm"
              variant="success"
              icon={<Download size={14} />}
              loading={download.isPending}
              onClick={() => download.mutate()}
            >
              {t.download}
            </Button>
          </>
        )}
        {!ready && <span>{t.expired}</span>}
        {canGenerate && (
          <Button
            size="sm"
            icon={<RefreshCw size={13} />}
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            {t.regenerate}
          </Button>
        )}
      </div>
      {(download.error || regenerate.error) && (
        <Alert tone="danger">
          {download.error?.message || regenerate.error?.message}
        </Alert>
      )}
      {preview && (
        <ArtifactPreview
          artifact={artifact}
          api={api}
          scope={scope}
          onClose={() => setPreview(false)}
        />
      )}
    </article>
  );
}
function ArtifactPreview({
  artifact,
  api,
  scope,
  onClose,
}: {
  artifact: Artifact;
  api: AssistantApi;
  scope: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["assistant", scope, "preview", artifact.id],
    queryFn: ({ signal }) => api.file(artifact, true, signal),
    gcTime: 0,
  });
  return (
    <Modal
      title={artifact.title || artifact.filename}
      onClose={onClose}
      size="xl"
      className="assistant-preview"
    >
      <DialogBody>
        {query.isPending && <Loading text="Abriendo archivo…" />}
        {query.error && <Alert tone="danger">{query.error.message}</Alert>}
        {query.data &&
          (/\.(xls[xm]|csv|tsv)$/i.test(query.data.name) ? (
            <SpreadsheetPreview blob={query.data.blob} name={query.data.name} />
          ) : artifact.mime_type.startsWith("image/") ? (
            <ImageViewer
              blob={query.data.blob}
              alt={artifact.title || artifact.filename}
            />
          ) : (
            <FilePreview blob={query.data.blob} name={query.data.name} />
          ))}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </Modal>
  );
}
