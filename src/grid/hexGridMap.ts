import type { CostFunction, GridMap } from "./map";
import type { Dimensions, Path, SimpleLine } from "./types";

import type { Vector2 } from "@owlbear-rodeo/sdk";
import { intersects } from "./tools";

type Parity = "ODD" | "EVEN";

const EVEN_NEIGHBOURS: readonly Vector2[] = [
    {x: -1, y: -1},
    {x: 0, y: -1},
    {x: 1, y: -1},
    {x: 1, y: 0},
    {x: 0, y: 1},
    {x: -1, y: 0},
];
const ODD_NEIGHBOURS: readonly Vector2[] = [
    {x: -1, y: 0},
    {x: 0, y: -1},
    {x: 1, y: 0},
    {x: 1, y: 1},
    {x: 0, y: 1},
    {x: -1, y: 1},
];

export class HexGrid implements GridMap {
    unit: string | undefined;
    cost: CostFunction;

    private $bounds: Dimensions;
    private $scale: number;
    private $offset: Vector2;
    private $grid: Uint8Array[];

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, scale: number, costFunction: CostFunction, unit: string | undefined = undefined) {
        this.$bounds = {
            width: Math.ceil(1.25 * (xMax - xMin) / scale),
            height: Math.ceil((yMax - yMin) / scale - 0.5),
        };
        this.$scale =  scale / Math.sqrt(3);
        this.$offset = {x: xMin + scale / 4, y: yMin};
        this.$grid = [];
        this.cost = costFunction;
        this.unit = unit;
        
        for (let i = 0; i < this.$bounds.height; i++) {
            this.$grid.push(new Uint8Array(this.$bounds.width).fill(0xff));
        }
    }

    $cubeRound(fq: number, fr: number, fs: number) {
        let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
        const qDiff = Math.abs(q - fq);
        const rDiff = Math.abs(r - fr);
        const sDiff = Math.abs(s - fs);
        if (qDiff > rDiff && qDiff > sDiff) {
            q = -r - s;
        }
        else if (rDiff > sDiff) {
            r = -q - s;
        }
        else {
            s = -q - r;
        }
        return {q, r, s};
    }

    $axialRound(axialCoords: Vector2): Vector2 {
        const cube = this.$cubeRound(axialCoords.x, axialCoords.y, -axialCoords.x - axialCoords.y);
        return {
            x: cube.q,
            y: cube.r,
        };
    }

    $axialToOddQ(axialCoords: Vector2): Vector2 {
        const parity = this.$parity(axialCoords);
        return {
            x: axialCoords.x,
            y: axialCoords.y + (axialCoords.x - (parity === "ODD" ? 1 : 0)) / 2,
        };
    }

    $oddQToAxial(oddQCoords: Vector2): Vector2 {
        const parity = this.$parity(oddQCoords);
        return {
            x: oddQCoords.x,
            y: oddQCoords.y + (oddQCoords.x - (parity === "ODD" ? 1 : 0)) / 2,
        };
    }

    $computeOccupancy(x: number, y: number, lines: SimpleLine[]) {
        let occupancy = 0;
        const point = {x, y};
        const parity = this.$parity(point);
        for (const neighbour of this.walkableNeighbours(point, false)) {
            const start = this.toCenteredWorldCoords(point);
            const end = this.toCenteredWorldCoords(neighbour);
            const neighbourLine = {start, end};
            for (const line of lines) {
                if (intersects(line, neighbourLine)) {
                    const offset = {x: Math.sign(neighbour.x - point.x), y: Math.sign(neighbour.y - point.y)};
                    occupancy |= this.$maskFromNeighbour(offset, parity);
                    break;
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
        const parity = this.$parity(gridCoords);
        return {
            x: 1.5 * gridCoords.x * this.$scale + this.$offset.x,
            y: Math.sqrt(3) * (gridCoords.y + 0.5 * (parity === "ODD" ? 1 : 0)) * this.$scale + this.$offset.y,
        };
    }

    toCenteredWorldCoords(gridCoords: Vector2): Vector2 {
        const parity = this.$parity(gridCoords);
        return {
            x: 1.5 * (gridCoords.x - 0.625) * this.$scale + this.$offset.x,
            y: Math.sqrt(3) * ((gridCoords.y) + 0.5 * (parity === "ODD" ? 1 : 0)) * this.$scale + this.$offset.y,
        };
    }

    fromWorldCoords(worldCoords: Vector2): Vector2 {
        const x = (worldCoords.x + this.$offset.x) / this.$scale;
        const y = (worldCoords.y + this.$offset.y) / this.$scale;

        const col = x * 2 / 3;
        const row = (Math.sqrt(3) * y - x) / 3;
        return this.$axialToOddQ(this.$axialRound({x: col, y: row}));
    }

    $maskFromNeighbour(neighbour: Vector2, parity: Parity) {
        const neighbourOffsets = parity === "EVEN" ? EVEN_NEIGHBOURS : ODD_NEIGHBOURS;
        for (let i = 0; i < neighbourOffsets.length; i++) {
            if (neighbour.x !== neighbourOffsets[i].x || neighbour.y !== neighbourOffsets[i].y) continue;
            return 1 << i;
        }
        throw new Error(`Invalid neighbour ${JSON.stringify(neighbour)} (${parity.toLocaleLowerCase()} parity)`);
    }

    $canEnter(from: Vector2, to: Vector2) {
        if (to.x < 0 || to.x >= this.$bounds.width || to.y < 0 || to.y >= this.$bounds.height) {
            return false;
        }
        const mask = this.$maskFromNeighbour({x: Math.sign(from.x - to.x), y: Math.sign(from.y - to.y)}, this.$parity(to));
        return !(this.$grid[to.y][to.x] & mask);
    }

    $setOccupancy(x: number, y: number, occupancy: number) {
        this.$grid[y][x] = occupancy;
    }

    $parity(node: Vector2): Parity {
        return node.x % 2 === 0 ? "EVEN" : "ODD";
    }

    walkableNeighbours(node: Vector2, considerOccupancy: boolean = true): Path {
        const neighbourOffsets = this.$parity(node) === "EVEN" ? EVEN_NEIGHBOURS : ODD_NEIGHBOURS;
        return neighbourOffsets
            .map(offset => ({ x: node.x + offset.x, y: node.y + offset.y }))
            .filter(node => node.x >= 0 && node.x < this.$bounds.width && node.y >= 0 && node.y < this.$bounds.height)
            .filter(neighbour => !considerOccupancy || this.$canEnter(node, neighbour));
    }
}
