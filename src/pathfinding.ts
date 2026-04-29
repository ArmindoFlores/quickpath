import type { DistanceFunction, OccupancyGrid } from "./occupancyGrid";
import type { Vector2 } from "@owlbear-rodeo/sdk";

export interface PathfindingResultSuccess {
    path: Path; 
    distance: number;
}

type VectorKey = `${number},${number}`;
type InlineDirection = "HORIZONTAL" | "VERTICAL" | "DIAGONAL" | "NONE";
export type Path = Vector2[];
export type PathfindingResult = PathfindingResultSuccess | null; 

function key(v: Vector2): VectorKey {
    return `${v.x},${v.y}`;
}

function inline(v1: Vector2, v2: Vector2): InlineDirection {
    const diff = { x: v2.x - v1.x, y: v2.y - v1.y };
    
    // Check diagonals
    if (Math.abs(diff.x) === Math.abs(diff.y)) {
        return "DIAGONAL";
    }

    // Check horizontal movement
    if (diff.y === 0) {
        return "HORIZONTAL";
    }

    // Check vertical movement
    if (diff.x === 0) {
        return "VERTICAL";
    }

    return "NONE";
}

function coalesce(path: Path) {
    if (path.length < 2) return path;

    const newPath = [path[0]];
    let previousInlineDirection: InlineDirection = "NONE";

    function pathPush(point: Vector2) {
        if (newPath.length > 0 && point.x === newPath[newPath.length - 1].x && point.y === newPath[newPath.length - 1].y) return;
        newPath.push(point);
    }

    function changeDirections(i: number) {
        pathPush(path[i-1]);
        pathPush(path[i]);
    }
    
    for (let i = 1; i < path.length; i++) {
        const inlineDirection = inline(newPath.at(-1)!, path[i]);
        if (i === path.length - 1) {
            changeDirections(i);
        }
        else if (inlineDirection === "NONE") {
            changeDirections(i);
        }
        else if (inlineDirection !== previousInlineDirection && previousInlineDirection !== "NONE") {
            changeDirections(i);
        }
        previousInlineDirection = inlineDirection;
    }
    return newPath;
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

function pathDistance(path: Path, distanceFunction: DistanceFunction): number {
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
export function pathfind(from: Vector2, to: Vector2, grid: OccupancyGrid): PathfindingResult {
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
        
        for (const neighbour of grid.walkableNeighbours(u)) {
            if (distances.get(key(neighbour)) === undefined) queue.push(neighbour);
            // Probably could be done with 1 instead of utils.distance, or some other distance function
            const alt = (distances.get(key(u)) ?? +Infinity) + grid.distanceFunc(u, neighbour);
            if (alt < (distances.get(key(neighbour)) ?? +Infinity)) {
                distances.set(key(neighbour), alt);
                previous.set(key(neighbour), u);
            }
        }
    }

    if (!found) return null;

    const reconstructed = reconstruct(previous, from, to);
    return {
        path: coalesce(reconstructed),
        distance: pathDistance(reconstructed, grid.distanceFunc)
    };
}
