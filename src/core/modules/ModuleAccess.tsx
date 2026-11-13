import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { allowsRoles, usePermission } from "../auth/usePermission";
import type { PermissionRule } from "../auth/types";
import { Card } from "@/shared/ui/Layout";
import { EmptyState, ErrorState, Loading } from "@/shared/ui/Feedback";

export function ModuleAccess({
  permission,
  children,
  demoOnly = false,
  requiredRoles,
}: {
  permission: PermissionRule | null;
  children: ReactNode;
  demoOnly?: boolean;
  requiredRoles?: readonly string[];
}) {
  const { mode, profile } = useAuth();
  const roleAllowed = allowsRoles(profile, requiredRoles, mode);
  const access = usePermission(
    permission,
    roleAllowed && !(demoOnly && mode !== "demo"),
  );
  if (demoOnly && mode !== "demo")
    return (
      <Card>
        <EmptyState
          title="Disponible en demostración"
          message="Este módulo de ejemplo todavía no está conectado al servidor MES."
        />
      </Card>
    );
  if (!roleAllowed)
    return (
      <Card>
        <EmptyState
          title="Acceso restringido"
          message="Tu cuenta no tiene permiso para acceder a este módulo."
          icon={<ShieldAlert size={32} />}
        />
      </Card>
    );
  if (access.isPending)
    return (
      <Card>
        <Loading text="Verificando acceso al módulo…" />
      </Card>
    );
  if (access.isError)
    return (
      <Card>
        <ErrorState
          error={access.error}
          onRetry={() => void access.refetch()}
        />
      </Card>
    );
  if (!access.data)
    return (
      <Card>
        <EmptyState
          title="Acceso restringido"
          message="Tu cuenta no tiene permiso para acceder a este módulo."
          icon={<ShieldAlert size={32} />}
        />
      </Card>
    );
  return children;
}
