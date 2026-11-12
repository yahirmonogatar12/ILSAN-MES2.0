import { ApiError } from "../http";
import { clientId } from "@/shared/lib/id";
import { fileIssue } from "./model";
import type {
  AssistantApi,
  Conversation,
  Message,
  Quota,
  Thread,
  Usage,
} from "./types";
const sessions = new Map<string, AssistantApi>();
export function demoAssistant(scope: string): AssistantApi {
  const existing = sessions.get(scope);
  if (existing) return existing;
  let sequence = 0;
  const threads = new Map<string, Thread>();
  const uploaded = new Map<string, File>();
  const quotas: Quota[] = [];
  const usage: Usage = {
    request_count: 0,
    artifact_count: 0,
    input_tokens: 0,
    output_tokens: 0,
  };
  const limits = {
    daily_request_limit: 50,
    daily_token_limit: 250000,
    daily_artifact_limit: 10,
  };
  const owner = scope.slice(scope.indexOf(":") + 1);
  const thread = (id: string) => {
    const result = threads.get(id);
    if (!result) throw new ApiError("Conversación no encontrada.", 404);
    return result;
  };
  const list = () =>
    [...threads.values()]
      .map((item) => item.conversation)
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  const api: AssistantApi = {
    async bootstrap(signal) {
      signal?.throwIfAborted();
      return {
        configured: true,
        model: "Demostración",
        can_generate_artifacts: true,
        can_audit: true,
        can_manage_limits: true,
        can_use_plan: true,
        usage: { ...usage },
        limits: { ...limits },
      };
    },
    async conversations(archived, signal) {
      signal?.throwIfAborted();
      return structuredClone(
        list().filter((item) => archived || item.status === "active"),
      );
    },
    async thread(id, signal, before) {
      signal?.throwIfAborted();
      const value = structuredClone(thread(id));
      value.messages = value.messages
        .filter((item) => !before || item.id < before)
        .slice(-100);
      return value;
    },
    async create(language) {
      const conversation: Conversation = {
        public_id: clientId(),
        title: "Nueva conversación",
        language,
        model: "Demostración",
        status: "active",
        updated_at: new Date().toISOString(),
        username: owner,
      };
      threads.set(conversation.public_id, {
        conversation,
        messages: [],
        artifacts: [],
      });
      return structuredClone(conversation);
    },
    async update(id, patch) {
      Object.assign(thread(id).conversation, patch, {
        updated_at: new Date().toISOString(),
      });
      return structuredClone(thread(id).conversation);
    },
    async remove(id) {
      thread(id);
      threads.delete(id);
    },
    async upload(id, file, signal) {
      signal?.throwIfAborted();
      thread(id);
      const issue = fileIssue(file);
      if (issue) throw new Error(issue);
      const file_ref = clientId();
      uploaded.set(file_ref, file);
      return {
        file_ref,
        filename: file.name,
        size_bytes: file.size,
        extension: "." + file.name.split(".").pop()?.toLowerCase(),
      };
    },
    async send(id, payload, receive, signal) {
      signal.throwIfAborted();
      const current = thread(id);
      if (
        current.messages.some(
          (item) => item.client_message_id === payload.client_message_id,
        )
      )
        throw new ApiError("El mensaje ya fue procesado.", 409);
      const files = payload.file_refs
        .map((ref) => uploaded.get(ref))
        .filter((file): file is File => !!file);
      const user: Message = {
        id: ++sequence,
        key: String(sequence),
        client_message_id: payload.client_message_id,
        role: "user",
        content: payload.content,
        status: "complete",
        created_at: new Date().toISOString(),
        attachments: files.map((file) => ({
          filename: file.name,
          size_bytes: file.size,
        })),
        artifacts: [],
        visualizations: [],
      };
      const assistant: Message = {
        ...user,
        id: ++sequence,
        key: String(sequence),
        client_message_id: null,
        role: "assistant",
        content: "",
        status: "streaming",
        attachments: [],
      };
      current.messages.push(user, assistant);
      current.conversation.title = payload.content.slice(0, 80);
      current.conversation.updated_at = new Date().toISOString();
      receive({ type: "ack", userId: user.id, assistantId: assistant.id });
      const answer =
        "Esta es una respuesta de demostración.\n\nEl asistente del MES permite consultar datos según tus permisos, adjuntar archivos y recuperar conversaciones. En modo real, la respuesta se obtiene del servicio de IA configurado en el servidor." +
        (files.length
          ? "\n\nArchivos recibidos en este ejemplo\n" +
            files.map((file) => "- " + file.name).join("\n")
          : "");
      try {
        for (let offset = 0; offset < answer.length; offset += 28) {
          await new Promise((resolve) => setTimeout(resolve, 18));
          signal.throwIfAborted();
          const text = answer.slice(offset, offset + 28);
          assistant.content += text;
          receive({ type: "delta", text });
        }
        assistant.status = "complete";
        usage.request_count++;
        usage.input_tokens += payload.content.length;
        usage.output_tokens += answer.length;
        receive({ type: "usage", usage: { ...usage }, limits: { ...limits } });
        receive({
          type: "done",
          messageId: assistant.id,
          artifacts: [],
          visualizations: [],
        });
      } catch (error) {
        assistant.status = "interrupted";
        throw error;
      }
    },
    async file() {
      throw new Error(
        "Los archivos generados se consultan con el servicio real.",
      );
    },
    async regenerate() {
      throw new Error(
        "La regeneración de archivos se realiza con el servicio real.",
      );
    },
    async audit(username, signal) {
      signal?.throwIfAborted();
      return structuredClone(
        !username || owner.includes(username) ? list() : [],
      );
    },
    async auditThread(id, signal) {
      return api.thread(id, signal);
    },
    async quotas(signal) {
      signal?.throwIfAborted();
      return structuredClone(quotas);
    },
    async saveQuota(payload) {
      const existing = quotas.find(
        (item) =>
          item.subject_type === payload.subject_type &&
          item.subject_key === payload.subject_key,
      );
      if (existing) Object.assign(existing, payload);
      else quotas.push({ ...payload, id: ++sequence });
    },
  };
  sessions.set(scope, api);
  return api;
}
