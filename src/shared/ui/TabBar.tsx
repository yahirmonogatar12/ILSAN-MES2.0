import { useEffect, useRef } from "react";
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
}: {
  id: string;
  label: string;
  items: readonly TabItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  onClose?: (id: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
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
    >
      {items.map((item, index) => {
        const selected = item.id === activeId;
        const ids = tabIds(id, item.id);
        return (
          <div
            role="presentation"
            className={`ui-tab-item ${selected ? "ui-tab-active" : ""}`}
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
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
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
