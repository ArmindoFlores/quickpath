import type { Grid, GridScale, Image, Vector2 } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import type { Dimensions } from "./gridMaps";

const GRID_SCALE_REGEX = /^(\d+(?:\.\d+)?)([a-zA-Z]*)/;

export type ParsedGrid = Omit<Grid, "scale" | "style"> & { scale: GridScale };

export interface SimpleLine {
    start: Vector2;
    end: Vector2;
}

export function intersects(line1: SimpleLine, line2: SimpleLine) {
    const { start: p1, end: p2 } = line1;
    const { start: p3, end: p4 } = line2;

    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const denom = d1x * d2y - d1y * d2x;

    if (denom === 0) return false;

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;

    const t = (dx * d2y - dy * d2x) / denom;
    const u = (dx * d1y - dy * d1x) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export async function getGrid(): Promise<ParsedGrid> {
    const [
        dpi,
        type,
        measurement,
        scale
    ] = await Promise.all([
        OBR.scene.grid.getDpi(),
        OBR.scene.grid.getType(),
        OBR.scene.grid.getMeasurement(),
        OBR.scene.grid.getScale(),
    ]);
    return {
        dpi,
        type,
        measurement,
        scale
    };
}

export function parseGrid(grid: Grid): ParsedGrid {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, multiplierString, unit] = GRID_SCALE_REGEX.exec(grid.scale)!;
    const decimalPart = multiplierString.split(".")[1];
    const digits = decimalPart ? decimalPart.length : 0;
    const multiplier = parseFloat(multiplierString);

    return {
        dpi: grid.dpi,
        type: grid.type,
        measurement: grid.measurement,
        scale: {
            raw: grid.scale,
            parsed: {
                multiplier,
                unit,
                digits,
            }
        },
    }
}

export function imageDimensions(image: Image): Dimensions {
    return {
        width: image.image.width * image.scale.x / image.grid.dpi,
        height: image.image.height  * image.scale.y / image.grid.dpi,
    };
}
