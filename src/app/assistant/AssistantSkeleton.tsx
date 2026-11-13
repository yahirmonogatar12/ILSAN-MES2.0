import { Skeleton } from "@/shared/ui";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantSkeleton({
  messagesOnly = false,
}: {
  messagesOnly?: boolean;
}) {
  return (
    <div
      className="assistant-skeleton"
      role="status"
      aria-label="Cargando asistente…"
      aria-busy="true"
    >
      <span className="ui-skeleton-label">Cargando asistente…</span>
      {!messagesOnly && (
        <div className="assistant-skeleton-toolbar" aria-hidden="true">
          <Skeleton />
          <Skeleton />
        </div>
      )}
      <div className="assistant-skeleton-messages" aria-hidden="true">
        {[0, 1, 2].map((message) => (
          <div className="assistant-skeleton-message" key={message}>
            <Skeleton className="assistant-skeleton-avatar" />
            <div className="assistant-skeleton-bubble">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          </div>
        ))}
      </div>
      {!messagesOnly && (
        <div className="assistant-skeleton-composer" aria-hidden="true">
          <Skeleton />
          <div>
            <Skeleton />
            <Skeleton />
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistantHistorySkeleton() {
  return (
    <div
      className="assistant-history-skeleton"
      role="status"
      aria-label="Cargando conversaciones…"
      aria-busy="true"
    >
      <span className="ui-skeleton-label">Cargando conversaciones…</span>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} aria-hidden="true">
          <Skeleton />
          <Skeleton />
        </div>
      ))}
    </div>
  );
}

export function AssistantLoading({
  expanded,
  onToggle,
  onClose,
}: {
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <AssistantPanel
      expanded={expanded}
      onToggle={onToggle}
      onClose={onClose}
      headerActions={<Skeleton className="assistant-skeleton-language" />}
    >
      <div className="assistant-skeleton-tabs" aria-hidden="true">
        <Skeleton />
        <Skeleton />
      </div>
      <div className="assistant-layout">
        {expanded && (
          <aside
            className="assistant-history-sidebar"
            aria-label="Conversaciones"
          >
            <AssistantHistorySkeleton />
          </aside>
        )}
        <AssistantSkeleton />
      </div>
    </AssistantPanel>
  );
}
