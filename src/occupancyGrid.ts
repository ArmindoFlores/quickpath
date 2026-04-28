import type { Vector2 } from "@owlbear-rodeo/sdk";

export interface Bounds {
    min: number;
    max: number;
}

export interface OccupancyGridBounds {
    x: Bounds;
    y: Bounds;
}

export type DistanceFunction = (source: Vector2, dest: Vector2) => number;

export class OccupancyGrid {
    bounds: OccupancyGridBounds;
    dpi: number;
    distanceFunc: DistanceFunction;
    unit: string | undefined;
    __grid: Uint8Array[];

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, dpi: number, distanceFunc: DistanceFunction, unit: string | undefined = undefined) {
        this.bounds = {
            x: {
                min: xMin / dpi,
                max: xMax / dpi
            },
            y: {
                min: yMin / dpi,
                max: yMax / dpi
            },
        }
        this.dpi = dpi;
        this.__grid = [];
        this.distanceFunc = distanceFunc;
        this.unit = unit;
        
        for (let i = this.bounds.y.min; i < this.bounds.y.max; i++) {
            this.__grid.push(new Uint8Array(this.bounds.x.max - this.bounds.x.min).fill(0xff));
        }
    }

    maskFromNeighbour(neighbour: Vector2) {
        if (neighbour.x > 0) {
            if (neighbour.y > 0) {
                return 0b00000001;
            }
            if (neighbour.y === 0) {
                return 0b00000010;
            }
            if (neighbour.y < 0) {
                return 0b00000100;
            }
        }
        if (neighbour.x === 0) {
            if (neighbour.y > 0) {
                return 0b00001000;
            }
            if (neighbour.y === 0) {
                return 0b11111111;  // this is invalid
            }
            if (neighbour.y < 0) {
                return 0b00010000;
            }
        }
        if (neighbour.x < 0) {
            if (neighbour.y > 0) {
                return 0b00100000;
            }
            if (neighbour.y === 0) {
                return 0b01000000;
            }
            if (neighbour.y < 0) {
                return 0b10000000;
            }
        }
        throw new Error("Invalid neighbour");
    }

    canEnter(from: Vector2, to: Vector2) {
        if (to.x < this.bounds.x.min || to.x >= this.bounds.x.max || to.y < this.bounds.y.min || to.y >= this.bounds.y.max) {
            return false;
        }
        const mask = this.maskFromNeighbour({x: from.x - to.x, y: from.y - to.y});
        return !!(this.__grid[to.y - this.bounds.y.min][to.x - this.bounds.x.min] & mask);
    }

    setOccupancy(x: number, y: number, occupancy: number) {
        this.__grid[y][x] = occupancy;
    }

    walkableNeighbours(node: Vector2): Vector2[] {
        const neighbours: Vector2[] = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                const neighbour = {x: node.x + x, y: node.y + y};
                if ((x === 0 && y === 0) || !this.canEnter(node, neighbour)) continue;
                neighbours.push(neighbour);
            }
        }
        return neighbours;
    }
}
