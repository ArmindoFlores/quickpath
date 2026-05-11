import type { Vector2 } from "@owlbear-rodeo/sdk";

export interface MessageEvent {
    data: unknown;
    connectionId: string;
};

export interface QuickpathMessageBase {
    id: string;
    type: string;
}

export interface QuickpathMessageError extends QuickpathMessageBase {
    error: string;
}

export interface QuickpathMessageResponse<T = unknown> extends QuickpathMessageBase {
    result: T;
}

export interface QuickpathMeasureResponseMessage extends QuickpathMessageBase {
    result: string;
}

export interface QuickpathPathfindMessage extends QuickpathMessageBase {
    type: "QUICKPATH_PATHFIND",
    from: Vector2,
    to: Vector2,
}

export type QuickpathMessage = QuickpathPathfindMessage;
