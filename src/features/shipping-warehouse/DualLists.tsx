import { useId, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { TabBar, tabIds } from "@/shared/ui";

/** Both panels remain available on desktop. Compact screens give the active table the available height. */
export function DualLists({
  label,
  left,
  right,
}: {
  label: string;
  left: { label: string; content: ReactNode };
  right: { label: string; content: ReactNode };
}) {
  const compact = useMediaQuery("(max-width: 700px), (max-height: 800px)");
  const id = useId();
  const [active, setActive] = useState("left");
  const panels = [
    { id: "left", ...left },
    { id: "right", ...right },
  ];
  return (
    <div
      className={`shipping-warehouse-dual ${compact ? "shipping-warehouse-dual-compact" : ""}`}
    >
      {compact && (
        <TabBar
          id={id}
          label={label}
          items={panels}
          activeId={active}
          onChange={setActive}
        />
      )}
      {panels.map((panel) => {
        const ids = tabIds(id, panel.id);
        return (
          <div
            key={panel.id}
            className="shipping-warehouse-panel"
            hidden={compact && active !== panel.id}
            id={ids.panel}
            role={compact ? "tabpanel" : undefined}
            aria-labelledby={compact ? ids.tab : undefined}
          >
            {panel.content}
          </div>
        );
      })}
    </div>
  );
}
