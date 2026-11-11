import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./AuthProvider";
import type { PermissionRule, PermissionSnapshot, Profile } from "./types";
import type { RuntimeMode } from "../runtime";

export function allowsRoles(
  profile: Profile | null,
  requiredRoles: readonly string[] | undefined,
  mode: RuntimeMode,
) {
  if (!requiredRoles?.length) return true;
  if (mode === "demo") return true;
  return (
    !!profile &&
    requiredRoles.some(
      (role) => role === profile.rol || profile.roles?.includes(role),
    )
  );
}

export function allowsPermission(
  snapshot: PermissionSnapshot,
  rule: PermissionRule | null,
) {
  return (
    !rule ||
    snapshot.rol === "superadmin" ||
    snapshot.permisos[rule.pagina]?.[rule.seccion]?.includes(rule.boton) ===
      true
  );
}

/** One server snapshot per session, shared by navigation, routes and actions. */
function usePermissionOptions() {
  const { gateway, scope, profile } = useAuth();
  return {
    queryKey: ["permission", scope],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const result = await gateway.permissions(signal);
      if (result.usuario !== profile?.username)
        throw new Error("Los permisos no corresponden a la sesión actual.");
      return result;
    },
    refetchOnWindowFocus: "always" as const,
    enabled: !!profile,
  };
}
export function usePermissions(watch = false) {
  return useQuery({
    ...usePermissionOptions(),
    refetchInterval: watch ? 60_000 : false,
  });
}

/** The same scoped cache serves module gates and action-level permissions. */
export function usePermission(
  permission: PermissionRule | null,
  enabled = true,
) {
  const options = usePermissionOptions();
  return useQuery({
    ...options,
    select: (snapshot) => allowsPermission(snapshot, permission),
    enabled: enabled && options.enabled,
  });
}
