import type { CostFunction, GridMap } from "./grid/map";

import type { Path } from "./grid";
import type { Vector2 } from "@owlbear-rodeo/sdk";

export interface PathfindingResultSuccess {
    path: Path;
    distance: number;
}

type VectorKey = `${number},${number}`;
export type PathfindingResult = PathfindingResultSuccess | null;

const DIAGONAL_PENALTY = 0.0001;

function key(v: Vector2): VectorKey {
    return `${v.x},${v.y}`;
}

function reconstruct(
    previous: Map<VectorKey, Vector2>,
    from: Vector2,
    to: Vector2,
) {
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
        total += distanceFunction(path[i - 1], path[i]);
    }
    return total;
}

/*
    Finds the shortest path between two points in a grid using
    Dijkstra's algorithm. 
*/
export function pathfind(
    from: Vector2,
    to: Vector2,
    gridMap: GridMap,
): PathfindingResult {
    if (key(from) === key(to)) {
        return {
            path: [],
            distance: 0,
        };
    }

    const distances = new Map<VectorKey, number>();
    const previous = new Map<VectorKey, Vector2>();

    distances.set(key(from), 0);

    const queue = [from];
    let found = false;
    while (queue.length > 0) {
        queue.sort(
            (v1, v2) =>
                (distances.get(key(v2)) ?? +Infinity) -
                (distances.get(key(v1)) ?? +Infinity),
        );
        const u = queue.pop()!;
        const keyOfU = key(u);
        if (keyOfU === key(to)) {
            found = true;
            break;
        }

        for (const neighbour of gridMap.walkableNeighbours(u)) {
            const keyOfNeighbour = key(neighbour);
            if (distances.get(keyOfNeighbour) === undefined)
                queue.push(neighbour);

            // Even in measurement modes such as chessboard (where diagonal distance = horizontal/vertical
            // distance), prefer straight to diagonal movement.
            const stepSize =
                Math.abs(neighbour.x - u.x) + Math.abs(neighbour.y - u.y);
            const diagonalPenalty = stepSize > 1 ? DIAGONAL_PENALTY : 0;

            const alt =
                (distances.get(keyOfU) ?? +Infinity) +
                gridMap.cost(u, neighbour) +
                diagonalPenalty;

            if (alt < (distances.get(keyOfNeighbour) ?? +Infinity)) {
                distances.set(keyOfNeighbour, alt);
                previous.set(keyOfNeighbour, u);
            }
        }
    }

    if (!found) return null;

    const reconstructed = reconstruct(previous, from, to);
    return {
        path: reconstructed,
        distance: pathDistance(reconstructed, gridMap.cost),
    };
}
