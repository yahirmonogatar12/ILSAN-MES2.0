import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useActiveModule } from "@/core/modules/ActiveModule";
import { useAuth } from "@/core/auth/AuthProvider";
import { usePermission } from "@/core/auth/usePermission";
import { createAssistantApi } from "@/core/assistant/api";
import {
  ASSISTANT_CAPABILITIES,
  assistantKeys,
  MAX_ATTACHMENTS,
} from "@/core/assistant/config";
import { fileIssue } from "@/core/assistant/model";
import type {
  Conversation,
  Language,
  Thread,
  UploadedFile,
} from "@/core/assistant/types";
import { clientId } from "@/shared/lib/id";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { useChatStream } from "./useChatStream";

export function useAssistantSession(open: boolean) {
  const { mode, scope } = useAuth();
  const location = useLocation();
  const activeModule = useActiveModule();
  const client = useQueryClient();
  const canArtifacts = usePermission(ASSISTANT_CAPABILITIES.artifacts);
  const canAudit = usePermission(ASSISTANT_CAPABILITIES.audit);
  const canLimits = usePermission(ASSISTANT_CAPABILITIES.limits);
  const api = useMemo(() => createAssistantApi(mode, scope), [mode, scope]);
  const [language, setLanguage] = usePersistentState<Language>(
    "mes-ai-language:" + scope,
    "auto",
    (value) =>
      value === "es" || value === "en" || value === "ko" ? value : "auto",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [operating, setOperating] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [canLoadOlder, setCanLoadOlder] = useState(true);
  const lock = useRef(false);
  const alive = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const resumed = useRef(false);
  const stream = useChatStream(api, scope);
  const bootstrap = useQuery({
    queryKey: assistantKeys.bootstrap(scope),
    queryFn: ({ signal }) => api.bootstrap(signal),
    enabled: open,
  });
  const history = useQuery({
    queryKey: assistantKeys.conversations(scope, archived),
    queryFn: ({ signal }) => api.conversations(archived, signal),
    enabled: open && !!bootstrap.data,
  });
  const detail = useQuery({
    queryKey: assistantKeys.thread(scope, selected ?? ""),
    queryFn: ({ signal }) => api.thread(selected!, signal),
    enabled: open && !!selected && !stream.pending,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current?.abort();
    };
  }, []);
  function select(conversation: Conversation | null) {
    if (lock.current || stream.pending) return;
    selectedRef.current = conversation?.public_id ?? null;
    setSelected(selectedRef.current);
    setFiles([]);
    setCanLoadOlder(true);
    stream.clearRetry();
    setError("");
    if (conversation) setLanguage(conversation.language);
  }
  useEffect(() => {
    if (!open || resumed.current || !history.isSuccess) return;
    resumed.current = true;
    const current = history.data.find(
      (conversation) => conversation.status === "active",
    );
    if (current && !selectedRef.current) select(current);
  }, [open, history.data, history.isSuccess]);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (lock.current || stream.pending) return false;
    lock.current = true;
    const controller = new AbortController();
    operation.current = controller;
    setOperating(true);
    setError("");
    try {
      await action(controller.signal);
      return true;
    } catch (cause) {
      if (alive.current && !controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo completar la operación.",
        );
      return false;
    } finally {
      lock.current = false;
      if (operation.current === controller) operation.current = null;
      if (alive.current) {
        setOperating(false);
        setUploading("");
      }
    }
  }
  async function createConversation() {
    const conversation = await api.create(language);
    if (!alive.current) throw new DOMException("Sesión cerrada", "AbortError");
    client.setQueryData<Thread>(
      assistantKeys.thread(scope, conversation.public_id),
      { conversation, messages: [], artifacts: [] },
    );
    selectedRef.current = conversation.public_id;
    setSelected(conversation.public_id);
    resumed.current = true;
    void history.refetch();
    return conversation.public_id;
  }
  const ensureConversation = () =>
    selectedRef.current
      ? Promise.resolve(selectedRef.current)
      : createConversation();
  return {
    mode,
    scope,
    api,
    bootstrap,
    history,
    detail,
    selected,
    archived,
    setArchived,
    access: {
      artifacts:
        canArtifacts.data === true &&
        bootstrap.data?.can_generate_artifacts === true,
      audit: canAudit.data === true && bootstrap.data?.can_audit === true,
      limits:
        canLimits.data === true && bootstrap.data?.can_manage_limits === true,
    },
    language,
    draft,
    setDraft,
    files,
    uploading,
    operating,
    stream,
    error,
    busy: operating || stream.pending,
    canLoadOlder,
    clearError: () => setError(""),
    select,
    newChat: () =>
      run(async () => {
        await createConversation();
        if (alive.current) {
          setFiles([]);
          setDraft("");
          stream.clearRetry();
        }
      }),
    changeLanguage: (value: Language) =>
      run(async () => {
        if (selectedRef.current) {
          const conversation = await api.update(selectedRef.current, {
            language: value,
          });
          client.setQueryData<Thread>(
            assistantKeys.thread(scope, conversation.public_id),
            (thread) => (thread ? { ...thread, conversation } : thread),
          );
        }
        if (alive.current) setLanguage(value);
      }),
    send: () =>
      run(async () => {
        const content =
          draft.trim() ||
          (files.length
            ? "Adjunto " + files.map((file) => file.filename).join(", ")
            : "");
        if (!content || content.length > 8000 || !bootstrap.data?.configured)
          return;
        const id = await ensureConversation();
        const snapshot = [...files];
        setDraft("");
        setFiles([]);
        await stream.send(
          id,
          {
            content,
            client_message_id: clientId(),
            language,
            page_context: {
              path: location.pathname,
              title: "ILSAN MES",
              container_id: activeModule?.panelId ?? null,
              module_title: activeModule?.title,
            },
            file_refs: snapshot.map((file) => file.file_ref),
            file_ref: snapshot.at(-1)?.file_ref ?? null,
          },
          snapshot,
        );
      }),
    retry: () =>
      run(async () => {
        await stream.retry();
      }),
    upload: (selectedFiles: File[]) =>
      run(async (signal) => {
        const allowed = selectedFiles.slice(0, MAX_ATTACHMENTS - files.length);
        if (allowed.length < selectedFiles.length)
          setError("Máximo 100 archivos por mensaje.");
        for (const file of allowed) {
          const issue = fileIssue(file);
          if (issue) throw new Error(file.name + " · " + issue);
          const id = await ensureConversation();
          setUploading(file.name);
          const result = await api.upload(id, file, signal);
          if (alive.current && !signal.aborted)
            setFiles((previous) => [...previous, result]);
        }
      }),
    removeFile: (ref: string) => {
      if (!lock.current && !stream.pending)
        setFiles((previous) =>
          previous.filter((file) => file.file_ref !== ref),
        );
    },
    archive: () =>
      run(async () => {
        const id = selectedRef.current;
        if (!id) return;
        await api.update(id, { status: "archived" });
        if (!alive.current) return;
        selectedRef.current = null;
        setSelected(null);
        setFiles([]);
        stream.clearRetry();
        void history.refetch();
      }),
    remove: (conversation: Conversation) =>
      run(async () => {
        await api.remove(conversation.public_id);
        if (!alive.current) return;
        if (selectedRef.current === conversation.public_id) {
          selectedRef.current = null;
          setSelected(null);
          setFiles([]);
          stream.clearRetry();
        }
        client.removeQueries({
          queryKey: assistantKeys.thread(scope, conversation.public_id),
          exact: true,
        });
        void history.refetch();
      }),
    older: () =>
      run(async (signal) => {
        const id = selectedRef.current,
          before = detail.data?.messages[0]?.id;
        if (!id || !before || before < 0) return;
        const result = await api.thread(id, signal, before);
        if (!alive.current || signal.aborted) return;
        client.setQueryData<Thread>(
          assistantKeys.thread(scope, id),
          (current) => {
            if (!current) return current;
            const seen = new Set(current.messages.map((message) => message.id));
            return {
              ...current,
              messages: [
                ...result.messages.filter((message) => !seen.has(message.id)),
                ...current.messages,
              ],
            };
          },
        );
        setCanLoadOlder(result.messages.length >= 100);
      }),
  };
}
export type AssistantSession = ReturnType<typeof useAssistantSession>;
