import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createApi } from "./api";

export function useProcess() {
  const auth = useAuth(),
    api = useMemo(() => createApi(auth.mode), [auth.mode]),
    client = useQueryClient(),
    toast = useToast();
  return {
    ...auth,
    api,
    client,
    key: (...parts: unknown[]) => ["process-production", auth.scope, ...parts],
    saved: (message = "Cambios guardados.") => {
      void client.invalidateQueries({
        queryKey: ["process-production", auth.scope],
      });
      toast(message);
    },
  };
}
