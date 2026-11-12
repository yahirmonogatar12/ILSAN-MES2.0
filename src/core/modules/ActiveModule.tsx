import { createContext, useContext } from "react";

/** Workspace-owned metadata shared with global tools independently of its markup. */
export interface ActiveModule {
  id: string;
  title: string;
  path: string;
  panelId: string;
}
export const ActiveModuleContext = createContext<ActiveModule | null>(null);
export const useActiveModule = () => useContext(ActiveModuleContext);
