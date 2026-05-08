import type { Grid, GridScale, Vector2 } from "@owlbear-rodeo/sdk";

export type ParsedGrid = Omit<Grid, "scale" | "style"> & { scale: GridScale };
export type Path = Vector2[];

export interface Dimensions {
    width: number;
    height: number;
}

export interface SimpleLine {
    start: Vector2;
    end: Vector2;
}
