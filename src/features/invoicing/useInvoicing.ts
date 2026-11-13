import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/shared/ui";
import { createInvoiceApi, createPurchaseApi, createValuationApi } from "./api";

export function useInvoicing() {
  const { mode, scope } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const invoices = useMemo(() => createInvoiceApi(mode), [mode]);
  const purchases = useMemo(() => createPurchaseApi(mode), [mode]);
  const valuation = useMemo(() => createValuationApi(mode), [mode]);
  const key = (...parts: unknown[]) => ["invoicing", scope, ...parts];
  function saved(message = "Operación completada.") {
    toast(message);
    void client.invalidateQueries({ queryKey: ["invoicing", scope] });
  }
  return { mode, scope, client, invoices, purchases, valuation, key, saved };
}
