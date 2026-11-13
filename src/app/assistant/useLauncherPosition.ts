import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { usePersistentState } from "@/shared/hooks/usePersistentState";

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  left: number;
  width: number;
  moved: boolean;
}

/** Keep the launcher on an edge, preserving native activation for clicks and taps. */
export function useLauncherPosition(scope: string) {
  const [side, setSide] = usePersistentState<"left" | "right" | null>(
    "mes-ai-launcher-side:" + scope,
    null,
    (value) => (value === "left" || value === "right" ? value : null),
  );
  const [left, setLeft] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  function position(event: PointerEvent<HTMLButtonElement>, active: Drag) {
    active.moved ||=
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >
      6;
    return Math.max(
      0,
      Math.min(
        window.innerWidth - active.width,
        active.left + event.clientX - active.startX,
      ),
    );
  }

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const finalLeft = position(event, active);
    suppressClick.current = active.moved;
    if (active.moved && !cancelled)
      setSide(
        finalLeft + active.width / 2 < window.innerWidth / 2 ? "left" : "right",
      );
    drag.current = null;
    setLeft(null);
    if (!cancelled && !active.moved && event.pointerType === "touch") {
      // Activate the tap once, then consume any compatibility click from the browser.
      event.preventDefault();
      event.currentTarget.click();
      suppressClick.current = true;
    }
  }

  return {
    side,
    dragging: left !== null,
    style: left === null ? undefined : { left, right: "auto" },
    handlers: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0 || event.isPrimary === false || drag.current)
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          left: bounds.left,
          width: bounds.width,
          moved: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const next = position(event, active);
        if (active.moved) setLeft(next);
      },
      onPointerUp: finish,
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
        finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) =>
        finish(event, true),
      onClickCapture(event: MouseEvent<HTMLButtonElement>) {
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault();
          event.stopPropagation();
        }
        suppressClick.current = false;
      },
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        setSide(event.key === "ArrowLeft" ? "left" : "right");
      },
    },
  };
}
