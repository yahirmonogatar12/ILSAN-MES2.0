import {
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { SESSION_EXPIRED_EVENT, userScope, type RuntimeMode } from "../runtime";
import { createAuthGateway } from "./api";
import type { Profile, ProfileUpdate } from "./types";
import { AuthContext } from "./useAuth";
const decodeMode = (value: unknown): RuntimeMode =>
  value === "demo" ? "demo" : "live";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = usePersistentState<RuntimeMode>(
    "mes-v2:mode",
    "live",
    decodeMode,
  );
  const client = useQueryClient();
  const gateway = useMemo(() => createAuthGateway(mode), [mode]);
  const sessionKey = ["session", mode] as const;
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => gateway.profile(signal),
    staleTime: Infinity,
  });
  useEffect(() => {
    const expire = () => {
      void client.cancelQueries();
      client.setQueryData(["session", mode], null);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [client, mode]);
  function switchMode(next: RuntimeMode) {
    client.clear();
    setMode(next);
  }
  async function login(username: string, password: string) {
    await gateway.login(username, password);
    const profile = await gateway.profile();
    if (!profile)
      throw new Error(
        "No se pudo recuperar la sesión. Vuelve a iniciar sesión.",
      );
    client.setQueryData(sessionKey, profile);
  }
  async function logout() {
    if (mode === "demo") {
      switchMode("live");
      return;
    }
    await gateway.logout();
    await client.cancelQueries();
    client.setQueryData(sessionKey, null);
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
  }
  async function saveProfile(values: ProfileUpdate) {
    if (!session.data) throw new Error("Inicia sesión para editar tu perfil.");
    const updated = await gateway.saveProfile(values);
    if (updated.username !== session.data.username)
      throw new Error("El perfil no corresponde a la sesión actual.");
    const current = client.getQueryData<Profile | null>(sessionKey);
    if (current?.username === updated.username)
      client.setQueryData(sessionKey, updated);
  }
  return (
    <AuthContext.Provider
      value={{
        mode,
        profile: session.data || null,
        scope: userScope(mode, session.data?.username || "anonymous"),
        checking: session.isPending,
        error: session.error,
        gateway,
        switchMode,
        login,
        logout,
        saveProfile,
        retry: () => session.refetch(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
