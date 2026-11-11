import { useId, useState } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page, TabBar, tabIds } from "@/shared/ui";
import { HistoryView } from "./HistoryPage";
import type { HistoryKind } from "./types";

const tabs = [
  { id: "interlock", label: "Paros de interlock" },
  { id: "vision", label: "Escáner ICT" },
] as const;
export default function InterlockPage() {
  const id = useId();
  const [active, setActive] = useState<HistoryKind>("interlock");
  const [visited, setVisited] = useState<HistoryKind[]>(["interlock"]);
  return (
    <Page className="quality-control-page" banner={<DemoBanner />}>
      <TabBar
        id={id}
        label="Process interlock History"
        items={tabs}
        activeId={active}
        onChange={(key) => {
          const next = key === "vision" ? "vision" : "interlock";
          setActive(next);
          setVisited((previous) =>
            previous.includes(next) ? previous : [...previous, next],
          );
        }}
      />
      {tabs
        .filter((tab) => visited.includes(tab.id))
        .map((tab) => {
          const ids = tabIds(id, tab.id);
          return (
            <div
              key={tab.id}
              id={ids.panel}
              role="tabpanel"
              aria-labelledby={ids.tab}
              hidden={active !== tab.id}
              className="quality-control-panel"
            >
              <HistoryView kind={tab.id} active={active === tab.id} />
            </div>
          );
        })}
    </Page>
  );
}
