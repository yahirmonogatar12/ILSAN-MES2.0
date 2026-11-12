import { AssyWorkOrders } from "./AssyWorkOrders";
import { AssyScanLots } from "./AssyScanLots";
import { AssyProposals } from "./AssyProposals";
import type { AssyToolProps } from "./types";
export function AssyTools({
  tool,
  ...props
}: AssyToolProps & { tool: "wos" | "scan" | "proposals" }) {
  switch (tool) {
    case "wos":
      return <AssyWorkOrders {...props} />;
    case "scan":
      return <AssyScanLots {...props} />;
    case "proposals":
      return <AssyProposals {...props} />;
  }
}
