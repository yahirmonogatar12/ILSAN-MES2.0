import { request, requestEventStream, requestFile } from "../http";
import type { RuntimeMode } from "../runtime";
import * as decode from "./model";
import { record, requiredText } from "@/shared/lib/parse";
import type { AssistantApi, Thread } from "./types";
const ROOT = "/api/ai";
const conversationPath = (id: string) =>
  `${ROOT}/conversations/${encodeURIComponent(id)}`;
export function createAssistantApi(
  mode: RuntimeMode,
  scope: string,
): AssistantApi {
  const demo = () =>
    import("./demo").then((module) => module.demoAssistant(scope));
  const json = (body: unknown, method = "POST") => ({
    method,
    body: JSON.stringify(body),
  });
  return {
    async bootstrap(signal) {
      if (mode === "demo") return (await demo()).bootstrap(signal);
      return decode.bootstrap(
        await request<unknown>(ROOT + "/bootstrap", { signal }),
      );
    },
    async conversations(archived, signal) {
      if (mode === "demo")
        return (await demo()).conversations(archived, signal);
      const data = record(
        await request<unknown>(
          ROOT +
            "/conversations?" +
            new URLSearchParams({
              limit: "100",
              ...(archived ? { include_archived: "1" } : {}),
            }),
          { signal },
        ),
      );
      return decode.conversations(data.conversations);
    },
    async thread(id, signal, before) {
      if (mode === "demo") return (await demo()).thread(id, signal, before);
      const params = new URLSearchParams({
        limit: "100",
        ...(before ? { before_id: String(before) } : {}),
      });
      const [rawMessages, rawFiles] = await Promise.all([
        request<unknown>(conversationPath(id) + "/messages?" + params, {
          signal,
        }),
        request<unknown>(conversationPath(id) + "/artifacts", { signal }),
      ]);
      const data = record(rawMessages);
      return {
        conversation: decode.conversation(data.conversation),
        messages: decode.messages(data.messages),
        artifacts: decode.artifacts(record(rawFiles).artifacts),
      };
    },
    async create(language) {
      if (mode === "demo") return (await demo()).create(language);
      return decode.conversation(
        record(
          await request<unknown>(ROOT + "/conversations", json({ language })),
        ).conversation,
      );
    },
    async update(id, patch) {
      if (mode === "demo") return (await demo()).update(id, patch);
      return decode.conversation(
        record(
          await request<unknown>(conversationPath(id), json(patch, "PATCH")),
        ).conversation,
      );
    },
    async remove(id) {
      if (mode === "demo") return (await demo()).remove(id);
      await request<unknown>(conversationPath(id), { method: "DELETE" });
    },
    async upload(id, file, signal) {
      if (mode === "demo") return (await demo()).upload(id, file, signal);
      const issue = decode.fileIssue(file);
      if (issue) throw new Error(issue);
      const data = new FormData();
      data.append("file", file);
      const result = record(
        await request<unknown>(conversationPath(id) + "/upload", {
          method: "POST",
          body: data,
          signal,
        }),
      );
      return {
        filename:
          typeof result.filename === "string" ? result.filename : file.name,
        file_ref: requiredText(result.file_ref, "file_ref"),
        size_bytes: file.size,
        extension: "." + file.name.split(".").pop()?.toLowerCase(),
      };
    },
    async send(id, payload, receive, signal) {
      if (mode === "demo")
        return (await demo()).send(id, payload, receive, signal);
      await requestEventStream(
        conversationPath(id) + "/messages/stream",
        {
          ...json(payload),
          signal,
        },
        (event) => {
          let value: unknown;
          try {
            value = JSON.parse(event.data);
          } catch {
            throw new Error("El asistente devolvió un evento inválido.");
          }
          const decoded = decode.decodeEvent(event.event, value);
          if (decoded) receive(decoded);
        },
      );
    },
    async file(artifact, preview, signal) {
      if (mode === "demo")
        return (await demo()).file(artifact, preview, signal);
      return requestFile(
        `${ROOT}/artifacts/${encodeURIComponent(artifact.id)}/download${preview && artifact.mime_type.startsWith("image/") ? "?inline=1" : ""}`,
        artifact.filename,
        signal,
      );
    },
    async regenerate(id) {
      if (mode === "demo") return (await demo()).regenerate(id);
      return decode.artifact(
        record(
          await request<unknown>(
            `${ROOT}/artifacts/${encodeURIComponent(id)}/regenerate`,
            json({}),
          ),
        ).artifact,
      );
    },
    async audit(username, signal) {
      if (mode === "demo") return (await demo()).audit(username, signal);
      return decode.conversations(
        record(
          await request<unknown>(
            ROOT +
              "/audit/conversations?" +
              new URLSearchParams({ limit: "100", username }),
            { signal },
          ),
        ).conversations,
      );
    },
    async auditThread(id, signal): Promise<Thread> {
      if (mode === "demo") return (await demo()).auditThread(id, signal);
      const data = record(
        await request<unknown>(
          `${ROOT}/audit/conversations/${encodeURIComponent(id)}/messages?limit=100`,
          { signal },
        ),
      );
      return {
        conversation: decode.conversation(data.conversation),
        messages: decode.messages(data.messages),
        artifacts: decode.artifacts(data.artifacts),
      };
    },
    async quotas(signal) {
      if (mode === "demo") return (await demo()).quotas(signal);
      return decode.quotas(
        record(await request<unknown>(ROOT + "/audit/limits", { signal }))
          .limits,
      );
    },
    async saveQuota(payload) {
      if (mode === "demo") return (await demo()).saveQuota(payload);
      await request<unknown>(ROOT + "/audit/limits", json(payload, "PATCH"));
    },
  };
}
