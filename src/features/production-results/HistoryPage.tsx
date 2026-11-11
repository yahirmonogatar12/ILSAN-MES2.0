import { useMemo } from "react";
import { DemoBanner } from "@/core/runtime/DemoBanner";
import { Page } from "@/shared/ui";
import { ResultsTable } from "./ResultsTable";
import { excessHistory, inputHistory, type InputKind } from "./views";
import "./module.css";

export function InputHistoryPage({ kind }: { kind: InputKind }) {
  const spec = useMemo(() => inputHistory(kind), [kind]);
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      <ResultsTable spec={spec} />
    </Page>
  );
}
export function ExcessHistoryPage({ kind }: { kind: "entradas" | "salidas" }) {
  const spec = useMemo(() => excessHistory(kind), [kind]);
  return (
    <Page banner={<DemoBanner />} className="production-results-page">
      <ResultsTable spec={spec} />
    </Page>
  );
}
