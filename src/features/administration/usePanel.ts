import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createPanelApi } from "./panelApi";

export const panelKeys = {
  all: (scope: string) => ["administration-panel", scope] as const,
  data: (scope: string, name: string) =>
    ["administration-panel", scope, name] as const,
};
export function usePanel() {
  const { mode, scope, profile } = useAuth();
  const api = useMemo(() => createPanelApi(mode), [mode]);
  const client = useQueryClient();
  const notify = useToast();
  function saved(message: string) {
    notify(message);
    void client.invalidateQueries({ queryKey: panelKeys.all(scope) });
    // Department forms and global forms share records on the server.
    void client.invalidateQueries({ queryKey: ["administration", scope] });
    void client.invalidateQueries({
      queryKey: ["administration", scope + ":panel"],
    });
    void client.invalidateQueries({ queryKey: ["permission", scope] });
    if (mode === "live")
      void client.invalidateQueries({ queryKey: ["session", mode] });
  }
  return { api, scope, profile, saved };
}
