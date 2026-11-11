import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/AuthProvider";
import { useToast } from "@/shared/ui";
import { createQualityApi } from "./api";

export function useQuality() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createQualityApi(mode), [mode]);
  const client = useQueryClient();
  const toast = useToast();
  return {
    api,
    mode,
    scope,
    key: (...parts: unknown[]) => ["quality-control", scope, ...parts],
    stationSaved: (message: string) => {
      void client.invalidateQueries({
        queryKey: ["quality-control", scope, "stations"],
      });
      toast(message);
    },
  };
}
