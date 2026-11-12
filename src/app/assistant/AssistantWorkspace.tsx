import { useEffect, useState } from "react";
import { Archive, Maximize2, Minimize2, Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  CheckboxField,
  ConfirmDialog,
  ErrorState,
  IconButton,
  Loading,
  Modal,
  SelectField,
  TabBar,
  tabIds,
} from "@/shared/ui";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import type { Conversation, Language } from "@/core/assistant/types";
import { useAssistantSession } from "./useAssistantSession";
import { labels } from "./i18n";
import { ConversationList } from "./ConversationList";
import { ChatComposer } from "./ChatComposer";
import { Messages } from "./Messages";
import { AssistantAudit } from "./AssistantAudit";
import { AssistantQuotas } from "./AssistantQuotas";
import "./assistant.css";

export default function AssistantWorkspace({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const session = useAssistantSession(open);
  const [expanded, setExpanded] = usePersistentState(
    "mes-ai-expanded:" + session.scope,
    false,
    (value) => value === true,
  );
  const [tab, setTab] = useState("chat");
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const t = labels(session.language);
  const tabs: { id: string; label: string }[] = [
    { id: "chat", label: t.chat },
    { id: "history", label: t.history },
  ];
  if (session.access.audit) tabs.push({ id: "audit", label: t.audit });
  if (session.access.limits) tabs.push({ id: "limits", label: t.limits });
  const active = tabs.some((item) => item.id === tab) ? tab : "chat";
  useEffect(() => {
    if (active !== tab) setTab(active);
  }, [active, tab]);
  if (!open) return null;
  const history = (
    <div className="assistant-history">
      <div className="assistant-history-toolbar">
        <Button
          size="sm"
          icon={<Plus size={14} />}
          disabled={session.busy}
          onClick={() => {
            void session.newChat();
            setTab("chat");
          }}
        >
          {t.newChat}
        </Button>
        <CheckboxField
          label={t.showArchived}
          checked={session.archived}
          disabled={session.busy}
          onChange={(event) => session.setArchived(event.target.checked)}
        />
      </div>
      {session.history.isPending ? (
        <Loading />
      ) : session.history.isError ? (
        <ErrorState
          error={session.history.error}
          onRetry={() => void session.history.refetch()}
        />
      ) : (
        <ConversationList
          conversations={session.history.data}
          selected={session.selected}
          pending={session.busy}
          empty={t.empty}
          deleteLabel={t.delete}
          onSelect={(conversation) => {
            session.select(conversation);
            setTab("chat");
          }}
          onDelete={setDeleting}
        />
      )}
    </div>
  );
  const bootstrap = session.bootstrap.data;
  const effectiveBootstrap = bootstrap
    ? { ...bootstrap, can_generate_artifacts: session.access.artifacts }
    : undefined;
  return (
    <>
      <Modal
        title={t.title}
        subtitle={
          bootstrap?.model ? "ILSAN MES · " + bootstrap.model : "ILSAN MES"
        }
        icon={<img src="/brand/assistant.svg" alt="" />}
        onClose={onClose}
        closeOnBackdrop={false}
        className={
          "assistant-panel" + (expanded ? " assistant-panel-expanded" : "")
        }
        headerActions={
          <>
            <SelectField
              aria-label="Idioma del asistente"
              containerClassName="assistant-language"
              value={session.language}
              disabled={session.busy}
              options={[
                { value: "auto", label: "Auto" },
                { value: "es", label: "Español" },
                { value: "en", label: "English" },
                { value: "ko", label: "한국어" },
              ]}
              onChange={(event) =>
                void session.changeLanguage(event.target.value as Language)
              }
            />
            <IconButton
              label={expanded ? t.collapse : t.expand}
              icon={
                expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />
              }
              onClick={() => setExpanded(!expanded)}
            />
          </>
        }
      >
        <TabBar
          id="assistant"
          label={t.title}
          items={tabs}
          activeId={active}
          onChange={setTab}
        />
        <div className="assistant-layout">
          {expanded && active === "chat" && (
            <aside
              className="assistant-history-sidebar"
              aria-label={t.conversations}
            >
              {history}
            </aside>
          )}
          <section
            className="assistant-tab-panel"
            role="tabpanel"
            id={tabIds("assistant", active).panel}
            aria-labelledby={tabIds("assistant", active).tab}
          >
            {session.bootstrap.isPending ? (
              <Loading />
            ) : session.bootstrap.isError ? (
              <ErrorState
                error={session.bootstrap.error}
                onRetry={() => void session.bootstrap.refetch()}
              />
            ) : (
              <>
                {active === "history" && history}
                {active === "audit" && session.access.audit && (
                  <AssistantAudit session={session} />
                )}
                {active === "limits" && session.access.limits && (
                  <AssistantQuotas session={session} />
                )}
                {active === "chat" && (
                  <div
                    className="assistant-chat"
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes("Files"))
                        event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!event.dataTransfer.files.length) return;
                      event.preventDefault();
                      if (!session.busy && bootstrap?.configured)
                        void session.upload(
                          Array.from(event.dataTransfer.files),
                        );
                    }}
                    onPaste={(event) => {
                      if (!event.clipboardData.files.length) return;
                      event.preventDefault();
                      if (!session.busy && bootstrap?.configured)
                        void session.upload(
                          Array.from(event.clipboardData.files),
                        );
                    }}
                  >
                    <div className="assistant-chat-toolbar">
                      <Button
                        size="sm"
                        icon={<Plus size={14} />}
                        disabled={session.busy}
                        onClick={() => void session.newChat()}
                      >
                        {t.newChat}
                      </Button>
                      <span
                        className="assistant-chat-title"
                        title={session.detail.data?.conversation.title}
                      >
                        {session.detail.data?.conversation.title}
                      </span>
                      {session.detail.data && (
                        <>
                          {session.detail.data.conversation.status !==
                            "archived" && (
                            <IconButton
                              label={t.archive}
                              icon={<Archive size={16} />}
                              disabled={session.busy}
                              onClick={() => void session.archive()}
                            />
                          )}
                          <IconButton
                            label={t.delete}
                            icon={<Trash2 size={16} />}
                            disabled={session.busy}
                            onClick={() =>
                              setDeleting(session.detail.data!.conversation)
                            }
                          />
                        </>
                      )}
                    </div>
                    {!bootstrap?.configured && (
                      <Alert tone="warning">{t.notConfigured}</Alert>
                    )}
                    {session.mode === "demo" && (
                      <Alert>
                        Modo demostración · Las respuestas del asistente son de
                        ejemplo.
                      </Alert>
                    )}
                    {session.selected && session.detail.isPending ? (
                      <Loading />
                    ) : session.detail.isError ? (
                      <ErrorState
                        error={session.detail.error}
                        onRetry={() => void session.detail.refetch()}
                      />
                    ) : (
                      <Messages
                        key={session.selected}
                        thread={session.detail.data}
                        api={session.api}
                        scope={session.scope}
                        bootstrap={effectiveBootstrap}
                        language={session.language}
                        pending={session.busy}
                        canLoadOlder={session.canLoadOlder}
                        onOlder={() => void session.older()}
                      />
                    )}
                    {(session.error || session.stream.error) && (
                      <Alert tone="danger">
                        {session.error || session.stream.error}
                      </Alert>
                    )}
                    {(session.stream.pending || session.stream.canRetry) && (
                      <div className="assistant-stream-status" role="status">
                        {session.stream.pending ? (
                          <>
                            <span className="assistant-pulse" />
                            {session.stream.progress || t.thinking}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => void session.retry()}
                            disabled={session.busy}
                          >
                            {t.retry}
                          </Button>
                        )}
                      </div>
                    )}
                    <ChatComposer session={session} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </Modal>
      {deleting && (
        <ConfirmDialog
          title={t.delete}
          confirmLabel={t.delete}
          pending={session.operating}
          error={session.error}
          onClose={() => {
            setDeleting(null);
            session.clearError();
          }}
          onConfirm={() => {
            void session.remove(deleting).then((success) => {
              if (success) setDeleting(null);
            });
          }}
        >
          <p>{t.deleteConfirm}</p>
          <strong>{deleting.title}</strong>
        </ConfirmDialog>
      )}
    </>
  );
}
