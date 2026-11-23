import { useEffect, useRef, useState, type DragEvent } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";
import { tabIds, type TabItem } from "./tabs";
import "./tabs.css";
/** Controlled tabs: no routes, session, persistence or business dependencies. */
export function TabBar({
  id,
  label,
  items,
  activeId,
  onChange,
  onClose,
  onReorder,
  onDragOut,
}: {
  id: string;
  label: string;
  items: readonly TabItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  onClose?: (id: string) => void;
  /** Moves a tab so it ends at `index`: dragged within the bar, like browser tabs, or Ctrl+Shift+arrows. */
  onReorder?: (id: string, index: number) => void;
  /** A tab dragged away from the bar and released where nothing accepts it; `at` is the screen point. */
  onDragOut?: (id: string, at: { x: number; y: number }) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  // Tab being dragged from this bar; other bars and outside drags are ignored.
  const dragged = useRef<string | null>(null);
  // Insertion slot (0..items.length) under the pointer while dragging.
  const [slot, setSlot] = useState<number | null>(null);
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const reveal = () => {
      const item = element.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      )?.parentElement;
      if (!item) return;
      const viewport = element.getBoundingClientRect();
      const target = item.getBoundingClientRect();
      // Reveal the whole chip, including its close button, and scroll only this
      // strip rather than allowing scrollIntoView to move surrounding content.
      if (target.left < viewport.left)
        element.scrollLeft += target.left - viewport.left;
      else if (target.right > viewport.right)
        element.scrollLeft += target.right - viewport.right;
    };
    reveal();
    // Container width also changes when the sidebar opens/closes, not only on
    // window resize. Keep the selected tab visible without polling.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(reveal);
      observer.observe(element);
      return () => observer.disconnect();
    }
  }, [activeId, items.length]);
  function slotAt(event: DragEvent<HTMLElement>) {
    const chips = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(".ui-tab-item"),
    ];
    const index = chips.findIndex((chip) => {
      const box = chip.getBoundingClientRect();
      return event.clientX < box.left + box.width / 2;
    });
    return index < 0 ? chips.length : index;
  }
  const from = items.findIndex((item) => item.id === dragged.current);
  // Dropping right before or after the dragged tab leaves it where it is.
  const marker =
    slot === null || slot === from || slot === from + 1 ? null : slot;
  function move(index: number) {
    const target = items[(index + items.length) % items.length];
    if (!target) return;
    strip.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [(index + items.length) % items.length]?.focus();
    onChange(target.id);
  }
  return (
    <div
      ref={strip}
      className="ui-tabs"
      role={items.length ? "tablist" : undefined}
      aria-label={items.length ? label : undefined}
      aria-orientation={items.length ? "horizontal" : undefined}
      onDragOver={(event) => {
        if (!onReorder || !dragged.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setSlot(slotAt(event));
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setSlot(null);
      }}
      onDrop={(event) => {
        const id = dragged.current;
        if (!onReorder || !id) return;
        event.preventDefault();
        const target = slotAt(event);
        const index = items.findIndex((item) => item.id === id);
        setSlot(null);
        onReorder(id, target > index ? target - 1 : target);
      }}
    >
      {items.map((item, index) => {
        const selected = item.id === activeId;
        const ids = tabIds(id, item.id);
        return (
          <div
            role="presentation"
            className={`ui-tab-item ${selected ? "ui-tab-active" : ""} ${
              marker === index
                ? "ui-tab-drop-before"
                : marker === items.length && index === items.length - 1
                  ? "ui-tab-drop-after"
                  : ""
            }`}
            key={item.id}
          >
            <Button
              variant="plain"
              role="tab"
              id={ids.tab}
              aria-controls={ids.panel}
              aria-selected={selected}
              tabIndex={selected || (!activeId && index === 0) ? 0 : -1}
              className="ui-tab"
              title={item.title || item.label}
              onClick={() => onChange(item.id)}
              draggable={!!(onDragOut || onReorder)}
              onDragStart={(event) => {
                dragged.current = item.id;
                // A private type only: drop targets that read text/plain ignore a tab.
                event.dataTransfer.setData("application/x-ui-tab", item.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={(event) => {
                dragged.current = null;
                setSlot(null);
                const bar = strip.current?.getBoundingClientRect();
                if (
                  !onDragOut ||
                  !bar ||
                  event.dataTransfer.dropEffect !== "none"
                )
                  return;
                // Released on or next to the bar counts as a cancelled drag.
                if (
                  event.clientY > bar.top - 40 &&
                  event.clientY < bar.bottom + 40
                )
                  return;
                onDragOut(item.id, { x: event.screenX, y: event.screenY });
              }}
              onKeyDown={(event) => {
                const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
                if (step && event.ctrlKey && event.shiftKey) {
                  event.preventDefault();
                  const target = index + step;
                  if (onReorder && target >= 0 && target < items.length)
                    onReorder(item.id, target);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  move(index + 1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(index - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  move(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  move(items.length - 1);
                } else if (event.key === "Delete" && onClose) {
                  event.preventDefault();
                  onClose(item.id);
                }
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
            {onClose && (
              <IconButton
                className="ui-tab-close"
                label={`Cerrar ${item.label}`}
                icon={<X size={12} />}
                tabIndex={selected ? 0 : -1}
                onClick={() => onClose(item.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
