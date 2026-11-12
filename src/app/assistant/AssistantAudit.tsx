import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Loading, TextField } from "@/shared/ui";
import type { AssistantSession } from "./useAssistantSession";
import { ConversationList } from "./ConversationList";
import { Messages } from "./Messages";
import { labels } from "./i18n";
export function AssistantAudit({ session }: { session: AssistantSession }) {
  const [draft, setDraft] = useState(""),
    [username, setUsername] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const t = labels(session.language);
  const query = useQuery({
    queryKey: ["assistant", session.scope, "audit", username],
    queryFn: ({ signal }) => session.api.audit(username, signal),
  });
  const detail = useQuery({
    queryKey: ["assistant", session.scope, "audit-thread", selected],
    queryFn: ({ signal }) => session.api.auditThread(selected!, signal),
    enabled: !!selected,
  });
  return (
    <section className="assistant-audit" aria-label={t.audit}>
      <form
        className="assistant-audit-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setUsername(draft.trim());
          setSelected(null);
          if (username === draft.trim()) void query.refetch();
        }}
      >
        <TextField
          label="Usuario"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" variant="primary">
          {t.search}
        </Button>
      </form>
      {query.error && <Alert tone="danger">{query.error.message}</Alert>}
      {selected ? (
        <>
          <Button
            size="sm"
            className="assistant-audit-back"
            onClick={() => setSelected(null)}
          >
            {t.conversations}
          </Button>
          {detail.isPending && <Loading />}
          {detail.error && <Alert tone="danger">{detail.error.message}</Alert>}
          <Messages
            thread={detail.data}
            api={session.api}
            scope={session.scope}
            language={session.language}
            bootstrap={
              session.bootstrap.data
                ? { ...session.bootstrap.data, can_generate_artifacts: false }
                : undefined
            }
          />
        </>
      ) : query.isPending ? (
        <Loading />
      ) : (
        <ConversationList
          conversations={query.data ?? []}
          onSelect={(conversation) => setSelected(conversation.public_id)}
          empty={t.empty}
          deleteLabel={t.delete}
        />
      )}
    </section>
  );
}
