import { lazy } from "react";
import { List } from "lucide-react";
import type { ModuleDefinition } from "@/core/modules/types";

/** Replace permission with the exact Flask contract before enabling live mode. */
export const __SYMBOL__Module: ModuleDefinition = {
  id: __NAME_JSON__,
  path: __PATH_JSON__,
  title: __TITLE_JSON__,
  sectionId: __SECTION_JSON__,
  group: __GROUP_JSON__,
  icon: List,
  permission: null,
  demoOnly: true,
  component: lazy(() => import("./Page")),
};
