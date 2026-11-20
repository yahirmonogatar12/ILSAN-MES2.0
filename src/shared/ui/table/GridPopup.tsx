import { useEffect, useId, useRef, type ReactNode } from "react";
import { focusableControls } from "../../lib/focus";

export interface GridAnchor {
  x: number;
  y: number;
  trigger: HTMLElement;
}
/** Native popover reaches the top layer, including when the grid is inside a modal. */
export function GridPopup({
  anchor,
  title,
  onClose,
  onSubmit,
  children,
}: {
  anchor: GridAnchor;
  title: string;
  onClose: () => void;
  /** Enter in any field of the popup applies it, as in Excel's filter list. */
  onSubmit?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current!;
    const close = (event: PointerEvent) => {
      if (
        !element.contains(event.target as Node) &&
        !anchor.trigger.contains(event.target as Node)
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    if (element.showPopover) element.showPopover();
    else {
      element.setAttribute("data-fallback", "true");
      element.style.display = "block";
    }
    (
      element.querySelector<HTMLElement>("input") ||
      element.querySelector<HTMLElement>("button")
    )?.focus();
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape, true);
      if (element.hidePopover && element.matches(":popover-open"))
        element.hidePopover();
      if (anchor.trigger.isConnected) anchor.trigger.focus();
    };
  }, [anchor, onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={id}
      popover="manual"
      className="grid-popup"
      onKeyDown={(event) => {
        const controls = focusableControls(event.currentTarget);
        const index = controls.indexOf(event.target as HTMLElement);
        if (index < 0) return;
        const { key, shiftKey } = event;
        // Tab stays inside the popup until it is applied or closed.
        if (key === "Tab") {
          const edge = shiftKey ? 0 : controls.length - 1;
          if (index !== edge) return;
          event.preventDefault();
          controls[shiftKey ? controls.length - 1 : 0].focus();
        } else if (key === "ArrowDown" || key === "ArrowUp") {
          // Up/Down walk the search box, the values and the actions.
          const next = controls[index + (key === "ArrowDown" ? 1 : -1)];
          if (!next) return;
          event.preventDefault();
          next.focus();
        } else if (
          key === "Enter" &&
          onSubmit &&
          (event.target as HTMLElement).matches("input")
        ) {
          event.preventDefault();
          onSubmit();
        }
      }}
      style={{
        left: Math.max(8, Math.min(anchor.x, window.innerWidth - 292)),
        top: Math.max(8, Math.min(anchor.y, window.innerHeight - 438)),
      }}
    >
      <strong id={id}>{title}</strong>
      {children}
    </div>
  );
}
