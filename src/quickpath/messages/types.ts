import type { Vector2 } from "@owlbear-rodeo/sdk";
import type { MessageBase } from "@armindoflores/obr-ext-core/types";
import type { Path } from "../grid";

export interface QuickpathMeasureResponseMessage extends MessageBase {
    type: "QUICKPATH_PATHFIND_RESPONSE";
    distance: number;
    path: Path;
}

export interface QuickpathPathfindMessage extends MessageBase {
    type: "QUICKPATH_PATHFIND";
    from: Vector2;
    to: Vector2;
    centerResult?: boolean;
}

export type QuickpathMessageRegistry = {
    QUICKPATH_PATHFIND: {
        request: QuickpathPathfindMessage;
        response: QuickpathMeasureResponseMessage;
    };
}
