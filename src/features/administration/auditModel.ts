import { rangeIssue, localDate } from "@/shared/lib/date";
import type { AuditFilters } from "./panelTypes";

export function auditDefaults(): AuditFilters {
  const date = localDate();
  return {
    fecha_inicio: date,
    fecha_fin: date,
    usuario: "",
    modulo: "",
    accion: "",
    resultado: "",
    limite: "500",
  };
}

export function auditFilterIssue(filters: AuditFilters) {
  return rangeIssue(filters.fecha_inicio, filters.fecha_fin);
}

/** Audit can contain JSON strings or parsed objects, including historical records. */
export function auditData(value: unknown): string {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return String(value) || "—";
    }
  }
  if (parsed === null || parsed === undefined || parsed === "") return "—";
  return JSON.stringify(
    parsed,
    (key, item) =>
      /password|contrase[nñ]a|token|secret/i.test(key) ? "••••••" : item,
    2,
  );
}
