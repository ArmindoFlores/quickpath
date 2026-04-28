import type { DistanceFunction, OccupancyGrid } from "./occupancyGrid";
import type { Vector2 } from "@owlbear-rodeo/sdk";

type VectorKey = `${number},${number}`;

export interface PathfindingResultSuccess {
    path: Vector2[]; 
    distance: number;
}

export type PathfindingResult = PathfindingResultSuccess | null; 

function key(v: Vector2): VectorKey {
    return `${v.x},${v.y}`;
}

function inline(v1: Vector2, v2: Vector2) {
    const diff = { x: v2.x - v1.x, y: v2.y - v1.y };
    
    // Check diagonals
    if (Math.abs(diff.x) === Math.abs(diff.y)) {
        return true;
    }

    // Check horizontal movement
    if (diff.y === 0) {
        return true;
    }

    // Check vertical movement
    if (diff.x === 0) {
        return true;
    }

    return false;
}

function coalesce(path: Vector2[]) {
    if (path.length < 2) return path;

    const newPath = [path[0]];
    
    for (let i = 1; i < path.length; i++) {
        const point = path[i];
        if (i === path.length - 1 || !inline(newPath.at(-1)!, point)) {
            newPath.push(path[i-1]);
            newPath.push(point);
        }
    }
    return newPath;
}

function reconstruct(previous: Map<VectorKey, Vector2>, from: Vector2, to: Vector2) {
    const path: Vector2[] = [];
    let u: Vector2 | undefined = to;
    if (key(u) === key(from) || previous.get(key(u))) {
        while (u) {
            path.push(u);
            u = previous.get(key(u));
        }
    }
    return path.toReversed();
}

function pathDistance(path: Vector2[], distanceFunction: DistanceFunction): number {
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
