import type { Vector2 } from "@owlbear-rodeo/sdk";
import type { Path } from "./pathfinding";

export interface Dimensions {
    width: number;
    height: number;
}

export type DistanceFunction = (source: Vector2, dest: Vector2) => number;

export class OccupancyGrid {
    bounds: Dimensions;
    scale: number;
    offset: Vector2;
    distanceFunc: DistanceFunction;
    unit: string | undefined;
    __grid: Uint8Array[];

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, scale: number, distanceFunc: DistanceFunction, unit: string | undefined = undefined) {
        this.bounds = {
            width: Math.ceil((xMax - xMin) / scale),
            height: Math.ceil((yMax - yMin) / scale),
        };
        this.scale = scale;
        this.offset = {x: xMin, y: yMin};
        this.__grid = [];
        this.distanceFunc = distanceFunc;
        this.unit = unit;
        
        for (let i = 0; i < this.bounds.height; i++) {
            this.__grid.push(new Uint8Array(this.bounds.width).fill(0xff));
        }
    }

    toWorldCoords(gridCoords: Vector2): Vector2 {
        return {
            x: gridCoords.x * this.scale + this.offset.x,
            y: gridCoords.y * this.scale + this.offset.y,
        };
    }

    toCenteredWorldCoords(gridCoords: Vector2, dimensions: Dimensions | undefined = undefined): Vector2 {
        return {
            x: (gridCoords.x + (dimensions ? (dimensions.width / 2) : 0.5)) * this.scale + this.offset.x,
            y: (gridCoords.y + (dimensions ? (dimensions.height / 2) : 0.5)) * this.scale + this.offset.y,
        };
    }

    fromWorldCoords(worldCoords: Vector2, dimensions: Dimensions | undefined = undefined): Vector2 {
        return {
            x: Math.round((worldCoords.x - this.offset.x) / this.scale - (dimensions ? (dimensions.width / 2) : 0.5)),
            y: Math.round((worldCoords.y - this.offset.y) / this.scale - (dimensions ? (dimensions.height / 2) : 0.5)),
        };
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
        if (to.x < 0 || to.x >= this.bounds.width || to.y < 0 || to.y >= this.bounds.height) {
            return false;
        }
        const mask = this.maskFromNeighbour({x: from.x - to.x, y: from.y - to.y});
        return !!(this.__grid[to.y][to.x] & mask);
    }

    setOccupancy(x: number, y: number, occupancy: number) {
        this.__grid[y][x] = occupancy;
    }

    walkableNeighbours(node: Vector2): Path {
        const neighbours: Path = [];
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
