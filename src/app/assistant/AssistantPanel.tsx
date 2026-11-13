import type { ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { IconButton, Modal } from "@/shared/ui";
import "./assistant.css";

/** One frame for lazy loading, errors and the ready assistant workspace. */
export function AssistantPanel({
  title = "Asistente IA",
  subtitle = "ILSAN MES",
  expanded,
  toggleLabel,
  onToggle,
  onClose,
  headerActions,
  children,
}: {
  title?: string;
  subtitle?: string;
  expanded: boolean;
  toggleLabel?: string;
  onToggle: () => void;
  onClose: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={<img src="/brand/assistant.svg" alt="" />}
      onClose={onClose}
      closeOnBackdrop={false}
      className={
        "assistant-panel" + (expanded ? " assistant-panel-expanded" : "")
      }
      headerActions={
        <>
          {headerActions}
          <IconButton
            label={
              toggleLabel ?? (expanded ? "Reducir panel" : "Expandir panel")
            }
            icon={expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            onClick={onToggle}
          />
        </>
      }
    >
      {children}
    </Modal>
  );
}
