import type { ReactNode } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page } from "@/shared/ui";
import "./module.css";
import "./panel.css";

export function PanelLayout({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Page
      className={`administration-panel ${className}`}
      banner={<DemoBanner />}
    >
      {children}
    </Page>
  );
}
