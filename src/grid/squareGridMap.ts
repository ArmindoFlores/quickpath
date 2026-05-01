import type { CostFunction, GridMap } from "./map";
import type { Dimensions, Path, SimpleLine } from "./types";

import type { Vector2 } from "@owlbear-rodeo/sdk";
import { intersects } from "./tools";

export class SquareGrid implements GridMap {
    unit: string | undefined;
    cost: CostFunction;
    
    private $bounds: Dimensions;
    private $scale: number;
    private $offset: Vector2;
    private $grid: Uint8Array[];

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, scale: number, costFunction: CostFunction, unit: string | undefined = undefined) {
        this.$bounds = {
            width: Math.ceil((xMax - xMin) / scale),
            height: Math.ceil((yMax - yMin) / scale),
        };
        this.$scale = scale;
        this.$offset = {x: xMin, y: yMin};
        this.$grid = [];
        this.cost = costFunction;
        this.unit = unit;
        
        for (let i = 0; i < this.$bounds.height; i++) {
            this.$grid.push(new Uint8Array(this.$bounds.width).fill(0xff));
        }
    }

    $computeOccupancy(x: number, y: number, lines: SimpleLine[]) {
        let occupancy = 0;
        for (let yOffset = -1; yOffset <= 1; yOffset++) {
            for (let xOffset = -1; xOffset <= 1; xOffset++) {
                if (yOffset === 0 && xOffset === 0) continue;
                for (const line of lines) {
                    const start = this.toCenteredWorldCoords({x: x + xOffset, y: y + yOffset});
                    const end = this.toCenteredWorldCoords({x, y});
    
                    if (intersects(line, {start, end})) {
                        occupancy |= this.$maskFromNeighbour({x: xOffset, y: yOffset});
                        break;
                    }
                }
            }
        }
        return occupancy;
    }

    build(lines: SimpleLine[]) {
        for (let y = 0; y < this.$bounds.height; y++) {
            for (let x = 0; x < this.$bounds.width; x++) {
                this.$setOccupancy(x, y, this.$computeOccupancy(x, y, lines));
            }
        }
    }

    toWorldCoords(gridCoords: Vector2): Vector2 {
        return {
            x: gridCoords.x * this.$scale + this.$offset.x,
            y: gridCoords.y * this.$scale + this.$offset.y,
        };
    }

    toCenteredWorldCoords(gridCoords: Vector2): Vector2 {
        return {
            x: (gridCoords.x + 0.5) * this.$scale + this.$offset.x,
            y: (gridCoords.y + 0.5) * this.$scale + this.$offset.y,
        };
    }

    fromWorldCoords(worldCoords: Vector2): Vector2 {
        return {
            x: Math.round((worldCoords.x - this.$offset.x) / this.$scale - 0.5),
            y: Math.round((worldCoords.y - this.$offset.y) / this.$scale - 0.5),
        };
    }

    $maskFromNeighbour(neighbour: Vector2) {
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

    $canEnter(from: Vector2, to: Vector2) {
        if (to.x < 0 || to.x >= this.$bounds.width || to.y < 0 || to.y >= this.$bounds.height) {
            return false;
        }
        const mask = this.$maskFromNeighbour({x: from.x - to.x, y: from.y - to.y});
        return !(this.$grid[to.y][to.x] & mask);
    }

    $setOccupancy(x: number, y: number, occupancy: number) {
        this.$grid[y][x] = occupancy;
    }

    walkableNeighbours(node: Vector2, considerOccupancy: boolean = true): Path {
        const neighbours: Path = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                const neighbour = {x: node.x + x, y: node.y + y};
                if ((x === 0 && y === 0) || (considerOccupancy && !this.$canEnter(node, neighbour))) continue;
                neighbours.push(neighbour);
            }
        }
        return neighbours;
    }
}
