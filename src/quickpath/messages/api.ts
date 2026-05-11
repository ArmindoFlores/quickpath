import type { PathfindingResult } from "../pathfinding";
import { makeMessageBasedAPI } from "./base";
import type { QuickpathPathfindMessage } from "./types";

export const api = {
    pathfind: makeMessageBasedAPI<QuickpathPathfindMessage, PathfindingResult>("QUICKPATH_PATHFIND"),
};
