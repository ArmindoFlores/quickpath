import type { Path, SimpleLine } from "./types";

import type { Vector2 } from "@owlbear-rodeo/sdk";

export type CostFunction = (source: Vector2, dest: Vector2) => number;

export interface GridMap {
    cost: CostFunction;
    unit: string | undefined;

    build(lines: SimpleLine[]): void;

    toWorldCoords(gridCoords: Vector2): Vector2 ;
    toCenteredWorldCoords(gridCoords: Vector2): Vector2;
    fromWorldCoords(worldCoords: Vector2): Vector2;
    walkableNeighbours(node: Vector2, considerOccupancy?: boolean): Path;
};
