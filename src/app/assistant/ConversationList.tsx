import { Trash2 } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import type { Conversation } from "@/core/assistant/types";
export function ConversationList({
  conversations,
  selected,
  pending,
  onSelect,
  onDelete,
  empty,
  deleteLabel,
}: {
  conversations: Conversation[];
  selected?: string | null;
  pending?: boolean;
  onSelect: (conversation: Conversation) => void;
  onDelete?: (conversation: Conversation) => void;
  empty: string;
  deleteLabel: string;
}) {
  return (
    <div className="assistant-conversations">
      {!conversations.length && <p className="assistant-empty-list">{empty}</p>}
      {conversations.map((conversation) => (
        <div
          className="assistant-conversation-row"
          key={conversation.public_id}
        >
          <Button
            variant="plain"
            className="assistant-conversation"
            data-selected={selected === conversation.public_id}
            aria-current={
              selected === conversation.public_id ? "true" : undefined
            }
            disabled={pending}
            onClick={() => onSelect(conversation)}
          >
            <strong>
              {conversation.username ? conversation.username + " · " : ""}
              {conversation.title}
            </strong>
            <small>
              {conversation.status}
              {conversation.updated_at
                ? " · " + conversation.updated_at.replace("T", " ").slice(0, 16)
                : ""}
            </small>
          </Button>
          {onDelete && (
            <IconButton
              label={deleteLabel + " · " + conversation.title}
              icon={<Trash2 size={14} />}
              disabled={pending}
              onClick={() => onDelete(conversation)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
