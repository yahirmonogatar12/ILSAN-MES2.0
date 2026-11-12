import { isRecord as object } from "@/shared/lib/parse";
import { ApiError, backendFetch, ensureResponse, request } from "../http";
import type { RuntimeMode } from "../runtime";
import type { AuthGateway, PermissionSnapshot, Profile } from "./types";

function snapshot(value: unknown): value is PermissionSnapshot {
  return (
    object(value) &&
    typeof value.usuario === "string" &&
    typeof value.rol === "string" &&
    object(value.permisos) &&
    Object.values(value.permisos).every(
      (page) =>
        object(page) &&
        Object.values(page).every(
          (buttons) =>
            Array.isArray(buttons) &&
            buttons.every((button) => typeof button === "string"),
        ),
    )
  );
}

/** Authentication belongs to the application, independently of business modules. */
export function createAuthGateway(mode: RuntimeMode): AuthGateway {
  const demo = mode === "demo";
  return {
    async profile(signal) {
      if (demo)
        return {
          username: "demo",
          nombre_completo: "Usuario de demostración",
          rol: "Demostración",
        };
      try {
        return (
          await request<{ perfil: Profile }>("/api/mi-perfil", { signal })
        ).perfil;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    async login(username, password) {
      if (demo) return;
      await request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
      });
    },
    async logout() {
      if (demo) return;
      const response = await backendFetch("/logout", { redirect: "manual" });
      if (response.type !== "opaqueredirect") await ensureResponse(response);
    },
    async saveProfile(values) {
      const payload = {
        ...values,
        nombre_completo: values.nombre_completo.trim(),
        email: values.email.trim(),
      };
      if (demo)
        return {
          username: "demo",
          nombre_completo: payload.nombre_completo,
          email: payload.email,
          rol: "Demostración",
          editable: true,
        };
      const result = await request<{ perfil: Profile }>("/api/mi-perfil", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!result.perfil || typeof result.perfil.username !== "string")
        throw new Error("El servidor devolvió un perfil inválido.");
      return result.perfil;
    },
    async permission(rule, signal) {
      if (demo) return true;
      return (
        await request<{ tiene_permiso: boolean }>(
          "/verificar_permiso_dropdown",
          { method: "POST", body: JSON.stringify(rule), signal },
        )
      ).tiene_permiso;
    },
    async permissions(signal) {
      if (demo) return { usuario: "demo", rol: "superadmin", permisos: {} };
      const result = await request<unknown>(
        "/obtener_permisos_usuario_actual",
        { signal },
      );
      if (!snapshot(result))
        throw new Error("La respuesta de permisos no es válida.");
      return result;
    },
  };
}
