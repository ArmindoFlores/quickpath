import type { CostFunction, GridMap } from "./map";
import type { Dimensions, Path, SimpleLine } from "./types";

import type { Vector2 } from "@owlbear-rodeo/sdk";
import { intersects } from "./tools";

type Parity = "ODD" | "EVEN";

const HORIZONTAL_EVEN_NEIGHBOURS: readonly Vector2[] = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
];
const HORIZONTAL_ODD_NEIGHBOURS: readonly Vector2[] = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
];

const VERTICAL_EVEN_NEIGHBOURS: readonly Vector2[] = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
];
const VERTICAL_ODD_NEIGHBOURS: readonly Vector2[] = [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
];

abstract class HexGrid {
    unit: string | undefined;
    cost: CostFunction;

    protected $bounds!: Dimensions;
    protected $scale!: number;
    protected $offset!: Vector2;
    protected $grid!: Uint8Array[];

    private $oddNeighbours: readonly Vector2[];
    private $evenNeighbours: readonly Vector2[];
    private $parityVariable: "x" | "y";

    constructor(
        gridType: "HORIZONTAL" | "VERTICAL",
        costFunction: CostFunction,
        unit: string | undefined = undefined,
    ) {
        this.$oddNeighbours =
            gridType === "HORIZONTAL"
                ? HORIZONTAL_ODD_NEIGHBOURS
                : VERTICAL_ODD_NEIGHBOURS;
        this.$evenNeighbours =
            gridType === "HORIZONTAL"
                ? HORIZONTAL_EVEN_NEIGHBOURS
                : VERTICAL_EVEN_NEIGHBOURS;
        this.$parityVariable = gridType === "HORIZONTAL" ? "x" : "y";
        this.cost = costFunction;
        this.unit = unit;
    }

    $cubeRound(fq: number, fr: number, fs: number) {
        let q = Math.round(fq),
            r = Math.round(fr),
            s = Math.round(fs);
        const qDiff = Math.abs(q - fq);
        const rDiff = Math.abs(r - fr);
        const sDiff = Math.abs(s - fs);
        if (qDiff > rDiff && qDiff > sDiff) {
            q = -r - s;
        } else if (rDiff > sDiff) {
            r = -q - s;
        } else {
            s = -q - r;
        }
        return { q, r, s };
    }

    $axialRound(axialCoords: Vector2): Vector2 {
        const cube = this.$cubeRound(
            axialCoords.x,
            axialCoords.y,
            -axialCoords.x - axialCoords.y,
        );
        return {
            x: cube.q,
            y: cube.r,
        };
    }

    $axialToOffset(axialCoords: Vector2): Vector2 {
        const parity = this.$parity(axialCoords);
        const secondaryVariable = this.$parityVariable === "x" ? "y" : "x";
        return {
            [this.$parityVariable]: axialCoords[this.$parityVariable],
            [secondaryVariable]:
                axialCoords[secondaryVariable] +
                (axialCoords[this.$parityVariable] -
                    (parity === "ODD" ? 1 : 0)) /
                    2,
        } as unknown as Vector2;
    }

    $computeOccupancy(x: number, y: number, lines: SimpleLine[]) {
        let occupancy = 0;
        const point = { x, y };
        const parity = this.$parity(point);
        for (const neighbour of this.walkableNeighbours(point, false)) {
            const start = this.toCenteredWorldCoords(point);
            const end = this.toCenteredWorldCoords(neighbour);
            const neighbourLine = { start, end };
            for (const line of lines) {
                if (intersects(line, neighbourLine)) {
                    const offset = {
                        x: Math.sign(neighbour.x - point.x),
                        y: Math.sign(neighbour.y - point.y),
                    };
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
        const secondaryVariable = this.$parityVariable === "x" ? "y" : "x";
        return {
            [this.$parityVariable]:
                1.5 * gridCoords[this.$parityVariable] * this.$scale +
                this.$offset[this.$parityVariable],
            [secondaryVariable]:
                Math.sqrt(3) *
                    (gridCoords[secondaryVariable] +
                        0.5 * (parity === "ODD" ? 1 : 0)) *
                    this.$scale +
                this.$offset[secondaryVariable],
        } as unknown as Vector2;
    }

    toCenteredWorldCoords(gridCoords: Vector2): Vector2 {
        const parity = this.$parity(gridCoords);
        const secondaryVariable = this.$parityVariable === "x" ? "y" : "x";
        return {
            [this.$parityVariable]:
                1.5 * (gridCoords[this.$parityVariable] - 0.625) * this.$scale +
                this.$offset[this.$parityVariable],
            [secondaryVariable]:
                Math.sqrt(3) *
                    (gridCoords[secondaryVariable] +
                        0.5 * (parity === "ODD" ? 1 : 0)) *
                    this.$scale +
                this.$offset[secondaryVariable],
        } as unknown as Vector2;
    }

    fromWorldCoords(worldCoords: Vector2): Vector2 {
        const x = (worldCoords.x + this.$offset.x) / this.$scale;
        const y = (worldCoords.y + this.$offset.y) / this.$scale;

        let col: number, row: number;
        if (this.$parityVariable === "x") {
            col = (x * 2) / 3;
            row = (Math.sqrt(3) * y - x) / 3;
        } else {
            row = (y * 2) / 3;
            col = (Math.sqrt(3) * x - y) / 3;
        }
        return this.$axialToOffset(this.$axialRound({ x: col, y: row }));
    }

    $maskFromNeighbour(neighbour: Vector2, parity: Parity) {
        const neighbourOffsets =
            parity === "EVEN" ? this.$evenNeighbours : this.$oddNeighbours;
        for (let i = 0; i < neighbourOffsets.length; i++) {
            if (
                neighbour.x !== neighbourOffsets[i].x ||
                neighbour.y !== neighbourOffsets[i].y
            )
                continue;
            return 1 << i;
        }
        throw new Error(
            `Invalid neighbour ${JSON.stringify(neighbour)} (${parity.toLocaleLowerCase()} parity)`,
        );
    }

    $canEnter(from: Vector2, to: Vector2) {
        if (
            to.x < 0 ||
            to.x >= this.$bounds.width ||
            to.y < 0 ||
            to.y >= this.$bounds.height
        ) {
            return false;
        }
        const mask = this.$maskFromNeighbour(
            { x: Math.sign(from.x - to.x), y: Math.sign(from.y - to.y) },
            this.$parity(to),
        );
        return !(this.$grid[to.y][to.x] & mask);
    }

    $setOccupancy(x: number, y: number, occupancy: number) {
        this.$grid[y][x] = occupancy;
    }

    $parity(node: Vector2): Parity {
        return node[this.$parityVariable] % 2 === 0 ? "EVEN" : "ODD";
    }

    walkableNeighbours(node: Vector2, considerOccupancy: boolean = true): Path {
        const neighbourOffsets =
            this.$parity(node) === "EVEN"
                ? this.$evenNeighbours
                : this.$oddNeighbours;
        return neighbourOffsets
            .map((offset) => ({ x: node.x + offset.x, y: node.y + offset.y }))
            .filter(
                (node) =>
                    node.x >= 0 &&
                    node.x < this.$bounds.width &&
                    node.y >= 0 &&
                    node.y < this.$bounds.height,
            )
            .filter(
                (neighbour) =>
                    !considerOccupancy || this.$canEnter(node, neighbour),
            );
    }
}

export class HorizontalHexGrid extends HexGrid implements GridMap {
    constructor(
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        scale: number,
        costFunction: CostFunction,
        unit: string | undefined = undefined,
    ) {
        super("HORIZONTAL", costFunction, unit);

        this.$bounds = {
            width: Math.ceil((1.25 * (xMax - xMin)) / scale),
            height: Math.ceil((yMax - yMin) / scale - 0.5),
        };
        this.$scale = scale / Math.sqrt(3);
        this.$offset = { x: xMin + scale / 4, y: yMin };
        this.$grid = [];

        for (let i = 0; i < this.$bounds.height; i++) {
            this.$grid.push(new Uint8Array(this.$bounds.width).fill(0xff));
        }
    }
}

export class VerticalHexGrid extends HexGrid implements GridMap {
    constructor(
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        scale: number,
        costFunction: CostFunction,
        unit: string | undefined = undefined,
    ) {
        super("VERTICAL", costFunction, unit);

        this.$bounds = {
            width: Math.ceil((xMax - xMin) / scale - 0.5),
            height: Math.ceil((1.25 * (yMax - yMin)) / scale),
        };
        this.$scale = scale / Math.sqrt(3);
        this.$offset = { x: xMin, y: yMin + scale / 4 };
        this.$grid = [];

        for (let i = 0; i < this.$bounds.height; i++) {
            this.$grid.push(new Uint8Array(this.$bounds.width).fill(0xff));
        }
    }
}
