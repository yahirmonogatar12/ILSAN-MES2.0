import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/core/http";
import { assistantKeys } from "@/core/assistant/config";
import { mergeById } from "@/core/assistant/model";
import type {
  AssistantApi,
  Bootstrap,
  ChatEvent,
  Message,
  SendRequest,
  Thread,
  UploadedFile,
} from "@/core/assistant/types";
import { clientId } from "@/shared/lib/id";

interface Attempt {
  conversation: string;
  payload: SendRequest;
  files: UploadedFile[];
  accepted: boolean;
}
export function useChatStream(api: AssistantApi, scope: string) {
  const client = useQueryClient();
  const active = useRef<AbortController | null>(null);
  const last = useRef<Attempt | null>(null);
  const alive = useRef(true);
  const [pending, setPending] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);
  async function send(
    conversation: string,
    payload: SendRequest,
    files: UploadedFile[],
    retry = false,
  ) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const attempt: Attempt = { conversation, payload, files, accepted: false };
    last.current = attempt;
    setPending(true);
    setCanRetry(false);
    setError("");
    setProgress("");
    const key = assistantKeys.thread(scope, conversation);
    const userKey = payload.client_message_id + ":user",
      assistantKey = payload.client_message_id + ":assistant";
    const update = (change: (thread: Thread) => Thread) => {
      if (alive.current)
        client.setQueryData<Thread>(key, (thread) =>
          thread ? change(thread) : thread,
        );
    };
    const edit = (
      change: Partial<Message> | ((message: Message) => Partial<Message>),
    ) =>
      update((thread) => ({
        ...thread,
        messages: thread.messages.map((message) =>
          message.key === assistantKey
            ? {
                ...message,
                ...(typeof change === "function" ? change(message) : change),
              }
            : message,
        ),
      }));
    let done = false;
    let failure: Error | null = null;
    try {
      await client.cancelQueries({ queryKey: key, exact: true });
      if (controller.signal.aborted) return;
      update((thread) => {
        const baseline: Message = {
          id: -1,
          key: userKey,
          client_message_id: payload.client_message_id,
          role: "user",
          content: payload.content,
          status: "complete",
          created_at: new Date().toISOString(),
          attachments: files,
          artifacts: [],
          visualizations: [],
        };
        const assistant: Message = {
          ...baseline,
          id: -2,
          key: assistantKey,
          client_message_id: null,
          role: "assistant",
          content: "",
          status: "streaming",
          attachments: [],
        };
        return {
          ...thread,
          messages: [
            ...thread.messages.filter(
              (message) =>
                message.key !== userKey && message.key !== assistantKey,
            ),
            baseline,
            assistant,
          ],
        };
      });
      const receive = (event: ChatEvent) => {
        if (!alive.current || controller.signal.aborted) return;
        switch (event.type) {
          case "ack":
            attempt.accepted = true;
            update((thread) => ({
              ...thread,
              messages: thread.messages.map((message) =>
                message.key === userKey
                  ? { ...message, id: event.userId }
                  : message.key === assistantKey
                    ? { ...message, id: event.assistantId }
                    : message,
              ),
            }));
            break;
          case "delta":
            edit((message) => ({ content: message.content + event.text }));
            break;
          case "progress":
            setProgress(event.message);
            break;
          case "artifact":
            edit((message) => ({
              artifacts: mergeById(message.artifacts, [event.artifact]),
            }));
            break;
          case "visualization":
            edit((message) => ({
              visualizations: mergeById(message.visualizations, [
                event.visualization,
              ]),
            }));
            break;
          case "notice":
            setError(event.message);
            break;
          case "usage":
            client.setQueryData<Bootstrap>(
              assistantKeys.bootstrap(scope),
              (bootstrap) =>
                bootstrap
                  ? { ...bootstrap, usage: event.usage, limits: event.limits }
                  : bootstrap,
            );
            break;
          case "error":
            failure = new Error(event.message);
            break;
          case "done":
            done = true;
            edit((message) => ({
              id: event.messageId ?? message.id,
              status: "complete",
              artifacts: mergeById(message.artifacts, event.artifacts),
              visualizations: mergeById(
                message.visualizations,
                event.visualizations,
              ),
            }));
            break;
        }
      };
      await api.send(conversation, payload, receive, controller.signal);
      if (failure) {
        done = false;
        throw failure;
      }
      if (!done)
        throw new Error("La respuesta se interrumpió antes de terminar.");
    } catch (cause) {
      if (!alive.current) return;
      if (controller.signal.aborted) edit({ status: "interrupted" });
      else if (cause instanceof ApiError && cause.status === 409 && retry) {
        attempt.accepted = true;
        try {
          const stored = await api.thread(conversation, controller.signal);
          const index = stored.messages.findIndex(
            (message) =>
              message.client_message_id === payload.client_message_id,
          );
          const answer = index >= 0 ? stored.messages[index + 1] : undefined;
          done = answer?.role === "assistant" && answer.status === "complete";
          client.setQueryData(key, stored);
          if (!done)
            setError(
              "El servidor ya recibió este mensaje. Puedes revisar la respuesta o reintentar.",
            );
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "No se pudo recuperar la conversación.",
          );
        }
      } else {
        edit({ status: "failed" });
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo completar la respuesta.",
        );
        if (cause instanceof ApiError && cause.status === 403)
          void client.invalidateQueries({ queryKey: ["permission", scope] });
      }
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current) {
        setPending(false);
        setProgress("");
        setCanRetry(!done);
        void client.invalidateQueries({
          queryKey: ["assistant", scope, "conversations"],
        });
        void client.invalidateQueries({
          queryKey: assistantKeys.bootstrap(scope),
        });
        if (done) void client.invalidateQueries({ queryKey: key, exact: true });
      }
    }
  }
  const clearRetry = useCallback(() => {
    last.current = null;
    setCanRetry(false);
    setError("");
  }, []);
  return {
    pending,
    canRetry,
    error,
    progress,
    send,
    stop: () => active.current?.abort(),
    retry: () => {
      const previous = last.current;
      if (!previous || active.current) return Promise.resolve();
      const payload = {
        ...previous.payload,
        client_message_id: previous.accepted
          ? clientId()
          : previous.payload.client_message_id,
      };
      return send(previous.conversation, payload, previous.files, true);
    },
    clearRetry,
  };
}
