import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createAdministrationApi } from "./api";
import { administrationKeys as keys } from "./config";

export function useAdministration() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createAdministrationApi(mode), [mode]);
  const client = useQueryClient();
  const notify = useToast();
  function afterSaved(message: string) {
    notify(message);
    // A refresh failure must not present a successful write as a failed save.
    void client.invalidateQueries({ queryKey: keys.all(scope) });
    void client.invalidateQueries({ queryKey: ["permission", scope] });
    if (mode === "live")
      void client.invalidateQueries({ queryKey: ["session", mode] });
  }
  return { api, scope, afterSaved };
}
export function useUsers() {
  const base = useAdministration();
  const context = useQuery({
    queryKey: keys.userContext(base.scope),
    queryFn: ({ signal }) => base.api.userContext(signal),
  });
  const list = useQuery({
    queryKey: keys.users(base.scope),
    queryFn: ({ signal }) => base.api.users(signal),
    enabled: context.isSuccess,
  });
  return { ...base, context, list };
}
export function useAuthorities() {
  const base = useAdministration();
  const context = useQuery({
    queryKey: keys.authorityContext(base.scope),
    queryFn: ({ signal }) => base.api.authorityContext(signal),
  });
  const list = useQuery({
    queryKey: keys.roles(base.scope),
    queryFn: ({ signal }) => base.api.roles(signal),
    enabled: context.isSuccess,
  });
  return { ...base, context, list };
}
