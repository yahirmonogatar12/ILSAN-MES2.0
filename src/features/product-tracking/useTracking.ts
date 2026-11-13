import { useMemo } from "react";
import { useAuth } from "@/core/auth/useAuth";
import { createTrackingApi } from "./api";

export function useTracking() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createTrackingApi(mode), [mode]);
  return { api, scope };
}
