import type { CostFunction, GridMap } from "./grid/map";

import type { Path } from "./grid";
import type { Vector2 } from "@owlbear-rodeo/sdk";

export interface PathfindingResultSuccess {
    path: Path; 
    distance: number;
}

type VectorKey = `${number},${number}`;
export type PathfindingResult = PathfindingResultSuccess | null; 

function key(v: Vector2): VectorKey {
    return `${v.x},${v.y}`;
}

function reconstruct(previous: Map<VectorKey, Vector2>, from: Vector2, to: Vector2) {
    const path: Path = [];
    let u: Vector2 | undefined = to;
    if (key(u) === key(from) || previous.get(key(u))) {
        while (u) {
            path.push(u);
            u = previous.get(key(u));
        }
    }
    return path.toReversed();
}

function pathDistance(path: Path, distanceFunction: CostFunction): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        total += distanceFunction(path[i-1], path[i]);
    }
    return total;
}

/*
    Finds the shortest path between two points in a grid using
    Dijkstra's algorithm. 
*/
export function pathfind(from: Vector2, to: Vector2, gridMap: GridMap): PathfindingResult {
    if (key(from) === key(to)) {
        return {
            path: [],
            distance: 0
        };
    }

    const distances = new Map<VectorKey, number>();
    const previous = new Map<VectorKey, Vector2>();

    distances.set(key(from), 0);

    const queue = [from];
    let found = false;
    while (queue.length > 0) {
        queue.sort((v1, v2) => (distances.get(key(v2)) ?? +Infinity) - (distances.get(key(v1)) ?? +Infinity));
        const u = queue.pop()!;
        if (key(u) === key(to)) {
            found = true;
            break;
        }
        
        for (const neighbour of gridMap.walkableNeighbours(u)) {
            if (distances.get(key(neighbour)) === undefined) queue.push(neighbour);
            // Probably could be done with 1 instead of utils.distance, or some other distance function
            const alt = (distances.get(key(u)) ?? +Infinity) + gridMap.cost(u, neighbour);
            if (alt < (distances.get(key(neighbour)) ?? +Infinity)) {
                distances.set(key(neighbour), alt);
                previous.set(key(neighbour), u);
            }
        }
    }

    if (!found) return null;

    const reconstructed = reconstruct(previous, from, to);
    return {
        path: reconstructed,
        distance: pathDistance(reconstructed, gridMap.cost)
    };
}
