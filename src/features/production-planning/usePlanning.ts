import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createPlanningApi } from "./api";

export function usePlanning() {
  const auth = useAuth(),
    client = useQueryClient(),
    toast = useToast(),
    api = useMemo(() => createPlanningApi(auth.mode), [auth.mode]);
  return {
    ...auth,
    api,
    client,
    key: (...parts: unknown[]) => ["production-planning", auth.scope, ...parts],
    saved: (message = "Cambios guardados.") => {
      toast(message);
      void client.invalidateQueries({
        queryKey: ["production-planning", auth.scope],
      });
    },
  };
}
