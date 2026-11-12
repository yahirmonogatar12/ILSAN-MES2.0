import {
  isRecord,
  record,
  requiredInteger,
  requiredText,
} from "@/shared/lib/parse";
import { text } from "@/shared/lib/text";
import { ATTACH_EXTENSIONS, MAX_FILE_BYTES } from "./config";
import type {
  Artifact,
  Attachment,
  Bootstrap,
  ChatEvent,
  Conversation,
  Language,
  Limits,
  Message,
  Quota,
  Usage,
  Visualization,
} from "./types";

export function language(value: unknown): Language {
  return value === "es" || value === "en" || value === "ko" ? value : "auto";
}
const optionalRecord = (value: unknown) => (value == null ? {} : record(value));
const count = (value: unknown, field: string) =>
  value == null ? 0 : requiredInteger(value, field);
const quotaLimit = (value: unknown, field: string) =>
  value == null ? null : requiredInteger(value, field);
const nullableText = (value: unknown) => (value == null ? null : text(value));
const records = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value))
    throw new Error("El servidor devolvió una lista del asistente inválida.");
  return value.map(record);
};
export function usage(value: unknown): Usage {
  const data = optionalRecord(value);
  return {
    request_count: count(data.request_count, "request_count"),
    artifact_count: count(data.artifact_count, "artifact_count"),
    input_tokens: count(data.input_tokens, "input_tokens"),
    output_tokens: count(data.output_tokens, "output_tokens"),
  };
}
export function limits(value: unknown): Limits {
  const data = optionalRecord(value);
  return {
    daily_request_limit: quotaLimit(
      data.daily_request_limit,
      "daily_request_limit",
    ),
    daily_token_limit: quotaLimit(data.daily_token_limit, "daily_token_limit"),
    daily_artifact_limit: quotaLimit(
      data.daily_artifact_limit,
      "daily_artifact_limit",
    ),
  };
}
export function bootstrap(value: unknown): Bootstrap {
  const data = record(value);
  if (typeof data.configured !== "boolean")
    throw new Error("No se pudo verificar la configuración del asistente.");
  return {
    configured: data.configured,
    model: text(data.model) || "GPT",
    can_generate_artifacts: data.can_generate_artifacts === true,
    can_audit: data.can_audit === true,
    can_manage_limits: data.can_manage_limits === true,
    can_use_plan: data.can_use_plan === true,
    usage: usage(data.usage),
    limits: limits(data.limits),
  };
}
export function conversation(value: unknown): Conversation {
  const data = record(value);
  return {
    public_id: requiredText(data.public_id, "conversation.public_id"),
    title: text(data.title) || "Nueva conversación",
    language: language(data.language),
    model: text(data.model),
    status: text(data.status) || "active",
    updated_at: nullableText(data.updated_at),
    username: data.username == null ? undefined : text(data.username),
  };
}
export const conversations = (value: unknown) =>
  records(value).map(conversation);
export function attachment(value: unknown): Attachment {
  const data = record(value);
  return {
    filename: requiredText(data.filename, "filename"),
    extension: text(data.extension),
    kind: text(data.kind),
    size_bytes: count(data.size_bytes, "attachment.size_bytes"),
    file_ref: data.file_ref == null ? undefined : text(data.file_ref),
  };
}
export function artifact(value: unknown): Artifact {
  const data = record(value);
  return {
    id: requiredText(data.id, "artifact.id"),
    type: text(data.type),
    title: text(data.title),
    filename: text(data.filename),
    mime_type: text(data.mime_type),
    size_bytes: count(data.size_bytes, "artifact.size_bytes"),
    row_count: count(data.row_count, "artifact.row_count"),
    status: text(data.status),
    expires_at: nullableText(data.expires_at),
    source: nullableText(data.source),
    filters: isRecord(data.filters) ? data.filters : {},
  };
}
export const artifacts = (value: unknown): Artifact[] =>
  records(value).map(artifact);
export function visualization(value: unknown): Visualization {
  const data = record(value),
    type = requiredText(data.type, "visualization.type");
  return {
    id: text(data.id) || JSON.stringify(data),
    type,
    date_from: text(data.date_from),
    date_to: text(data.date_to),
    source: text(data.source),
    areas: Array.isArray(data.areas) ? records(data.areas) : undefined,
    sources: Array.isArray(data.sources) ? records(data.sources) : undefined,
    omitted_areas: Array.isArray(data.omitted_areas)
      ? data.omitted_areas.map(text)
      : undefined,
    omitted_sources: Array.isArray(data.omitted_sources)
      ? data.omitted_sources.map(text)
      : undefined,
  };
}
export function message(value: unknown): Message {
  const data = record(value);
  const id = requiredInteger(data.id, "message.id", 1);
  const content = isRecord(data.content_json) ? data.content_json : {};
  const files = Array.isArray(content.attachments)
    ? content.attachments
    : content.attachment
      ? [content.attachment]
      : [];
  return {
    id,
    key: String(id),
    client_message_id: nullableText(data.client_message_id),
    role: text(data.role),
    content: text(data.content),
    status: text(data.status),
    created_at: nullableText(data.created_at),
    attachments: files.map(attachment),
    artifacts: Array.isArray(content.artifacts)
      ? artifacts(content.artifacts)
      : [],
    visualizations: Array.isArray(content.visualizations)
      ? content.visualizations.map(visualization)
      : [],
  };
}
export const messages = (value: unknown) => records(value).map(message);
export function quota(value: unknown): Quota {
  const data = record(value);
  if (data.subject_type !== "user" && data.subject_type !== "role")
    throw new Error("El servidor devolvió una cuota inválida.");
  return {
    ...limits(data),
    id: requiredInteger(data.id, "quota.id", 1),
    subject_type: data.subject_type,
    subject_key: requiredText(data.subject_key, "subject_key"),
  };
}
export const quotas = (value: unknown) => records(value).map(quota);
export function fileIssue(file: File): string {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ATTACH_EXTENSIONS.includes(extension))
    return "Formato de archivo no soportado.";
  if (!file.size || file.size > MAX_FILE_BYTES)
    return "El archivo debe contener datos y pesar hasta 20 MB.";
  return "";
}
export function mergeById<T extends { id: string }>(
  current: T[],
  next: T[],
): T[] {
  const values = new Map(current.map((item) => [item.id, item]));
  for (const item of next) values.set(item.id, item);
  return [...values.values()];
}
export function decodeEvent(event: string, value: unknown): ChatEvent | null {
  const data = record(value);
  switch (event) {
    case "ack":
      if (
        !Number.isSafeInteger(data.user_message_id) ||
        !Number.isSafeInteger(data.assistant_message_id) ||
        Number(data.user_message_id) <= 0 ||
        Number(data.assistant_message_id) <= 0
      )
        throw new Error(
          "El servidor no confirmó los identificadores del mensaje.",
        );
      return {
        type: "ack",
        userId: Number(data.user_message_id),
        assistantId: Number(data.assistant_message_id),
      };
    case "delta":
      if (typeof data.text !== "string")
        throw new Error("El asistente devolvió texto inválido.");
      return { type: "delta", text: data.text };
    case "tool_start":
      return {
        type: "progress",
        message:
          data.name === "create_artifact"
            ? "Generando archivo…"
            : "Consultando datos autorizados…",
      };
    case "tool_end":
      return { type: "progress", message: "Razonando…" };
    case "artifact_start":
    case "artifact_progress":
      return {
        type: "progress",
        message: text(data.message) || "Generando archivo…",
      };
    case "artifact_ready":
      return { type: "artifact", artifact: artifact(data) };
    case "visualization":
      return { type: "visualization", visualization: visualization(data) };
    case "usage_diaria":
      return { type: "usage", usage: usage(data), limits: limits(data.limits) };
    case "artifact_error":
      return {
        type: "notice",
        message: text(data.message) || "No se pudo generar el archivo.",
      };
    case "error":
      return {
        type: "error",
        message: text(data.message) || "No se pudo completar la respuesta.",
      };
    case "done":
      return {
        type: "done",
        messageId:
          data.message_id == null
            ? undefined
            : requiredInteger(data.message_id, "message_id", 1),
        artifacts: data.artifacts ? artifacts(data.artifacts) : [],
        visualizations: Array.isArray(data.visualizations)
          ? data.visualizations.map(visualization)
          : [],
      };
    default:
      return null;
  }
}
