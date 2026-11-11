import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button, IconButton, type ButtonProps } from "./Button";
import { Alert } from "./Feedback";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

export interface ModalProps {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  busy?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
}
/** Native dialog supplies modal semantics and focus containment. IDs are unique. */
export function Modal({
  title,
  icon,
  subtitle,
  onClose,
  children,
  size = "md",
  busy = false,
  closeOnBackdrop = true,
  className = "",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useBodyScrollLock();
  useEffect(() => {
    const element = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    if (!element.open) element.showModal();
    element.querySelector<HTMLElement>('[data-initial-focus="true"]')?.focus();
    return () => {
      element.close();
      if (focused?.isConnected) focused.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`modal ${size === "xl" ? "modal-extra-wide" : size === "lg" ? "modal-wide" : ""} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy && closeOnBackdrop)
          onClose();
      }}
    >
      <div className="modal-heading">
        <div className={icon ? "modal-title-with-icon" : undefined}>
          {icon && (
            <span className="modal-title-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={descriptionId}>{subtitle}</p>}
          </div>
        </div>
        <IconButton
          label="Cerrar ventana"
          icon={<X size={20} />}
          onClick={onClose}
          disabled={busy}
        />
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="modal-body">{children}</div>;
}
export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="modal-footer">{children}</div>;
}
export function ConfirmDialog({
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  pendingLabel = "Procesando…",
  confirmVariant = "danger",
  pending = false,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      subtitle={description}
      onClose={onClose}
      busy={pending}
    >
      <DialogBody>
        <div className="delete-warning-icon">
          <AlertTriangle size={26} />
        </div>
        {children}
        {error ? (
          <Alert tone="danger">
            {error instanceof Error
              ? error.message
              : "No se pudo completar la operación."}
          </Alert>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button disabled={pending} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant={confirmVariant}
          loading={pending}
          loadingLabel={pendingLabel}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Modal>
  );
}
