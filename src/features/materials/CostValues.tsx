import { formatCost, hasCost } from "./model";
import type { VendorCost } from "./types";

export function CostValues({ costs }: { costs: readonly VendorCost[] }) {
  if (!costs.some(hasCost))
    return <span className="no-cost">Sin registrar</span>;
  return (
    <span className="material-costs">
      {costs.map((cost) => (
        <span className="cost-value" key={cost.vendedor} title={cost.vendedor}>
          {formatCost(cost)}
        </span>
      ))}
    </span>
  );
}
