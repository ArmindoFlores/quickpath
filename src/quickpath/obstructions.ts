import type { Curve, Item, Line, Vector2 } from "@owlbear-rodeo/sdk";

import { constants } from "../constants";
import { utils } from "../utils";

export interface OwlbearDoorMetadata {
    open: boolean;
    start: {
        distance: number;
        index: number;
    };
    end: {
        distance: number;
        index: number;
    };
}

export interface ObstructionOptions {
    includeOBRDynamicFog: boolean;
    includeSmokeAndSpecter: boolean;
}

function isSmokeAndSpecterObstruction(item: Item) {
    return (
        item.type === "CURVE" &&
        item.metadata[`${constants.SMOKE_AND_SPECTER_ID}/isVisionLine`] ===
            true &&
        item.metadata[`${constants.SMOKE_AND_SPECTER_ID}/blocking`] === true &&
        item.metadata[`${constants.SMOKE_AND_SPECTER_ID}/disabled`] !== true &&
        !(
            item.metadata[`${constants.SMOKE_AND_SPECTER_ID}/isDoor`] ===
                true &&
            item.metadata[`${constants.SMOKE_AND_SPECTER_ID}/doorOpen`] === true
        )
    );
}

function isOwlbearDynamicFogWall(item: Item) {
    return item.type === "LINE" && item.layer === "FOG";
}

export function isBlockingLine(
    item: Item,
    obstructionOptions?: Partial<ObstructionOptions>,
): item is Curve | Line {
    const filters: ((item: Item) => boolean)[] = [];
    if (obstructionOptions?.includeOBRDynamicFog !== false) {
        filters.push(isOwlbearDynamicFogWall);
    }
    if (obstructionOptions?.includeSmokeAndSpecter !== false) {
        filters.push(isSmokeAndSpecterObstruction);
    }
    for (const filter of filters) {
        if (filter(item)) return true;
    }
    return false;
}

function distancesToSegment(
    line: Line,
    startDistance: number,
    endDistance: number,
) {
    const length = utils.distance(line.startPosition, line.endPosition);
    const dx = (line.endPosition.x - line.startPosition.x) / length;
    const dy = (line.endPosition.y - line.startPosition.y) / length;
    return {
        start: { x: dx * startDistance, y: dy * startDistance },
        end: { x: dx * endDistance, y: dy * endDistance },
    };
}

export function getOwlbearDynamicFogDoorSegments(line: Line) {
    const segments: {
        start: Vector2;
        end: Vector2;
    }[] = [];

    const doorMetadata = line.metadata[
        `${constants.OBR_DYNAMIC_FOG_ID}/doors`
    ] as OwlbearDoorMetadata[] | undefined;
    if (doorMetadata === undefined || doorMetadata.length === 0) {
        return [{ start: line.startPosition, end: line.endPosition }];
    }
    doorMetadata.sort((a, b) => a.start.distance - b.start.distance);

    let lastDistance = 0;
    for (const door of doorMetadata) {
        segments.push(
            distancesToSegment(line, lastDistance, door.start.distance),
        );
        if (!door.open) {
            segments.push(
                distancesToSegment(
                    line,
                    door.start.distance,
                    door.end.distance,
                ),
            );
        }
        lastDistance = door.end.distance;
    }

    const lineLength = utils.distance(line.startPosition, line.endPosition);
    if (lastDistance < lineLength) {
        segments.push(distancesToSegment(line, lastDistance, lineLength));
    }

    return segments;
}
