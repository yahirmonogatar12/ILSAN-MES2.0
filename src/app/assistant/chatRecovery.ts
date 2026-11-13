import { mergeById } from "@/core/assistant/model";
import type { AssistantApi, SendRequest } from "@/core/assistant/types";

/** ACK ids identify the exact reply even when requests from other tabs interleave. */
export async function recoverChat(
  api: AssistantApi,
  attempt: { conversation: string; payload: SendRequest; assistantId?: number },
  signal: AbortSignal,
) {
  let thread = await api.thread(attempt.conversation, signal);
  signal.throwIfAborted();
  if (
    attempt.assistantId &&
    !thread.messages.some((message) => message.id === attempt.assistantId)
  ) {
    const older = await api.thread(
      attempt.conversation,
      signal,
      attempt.assistantId + 1,
    );
    signal.throwIfAborted();
    thread = {
      ...thread,
      messages: mergeById(older.messages, thread.messages).sort(
        (a, b) => a.id - b.id,
      ),
      artifacts: mergeById(older.artifacts, thread.artifacts),
    };
  }
  const userIndex = thread.messages.findIndex(
    (message) =>
      message.role === "user" &&
      message.client_message_id === attempt.payload.client_message_id,
  );
  const following = userIndex >= 0 ? thread.messages[userIndex + 1] : undefined;
  const answer = attempt.assistantId
    ? thread.messages.find(
        (message) =>
          message.role === "assistant" && message.id === attempt.assistantId,
      )
    : following?.role === "assistant"
      ? following
      : undefined;
  return {
    thread,
    answer,
    accepted: userIndex >= 0 || !!answer,
    // An unacknowledged reply cannot be associated reliably across concurrent tabs.
    failed:
      !!attempt.assistantId &&
      !!answer &&
      ["failed", "cancelled", "interrupted"].includes(answer.status),
  };
}
