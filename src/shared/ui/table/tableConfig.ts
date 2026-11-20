import { createContext } from "react";
/** One default for local grids and remotely paginated modules. */
export const DEFAULT_PAGE_SIZE = 500;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const;
/** Signed-in user scope; column widths are remembered per user in this browser. */
export const TableStorageScope = createContext("");
