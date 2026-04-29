import type { Grid, GridScale, Image } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import type { Dimensions } from "./occupancyGrid";

const GRID_SCALE_REGEX = /^(\d+(?:\.\d+)?)([a-zA-Z]*)/;

export type ParsedGrid = Omit<Grid, "scale" | "style"> & { scale: GridScale };

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
