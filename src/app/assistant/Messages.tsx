import { useEffect, useRef } from "react";
import { Paperclip } from "lucide-react";
import { Button, RichText } from "@/shared/ui";
import type {
  AssistantApi,
  Bootstrap,
  Language,
  Thread,
} from "@/core/assistant/types";
import { ArtifactCard } from "./ArtifactCard";
import { Visualizations } from "./Visualizations";
import { labels } from "./i18n";

const EMPTY_MESSAGES: Thread["messages"] = [];

export function Messages({
  thread,
  api,
  scope,
  bootstrap,
  language,
  pending = false,
  canLoadOlder,
  onOlder,
}: {
  thread?: Thread;
  api: AssistantApi;
  scope: string;
  bootstrap?: Bootstrap;
  language: Language;
  pending?: boolean;
  canLoadOlder?: boolean;
  onOlder?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const previousFirst = useRef<string | null>(null);
  const t = labels(language);
  const entries = thread?.messages ?? EMPTY_MESSAGES;
  useEffect(() => {
    const element = host.current;
    const first = entries[0]?.key ?? null;
    const prepended =
      previousFirst.current !== null &&
      first !== previousFirst.current &&
      entries.length > 1;
    previousFirst.current = first;
    if (element && follow.current && !prepended)
      element.scrollTop = element.scrollHeight;
  }, [thread?.conversation.public_id, entries]);
  const attached = new Set(
    entries.flatMap((message) =>
      message.artifacts.map((artifact) => artifact.id),
    ),
  );
  return (
    <div
      className="assistant-messages"
      ref={host}
      role="log"
      aria-label={t.chat}
      aria-live="polite"
      aria-relevant="additions"
      onScroll={() => {
        if (host.current)
          follow.current =
            host.current.scrollHeight -
              host.current.scrollTop -
              host.current.clientHeight <
            80;
      }}
    >
      {onOlder && canLoadOlder && entries.length >= 100 && (
        <Button
          size="sm"
          className="assistant-older"
          disabled={pending}
          onClick={onOlder}
        >
          Cargar mensajes anteriores
        </Button>
      )}
      {!entries.length && (
        <div className="assistant-welcome">
          <img src="/brand/assistant.svg" alt="" />
          <strong>{t.welcome}</strong>
          <p>{t.welcomeHint}</p>
        </div>
      )}
      {entries.map((message) => (
        <article
          className={
            "assistant-message assistant-message-" +
            (message.role === "user" ? "user" : "assistant")
          }
          key={message.key}
        >
          <div className="assistant-bubble">
            {message.role === "user" || message.status === "streaming" ? (
              <div className="assistant-plain-text">
                {message.content ||
                  (message.status === "streaming" ? t.thinking : "")}
              </div>
            ) : (
              <RichText
                text={
                  message.content ||
                  (message.status === "failed" ? t.error : "")
                }
              />
            )}
            {message.attachments.map((file, index) => (
              <div
                className="assistant-message-attachment"
                key={file.file_ref ?? index}
              >
                <Paperclip size={13} />
                {file.filename}
              </div>
            ))}
          </div>
          {(message.created_at ||
            (message.status && message.status !== "complete")) && (
            <small className="assistant-message-meta">
              {message.created_at?.replace("T", " ").slice(0, 16)}
              {message.status !== "complete" ? " · " + message.status : ""}
            </small>
          )}
          {message.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              api={api}
              scope={scope}
              conversation={thread!.conversation.public_id}
              canGenerate={!!bootstrap?.can_generate_artifacts}
              t={t}
            />
          ))}
          <Visualizations values={message.visualizations} t={t} />
        </article>
      ))}
      {thread?.artifacts
        .filter((artifact) => !attached.has(artifact.id))
        .map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            api={api}
            scope={scope}
            conversation={thread.conversation.public_id}
            canGenerate={!!bootstrap?.can_generate_artifacts}
            t={t}
          />
        ))}
    </div>
  );
}
