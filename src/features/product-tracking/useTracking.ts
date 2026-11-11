import { useMemo } from "react";
import { useAuth } from "@/core/auth/AuthProvider";
import { createTrackingApi } from "./api";

export function useTracking() {
  const { mode, scope } = useAuth();
  const api = useMemo(() => createTrackingApi(mode), [mode]);
  return { api, scope };
}
