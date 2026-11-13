import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  title?: string;
  icon?: ReactNode;
}

export function tabIds(prefix: string, id: string) {
  const key = encodeURIComponent(id);
  return { tab: `${prefix}-tab-${key}`, panel: `${prefix}-panel-${key}` };
}
