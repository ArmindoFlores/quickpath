import type { Vector2 } from "@owlbear-rodeo/sdk";
import { config } from "./config";

function id(...path: string[]) {
    return `${config.APP_KEY}/${path.join("/")}`;
}

function distance(start: Vector2, end: Vector2) {
    return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
}

export const utils = {
    id,
    distance,
};
